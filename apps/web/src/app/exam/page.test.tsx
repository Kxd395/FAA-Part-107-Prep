import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExamPage from "./page";
import type { Question } from "@part107/core";
import { writeExamStrictConfirmedOnly } from "../../lib/examGuardrailStore";
import { writeExamSetupPresetSelection } from "../../lib/sessionPresetStore";
import { writeBookmarkedQuestionIds } from "../../lib/questionCollectionStore";
import { readSessionPresetTemplates } from "../../lib/sessionPresetStore";
import { writeLearningPreferences } from "../../lib/learningPreferencesStore";

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
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

function makeQuestion(id: string, category: string = "Regulations"): Question {
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
    logEvent: vi.fn(),
  }),
}));

describe("ExamPage", () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams();
    mocks.attemptEvents = [];
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

  it("shows in-session confidence controls before answering", async () => {
    const user = userEvent.setup();
    render(<ExamPage />);

    await user.click(await screen.findByRole("button", { name: /Begin Exam/i }));
    expect(screen.getByText(/Confidence for next answer:/i)).toBeInTheDocument();
    expect(screen.getByText("3/5", { selector: "code" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^2$/i }));
    expect(screen.getByText("2/5", { selector: "code" })).toBeInTheDocument();
  });

  it("supports timer preset override from setup", async () => {
    const user = userEvent.setup();
    render(<ExamPage />);

    await user.click(await screen.findByRole("button", { name: /^15 min$/i }));
    await user.click(screen.getByRole("button", { name: /Begin Exam/i }));

    expect(screen.getByText(/⏱ 15:00/i)).toBeInTheDocument();
  });

  it("restores persisted timer preset for active user", async () => {
    const user = userEvent.setup();
    writeExamSetupPresetSelection("test-user", {
      lengthPresetId: "half",
      timerPresetId: "30m",
    });

    render(<ExamPage />);
    await user.click(await screen.findByRole("button", { name: /Begin Exam/i }));

    expect(screen.getByText(/⏱ 30:00/i)).toBeInTheDocument();
  });

  it("enforces strict confirmed-only guardrail when enabled", async () => {
    const user = userEvent.setup();
    writeExamStrictConfirmedOnly("test-user", true);

    render(<ExamPage />);
    await user.click(screen.getByRole("button", { name: /All Questions \(Random\)/i }));
    const beginButton = await screen.findByRole("button", { name: /Begin Exam/i });

    expect(beginButton).toBeDisabled();
    expect(screen.getByText(/Strict confirmed-only mode is enabled/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Switch to Confirmed Test Questions/i }));
    expect(beginButton).toBeEnabled();
  });

  it("runs a flagged-review pass before final submission", async () => {
    const user = userEvent.setup();
    render(<ExamPage />);

    await user.click(await screen.findByRole("button", { name: /Begin Exam/i }));
    await user.click(screen.getByRole("button", { name: /Flag for Review/i }));
    await user.click(screen.getByRole("button", { name: /^Next →$/i }));

    const reviewBeforeSubmitButton = screen.getByRole("button", {
      name: /Review Flagged Before Submit/i,
    });
    await user.click(reviewBeforeSubmitButton);

    expect(screen.getByText(/Flagged review pass active/i)).toBeInTheDocument();
    expect(screen.getByText(/Q 1 \/ 2/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Submit Exam ✓$/i }));
    expect(await screen.findByRole("heading", { name: /Not Quite/i })).toBeInTheDocument();
  });

  it("supports weak-domain mock generator shortcut", async () => {
    const user = userEvent.setup();
    render(<ExamPage />);

    await user.click(await screen.findByRole("button", { name: /Generate Weak-Domain Mock/i }));
    await user.click(screen.getByRole("button", { name: /Begin Exam/i }));
    expect(screen.getByText(/Weak Spots Only/i)).toBeInTheDocument();
  });

  it("supports bookmarks collection filter in setup", async () => {
    mocks.searchParams = new URLSearchParams("collection=bookmarks");
    writeBookmarkedQuestionIds("test-user", ["Q-1"]);

    render(<ExamPage />);
    expect(
      await screen.findByText(/Collection filter active: Bookmarks \(1 saved\)/i)
    ).toBeInTheDocument();
  });

  it("shows weak-domain category targeting buttons from attempt history", async () => {
    const user = userEvent.setup();
    mocks.attemptEvents = [
      {
        attemptId: "1",
        userId: "test-user",
        questionKey: "A",
        questionId: "Q-1",
        timestamp: "2026-02-25T00:00:00.000Z",
        mode: "practice",
        correct: false,
        responseTimeMs: 5000,
        selectedOptionId: "A",
        quizId: null,
        topicTags: ["Operations"],
        difficulty: 2,
        confidence: 3,
      },
      {
        attemptId: "2",
        userId: "test-user",
        questionKey: "B",
        questionId: "Q-2",
        timestamp: "2026-02-25T00:01:00.000Z",
        mode: "practice",
        correct: false,
        responseTimeMs: 4000,
        selectedOptionId: "B",
        quizId: null,
        topicTags: ["Operations"],
        difficulty: 2,
        confidence: 3,
      },
    ];

    render(<ExamPage />);
    await user.click(await screen.findByRole("button", { name: /Operations - 0%/i }));

    expect(await screen.findByText(/Topic: Operations/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Begin Operations Test/i })).toBeInTheDocument();
  });

  it("toggles bookmark on current question in-session", async () => {
    const user = userEvent.setup();
    render(<ExamPage />);

    await user.click(await screen.findByRole("button", { name: /Begin Exam/i }));
    await user.click(screen.getByRole("button", { name: /☆ Bookmark/i }));
    expect(screen.getByRole("button", { name: /★ Bookmarked/i })).toBeInTheDocument();
  });

  it("creates an exam session template from setup", async () => {
    const user = userEvent.setup();
    render(<ExamPage />);

    await user.type(screen.getByPlaceholderText(/Save current setup as template/i), "Exam Sprint");
    await user.click(screen.getByRole("button", { name: /Save Template/i }));

    const templates = readSessionPresetTemplates("test-user");
    expect(templates.some((template) => template.name === "Exam Sprint")).toBe(true);
  });

  it("renames a selected session template from setup", async () => {
    const user = userEvent.setup();
    render(<ExamPage />);

    await user.type(screen.getByPlaceholderText(/Save current setup as template/i), "Old Name");
    await user.click(screen.getByRole("button", { name: /Save Template/i }));
    expect(readSessionPresetTemplates("test-user").some((template) => template.name === "Old Name")).toBe(
      true
    );

    await user.type(screen.getByPlaceholderText(/Save current setup as template/i), "Renamed");
    await user.click(screen.getByRole("button", { name: /Rename/i }));
    expect(readSessionPresetTemplates("test-user").some((template) => template.name === "Renamed")).toBe(
      true
    );
  });

  it("requires confirmation before deleting a template", async () => {
    const user = userEvent.setup();
    render(<ExamPage />);

    await user.type(screen.getByPlaceholderText(/Save current setup as template/i), "Delete Exam");
    await user.click(screen.getByRole("button", { name: /Save Template/i }));
    expect(readSessionPresetTemplates("test-user").some((template) => template.name === "Delete Exam")).toBe(
      true
    );

    await user.click(screen.getByRole("button", { name: /^Delete$/i }));
    expect(await screen.findByText(/Click "Confirm Delete" to remove this template/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Confirm Delete/i }));
    expect(readSessionPresetTemplates("test-user").some((template) => template.name === "Delete Exam")).toBe(
      false
    );
  });

  it("hydrates default exam category from learning preferences", async () => {
    writeLearningPreferences("test-user", {
      defaultStudyCategory: "All",
      defaultExamCategory: "Operations",
      defaultLearnBatchSize: 5,
      defaultFlashcardDailyReviewTarget: 20,
      weeklyStudyGoalSessions: 5,
      weeklyExamGoalSessions: 2,
    });

    render(<ExamPage />);
    expect(await screen.findByText(/Topic: Operations/i)).toBeInTheDocument();
  });

  it("shows 3-option practice-mode context during an exam question", async () => {
    const user = userEvent.setup();
    render(<ExamPage />);

    await user.click(await screen.findByRole("button", { name: /Begin Exam/i }));
    expect(
      screen.getByText(/Practice mode is showing 3 options for this question to reduce memorization/i)
    ).toBeInTheDocument();
  });
});
