"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  Building2,
  FileText,
  Pencil,
  Plus,
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
  libraryTypeLabel,
  libraryTypeSingular,
  libraryTypes,
} from "@/lib/library";
import type { LibraryItem, LibraryItemType } from "@/lib/generated/prisma";
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
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

const typeIcons = {
  case_study: FileText,
  team_bio: Users,
  certification: Award,
  company_profile: Building2,
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

export function LibraryView({ items }: { items: LibraryItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeType, setActiveType] = useState<LibraryItemType>("case_study");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
        setError(result.error);
        return;
      }

      toast({
        variant: "success",
        title:
          editor.mode === "create"
            ? `${libraryTypeSingular[editor.type]} added`
            : `${libraryTypeSingular[editor.type]} updated`,
        description:
          "Drafts will pull from this when writing agency-specific sections.",
      });

      setEditor(null);
      router.refresh();
    });
  };

  const handleDelete = (item: LibraryItemView) => {
    const confirmed = window.confirm(
      `Delete “${item.title}”? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteLibraryItem(item.id);
      if (!result.ok) {
        toast({
          variant: "error",
          title: "Could not delete",
          description: result.error,
        });
        return;
      }

      toast({
        variant: "success",
        title: "Removed from library",
      });
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
                  "inline-flex h-10 items-center gap-2 rounded-control border px-4 font-sans text-sm font-medium transition-[color,border-color,background-color] duration-hover ease-out",
                  selected
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border bg-surface-raised text-slate hover:border-brand/60 hover:text-ink",
                  focusRing,
                )}
              >
                {libraryTypeLabel[type]}
                <span className="font-mono text-xs tracking-wide">
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
              <Card className="group relative h-full p-5 transition-shadow duration-hover ease-out hover:shadow-[0_8px_24px_rgb(11_31_51_/_0.08)]">
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
                      "inline-flex h-8 w-8 items-center justify-center rounded-control text-slate transition-colors duration-hover ease-out hover:bg-surface hover:text-brand",
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
                  drafts sound like your agency — not generic filler.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-4">
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
                        ? "e.g. Fintech KYC portal — 40% faster onboarding"
                        : editor.type === "team_bio"
                          ? "e.g. Priya Sharma — Delivery Lead"
                          : editor.type === "certification"
                            ? "e.g. ISO 27001:2022"
                            : "e.g. About DraftWin Agency"
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
