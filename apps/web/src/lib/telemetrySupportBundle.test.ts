import { beforeEach, describe, expect, it } from "vitest";
import { defaultAttemptEventStore } from "./attemptEventStore";
import { defaultLearningEventStore } from "./learningEventStore";
import { buildTelemetrySupportBundle } from "./telemetrySupportBundle";

const USER_ID = "local-user";

describe("buildTelemetrySupportBundle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exports redacted learning and attempt telemetry aggregates", () => {
    defaultLearningEventStore.append(USER_ID, {
      id: "evt-1",
      userId: USER_ID,
      timestamp: "2026-02-24T00:00:00.000Z",
      type: "answer_submitted",
      mode: "learn",
      questionId: "SHOULD_NOT_BE_INCLUDED",
      category: "Regulations",
      subcategory: "Privacy",
      metadata: { round: 1, responseTimeMs: 3200 },
      isCorrect: true,
    });

    defaultAttemptEventStore.append(USER_ID, {
      attemptId: "att-1",
      userId: USER_ID,
      questionKey: "key-1",
      questionId: "QUESTION_ID",
      timestamp: "2026-02-24T00:00:10.000Z",
      mode: "quiz",
      correct: false,
      responseTimeMs: 4500,
      selectedOptionId: "A",
      quizId: "quiz-1",
      topicTags: ["Regulations", "Operations"],
      difficulty: 3,
      confidence: null,
    });

    const bundle = buildTelemetrySupportBundle(USER_ID);

    expect(bundle.learningEvents.total).toBe(1);
    expect(bundle.learningEvents.byMode.learn).toBe(1);
    expect(bundle.learningEvents.byType.answer_submitted).toBe(1);
    expect(bundle.learningEvents.events[0]).not.toHaveProperty("questionId");
    expect(bundle.learningEvents.events[0]).not.toHaveProperty("category");
    expect(bundle.learningEvents.events[0]).not.toHaveProperty("subcategory");

    expect(bundle.attemptEvents.total).toBe(1);
    expect(bundle.attemptEvents.byMode.quiz).toBe(1);
    expect(bundle.attemptEvents.events[0].hasQuizId).toBe(true);
    expect(bundle.attemptEvents.events[0].topicTagCount).toBe(2);
    expect(bundle.attemptEvents.events[0]).not.toHaveProperty("questionId");
    expect(bundle.attemptEvents.events[0]).not.toHaveProperty("selectedOptionId");
  });
});
