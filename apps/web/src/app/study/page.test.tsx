import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudyPage from "./page";
import type { Question } from "@part107/core";
import { writeStudySetupPresetSelection } from "../../lib/sessionPresetStore";
import { writeBookmarkedQuestionIds } from "../../lib/questionCollectionStore";
import { readSessionPresetTemplates } from "../../lib/sessionPresetStore";
import { readStudySetupPresetSelection } from "../../lib/sessionPresetStore";
import { writeLearningPreferences } from "../../lib/learningPreferencesStore";

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
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

vi.mock("../../hooks/useAdaptiveQuestionStats", () => ({
  useAdaptiveQuestionStats: () => ({
    userId: "test-user",
    statsByKey: {},
    config: { includeChoicesInCanonicalKey: false },
    recordAnswer: vi.fn(),
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

describe("StudyPage", () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders study setup with category controls", async () => {
    render(<StudyPage />);
    expect(await screen.findByRole("heading", { name: /Study Mode/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All .*questions available/i })).toBeInTheDocument();
  });

  it("shows warning when question type param is invalid", async () => {
    mocks.searchParams = new URLSearchParams("type=invalid_profile");
    render(<StudyPage />);

    expect(await screen.findByText(/Question type .*invalid_profile.* is not available/i)).toBeInTheDocument();
  });

  it("shows in-session confidence controls and applies selected value", async () => {
    const user = userEvent.setup();
    render(<StudyPage />);

    await user.click(await screen.findByRole("button", { name: /All .*questions available/i }));
    expect(screen.getByText(/Confidence for next answer:/i)).toBeInTheDocument();
    expect(screen.getByText("3/5", { selector: "code" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^2$/i }));
    expect(screen.getByText("2/5", { selector: "code" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Option A/i }));
    expect(await screen.findByText(/Confidence recorded: 2\/5/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence for next answer:/i)).toBeInTheDocument();
  });

  it("supports timed drill preset and shows countdown in session header", async () => {
    const user = userEvent.setup();
    render(<StudyPage />);

    await user.click(await screen.findByRole("button", { name: /^5 min$/i }));
    await user.click(screen.getByRole("button", { name: /All .*questions available/i }));

    expect(screen.getByText(/⏱ 4:5[0-9]/i)).toBeInTheDocument();
  });

  it("supports study length presets beyond 20 questions", async () => {
    const user = userEvent.setup();
    render(<StudyPage />);

    await user.click(await screen.findByRole("button", { name: /^60$/i }));
    await user.click(screen.getByRole("button", { name: /All .*questions available/i }));

    await screen.findByText(/Question 1 of 2/i);
    expect(readStudySetupPresetSelection("test-user")?.lengthPresetId).toBe("intense_60");
  });

  it("restores persisted timed drill preset for active user", async () => {
    const user = userEvent.setup();
    writeStudySetupPresetSelection("test-user", {
      lengthPresetId: "focus_20",
      timerPresetId: "10m",
    });

    render(<StudyPage />);

    await user.click(await screen.findByRole("button", { name: /All .*questions available/i }));
    expect(screen.getByText(/⏱ 9:5[0-9]/i)).toBeInTheDocument();
  });

  it("supports bookmarks collection filter in setup", async () => {
    mocks.searchParams = new URLSearchParams("collection=bookmarks");
    writeBookmarkedQuestionIds("test-user", ["Q-1"]);

    render(<StudyPage />);
    expect(await screen.findByText(/Collection filter active: Bookmarks/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All .*1 questions available/i })).toBeInTheDocument();
  });

  it("creates a named collection from setup", async () => {
    const user = userEvent.setup();
    render(<StudyPage />);

    await user.type(screen.getByPlaceholderText(/Create collection name/i), "Ops Focus");
    await user.click(screen.getByRole("button", { name: /Create Collection/i }));

    expect(await screen.findByText(/Created collection "Ops Focus"/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Ops Focus \(0\)/i })).toBeInTheDocument();
  });

  it("toggles bookmark on current question in-session", async () => {
    const user = userEvent.setup();
    render(<StudyPage />);

    await user.click(await screen.findByRole("button", { name: /All .*questions available/i }));
    const bookmarkButton = screen.getByRole("button", { name: /☆ Bookmark/i });
    await user.click(bookmarkButton);
    expect(screen.getByRole("button", { name: /★ Bookmarked/i })).toBeInTheDocument();
  });

  it("creates a study session template from setup", async () => {
    const user = userEvent.setup();
    render(<StudyPage />);

    await user.type(screen.getByPlaceholderText(/Save current setup as template/i), "Quick Focus");
    await user.click(screen.getByRole("button", { name: /Save Template/i }));

    const templates = readSessionPresetTemplates("test-user");
    expect(templates.some((template) => template.name === "Quick Focus")).toBe(true);
  });

  it("deletes a selected session template from setup", async () => {
    const user = userEvent.setup();
    render(<StudyPage />);

    await user.type(screen.getByPlaceholderText(/Save current setup as template/i), "Delete Me");
    await user.click(screen.getByRole("button", { name: /Save Template/i }));
    expect(readSessionPresetTemplates("test-user").some((template) => template.name === "Delete Me")).toBe(
      true
    );

    await user.click(screen.getByRole("button", { name: /^Delete$/i }));
    expect(await screen.findByText(/Click "Confirm Delete" to remove this template/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Confirm Delete/i }));
    expect(readSessionPresetTemplates("test-user").some((template) => template.name === "Delete Me")).toBe(
      false
    );
  });

  it("shows 3-option practice-mode context during a session", async () => {
    const user = userEvent.setup();
    render(<StudyPage />);

    await user.click(await screen.findByRole("button", { name: /All .*questions available/i }));
    expect(
      screen.getByText(/Practice mode is showing 3 options for this question to reduce memorization/i)
    ).toBeInTheDocument();
  });

  it("shows preferred category quick-start when configured", async () => {
    writeLearningPreferences("test-user", {
      defaultStudyCategory: "Regulations",
      defaultExamCategory: "All",
      defaultLearnBatchSize: 5,
      defaultFlashcardDailyReviewTarget: 20,
      weeklyStudyGoalSessions: 5,
      weeklyExamGoalSessions: 2,
    });
    render(<StudyPage />);

    const preferredButton = await screen.findByRole("button", {
      name: /Start Preferred Category/i,
    });
    expect(preferredButton).toBeInTheDocument();
    expect(within(preferredButton).getByText(/Regulations \(2 questions\)/i)).toBeInTheDocument();
  });
});
