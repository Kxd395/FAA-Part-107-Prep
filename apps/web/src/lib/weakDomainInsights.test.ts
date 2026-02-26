import { describe, expect, it } from "vitest";
import { computeWeakDomainInsights } from "./weakDomainInsights";

describe("computeWeakDomainInsights", () => {
  it("ranks weak categories by low accuracy", () => {
    const insights = computeWeakDomainInsights(
      [
        {
          attemptId: "1",
          userId: "pilot",
          questionKey: "A",
          questionId: "Q1",
          timestamp: "2026-02-25T00:00:00.000Z",
          mode: "practice",
          correct: false,
          responseTimeMs: 5000,
          selectedOptionId: "A",
          quizId: null,
          topicTags: ["Operations", "Airport"],
          difficulty: 2,
          confidence: 3,
        },
        {
          attemptId: "2",
          userId: "pilot",
          questionKey: "B",
          questionId: "Q2",
          timestamp: "2026-02-25T00:01:00.000Z",
          mode: "practice",
          correct: false,
          responseTimeMs: 6000,
          selectedOptionId: "B",
          quizId: null,
          topicTags: ["Operations", "Airport"],
          difficulty: 2,
          confidence: 3,
        },
        {
          attemptId: "3",
          userId: "pilot",
          questionKey: "C",
          questionId: "Q3",
          timestamp: "2026-02-25T00:02:00.000Z",
          mode: "practice",
          correct: true,
          responseTimeMs: 6000,
          selectedOptionId: "A",
          quizId: null,
          topicTags: ["Airspace", "Class D"],
          difficulty: 2,
          confidence: 3,
        },
        {
          attemptId: "4",
          userId: "pilot",
          questionKey: "D",
          questionId: "Q4",
          timestamp: "2026-02-25T00:03:00.000Z",
          mode: "mock",
          correct: false,
          responseTimeMs: null,
          selectedOptionId: "A",
          quizId: "quiz-1",
          topicTags: ["Airspace", "Class D"],
          difficulty: 2,
          confidence: 3,
        },
        {
          attemptId: "5",
          userId: "pilot",
          questionKey: "E",
          questionId: "Q5",
          timestamp: "2026-02-25T00:04:00.000Z",
          mode: "mock",
          correct: true,
          responseTimeMs: null,
          selectedOptionId: "A",
          quizId: "quiz-1",
          topicTags: ["Airspace", "Class D"],
          difficulty: 2,
          confidence: 3,
        },
      ],
      { minAttempts: 2, maxDomains: 2 }
    );

    expect(insights).toEqual([
      expect.objectContaining({
        category: "Operations",
        attempts: 2,
        incorrect: 2,
        accuracyPercent: 0,
      }),
      expect.objectContaining({
        category: "Airspace",
        attempts: 3,
        incorrect: 1,
        accuracyPercent: 67,
      }),
    ]);
  });

  it("ignores flashcard attempts and low-volume categories", () => {
    const insights = computeWeakDomainInsights(
      [
        {
          attemptId: "1",
          userId: "pilot",
          questionKey: "A",
          questionId: "Q1",
          timestamp: "2026-02-25T00:00:00.000Z",
          mode: "flashcard",
          correct: false,
          responseTimeMs: 1000,
          selectedOptionId: null,
          quizId: null,
          topicTags: ["Weather"],
          difficulty: 1,
          confidence: 2,
        },
        {
          attemptId: "2",
          userId: "pilot",
          questionKey: "B",
          questionId: "Q2",
          timestamp: "2026-02-25T00:01:00.000Z",
          mode: "practice",
          correct: false,
          responseTimeMs: 1000,
          selectedOptionId: "A",
          quizId: null,
          topicTags: ["Weather"],
          difficulty: 1,
          confidence: 2,
        },
      ],
      { minAttempts: 2 }
    );

    expect(insights).toEqual([]);
  });
});
