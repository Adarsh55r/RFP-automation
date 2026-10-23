import type { Metadata } from "next";
import { SignUpView } from "@/components/auth/sign-up-view";
import { FunnelBeacon } from "@/components/marketing/funnel-beacon";
import { isAttributionSource } from "@/lib/funnel-sources";
import { parsePlanId } from "@/lib/intended-plan";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false, follow: false },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; seg?: string }>;
}) {
  const { plan, seg } = await searchParams;
  const planId = parsePlanId(plan);

  return (
    <>
      <FunnelBeacon event="start_signup" />
      <SignUpView planId={planId} segment={isAttributionSource(seg) ? seg : undefined} />
    </>
  );
}
