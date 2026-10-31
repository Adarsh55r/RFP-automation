"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { importFromWebsite } from "@/lib/actions/website-import";
import { useAlert } from "@/components/ui/sweet-alert";

/** Drafts library items from the user's own website, on request. */
export function WebsiteImportCard() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const alert = useAlert();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await importFromWebsite(url);
      if (!result.ok) {
        alert.error("Import didn't work", result.error);
        return;
      }
      const parts = [
        result.created.length > 0
          ? `Added ${result.created.length} draft item${result.created.length === 1 ? "" : "s"} from ${result.pagesRead} page${result.pagesRead === 1 ? "" : "s"}. Check each one before you rely on it.`
          : `Read ${result.pagesRead} page${result.pagesRead === 1 ? "" : "s"} but found nothing specific enough to add.`,
        result.keptExistingProfile ? "Your existing company profile was kept." : "",
        result.skippedForLimits > 0 ? `${result.skippedForLimits} item(s) did not fit your library's limits.` : "",
        result.skippedByRobots > 0 ? `${result.skippedByRobots} page(s) were skipped because the site's robots.txt asks tools not to read them.` : "",
      ];
      alert.success(result.created.length > 0 ? "Imported from your website" : "Nothing new to add", parts.filter(Boolean).join(" "));
      router.refresh();
    });
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Globe className="mt-1 size-5 shrink-0 text-brand" aria-hidden />
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Start from your website</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate">
            DraftBid AI reads your home page and up to five pages about your company, services and work (following
            the site&apos;s robots.txt), then drafts a company profile and case studies for you to check. It only
            uses what the pages say and leaves gaps for anything missing.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="website-url" className="sr-only">
          Your website address
        </label>
        <Input
          id="website-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="yourcompany.com"
          inputMode="url"
          autoComplete="url"
          maxLength={300}
          disabled={pending}
        />
        <Button type="submit" variant="secondary" disabled={pending || url.trim().length < 4} className="gap-2 sm:w-fit">
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
          {pending ? "Reading your site…" : "Import"}
        </Button>
      </form>
    </Card>
  );
}
