import { describe, expect, it } from "vitest";
import { bidderNotes, numbersIn, overclaims, rateConflicts, unsupportedFigures } from "@/lib/grounding";

const library = `Pricing: Managed services $95 per user per month. Server management $150 per server per month.
On-site visits and project work: $125 per hour. Critical response within 30 minutes. 99.9% server uptime in 2025.
Founded in 2014; 19 years in IT.`;
const rfp = "The current environment includes approximately 15 workstations and approximately 5 servers. Proposals valid for at least 90 days.";
const sources = `${library}\n${rfp}`;

describe("figures in a draft", () => {
  it("flags prices and rates found in neither the library nor the RFP", () => {
    const invented = [
      "| Line item | Monthly | Annual |",
      "| --- | --- | --- |",
      "| Managed IT Services: 15 workstations | $900.00 | $10,800.00 |",
      "| Managed Server Support: 5 servers | $1,250.00 | $15,000.00 |",
      "| Backup and Disaster Recovery | $450.00 | $5,400.00 |",
      "",
      "Project work is billed at $175 per hour.",
    ].join("\n");
    const flagged = unsupportedFigures(invented, sources);
    expect(flagged).toHaveLength(4);
    expect(flagged[0]).toContain("$900.00");
    expect(flagged.at(-1)).toBe("Project work is billed at $175 per hour.");
  });

  it("accepts library figures and arithmetic shown on them", () => {
    const grounded = [
      "Monthly price: 15 users × $95 = $1,425, plus 5 servers × $150 = $750.",
      "",
      "| Line item | Unit price | Quantity | Monthly | Annual |",
      "| --- | --- | --- | --- | --- |",
      "| Managed services | $95 | 15 | $1,425 | $17,100 |",
      "| Server management | $150 | 5 | $750 | $9,000 |",
      "| Total | | | $2,175 | $26,100 |",
      "",
      "Critical issues get a response within 30 minutes [S4]. Server uptime was 99.9% in 2025 [S2].",
      "This proposal is valid for 90 days. Extra work is $125 per hour, or [[Amount]] for after-hours visits.",
    ].join("\n");
    expect(unsupportedFigures(grounded, sources)).toEqual([]);
  });

  it("reads numbers written in words and with multipliers", () => {
    expect([...numbersIn("three references, a $1.2M contract and twenty sites")]).toEqual(expect.arrayContaining([3, 1.2, 1200000, 20]));
    expect(unsupportedFigures("A contract worth $1.2 million over three years.", "Contract value $1,200,000; three years")).toEqual([]);
  });
});

describe("absolute claims", () => {
  it("flags guarantees and compliance claims the library never makes", () => {
    const draft = "We apply a zero-trust model. All work is in full compliance with the RFP. We review every alert.";
    expect(overclaims(draft, library)).toEqual([
      "We apply a zero-trust model.",
      "All work is in full compliance with the RFP.",
    ]);
    expect(overclaims("We operate a zero-trust model [S9].", "Our zero-trust architecture was audited in 2025.")).toEqual([]);
  });
});

describe("figures matched like for like (from the second Harrison draft)", () => {
  const library2 = "Normal: response within 1 business day. In the first 30 days we document every device. Weeks 2 to 3: audit. Week 4: written findings. Critical: response within 30 minutes. $95 per user per month.";
  const rfp2 = "Proposals valid for at least 90 days. Identify pricing differences for a one-year, two-year, or three-year term.";
  const src = `${library2}\n${rfp2}`;

  it("flags data allowances, percentages and durations the sources never state", () => {
    expect(unsupportedFigures("Standard backup storage allowance is 1 TB per server and 100 GB per Microsoft 365 user.", src)).toHaveLength(1);
    expect(unsupportedFigures("Annual price increases: 0% during the initial contract term.", src)).toHaveLength(1);
    // "30 minutes" in the library does not support "30 hours".
    expect(unsupportedFigures("Payment is due within 30 hours.", src)).toHaveLength(1);
  });

  it("accepts durations in the same unit, however they are written", () => {
    expect(unsupportedFigures("The transition takes four weeks. Normal requests get a response within 1 business day.", src)).toEqual([]);
    expect(unsupportedFigures("We document everything in the first 30 days; the proposal is valid for 90 days.", src)).toEqual([]);
  });
});

describe("conflicting prices", () => {
  it("finds the same per-unit price stated differently in two parts", () => {
    expect(
      rateConflicts([
        { title: "B. Executive Summary", content: "Our standard pricing is $99 per user per month." },
        { title: "G. Cost Proposal", content: "| Managed services | $95 per user | 15 |\n\nServers are $150 per server." },
        { title: "Exhibit A", content: "$95 per user × 15 users = $1,425. [[Amount]] per server for extras." },
      ]),
    ).toEqual([
      {
        unit: "user",
        amounts: [
          { amount: "$99", where: ["B. Executive Summary"] },
          { amount: "$95", where: ["G. Cost Proposal", "Exhibit A"] },
        ],
      },
    ]);
  });
});

describe("notes to the bidder left in the text", () => {
  it("are listed, while ordinary prose is not", () => {
    const md = [
      "The company's authorized representative must verify the company's litigation history before submission.",
      "| General Liability | Current insurance carrier — to be confirmed | $1,000,000, subject to verification |",
      "Any storage allowance must be verified with the backup provider before submission.",
      "Changes must be reviewed and approved by the City before they are made.",
      "We add the device to the City's domain. Our cyber liability limit is [[Confirm: limit, to be confirmed]].",
    ].join("\n");
    expect(bidderNotes(md)).toEqual([
      "The company's authorized representative must verify the company's litigation history before submission.",
      "General Liability · Current insurance carrier — to be confirmed · $1,000,000, subject to verification",
      "Any storage allowance must be verified with the backup provider before submission.",
    ]);
  });
});
