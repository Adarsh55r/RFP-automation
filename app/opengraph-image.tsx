import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview image shown when a DraftBid AI link is shared (LinkedIn, X, Slack, WhatsApp, search results). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0a2540 0%, #0b2f3a 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="76" height="76" viewBox="0 0 32 32">
            <path d="M7 3.5h7.5a12.5 12.5 0 0 1 0 25H7A3 3 0 0 1 4 25.5v-19a3 3 0 0 1 3-3Z" fill="#16A085" />
            <path d="M14.5 8.5Q15.1 15.4 22 16Q15.1 16.6 14.5 23.5Q13.9 16.6 7 16Q13.9 15.4 14.5 8.5Z" fill="#F2B04A" />
          </svg>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
            DraftBid<span style={{ color: "#F2B04A", marginLeft: 10 }}>AI</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            Turn any RFP into a compliant first draft.
          </div>
          <div style={{ fontSize: 32, color: "rgba(255,255,255,0.78)", maxWidth: 980, lineHeight: 1.3 }}>
            A requirements checklist, and a draft written from your own documents with gaps flagged.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#F2B04A" }}>draftbidai.com · Start free</div>
      </div>
    ),
    size,
  );
}
