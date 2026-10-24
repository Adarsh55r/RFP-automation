import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LibraryView } from "@/components/dashboard/library-view";
import { WebsiteImportCard } from "@/components/dashboard/website-import-card";
import { isLibraryItemType } from "@/lib/library";
import { requireDashboardUser } from "@/lib/dashboard";
import { getLibraryItemsForClerkUser } from "@/lib/library-data";

export const metadata: Metadata = {
  title: "Content Library",
  robots: { index: false, follow: false },
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    redirect("/sign-in");
  }

  const [user, items] = await Promise.all([
    requireDashboardUser(),
    getLibraryItemsForClerkUser(clerkId),
  ]);
  if (!user) {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header>
        <p className="font-mono text-xs tracking-wide text-slate uppercase">
          Content library
        </p>
        <h1 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">
          Company content that drafts can reuse
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate md:text-base">
          Case studies, team bios, certifications, saved answers, and your
          company profile give DraftBid AI real material to cite — so proposals
          sound like your company, not generic AI text.
        </p>
      </header>

      {items.length < 3 ? <WebsiteImportCard /> : null}

      <LibraryView items={items} initialType={type && isLibraryItemType(type) ? type : undefined} />
    </div>
  );
}
