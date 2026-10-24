import { describe, expect, it } from "vitest";
import { numbersIn, overclaims, unsupportedFigures } from "@/lib/grounding";

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
