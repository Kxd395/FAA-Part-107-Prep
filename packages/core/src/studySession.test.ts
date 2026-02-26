/* @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStudySession } from "./studySession";
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

describe("useStudySession", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts, answers, skips, and completes with expected scoring", () => {
    const bank = [makeQuestion("q1"), makeQuestion("q2")];
    const { result } = renderHook(() =>
      useStudySession({
        allQuestions: bank,
        initialCategory: "Regulations",
      })
    );

    expect(result.current.quizStarted).toBe(false);
    expect(result.current.currentQuestion).toBeNull();

    act(() => {
      result.current.startQuiz("Regulations");
    });

    expect(result.current.quizStarted).toBe(true);
    expect(result.current.questions).toHaveLength(2);
    expect(result.current.currentQuestion).not.toBeNull();

    const skippedQuestionId = result.current.currentQuestion?.id ?? "";
    const expectedNextQuestionId =
      result.current.questions.find((question) => question.id !== skippedQuestionId)?.id ?? "";

    act(() => {
      result.current.skipQuestion();
    });

    expect(result.current.currentQuestion?.id).toBe(expectedNextQuestionId);
    expect(result.current.questions[result.current.questions.length - 1]?.id).toBe(skippedQuestionId);

    const firstAnsweredQuestion = result.current.currentQuestion;
    expect(firstAnsweredQuestion).not.toBeNull();
    act(() => {
      result.current.answerQuestion(firstAnsweredQuestion!.correct_option_id);
    });
    expect(result.current.answerState).toBe("correct");
    expect(result.current.score).toEqual({ correct: 1, total: 1 });
    expect(result.current.questionResults).toHaveLength(1);

    act(() => {
      result.current.nextQuestion();
    });

    const secondAnsweredQuestion = result.current.currentQuestion;
    expect(secondAnsweredQuestion).not.toBeNull();
    act(() => {
      result.current.answerQuestion(getWrongOptionId(secondAnsweredQuestion!));
    });
    expect(result.current.answerState).toBe("incorrect");
    expect(result.current.score).toEqual({ correct: 1, total: 2 });

    act(() => {
      result.current.nextQuestion();
    });

    expect(result.current.isComplete).toBe(true);
    expect(result.current.currentQuestion).toBeNull();
    expect(result.current.questionResults).toHaveLength(2);
  });

  it("ends immediately when skipping the last visible question", () => {
    const { result } = renderHook(() =>
      useStudySession({
        allQuestions: [makeQuestion("q1")],
      })
    );

    act(() => {
      result.current.startQuiz("Regulations");
    });

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isComplete).toBe(false);

    act(() => {
      result.current.skipQuestion();
    });

    expect(result.current.currentIndex).toBe(1);
    expect(result.current.isComplete).toBe(true);
    expect(result.current.currentQuestion).toBeNull();
    expect(result.current.score).toEqual({ correct: 0, total: 0 });
  });

  it("restart and reset return to expected states", () => {
    const bank = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3", "Airspace")];
    const { result } = renderHook(() =>
      useStudySession({
        allQuestions: bank,
      })
    );

    act(() => {
      result.current.startQuiz("Airspace");
    });

    expect(result.current.selectedCategory).toBe("Airspace");
    expect(result.current.questions).toHaveLength(1);

    act(() => {
      result.current.answerQuestion("A");
      result.current.nextQuestion();
    });
    expect(result.current.isComplete).toBe(true);

    act(() => {
      result.current.restartQuiz();
    });
    expect(result.current.quizStarted).toBe(true);
    expect(result.current.selectedCategory).toBe("Airspace");
    expect(result.current.score).toEqual({ correct: 0, total: 0 });
    expect(result.current.currentIndex).toBe(0);

    act(() => {
      result.current.resetToSetup();
    });
    expect(result.current.quizStarted).toBe(false);
    expect(result.current.currentQuestion).toBeNull();
  });

  it("applies question limit and timed drill settings", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-25T13:00:00.000Z"));

    const bank = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    const { result } = renderHook(() =>
      useStudySession({
        allQuestions: bank,
      })
    );

    act(() => {
      result.current.startQuiz("Regulations", {
        questionLimit: 1,
        timeLimitMs: 3_000,
      });
    });

    expect(result.current.questions).toHaveLength(1);
    expect(result.current.isTimedDrill).toBe(true);
    expect(result.current.timeLimitMs).toBe(3_000);
    expect(result.current.remainingMs).toBe(3_000);

    act(() => {
      vi.advanceTimersByTime(3_100);
    });

    expect(result.current.timedOut).toBe(true);
    expect(result.current.isComplete).toBe(true);
    expect(result.current.remainingMs).toBe(0);
  });

  it("restores an in-progress snapshot", () => {
    const bank = [makeQuestion("q1"), makeQuestion("q2")];
    const { result } = renderHook(() =>
      useStudySession({
        allQuestions: bank,
      })
    );

    act(() => {
      result.current.restoreQuiz({
        selectedCategory: "Regulations",
        questions: bank,
        currentIndex: 1,
        selectedOption: "B",
        answerState: "incorrect",
        score: { correct: 0, total: 1 },
        sessionStartTime: Date.now() - 120000,
        questionResults: [
          {
            questionId: "q1",
            userAnswer: "B",
            correctAnswer: "A",
            isCorrect: false,
            category: "Regulations",
          },
        ],
        timeLimitMs: 600000,
        remainingMs: 480000,
        timedOut: false,
        lastStartOptions: {
          questionLimit: 20,
          timeLimitMs: 600000,
        },
      });
    });

    expect(result.current.quizStarted).toBe(true);
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentQuestion?.id).toBe("q2");
    expect(result.current.answerState).toBe("incorrect");
    expect(result.current.selectedOption).toBe("B");
    expect(result.current.score).toEqual({ correct: 0, total: 1 });
    expect(result.current.remainingMs).toBeLessThanOrEqual(480000);
    expect(result.current.remainingMs).toBeGreaterThan(470000);
  });
});
