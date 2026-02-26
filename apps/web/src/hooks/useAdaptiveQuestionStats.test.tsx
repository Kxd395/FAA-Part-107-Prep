import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Question } from "@part107/core";
import { useAdaptiveQuestionStats } from "./useAdaptiveQuestionStats";

function makeQuestion(id: string): Question {
  return {
    id,
    category: "Regulations",
    subcategory: "Registration",
    question_text: `Question ${id}?`,
    figure_reference: null,
    options: [
      { id: "A", text: "A" },
      { id: "B", text: "B" },
      { id: "C", text: "C" },
    ],
    correct_option_id: "A",
    explanation_correct: "Because.",
    explanation_distractors: {
      B: "No",
      C: "No",
    },
    citation: "14 CFR 107.0",
    difficulty_level: 1,
    tags: ["regulations"],
  };
}

describe("useAdaptiveQuestionStats", () => {
  it("loads existing stats on mount and exposes loaded state", async () => {
    const store = {
      load: vi.fn(() => ({
        key1: {
          userId: "pilot-user",
          canonicalKey: "key1",
          attempts: 1,
          correct: 1,
          incorrect: 0,
          correctStreak: 1,
          lastAttemptAt: "2026-02-26T00:00:00.000Z",
          lastResultWasCorrect: true,
          masteryScore: 0.8,
        },
      })),
      save: vi.fn(),
      clear: vi.fn(),
    };
    const attemptStore = {
      load: vi.fn(() => []),
      append: vi.fn(),
      clear: vi.fn(),
    };

    const { result } = renderHook(() =>
      useAdaptiveQuestionStats("pilot-user", {}, store, attemptStore)
    );

    expect(store.load).toHaveBeenCalledWith("pilot-user");
    expect(result.current.loaded).toBe(true);
    expect(Object.keys(result.current.statsByKey)).toHaveLength(1);
  });

  it("records answers and appends attempt events", () => {
    const store = {
      load: vi.fn(() => ({})),
      save: vi.fn(),
      clear: vi.fn(),
    };
    const attemptStore = {
      load: vi.fn(() => []),
      append: vi.fn(),
      clear: vi.fn(),
    };
    const question = makeQuestion("REG-001");

    const { result } = renderHook(() =>
      useAdaptiveQuestionStats("pilot-user", {}, store, attemptStore)
    );

    act(() => {
      result.current.recordAnswer(question, true, Date.parse("2026-02-26T01:00:00.000Z"), {
        mode: "practice",
        selectedOptionId: "A",
        responseTimeMs: 5000,
        quizId: "quiz-1",
        confidence: 4,
      });
    });

    const savedStats = store.save.mock.calls[0]?.[1] as Record<string, { attempts: number; correct: number }>;
    expect(store.save.mock.calls[0]?.[0]).toBe("pilot-user");
    expect(Object.keys(savedStats)).toHaveLength(1);
    expect(Object.values(savedStats)[0]).toEqual(
      expect.objectContaining({
        attempts: 1,
        correct: 1,
      })
    );
    expect(attemptStore.append).toHaveBeenCalledWith(
      "pilot-user",
      expect.objectContaining({
        questionId: "REG-001",
        correct: true,
        mode: "practice",
        selectedOptionId: "A",
        quizId: "quiz-1",
        confidence: 4,
      })
    );
  });

  it("records exam review batches and clears state and stores", () => {
    const store = {
      load: vi.fn(() => ({})),
      save: vi.fn(),
      clear: vi.fn(),
    };
    const attemptStore = {
      load: vi.fn(() => [
        {
          attemptId: "a1",
          userId: "pilot-user",
          questionKey: "key1",
          questionId: "REG-000",
          timestamp: "2026-02-26T00:00:00.000Z",
          mode: "practice" as const,
          correct: true,
          responseTimeMs: 1000,
          selectedOptionId: "A" as const,
          quizId: "quiz-0",
          topicTags: ["Regulations"],
          difficulty: 1,
          confidence: 3 as const,
        },
      ]),
      append: vi.fn(),
      clear: vi.fn(),
    };
    const questionA = makeQuestion("REG-001");
    const questionB = makeQuestion("REG-002");

    const { result } = renderHook(() =>
      useAdaptiveQuestionStats("pilot-user", {}, store, attemptStore)
    );

    act(() => {
      result.current.recordExamReview(
        [
          { question: questionA, isCorrect: true, userAnswer: "A", confidence: 5 },
          { question: questionB, isCorrect: false, userAnswer: "B", confidence: 2 },
        ],
        Date.parse("2026-02-26T02:00:00.000Z"),
        { mode: "mock", quizId: "exam-1" }
      );
    });

    expect(attemptStore.append).toHaveBeenCalledTimes(2);
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(result.current.getAttemptEvents()).toEqual([
      expect.objectContaining({ attemptId: "a1" }),
    ]);

    act(() => {
      result.current.clear();
    });

    expect(store.clear).toHaveBeenCalledWith("pilot-user");
    expect(attemptStore.clear).toHaveBeenCalledWith("pilot-user");
    expect(result.current.statsByKey).toEqual({});
  });
});
