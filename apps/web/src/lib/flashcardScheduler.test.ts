import {
  canonicalQuestionKey,
  type Category,
  type Question,
  type UserQuestionStats,
} from "@part107/core";
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyLapseHandlingToQueueDecision,
  buildFlashcardPlanRecommendation,
  buildFlashcardDeckPreview,
  DEFAULT_FLASHCARD_SCHEDULER_SETTINGS,
  type FlashcardSchedulerSettings,
} from "./flashcardScheduler";

function makeQuestion(id: string, category: Category = "Airspace"): Question {
  return {
    id,
    category,
    subcategory: "General",
    question_text: `Question ${id}`,
    figure_reference: null,
    options: [
      { id: "A", text: "Option A" },
      { id: "B", text: "Option B" },
      { id: "C", text: "Option C" },
      { id: "D", text: "Option D" },
    ],
    correct_option_id: "A",
    explanation_correct: "Correct.",
    explanation_distractors: { B: "Wrong.", C: "Wrong.", D: "Wrong." },
    citation: "14 CFR §107",
    difficulty_level: 2,
    tags: [],
    source_type: "confirmed_test",
  };
}

function makeStats(canonicalKey: string, nextDueAt: string): UserQuestionStats {
  return {
    userId: "pilot-a",
    canonicalKey,
    attempts: 3,
    correct: 2,
    incorrect: 1,
    correctStreak: 1,
    lastAttemptAt: new Date().toISOString(),
    lastResultWasCorrect: true,
    masteryScore: 0.5,
    nextDueAt,
  };
}

describe("flashcardScheduler", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("limits due new cards by remaining new-card quota", () => {
    const settings: FlashcardSchedulerSettings = {
      ...DEFAULT_FLASHCARD_SCHEDULER_SETTINGS,
      dailyReviewTarget: 20,
      maxNewCardsPerDay: 10,
    };
    const preview = buildFlashcardDeckPreview({
      questions: [makeQuestion("Q-1"), makeQuestion("Q-2"), makeQuestion("Q-3")],
      statsByKey: {},
      includeChoicesInCanonicalKey: false,
      settings,
      remainingNewQuota: 1,
      nowMs: Date.parse("2026-02-25T12:00:00.000Z"),
    });

    expect(preview.cards).toHaveLength(1);
    expect(preview.dueNowCount).toBe(3);
    expect(preview.dueNowNewCount).toBe(3);
    expect(preview.limitedByNewCap).toBe(true);
  });

  it("returns empty deck when only new cards are due and quota is exhausted", () => {
    const preview = buildFlashcardDeckPreview({
      questions: [makeQuestion("Q-1"), makeQuestion("Q-2")],
      statsByKey: {},
      includeChoicesInCanonicalKey: false,
      settings: DEFAULT_FLASHCARD_SCHEDULER_SETTINGS,
      remainingNewQuota: 0,
      nowMs: Date.parse("2026-02-25T12:00:00.000Z"),
    });

    expect(preview.cards).toHaveLength(0);
    expect(preview.dueNowNewCount).toBe(2);
    expect(preview.usingUpcomingFallback).toBe(false);
    expect(preview.limitedByNewCap).toBe(true);
  });

  it("limits deck by daily review target", () => {
    const preview = buildFlashcardDeckPreview({
      questions: [makeQuestion("Q-1"), makeQuestion("Q-2"), makeQuestion("Q-3")],
      statsByKey: {},
      includeChoicesInCanonicalKey: false,
      settings: {
        ...DEFAULT_FLASHCARD_SCHEDULER_SETTINGS,
        dailyReviewTarget: 2,
      },
      remainingNewQuota: 10,
      nowMs: Date.parse("2026-02-25T12:00:00.000Z"),
    });

    expect(preview.cards).toHaveLength(2);
    expect(preview.limitedByDailyTarget).toBe(true);
  });

  it("uses upcoming fallback when nothing is due", () => {
    const future = "2099-01-01T00:00:00.000Z";
    const questions = [makeQuestion("Q-1"), makeQuestion("Q-2")];
    const statsByKey: Record<string, UserQuestionStats> = {};
    for (const question of questions) {
      const key = canonicalQuestionKey(question, { includeChoices: false });
      statsByKey[key] = makeStats(key, future);
    }
    const preview = buildFlashcardDeckPreview({
      questions,
      statsByKey,
      includeChoicesInCanonicalKey: false,
      settings: DEFAULT_FLASHCARD_SCHEDULER_SETTINGS,
      remainingNewQuota: 10,
      nowMs: Date.parse("2026-02-25T12:00:00.000Z"),
    });

    expect(preview.usingUpcomingFallback).toBe(true);
  });

  it("applies aggressive lapse handling to bring misses back sooner", () => {
    const decision = applyLapseHandlingToQueueDecision(
      { removeFromQueue: false, gapMin: 5, gapMax: 8 },
      false,
      "aggressive"
    );

    expect(decision).toEqual({
      removeFromQueue: false,
      gapMin: 1,
      gapMax: 2,
    });
  });

  it("keeps balanced lapse handling unchanged", () => {
    const base = { removeFromQueue: false, gapMin: 2, gapMax: 4 } as const;
    expect(applyLapseHandlingToQueueDecision(base, false, "balanced")).toEqual(base);
  });

  it("applies per-category cap when configured", () => {
    const preview = buildFlashcardDeckPreview({
      questions: [
        makeQuestion("Q-1", "Operations"),
        makeQuestion("Q-2", "Operations"),
        makeQuestion("Q-3", "Airspace"),
        makeQuestion("Q-4", "Weather"),
      ],
      statsByKey: {},
      includeChoicesInCanonicalKey: false,
      settings: {
        ...DEFAULT_FLASHCARD_SCHEDULER_SETTINGS,
        maxPerCategory: 1,
      },
      remainingNewQuota: 10,
      nowMs: Date.parse("2026-02-25T12:00:00.000Z"),
    });

    expect(preview.cards).toHaveLength(3);
    expect(preview.cards.filter((question) => question.category === "Operations")).toHaveLength(1);
    expect(preview.limitedByCategoryCap).toBe(true);
  });

  it("builds streak-aware weekly plan recommendation", () => {
    const recommendation = buildFlashcardPlanRecommendation({
      weeklyReviewGoal: 40,
      weeklyCompleted: 18,
      daysRemainingInWeek: 4,
      streakDays: 6,
    });
    expect(recommendation.remainingThisWeek).toBe(22);
    expect(recommendation.recommendedPerDay).toBe(6);
    expect(recommendation.message).toMatch(/streak/i);
  });
});
