import type { RfpStatus } from "@/lib/generated/prisma";
import type { BadgeVariant } from "@/components/ui/badge";

export const rfpStatusVariant: Record<
  RfpStatus,
  Extract<BadgeVariant, "draft" | "submitted" | "accent" | "success">
> = {
  uploaded: "draft",
  extracting: "submitted",
  extracted: "submitted",
  drafting: "accent",
  drafted: "accent",
  exported: "success",
};

export const rfpStatusLabel: Record<RfpStatus, string> = {
  uploaded: "Uploaded",
  extracting: "Extracting",
  extracted: "Extracted",
  drafting: "Drafting",
  drafted: "Drafted",
  exported: "Exported",
};
