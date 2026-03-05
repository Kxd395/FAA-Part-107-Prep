import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExamPage from "./page";
import type { Category, Question } from "@part107/core";

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  logEvent: vi.fn(),
  recordLearningAttempt: vi.fn(),
  attemptEvents: [] as Array<{
    attemptId: string;
    userId: string;
    questionKey: string;
    questionId: string;
    timestamp: string;
    mode: "practice" | "mock" | "pretest" | "quiz" | "flashcard";
    correct: boolean;
    responseTimeMs: number | null;
    selectedOptionId: "A" | "B" | "C" | "D" | null;
    quizId: string | null;
    topicTags: string[];
    difficulty: number;
    confidence: 1 | 2 | 3 | 4 | 5 | null;
  }>,
}));

function makeQuestion(id: string, category: Category = "Regulations"): Question {
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
    source: "review.md",
    source_type: "confirmed_test",
  };
}

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mocks.searchParams.get(key),
  }),
}));

vi.mock("../../hooks/useQuestionBank", () => ({
  useQuestionBank: () => ({
    questions: [makeQuestion("Q-1"), makeQuestion("Q-2", "Operations")],
    loaded: true,
    loading: false,
    error: null,
    warning: null,
    snapshotInfo: null,
    reload: vi.fn(),
    clearSnapshot: vi.fn(),
  }),
}));

vi.mock("../../hooks/useAdaptiveQuestionStats", () => ({
  useAdaptiveQuestionStats: () => ({
    userId: "test-user",
    statsByKey: {},
    config: { includeChoicesInCanonicalKey: false },
    recordAnswer: vi.fn(),
    recordExamReview: vi.fn(),
    getAttemptEvents: () => mocks.attemptEvents,
  }),
}));

vi.mock("../../hooks/useProgress", () => ({
  useProgress: () => ({
    saveSession: vi.fn(),
  }),
}));

vi.mock("../../hooks/useActiveUserId", () => ({
  useActiveUserId: () => "test-user",
}));

vi.mock("../../hooks/useLearningEventLogger", () => ({
  useLearningEventLogger: () => ({
    logEvent: mocks.logEvent,
  }),
}));

vi.mock("../../lib/learningAttemptPipeline", () => ({
  recordLearningAttempt: (...args: unknown[]) => mocks.recordLearningAttempt(...args),
}));

describe("ExamPage", () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams();
    mocks.attemptEvents = [];
    mocks.logEvent.mockReset();
    mocks.recordLearningAttempt.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders exam setup preview", async () => {
    render(<ExamPage />);
    expect(await screen.findByRole("heading", { name: /Practice Exam/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Begin Exam/i })).toBeInTheDocument();
  });

  it("shows warning when question type param is invalid", async () => {
    mocks.searchParams = new URLSearchParams("type=invalid_profile");
    render(<ExamPage />);

    expect(await screen.findByText(/Question type .*invalid_profile.* is not available/i)).toBeInTheDocument();
  });

  it("uses answer-level confidence quick actions without duplicate selector", async () => {
    const user = userEvent.setup();
    render(<ExamPage />);

    await user.click(await screen.findByRole("button", { name: /Begin Exam/i }));
    expect(screen.getByText(/⏱ 2:00:00/i)).toBeInTheDocument();
    expect(screen.queryByText(/Confidence for next answer:/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Answer .* as Not Sure/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Answer .* as Neutral/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Answer .* as Confident/i }).length).toBeGreaterThan(0);
  });

  it("supports category-targeted exam setup via query params", async () => {
    mocks.searchParams = new URLSearchParams("category=Operations");
    render(<ExamPage />);

    expect(await screen.findByText(/Topic: Operations/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Begin Operations Test/i })).toBeInTheDocument();
  });

  it("toggles the question navigator in-session", async () => {
    const user = userEvent.setup();
    render(<ExamPage />);

    await user.click(await screen.findByRole("button", { name: /Begin Exam/i }));
    await user.click(screen.getByRole("button", { name: /Navigator/i }));
    expect(screen.getByText(/Question Navigator/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^1$/ })).toBeInTheDocument();
  });

  it("records answer attempts on first submit and answer changes", async () => {
    const user = userEvent.setup();
    render(<ExamPage />);

    await user.click(await screen.findByRole("button", { name: /Begin Exam/i }));
    await user.click(screen.getByRole("button", { name: /Answer A as Not Sure/i }));
    await user.click(screen.getByRole("button", { name: /Answer B as Confident/i }));

    expect(mocks.recordLearningAttempt).toHaveBeenCalledTimes(2);
    const firstAttempt = mocks.recordLearningAttempt.mock.calls[0]?.[0] as {
      selectedOptionId?: string;
      learningMode?: string;
      attemptMode?: string;
      confidence?: number;
    };
    const secondAttempt = mocks.recordLearningAttempt.mock.calls[1]?.[0] as {
      selectedOptionId?: string;
      learningMode?: string;
      attemptMode?: string;
      confidence?: number;
    };

    expect(mocks.recordLearningAttempt.mock.calls[0]?.[0]).toMatchObject({
      learningMode: "exam",
      attemptMode: "mock",
      confidence: 1,
    });
    expect(mocks.recordLearningAttempt.mock.calls[1]?.[0]).toMatchObject({
      learningMode: "exam",
      attemptMode: "mock",
      confidence: 5,
    });
    expect(["A", "B", "C", "D"]).toContain(firstAttempt.selectedOptionId);
    expect(["A", "B", "C", "D"]).toContain(secondAttempt.selectedOptionId);
    expect(secondAttempt.selectedOptionId).not.toBe(firstAttempt.selectedOptionId);
  });

  it("submits exam and shows review results", async () => {
    const user = userEvent.setup();
    render(<ExamPage />);

    await user.click(await screen.findByRole("button", { name: /Begin Exam/i }));
    await user.click(screen.getByRole("button", { name: /Answer A as Confident/i }));
    await user.click(screen.getByRole("button", { name: /^Next →$/i }));
    await user.click(screen.getByRole("button", { name: /Answer A as Confident/i }));
    await user.click(screen.getByRole("button", { name: /Submit Exam/i }));

    expect(await screen.findByRole("heading", { name: /You Passed|Not Quite/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Question Review/i })).toBeInTheDocument();
  });
});
