import { describe, expect, it, vi } from "vitest";
import { recordLearningAttempt } from "./learningAttemptPipeline";

const question = {
  id: "Q-1",
  category: "Airspace",
  subcategory: "Class C",
  question_text: "Question?",
  figure_reference: null,
  options: [
    { id: "A", text: "A" },
    { id: "B", text: "B" },
    { id: "C", text: "C" },
    { id: "D", text: "D" },
  ],
  correct_option_id: "B",
  explanation_correct: "Because",
  explanation_distractors: {},
  citation: "",
  difficulty_level: 2,
  tags: [],
  source_type: "confirmed_test",
} as const;

describe("recordLearningAttempt", () => {
  it("records adaptive attempt and emits answer_submitted", () => {
    const adaptive = { recordAnswer: vi.fn() };
    const events = { logEvent: vi.fn() };

    recordLearningAttempt({
      adaptive,
      events,
      question: question as never,
      learningMode: "study",
      attemptMode: "practice",
      isCorrect: true,
      selectedOptionId: "B",
      responseTimeMs: 1200,
      confidence: 4,
      questionTypeProfile: "confirmed_test",
      metadata: { qualityScore: 4 },
    });

    expect(adaptive.recordAnswer).toHaveBeenCalledTimes(1);
    expect(events.logEvent).toHaveBeenCalledTimes(1);
  });

  it("supports event-only writes when persistAdaptive is false", () => {
    const adaptive = { recordAnswer: vi.fn() };
    const events = { logEvent: vi.fn() };

    recordLearningAttempt({
      adaptive,
      events,
      question: question as never,
      learningMode: "exam",
      attemptMode: "mock",
      isCorrect: false,
      selectedOptionId: "A",
      responseTimeMs: 900,
      confidence: 3,
      persistAdaptive: false,
    });

    expect(adaptive.recordAnswer).not.toHaveBeenCalled();
    expect(events.logEvent).toHaveBeenCalledTimes(1);
  });
});
