import { describe, expect, it } from "vitest";
import { computeResponseTimeTelemetry } from "./responseTimeTelemetry";

describe("computeResponseTimeTelemetry", () => {
  it("computes null/zero rates and percentiles", () => {
    const attempts = Array.from({ length: 25 }, (_, index) => ({
      attemptId: `a-${index}`,
      userId: "pilot",
      questionKey: `k-${index}`,
      questionId: `Q-${index}`,
      timestamp: new Date(2026, 1, 25, 0, index).toISOString(),
      mode: index % 2 === 0 ? "practice" : "mock",
      correct: index % 3 === 0,
      responseTimeMs: index < 4 ? null : index < 8 ? 0 : 1000 + index * 25,
      selectedOptionId: "A" as const,
      quizId: null,
      topicTags: ["Regulations"],
      difficulty: 2,
      confidence: 3 as const,
    }));

    const summary = computeResponseTimeTelemetry(attempts);
    expect(summary.attempts).toBe(25);
    expect(summary.sampled).toBe(21);
    expect(summary.nullCount).toBe(4);
    expect(summary.zeroCount).toBe(4);
    expect(summary.nullRatePercent).toBe(16);
    expect(summary.zeroRatePercent).toBe(19);
    expect(summary.p50Ms).toBeGreaterThan(1000);
    expect(summary.p95Ms).toBeGreaterThan(summary.p50Ms ?? 0);
    expect(summary.hasNullAnomaly).toBe(true);
    expect(summary.hasZeroAnomaly).toBe(true);
    expect(summary.modes).toHaveLength(2);
  });

  it("returns no anomalies when sample size is too small", () => {
    const summary = computeResponseTimeTelemetry([
      {
        attemptId: "a-1",
        userId: "pilot",
        questionKey: "k-1",
        questionId: "Q-1",
        timestamp: "2026-02-25T00:00:00.000Z",
        mode: "practice",
        correct: true,
        responseTimeMs: null,
        selectedOptionId: "A",
        quizId: null,
        topicTags: ["Regulations"],
        difficulty: 1,
        confidence: 3,
      },
    ]);
    expect(summary.hasNullAnomaly).toBe(false);
    expect(summary.hasZeroAnomaly).toBe(false);
    expect(summary.p50Ms).toBeNull();
    expect(summary.p95Ms).toBeNull();
  });
});
