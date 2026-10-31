"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Catches a failed dashboard page (a database hiccup, a timeout) inside the
 * dashboard, so the sidebar stays and the user can retry instead of seeing a
 * blank crash screen.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-12">
      <Card className="flex flex-col gap-4" role="alert">
        <p className="font-mono text-xs tracking-wide text-slate uppercase">
          Something went wrong
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          This page didn&apos;t load
        </h1>
        <p className="text-sm leading-relaxed text-slate">
          It is usually a brief connection problem. Your RFPs, drafts, and
          library are safe. Try again, and if it keeps happening, email us.
        </p>
        <div className="flex flex-wrap gap-4">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Button asChild variant="secondary">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
