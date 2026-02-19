import { describe, expect, it } from "vitest";
import { parseCitation } from "./citations";

describe("parseCitation", () => {
  it("parses PHAK chapter references to pdf links", () => {
    const refs = parseCitation("FAA-H-8083-25C, Ch 3");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      label: "PHAK Ch 3",
      type: "pdf",
      url: "/pdfs/faa-h-8083-25c.pdf",
      page: 72,
    });
  });

  it("parses ACS and CFR multi-section references", () => {
    const refs = parseCitation("ACS UA.II.A.K1; 14 CFR §107.15, §107.49");
    expect(refs.some((r) => r.label === "ACS UA.II.A.K1")).toBe(true);
    expect(refs.some((r) => r.label === "14 CFR §107.15")).toBe(true);
    expect(refs.some((r) => r.label === "14 CFR §107.49")).toBe(true);
  });

  it("parses AIM references and maps chapter url", () => {
    const refs = parseCitation("AIM 4-1-2");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      label: "AIM 4-1-2",
      type: "external",
      url: "https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap4.html",
    });
  });
});
