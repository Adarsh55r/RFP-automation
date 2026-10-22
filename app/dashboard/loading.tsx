import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown the moment a dashboard link is clicked, while the next page loads.
 * The sidebar and top bar stay put; only the content area is replaced.
 */
export default function DashboardLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading…</span>
      <header>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-9 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-[28rem] max-w-full" />
      </header>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index} className="flex flex-col gap-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-4 w-40" />
          </Card>
        ))}
      </div>
      <Card className="flex flex-col gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </Card>
    </div>
  );
}
