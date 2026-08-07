import type { Metadata } from "next";
import { SignUpView } from "@/components/auth/sign-up-view";
import { parsePlanId } from "@/lib/intended-plan";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false, follow: false },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const planId = parsePlanId(plan);

  return <SignUpView planId={planId} />;
}
