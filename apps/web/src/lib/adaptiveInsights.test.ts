import { describe, expect, it } from "vitest";
import type { UserQuestionStats } from "@part107/core";
import type { AttemptEvent } from "./attemptEventStore";
import { computeAdaptiveInsights } from "./adaptiveInsights";

function makeAttempt(overrides: Partial<AttemptEvent>): AttemptEvent {
  return {
    attemptId: "a-1",
    userId: "local-user",
    questionKey: "k-1",
    questionId: "q-1",
    timestamp: "2026-02-19T00:00:00.000Z",
    mode: "practice",
    correct: false,
    responseTimeMs: 12000,
    selectedOptionId: "A",
    quizId: null,
    topicTags: ["Regulations"],
    difficulty: 2,
    confidence: null,
    ...overrides,
  };
}

function makeStats(overrides: Partial<UserQuestionStats>): UserQuestionStats {
  return {
    userId: "local-user",
    canonicalKey: "k-1",
    attempts: 1,
    correct: 1,
    incorrect: 0,
    correctStreak: 1,
    lastAttemptAt: "2026-02-19T00:00:00.000Z",
    lastResultWasCorrect: true,
    masteryScore: 0.9,
    ...overrides,
  };
}

describe("computeAdaptiveInsights", () => {
  it("computes last10 accuracy and momentum from immutable events", () => {
    const attempts: AttemptEvent[] = [];
    for (let i = 0; i < 20; i++) {
      attempts.push(
        makeAttempt({
          attemptId: `a-${i}`,
          timestamp: new Date(Date.UTC(2026, 1, 19, 0, i, 0)).toISOString(),
          correct: i < 5 || i >= 10,
        })
      );
    }

    const insights = computeAdaptiveInsights({
      statsByKey: {},
      attempts,
      nowMs: Date.UTC(2026, 1, 20),
    });

    expect(insights.last10AttemptCount).toBe(10);
    expect(insights.last10CorrectCount).toBe(10);
    expect(insights.last10AccuracyPercent).toBe(100);
    expect(insights.previous10AccuracyPercent).toBe(50);
    expect(insights.momentumPercent).toBe(50);
  });

  it("computes due and at-risk counts from adaptive stats", () => {
    const nowMs = Date.UTC(2026, 1, 20, 12, 0, 0);
    const statsByKey: Record<string, UserQuestionStats> = {
      k1: makeStats({
        canonicalKey: "k1",
        attempts: 5,
        masteryScore: 0.5,
        nextDueAt: new Date(nowMs - 60_000).toISOString(),
      }),
      k2: makeStats({
        canonicalKey: "k2",
        attempts: 2,
        masteryScore: 0.4,
        nextDueAt: new Date(nowMs + 3_600_000).toISOString(),
      }),
      k3: makeStats({
        canonicalKey: "k3",
        attempts: 8,
        masteryScore: 0.92,
        nextDueAt: new Date(nowMs + 3 * 24 * 60 * 60 * 1000).toISOString(),
        last10Accuracy: 0.9,
        momentum: 0.1,
      }),
    };

    const insights = computeAdaptiveInsights({
      statsByKey,
      attempts: [],
      nowMs,
    });

    expect(insights.trackedQuestions).toBe(3);
    expect(insights.dueNowCount).toBe(1);
    expect(insights.dueWithin24hCount).toBe(1);
    expect(insights.atRiskCount).toBe(1);
  });
});
