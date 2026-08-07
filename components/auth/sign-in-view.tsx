"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { focusRing } from "@/lib/focus";
import { cn } from "@/lib/cn";

export function SignInView() {
  return (
    <AuthShell
      title="Log in"
      subtitle="Pick up where you left your last RFP draft."
      footer={
        <p>
          New to DraftWin?{" "}
          <Link
            href="/sign-up?plan=free"
            className={cn("font-semibold text-brand", focusRing, "rounded-control")}
          >
            Start free
          </Link>
        </p>
      }
    >
      <SignIn
        appearance={clerkAppearance}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
      />
    </AuthShell>
  );
}
