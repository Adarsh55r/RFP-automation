// #region agent log
fetch("http://127.0.0.1:7300/ingest/e0510c8a-6039-4418-bcce-da7cd1d3581a", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": "91d1a9",
  },
  body: JSON.stringify({
    sessionId: "91d1a9",
    location: "components/dashboard/index.ts:1",
    message: "dashboard barrel evaluated",
    data: { runtime: typeof window === "undefined" ? "server" : "client" },
    timestamp: Date.now(),
    hypothesisId: "H1",
    runId: "dashboard-ssr",
  }),
}).catch(() => {});
// #endregion

export { DashboardShell } from "./dashboard-shell";
export { dashboardNavItems } from "./dashboard-nav";
export { RecentRfps } from "./recent-rfps";
export { RfpExtractionPanel } from "./rfp-extraction-panel";
export { RfpUploadZone } from "./rfp-upload-zone";
export { StatCards } from "./stat-cards";
