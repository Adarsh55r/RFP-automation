import { describe, expect, it } from "vitest";
import { findUnverifiedCredentials } from "@/lib/claim-checks";
import { LIMITED_LIBRARY } from "../fixtures/rfps";

const library = LIMITED_LIBRARY.map((item) => `${item.title}\n${item.content}`).join("\n");

describe("findUnverifiedCredentials", () => {
  it("flags certifications the draft claims but the library never mentions", () => {
    const draft = "We hold a current SOC 2 Type II report, are ISO 27001 certified and FedRAMP High authorized.";
    expect(findUnverifiedCredentials(draft, library).sort()).toEqual(["FedRAMP", "ISO 27001", "SOC 2"].sort());
  });

  it("does not flag credentials the library supports", () => {
    expect(findUnverifiedCredentials("We are a Microsoft Solutions Partner.", library)).toEqual([]);
  });

  it("does not flag a credential mentioned inside a placeholder", () => {
    expect(findUnverifiedCredentials("[[Confirm: SOC 2 Type II report date]]", library)).toEqual([]);
  });

  it("matches common spellings", () => {
    expect(findUnverifiedCredentials("We are ISO/IEC 27001:2022 and SOC2 compliant.", library).sort()).toEqual(["ISO 27001", "SOC 2"]);
  });
});
