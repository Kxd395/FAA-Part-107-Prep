import { describe, expect, it } from "vitest";
import { extractCitationText, mergeCitations } from "./citationContext";

describe("citationContext", () => {
  it("extracts supported citation patterns from explanation text", () => {
    const extracted = extractCitationText(
      "Wrong because this conflicts with AIM 7-1-31 and 14 CFR §107.31. See ACS UA.III.B.K1k."
    );

    expect(extracted).toContain("AIM 7-1-31");
    expect(extracted).toContain("14 CFR §107.31");
    expect(extracted).toContain("ACS UA.III.B.K1k");
  });

  it("merges citations without duplicates", () => {
    const merged = mergeCitations(
      "ACS UA.III.B.K1k; AIM 7-1-31",
      "AIM 7-1-31; 14 CFR §107.31"
    );

    expect(merged).toContain("ACS UA.III.B.K1k");
    expect(merged).toContain("AIM 7-1-31");
    expect(merged).toContain("14 CFR §107.31");
    expect(merged.match(/AIM 7-1-31/g)?.length ?? 0).toBe(1);
  });
});
