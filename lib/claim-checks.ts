/**
 * Credentials buyers score as pass/fail. If a draft names one that the
 * bidder's library never mentions, the AI may be claiming something the
 * bidder does not hold, which can disqualify a bid or worse. These checks are
 * deterministic and run on every draft, alongside the prompt rules that
 * already forbid inventing credentials.
 */
const CREDENTIALS: { name: string; pattern: RegExp }[] = [
  { name: "SOC 2", pattern: /\bSOC\s*-?\s*2\b/i },
  { name: "SOC 1", pattern: /\bSOC\s*-?\s*1\b/i },
  { name: "ISO 27001", pattern: /\bISO(?:\/IEC)?\s*27001\b/i },
  { name: "ISO 9001", pattern: /\bISO\s*9001\b/i },
  { name: "ISO 14001", pattern: /\bISO\s*14001\b/i },
  { name: "ISO 45001", pattern: /\bISO\s*45001\b/i },
  { name: "ISO 20000", pattern: /\bISO(?:\/IEC)?\s*20000\b/i },
  { name: "ISO 22301", pattern: /\bISO\s*22301\b/i },
  { name: "FedRAMP", pattern: /\bFedRAMP\b/i },
  { name: "StateRAMP", pattern: /\b(StateRAMP|TX-RAMP)\b/i },
  { name: "CMMC", pattern: /\bCMMC\b/i },
  { name: "HITRUST", pattern: /\bHITRUST\b/i },
  { name: "PCI DSS", pattern: /\bPCI[\s-]?DSS\b/i },
  { name: "HIPAA", pattern: /\bHIPAA\b/i },
  { name: "Cyber Essentials", pattern: /\bCyber\s+Essentials\b/i },
  { name: "NIST 800-171", pattern: /\b(NIST\s*)?(SP\s*)?800-171\b/i },
  { name: "NIST 800-53", pattern: /\b(NIST\s*)?(SP\s*)?800-53\b/i },
  { name: "CJIS", pattern: /\bCJIS\b/i },
  { name: "GSA Schedule", pattern: /\bGSA\s+(Schedule|MAS)\b/i },
  { name: "G-Cloud", pattern: /\bG-Cloud\b/i },
  { name: "8(a)", pattern: /\b8\(a\)/i },
  { name: "HUBZone", pattern: /\bHUBZone\b/i },
  { name: "SDVOSB", pattern: /\bSDVOSB\b|service-disabled veteran/i },
  { name: "WOSB", pattern: /\bE?WOSB\b|women-owned small business/i },
  { name: "DBE / MBE / WBE", pattern: /\b(DBE|MBE|WBE|M\/WBE|MWBE)\b/ },
];

const PLACEHOLDER = /\[\[[\s\S]*?\]\]/g;

/** Canonical names of the credentials a text mentions. */
export function credentialsIn(text: string) {
  return CREDENTIALS.filter((c) => c.pattern.test(text)).map((c) => c.name);
}

/** Credentials named in a draft (outside placeholders) that the supported list does not include. */
export function unverifiedCredentials(draft: string, supported: string[]) {
  const claims = credentialsIn(draft.replace(PLACEHOLDER, " "));
  return claims.filter((name) => !supported.includes(name));
}

export function findUnverifiedCredentials(draft: string, libraryText: string) {
  return unverifiedCredentials(draft, credentialsIn(libraryText));
}
