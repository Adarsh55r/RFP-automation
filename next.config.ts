import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep PDF libs external so webpack does not rebundle pdf.js.
  serverExternalPackages: ["unpdf", "pdfjs-dist"],
};

export default nextConfig;
