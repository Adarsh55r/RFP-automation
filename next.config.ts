import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep PDF libs external so webpack does not rebundle pdf.js or pdfmake.
  serverExternalPackages: ["unpdf", "pdfjs-dist", "pdfmake"],
};

export default nextConfig;
