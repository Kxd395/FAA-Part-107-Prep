import { beforeEach, describe, expect, it } from "vitest";
import {
  appendLearningAnalyticsEvent,
  clearLearningAnalyticsStoreForTests,
  computeLearningScoringSummaryFromEvents,
  getLearningScoringSummary,
} from "./learningAnalyticsStore";

describe("learningAnalyticsStore", () => {
  beforeEach(async () => {
    await clearLearningAnalyticsStoreForTests();
  });

  it("dedupes events by id and keeps the latest version", async () => {
    await appendLearningAnalyticsEvent({
      id: "evt-1",
      userId: "pilot-a",
      timestamp: "2026-02-26T00:00:00.000Z",
      type: "answer_submitted",
      mode: "study",
      questionId: "Q-1",
      isCorrect: false,
      metadata: { confidence: 5 },
    });
    await appendLearningAnalyticsEvent({
      id: "evt-1",
      userId: "pilot-a",
      timestamp: "2026-02-26T00:00:01.000Z",
      type: "answer_submitted",
      mode: "study",
      questionId: "Q-1",
      isCorrect: true,
      metadata: { confidence: 5 },
    });

    const summary = await getLearningScoringSummary("pilot-a");
    expect(summary.answerCount).toBe(1);
    expect(summary.correctCount).toBe(1);
    expect(summary.accuracyPercent).toBe(100);
  });

  it("computes first vs final accuracy and answer-change rate", () => {
    const summary = computeLearningScoringSummaryFromEvents([
      {
        id: "evt-1",
        userId: "pilot-a",
        timestamp: "2026-02-26T00:00:00.000Z",
        type: "answer_submitted",
        mode: "exam",
        questionId: "Q-1",
        isCorrect: false,
        metadata: { confidence: 5 },
      },
      {
        id: "evt-2",
        userId: "pilot-a",
        timestamp: "2026-02-26T00:00:10.000Z",
        type: "answer_submitted",
        mode: "exam",
        questionId: "Q-1",
        isCorrect: true,
        metadata: { confidence: 3 },
      },
      {
        id: "evt-3",
        userId: "pilot-a",
        timestamp: "2026-02-26T00:01:00.000Z",
        type: "answer_submitted",
        mode: "study",
        questionId: "Q-2",
        isCorrect: true,
        metadata: { confidence: 1 },
      },
    ]);

    expect(summary.answerCount).toBe(3);
    expect(summary.uniqueQuestionCount).toBe(2);
    expect(summary.firstAnswerAccuracyPercent).toBe(50);
    expect(summary.finalAnswerAccuracyPercent).toBe(100);
    expect(summary.answerChangeRatePercent).toBe(50);
    expect(summary.byMode.exam).toBe(2);
    expect(summary.byMode.study).toBe(1);
    expect(summary.confidenceCount).toBe(3);
    expect(summary.calibrationScorePercent).not.toBeNull();
  });
});

