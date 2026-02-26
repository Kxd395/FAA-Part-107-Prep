/* @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useExamSession } from "./examSession";
import type { OptionId, Question } from "./types";

function makeQuestion(id: string, category: Question["category"] = "Regulations"): Question {
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
    explanation_correct: "A is correct",
    explanation_distractors: { B: "B wrong", C: "C wrong", D: "D wrong" },
    citation: "14 CFR §107.31",
    difficulty_level: 2,
    tags: [],
  };
}

function getWrongOptionId(question: Question): OptionId {
  return question.options.find((option) => option.id !== question.correct_option_id)?.id ?? "B";
}

describe("useExamSession", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false and remains in setup when filters produce zero questions", () => {
    const bank = [makeQuestion("q1", "Regulations"), makeQuestion("q2", "Regulations")];
    const { result } = renderHook(() =>
      useExamSession({
        allQuestions: bank,
      })
    );

    let started = true;
    act(() => {
      started = result.current.startExam("Airspace", "real_exam");
    });

    expect(started).toBe(false);
    expect(result.current.phase).toBe("setup");
    expect(result.current.questions).toHaveLength(0);
  });

  it("supports start, answering, flagging, navigation, and review summary", () => {
    const bank = [makeQuestion("q1", "Regulations"), makeQuestion("q2", "Regulations")];
    const { result } = renderHook(() =>
      useExamSession({
        allQuestions: bank,
      })
    );

    let started = false;
    act(() => {
      started = result.current.startExam("Regulations", "real_exam");
    });

    expect(started).toBe(true);
    expect(result.current.phase).toBe("in-progress");
    expect(result.current.questions).toHaveLength(2);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.timeLimitMs).toBeGreaterThan(0);

    const firstQuestion = result.current.currentQuestion;
    expect(firstQuestion).not.toBeNull();
    act(() => {
      result.current.toggleFlagCurrent();
      result.current.selectAnswer(firstQuestion!.correct_option_id);
    });

    expect(result.current.flagged.has(firstQuestion!.id)).toBe(true);
    expect(result.current.answeredCount).toBe(1);
    expect(result.current.answers.get(firstQuestion!.id)).toBe(firstQuestion!.correct_option_id);

    act(() => {
      result.current.goToQuestion(1);
    });
    expect(result.current.currentIndex).toBe(1);

    const secondQuestion = result.current.currentQuestion;
    expect(secondQuestion).not.toBeNull();
    act(() => {
      result.current.selectAnswer(getWrongOptionId(secondQuestion!));
    });

    act(() => {
      result.current.goToQuestion(99);
    });
    expect(result.current.currentIndex).toBe(1);

    act(() => {
      result.current.previousQuestion();
    });
    expect(result.current.currentIndex).toBe(0);

    act(() => {
      result.current.submitExam();
    });

    expect(result.current.phase).toBe("review");
    expect(result.current.review.rows).toHaveLength(2);
    expect(result.current.review.correctCount).toBe(1);
    expect(result.current.review.passed).toBe(false);
  });

  it("automatically moves to review when timer expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-25T12:00:00.000Z"));

    const { result } = renderHook(() =>
      useExamSession({
        allQuestions: [makeQuestion("q1", "Regulations")],
      })
    );

    act(() => {
      result.current.startExam("Regulations", "real_exam");
    });

    expect(result.current.phase).toBe("in-progress");
    expect(result.current.remainingMs).toBe(120_000);

    act(() => {
      vi.advanceTimersByTime(121_000);
    });

    expect(result.current.phase).toBe("review");
    expect(result.current.remainingMs).toBe(0);
  });

  it("applies run settings question limit and timer override", () => {
    const bank = [
      makeQuestion("q1", "Regulations"),
      makeQuestion("q2", "Regulations"),
      makeQuestion("q3", "Regulations"),
    ];
    const { result } = renderHook(() =>
      useExamSession({
        allQuestions: bank,
      })
    );

    const preview = result.current.getSetupPreview("Regulations", "real_exam", {
      questionLimit: 2,
      timeLimitMs: 90_000,
    });
    expect(preview.questionCount).toBe(2);
    expect(preview.timeLimitMs).toBe(90_000);

    let started = false;
    act(() => {
      started = result.current.startExam("Regulations", "real_exam", {
        questionLimit: 2,
        timeLimitMs: 90_000,
      });
    });

    expect(started).toBe(true);
    expect(result.current.questions).toHaveLength(2);
    expect(result.current.timeLimitMs).toBe(90_000);
  });
});
