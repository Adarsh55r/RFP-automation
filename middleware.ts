import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canonicalRedirect } from "@/lib/canonical-host";
import { SITE_URL } from "@/lib/site";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const redirect = canonicalRedirect(
    req.nextUrl,
    req.headers.get("host"),
    SITE_URL,
    process.env.CANONICAL_HOST_REDIRECT === "1",
  );
  if (redirect) {
    return NextResponse.redirect(redirect, 308);
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
