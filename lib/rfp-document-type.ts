export const RFP_DOCUMENT_TYPES = [
  "rfp",
  "public_tender",
  "rfi",
  "security_questionnaire",
  "pitch_request",
  "other",
] as const;

export type RfpDocumentType = (typeof RFP_DOCUMENT_TYPES)[number];

export const rfpDocumentTypeLabel: Record<RfpDocumentType, string> = {
  rfp: "Commercial RFP",
  public_tender: "Public-sector RFP / tender",
  rfi: "RFI / supplier questionnaire",
  security_questionnaire: "Security questionnaire",
  pitch_request: "Pitch / proposal request",
  other: "Other pack",
};

export function isRfpDocumentType(value: unknown): value is RfpDocumentType {
  return (
    typeof value === "string" &&
    RFP_DOCUMENT_TYPES.includes(value as RfpDocumentType)
  );
}
