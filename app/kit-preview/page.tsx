import type { Metadata } from "next";
import { KitPreview } from "./kit-preview";

export const metadata: Metadata = {
  title: "Component kit preview",
  robots: { index: false, follow: false },
};

export default function KitPreviewPage() {
  return <KitPreview />;
}
