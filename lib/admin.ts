import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

/** Comma-separated emails in ADMIN_EMAILS may open /admin. */
function allowedAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** The signed-in user's verified email if they are an admin, otherwise null. */
export async function getAdminEmail() {
  const allowed = allowedAdminEmails();
  if (allowed.length === 0) return null;
  const user = await currentUser();
  if (!user) return null;
  const verified = user.emailAddresses
    .filter((address) => address.verification?.status === "verified")
    .map((address) => address.emailAddress.toLowerCase());
  return verified.find((email) => allowed.includes(email)) ?? null;
}

/** For admin pages: anyone else gets a plain 404, so the panel's existence isn't revealed. */
export async function requireAdminPage() {
  const email = await getAdminEmail();
  if (!email) notFound();
  return email;
}

/** For admin server actions. */
export async function assertAdmin() {
  const email = await getAdminEmail();
  if (!email) throw new Error("Not authorized.");
  return email;
}
