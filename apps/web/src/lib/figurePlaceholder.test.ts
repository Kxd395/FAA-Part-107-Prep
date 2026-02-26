import { describe, expect, it } from "vitest";
import { isUnresolvedFigurePlaceholderText } from "./figurePlaceholder";

describe("isUnresolvedFigurePlaceholderText", () => {
  it("detects direct insert placeholders", () => {
    expect(isUnresolvedFigurePlaceholderText("Insert the chart excerpt from your course.")).toBe(
      true
    );
  });

  it("detects figure-prefixed insert placeholders", () => {
    expect(
      isUnresolvedFigurePlaceholderText("FIGURE\nInsert the chart excerpt from your course.")
    ).toBe(true);
    expect(
      isUnresolvedFigurePlaceholderText("Figure: Insert sectional chart image here.")
    ).toBe(true);
  });

  it("ignores real figure context text", () => {
    expect(
      isUnresolvedFigurePlaceholderText("KMDW 121853Z 32016G22KT 10SM BKN060 18/07 A2992")
    ).toBe(false);
  });
});
