export const RFP_DOCUMENT_TYPES = [
  "rfp",
  "vendor_empanelment",
  "security_questionnaire",
  "pitch_request",
  "other",
] as const;

export type RfpDocumentType = (typeof RFP_DOCUMENT_TYPES)[number];

export const rfpDocumentTypeLabel: Record<RfpDocumentType, string> = {
  rfp: "Traditional RFP",
  vendor_empanelment: "Vendor empanelment",
  security_questionnaire: "Security questionnaire",
  pitch_request: "Pitch request",
  other: "Other pack",
};

export function isRfpDocumentType(value: unknown): value is RfpDocumentType {
  return (
    typeof value === "string" &&
    RFP_DOCUMENT_TYPES.includes(value as RfpDocumentType)
  );
}
