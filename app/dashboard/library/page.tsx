import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LibraryView } from "@/components/dashboard/library-view";
import { requireDashboardUser } from "@/lib/dashboard";
import { getLibraryItemsForUser } from "@/lib/library-data";

export const metadata: Metadata = {
  title: "Content Library",
  robots: { index: false, follow: false },
};

export default async function LibraryPage() {
  const user = await requireDashboardUser();
  if (!user) {
    redirect("/sign-in");
  }

  const items = await getLibraryItemsForUser(user.id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header>
        <p className="font-mono text-xs tracking-wide text-slate uppercase">
          Content library
        </p>
        <h1 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">
          Agency content that drafts can reuse
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate md:text-base">
          Case studies, team bios, certifications, and your company profile
          give DraftWin real material to cite — so proposals sound like your
          agency, not generic AI text.
        </p>
      </header>

      <LibraryView items={items} />
    </div>
  );
}
