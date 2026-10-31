"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  Building2,
  FileText,
  MessageSquareText,
  Pencil,
  Plus,
  Upload,
  Trash2,
  Users,
} from "lucide-react";
import {
  createLibraryItem,
  deleteLibraryItem,
  updateLibraryItem,
} from "@/lib/actions/library";
import {
  libraryEmptyCopy,
  libraryTypeHint,
  LIBRARY_ITEM_MAX_CHARS,
  libraryTypeLabel,
  libraryTypeSingular,
  libraryTypes,
} from "@/lib/library";
import type { LibraryItem, LibraryItemType } from "@/lib/generated/prisma";
import { TEMPLATE_SEGMENTS, templatesFor } from "@/lib/library-templates";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAlert } from "@/components/ui/sweet-alert";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

const typeIcons = {
  case_study: FileText,
  team_bio: Users,
  certification: Award,
  company_profile: Building2,
  saved_answer: MessageSquareText,
} as const;

type EditorState = {
  mode: "create" | "edit";
  itemId?: string;
  type: LibraryItemType;
  title: string;
  content: string;
};

function serializeItem(item: LibraryItem) {
  return {
    ...item,
    createdAt:
      typeof item.createdAt === "string"
        ? item.createdAt
        : item.createdAt.toISOString(),
  };
}

type LibraryItemView = ReturnType<typeof serializeItem>;

export function LibraryView({
  items,
  initialType = "case_study",
}: {
  items: LibraryItem[];
  initialType?: LibraryItemType;
}) {
  const router = useRouter();
  const alert = useAlert();
  const [activeType, setActiveType] = useState<LibraryItemType>(initialType);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const uploadInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Past proposals, résumés and certificates usually exist as files already.
  const uploadDocument = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", activeType);
      const response = await fetch("/api/library/upload", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; created?: string[]; skippedForLimits?: number; hiddenRemoved?: number }
        | null;
      if (!response.ok || !payload?.created) throw new Error(payload?.error ?? "Upload failed. Try again.");
      alert.success(
        "Added to your library",
        [
          `Added ${payload.created.length === 1 ? `“${payload.created[0]}”` : `${payload.created.length} parts`}. Check the text and remove anything you do not want drafts to reuse.`,
          payload.skippedForLimits ? `${payload.skippedForLimits} part(s) did not fit your library's limits.` : "",
          payload.hiddenRemoved ? "Hidden text in the file was left out." : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      router.refresh();
    } catch (uploadError) {
      alert.error("Upload failed", uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const serialized = useMemo(
    () => items.map(serializeItem),
    [items],
  );

  const filtered = useMemo(
    () => serialized.filter((item) => item.type === activeType),
    [serialized, activeType],
  );

  const counts = useMemo(() => {
    return libraryTypes.reduce(
      (acc, type) => {
        acc[type] = serialized.filter((item) => item.type === type).length;
        return acc;
      },
      {} as Record<LibraryItemType, number>,
    );
  }, [serialized]);

  const hasCompanyProfile = counts.company_profile > 0;
  const showAddAction =
    activeType !== "company_profile" || !hasCompanyProfile;

  const openCreate = () => {
    setError(null);
    setEditor({
      mode: "create",
      type: activeType,
      title: "",
      content: "",
    });
  };

  const openEdit = (item: LibraryItemView) => {
    setError(null);
    setEditor({
      mode: "edit",
      itemId: item.id,
      type: item.type,
      title: item.title,
      content: item.content,
    });
  };

  const closeEditor = () => {
    if (pending) {
      return;
    }
    setEditor(null);
    setError(null);
  };

  const handleSave = () => {
    if (!editor) {
      return;
    }

    if (editor.title.trim().length < 2) {
      setError("Enter a title (at least 2 characters).");
      return;
    }
    if (editor.content.trim().length < 10) {
      setError("Add enough content for drafts to use (at least 10 characters).");
      return;
    }

    setError(null);
    startTransition(async () => {
      const payload = {
        type: editor.type,
        title: editor.title,
        content: editor.content,
      };

      const result =
        editor.mode === "create"
          ? await createLibraryItem(payload)
          : await updateLibraryItem(editor.itemId!, payload);

      if (!result.ok) {
        alert.error("Couldn't save it", result.error);
        return;
      }

      alert.success(
        editor.mode === "create"
          ? `${libraryTypeSingular[editor.type]} added`
          : `${libraryTypeSingular[editor.type]} updated`,
        "Drafts will pull from this when writing company-specific sections.",
      );

      setEditor(null);
      router.refresh();
    });
  };

  const handleDelete = async (item: LibraryItemView) => {
    const confirmed = await alert.confirm({
      title: `Delete “${item.title}”?`,
      text: "This cannot be undone. Drafts you already made keep their text.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteLibraryItem(item.id);
      if (!result.ok) {
        alert.error("Could not delete", result.error);
        return;
      }

      alert.success("Removed from library");
      router.refresh();
    });
  };

  const EmptyIcon = typeIcons[activeType];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div
          role="tablist"
          aria-label="Library content types"
          className="flex flex-wrap gap-2"
        >
          {libraryTypes.map((type) => {
            const selected = activeType === type;
            return (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveType(type)}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full border px-4 font-sans text-sm font-medium transition-all duration-200 ease-out",
                  selected
                    ? "border-transparent bg-brand-gradient text-on-brand shadow-[0_8px_20px_-8px_rgb(var(--glow)/0.8)]"
                    : "border-border bg-surface-raised/80 text-slate hover:-translate-y-0.5 hover:border-brand/50 hover:text-ink",
                  focusRing,
                )}
              >
                {libraryTypeLabel[type]}
                <span className={cn("rounded-full px-1.5 font-mono text-[11px] tracking-wide", selected ? "bg-black/10" : "bg-surface-sunken")}>
                  {counts[type]}
                </span>
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          onClick={openCreate}
          disabled={
            pending ||
            (activeType === "company_profile" && hasCompanyProfile)
          }
          className="w-full gap-2 sm:w-fit"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add {libraryTypeSingular[activeType].toLowerCase()}
        </Button>
        <input
          ref={uploadInput}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) uploadDocument(file);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => uploadInput.current?.click()}
          disabled={uploading || pending || (activeType === "company_profile" && hasCompanyProfile)}
          className="w-full gap-2 sm:w-fit"
          title="Add the text of a PDF or Word file, such as a past proposal or a résumé"
        >
          <Upload className="h-4 w-4" aria-hidden />
          {uploading ? "Reading…" : "Upload a document"}
        </Button>
      </div>


      {activeType === "company_profile" && hasCompanyProfile ? (
        <p className="text-sm text-slate">
          Keep one company profile blurb — edit the existing card when your
          positioning changes.
        </p>
      ) : (
        <p className="text-sm text-slate">{libraryTypeHint[activeType]}</p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={EmptyIcon}
          headline={libraryEmptyCopy[activeType].headline}
          description={libraryEmptyCopy[activeType].description}
          action={
            showAddAction ? (
              <Button type="button" onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" aria-hidden />
                Add your first {libraryTypeSingular[activeType].toLowerCase()}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <li key={item.id}>
              <Card className="group relative h-full p-5 transition-shadow duration-hover ease-out hover:shadow-[var(--shadow-lg)]">
                <div className="pr-16">
                  <p className="font-mono text-xs tracking-wide text-slate uppercase">
                    {libraryTypeSingular[item.type]}
                  </p>
                  <h2 className="mt-2 font-sans text-base font-semibold text-ink">
                    {item.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate">
                    {item.content}
                  </p>
                </div>

                <div
                  className={cn(
                    "absolute top-4 right-4 flex items-center gap-1",
                    "opacity-0 transition-opacity duration-hover ease-out",
                    "group-hover:opacity-100 group-focus-within:opacity-100",
                    "max-md:opacity-100",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    disabled={pending}
                    aria-label={`Edit ${item.title}`}
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-control text-slate transition-colors duration-hover ease-out hover:bg-surface-sunken hover:text-brand",
                      focusRing,
                    )}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={pending}
                    aria-label={`Delete ${item.title}`}
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-control text-slate transition-colors duration-hover ease-out hover:bg-danger/10 hover:text-danger",
                      focusRing,
                    )}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={Boolean(editor)}
        onOpenChange={(open) => {
          if (!open) {
            closeEditor();
          }
        }}
      >
        <DialogContent className="max-w-xl">
          {editor ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {editor.mode === "create" ? "Add" : "Edit"}{" "}
                  {libraryTypeSingular[editor.type].toLowerCase()}
                </DialogTitle>
                <DialogDescription>
                  {libraryTypeHint[editor.type]} This content is what makes AI
                  drafts sound like your company — not generic filler.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-4">
                {editor.mode === "create" && templatesFor(editor.type).length > 0 ? (
                  <label className="flex flex-col gap-2 text-sm font-medium text-ink">
                    Start from a template (optional)
                    <Select
                      value=""
                      disabled={pending}
                      onChange={async (event) => {
                        const template = templatesFor(editor.type).find((item) => item.id === event.target.value);
                        if (!template) return;
                        if (
                          (editor.title.trim() || editor.content.trim()) &&
                          !(await alert.confirm({
                            title: "Use this template?",
                            text: "It replaces what you have typed so far.",
                            confirmLabel: "Use template",
                          }))
                        ) {
                          return;
                        }
                        setEditor((current) =>
                          current ? { ...current, title: template.title, content: template.content } : current,
                        );
                      }}
                    >
                      <option value="">Choose a template…</option>
                      {templatesFor(editor.type).map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.segment ? `${TEMPLATE_SEGMENTS[template.segment]}: ` : ""}
                          {template.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                ) : null}
                {/\[\[[^\]]+\]\]/.test(editor.content) ? (
                  <p className="text-xs text-slate">
                    Replace every [[placeholder]] with your real details. Anything left in brackets shows up as a
                    gap in drafts.
                  </p>
                ) : null}

                <label className="flex flex-col gap-2">
                  <span className="font-sans text-sm font-medium text-ink">
                    Title
                  </span>
                  <Input
                    value={editor.title}
                    onChange={(event) =>
                      setEditor((current) =>
                        current
                          ? { ...current, title: event.target.value }
                          : current,
                      )
                    }
                    placeholder={
                      editor.type === "case_study"
                        ? "e.g. County health portal — 40% faster intake"
                        : editor.type === "team_bio"
                          ? "e.g. Jordan Lee — Delivery Lead"
                          : editor.type === "certification"
                            ? "e.g. SOC 2 Type II (2026)"
                            : editor.type === "saved_answer"
                              ? "e.g. Describe your incident response process"
                              : "e.g. About Acme Consulting"
                    }
                    aria-invalid={Boolean(error && editor.title.trim().length < 2)}
                    disabled={pending}
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="font-sans text-sm font-medium text-ink">
                    Content
                  </span>
                  <Textarea
                    value={editor.content}
                    onChange={(event) =>
                      setEditor((current) =>
                        current
                          ? { ...current, content: event.target.value }
                          : current,
                      )
                    }
                    maxLength={LIBRARY_ITEM_MAX_CHARS}
                    rows={8}
                    placeholder="Write the reusable copy drafts should pull from…"
                    aria-invalid={Boolean(error && editor.content.trim().length < 10)}
                    disabled={pending}
                    className="min-h-40"
                  />
                </label>

                {error ? (
                  <p className="rounded-control border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {error}
                  </p>
                ) : null}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeEditor}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
