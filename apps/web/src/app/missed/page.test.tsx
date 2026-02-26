import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MissedPage from "./page";
import type { Question } from "@part107/core";
import { listQuestionCollections, readBookmarkedQuestionIds } from "../../lib/questionCollectionStore";

const mocks = vi.hoisted(() => ({
  logEvent: vi.fn(),
  sessions: [] as Array<{
    id: string;
    mode: "study" | "exam";
    category: string;
    score: number;
    total: number;
    percentage: number;
    passed: boolean;
    timestamp: string;
    timeSpentMs: number;
    questions: Array<{
      questionId: string;
      userAnswer: "A" | "B" | "C" | "D" | null;
      correctAnswer: "A" | "B" | "C" | "D";
      isCorrect: boolean;
      category: string;
    }>;
  }>,
}));

function makeQuestion(id: string): Question {
  return {
    id,
    category: "Regulations",
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
    source_type: "confirmed_test",
  };
}

vi.mock("../../hooks/useQuestionBank", () => ({
  useQuestionBank: () => ({
    questions: [makeQuestion("Q-1"), makeQuestion("Q-2")],
    loaded: true,
    loading: false,
    error: null,
    warning: null,
    snapshotInfo: null,
    reload: vi.fn(),
    clearSnapshot: vi.fn(),
  }),
}));

vi.mock("../../hooks/useProgress", () => ({
  useProgress: () => ({
    sessions: mocks.sessions,
    loaded: true,
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

describe("MissedPage", () => {
  beforeEach(() => {
    mocks.logEvent.mockReset();
    mocks.sessions = [];
  });

  afterEach(() => {
    cleanup();
  });

  it("renders empty state when no misses exist", async () => {
    render(<MissedPage />);
    expect(await screen.findByText(/No Missed Questions Yet/i)).toBeInTheDocument();
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "page_view",
        mode: "missed",
      })
    );
  });

  it("renders missed list and logs filter changes", async () => {
    mocks.sessions = [
      {
        id: "session-1",
        mode: "study",
        category: "Regulations",
        score: 0,
        total: 1,
        percentage: 0,
        passed: false,
        timestamp: "2026-02-25T00:00:00.000Z",
        timeSpentMs: 1000,
        questions: [
          {
            questionId: "Q-1",
            userAnswer: "B",
            correctAnswer: "A",
            isCorrect: false,
            category: "Regulations",
          },
        ],
      },
    ];

    render(<MissedPage />);
    expect(await screen.findByRole("heading", { name: /Missed Questions Review/i })).toBeInTheDocument();
    expect(screen.getByText(/1 unique questions/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Most Recent/i }));
    expect(mocks.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "filter_changed",
        mode: "missed",
        metadata: { filter: "sort", value: "recent" },
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /Question Q-1/i }));
    expect(screen.getByRole("button", { name: /Report issue/i })).toBeInTheDocument();
  });

  it("adds visible missed questions to selected collection", async () => {
    mocks.sessions = [
      {
        id: "session-1",
        mode: "study",
        category: "Regulations",
        score: 0,
        total: 1,
        percentage: 0,
        passed: false,
        timestamp: "2026-02-25T00:00:00.000Z",
        timeSpentMs: 1000,
        questions: [
          {
            questionId: "Q-1",
            userAnswer: "B",
            correctAnswer: "A",
            isCorrect: false,
            category: "Regulations",
          },
        ],
      },
    ];

    render(<MissedPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Add Visible/i }));

    expect(Array.from(readBookmarkedQuestionIds("test-user"))).toEqual(["Q-1"]);
    expect(await screen.findByText(/Added 1 question to collection/i)).toBeInTheDocument();
  });

  it("creates a collection from missed controls", async () => {
    mocks.sessions = [
      {
        id: "session-1",
        mode: "study",
        category: "Regulations",
        score: 0,
        total: 1,
        percentage: 0,
        passed: false,
        timestamp: "2026-02-25T00:00:00.000Z",
        timeSpentMs: 1000,
        questions: [
          {
            questionId: "Q-1",
            userAnswer: "B",
            correctAnswer: "A",
            isCorrect: false,
            category: "Regulations",
          },
        ],
      },
    ];

    render(<MissedPage />);
    fireEvent.change(await screen.findByPlaceholderText(/Create collection/i), {
      target: { value: "Night Ops" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create Collection/i }));

    const collections = listQuestionCollections("test-user");
    expect(collections.some((collection) => collection.name === "Night Ops")).toBe(true);
  });
});
