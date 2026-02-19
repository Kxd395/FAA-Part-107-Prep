import { describe, expect, it } from "vitest";
import {
  canonicalQuestionKey,
  dedupeQuestions,
  selectAdaptiveQuestions,
  updateUserQuestionStats,
  type UserQuestionStats,
} from "./adaptive";
import type { Question } from "./types";

function makeQuestion(id: string, prompt: string, optionB: string = "Option B"): Question {
  return {
    id,
    category: "Regulations",
    subcategory: "General",
    question_text: prompt,
    figure_reference: null,
    options: [
      { id: "A", text: "Option A" },
      { id: "B", text: optionB },
      { id: "C", text: "Option C" },
    ],
    correct_option_id: "A",
    explanation_correct: "A is correct",
    explanation_distractors: {
      B: "B is incorrect",
      C: "C is incorrect",
    },
    citation: "14 CFR §107.31",
    difficulty_level: 2,
    tags: [],
  };
}

describe("adaptive dedupe", () => {
  it("removes duplicates with normalized prompt differences", () => {
    const q1 = makeQuestion("q1", "What   is   required before flight?");
    const q2 = makeQuestion("q2", "  what is required before FLIGHT? ");

    const result = dedupeQuestions([q1, q2], { includeChoices: false });
    expect(result.questions).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it("removes duplicates with normalized prompt + normalized choices", () => {
    const q1 = makeQuestion("q1", "Choose the right option", "  Airspace Lighting ");
    const q2 = makeQuestion("q2", "choose the RIGHT option ", "airspace   lighting");

    const k1 = canonicalQuestionKey(q1);
    const k2 = canonicalQuestionKey(q2);
    expect(k1).toBe(k2);

    const result = dedupeQuestions([q1, q2]);
    expect(result.questions).toHaveLength(1);
    expect(result.duplicatesRemoved).toBe(1);
  });
});

describe("adaptive selection", () => {
  it("excludes mastered questions when excludeMastered is true", () => {
    const q1 = makeQuestion("q1", "Question one");
    const q2 = makeQuestion("q2", "Question two");
    const q3 = makeQuestion("q3", "Question three");

    const key1 = canonicalQuestionKey(q1);
    const statsByKey: Record<string, UserQuestionStats> = {
      [key1]: {
        userId: "user-1",
        canonicalKey: key1,
        attempts: 5,
        correct: 5,
        incorrect: 0,
        correctStreak: 5,
        lastAttemptAt: new Date().toISOString(),
        lastResultWasCorrect: true,
        masteryScore: 0.99,
      },
    };

    const selection = selectAdaptiveQuestions({
      userId: "user-1",
      desiredQuizSize: 2,
      fullQuestionBank: [q1, q2, q3],
      userStatsByKey: statsByKey,
      config: { excludeMastered: true },
      rng: () => 0.1,
    });

    expect(selection.questions).toHaveLength(2);
    expect(selection.questions.some((q) => q.id === "q1")).toBe(false);
  });

  it("backfills with mastered questions when not enough unmastered questions exist", () => {
    const q1 = makeQuestion("q1", "Question one");
    const q2 = makeQuestion("q2", "Question two");
    const q3 = makeQuestion("q3", "Question three");

    const key1 = canonicalQuestionKey(q1);
    const key2 = canonicalQuestionKey(q2);

    const masteredStats = (canonicalKey: string): UserQuestionStats => ({
      userId: "user-1",
      canonicalKey,
      attempts: 5,
      correct: 5,
      incorrect: 0,
      correctStreak: 5,
      lastAttemptAt: new Date().toISOString(),
      lastResultWasCorrect: true,
      masteryScore: 0.99,
    });

    const selection = selectAdaptiveQuestions({
      userId: "user-1",
      desiredQuizSize: 3,
      fullQuestionBank: [q1, q2, q3],
      userStatsByKey: {
        [key1]: masteredStats(key1),
        [key2]: masteredStats(key2),
      },
      config: { excludeMastered: true, includeMasteredOnShortfall: true },
      rng: () => 0.2,
    });

    expect(selection.questions).toHaveLength(3);
    expect(selection.meta.backfilledFromMastered).toBeGreaterThan(0);
  });
});

describe("adaptive stats updates", () => {
  it("updates attempts, accuracy fields, and streak on each answer", () => {
    const first = updateUserQuestionStats({
      userId: "user-1",
      canonicalKey: "abc",
      isCorrect: true,
      answeredAtMs: 1_700_000_000_000,
    });
    const second = updateUserQuestionStats({
      userId: "user-1",
      canonicalKey: "abc",
      previous: first,
      isCorrect: false,
      answeredAtMs: 1_700_000_001_000,
    });

    expect(second.attempts).toBe(2);
    expect(second.correct).toBe(1);
    expect(second.incorrect).toBe(1);
    expect(second.correctStreak).toBe(0);
    expect(second.masteryScore).toBeGreaterThanOrEqual(0);
    expect(second.masteryScore).toBeLessThanOrEqual(1);
  });
});
