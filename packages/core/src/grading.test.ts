import { describe, expect, it } from "vitest";
import {
  nextIntervalDaysFromQuality,
  qualityFromOutcomeConfidence,
  sessionQueueDecisionFromQuality,
} from "./grading";

describe("grading quality mapping", () => {
  it("maps outcome + confidence to expected quality score", () => {
    expect(qualityFromOutcomeConfidence("correct", 5)).toBe(5);
    expect(qualityFromOutcomeConfidence("correct", 3)).toBe(4);
    expect(qualityFromOutcomeConfidence("correct", 1)).toBe(3);

    expect(qualityFromOutcomeConfidence("incorrect", 1)).toBe(2);
    expect(qualityFromOutcomeConfidence("incorrect", 3)).toBe(1);
    expect(qualityFromOutcomeConfidence("incorrect", 5)).toBe(0);
  });

  it("uses fallback confidence when value is missing", () => {
    expect(qualityFromOutcomeConfidence("correct", null)).toBe(4);
    expect(qualityFromOutcomeConfidence("incorrect", null)).toBe(1);
  });
});

describe("grading queue decisions", () => {
  it("removes only high-quality outcomes from queue", () => {
    expect(sessionQueueDecisionFromQuality(5)).toEqual({
      removeFromQueue: true,
      gapMin: null,
      gapMax: null,
    });

    expect(sessionQueueDecisionFromQuality(3)).toEqual({
      removeFromQueue: false,
      gapMin: 5,
      gapMax: 8,
    });

    expect(sessionQueueDecisionFromQuality(0)).toEqual({
      removeFromQueue: false,
      gapMin: 1,
      gapMax: 2,
    });
  });
});

describe("grading interval scheduling", () => {
  it("updates interval from quality score and clamps to bounds", () => {
    expect(nextIntervalDaysFromQuality(6, 5, 1, 30)).toBe(15);
    expect(nextIntervalDaysFromQuality(6, 4, 1, 30)).toBe(12);
    expect(nextIntervalDaysFromQuality(6, 3, 1, 30)).toBe(8);
    expect(nextIntervalDaysFromQuality(6, 2, 1, 30)).toBe(1);

    expect(nextIntervalDaysFromQuality(null, 5, 1, 30)).toBe(4);
    expect(nextIntervalDaysFromQuality(40, 5, 1, 30)).toBe(30);
  });
});
