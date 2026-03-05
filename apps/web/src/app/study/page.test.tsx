import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudyPage from "./page";
import type { Question } from "@part107/core";

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  logEvent: vi.fn(),
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
    logEvent: mocks.logEvent,
  }),
}));

describe("StudyPage", () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams();
    mocks.logEvent.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders study setup with category controls", async () => {
    render(<StudyPage />);
    expect(await screen.findByRole("heading", { name: /Study Mode/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmed Test Questions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All .*questions available/i })).toBeInTheDocument();
  });

  it("shows warning when question type param is invalid", async () => {
    mocks.searchParams = new URLSearchParams("type=invalid_profile");
    render(<StudyPage />);

    expect(await screen.findByText(/Question type .*invalid_profile.* is not available/i)).toBeInTheDocument();
  });

  it("auto-starts a session when category query param is provided", async () => {
    mocks.searchParams = new URLSearchParams("category=Regulations");
    render(<StudyPage />);

    expect(await screen.findByText(/Question 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmed Test Questions/i)).toBeInTheDocument();
  });

  it("auto-starts weak-focus mode from query params", async () => {
    mocks.searchParams = new URLSearchParams("focus=weak");
    render(<StudyPage />);

    expect(await screen.findByText(/Question 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Weak Spots Only/i)).toBeInTheDocument();
  });

  it("uses one-click high-confidence quick actions in-session", async () => {
    const user = userEvent.setup();
    render(<StudyPage />);

    await user.click(await screen.findByRole("button", { name: /All .*questions available/i }));
    await user.click(screen.getByRole("button", { name: /Answer A with high confidence/i }));
    expect(await screen.findByText(/Confidence recorded: 5\/5/i)).toBeInTheDocument();
  });

  it("supports manual confidence capture after selecting an answer", async () => {
    const user = userEvent.setup();
    render(<StudyPage />);

    await user.click(screen.getByRole("button", { name: /All .*questions available/i }));
    await user.click(screen.getByRole("button", { name: /^A\s/i }));
    expect(screen.getByText(/How confident are you\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^3$/ }));
    expect(await screen.findByText(/Confidence recorded: 3\/5/i)).toBeInTheDocument();
  });

  it("allows save-and-exit from an in-progress session", async () => {
    const user = userEvent.setup();
    render(<StudyPage />);

    await user.click(await screen.findByRole("button", { name: /All .*questions available/i }));
    await user.click(screen.getByRole("button", { name: /Answer A with high confidence/i }));
    await user.click(screen.getByRole("button", { name: /Save & Exit/i }));

    expect(await screen.findByRole("heading", { name: /Study Mode/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All .*questions available/i })).toBeInTheDocument();
  });
});
