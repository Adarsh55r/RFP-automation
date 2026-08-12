import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // #region agent log
  fetch("http://127.0.0.1:7300/ingest/e0510c8a-6039-4418-bcce-da7cd1d3581a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "91d1a9",
    },
    body: JSON.stringify({
      sessionId: "91d1a9",
      location: "middleware.ts:8",
      message: "middleware invoked",
      data: {
        pathname: req.nextUrl.pathname,
      },
      timestamp: Date.now(),
      hypothesisId: "H3",
      runId: "dev-manifest",
    }),
  }).catch(() => {});
  // #endregion

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
