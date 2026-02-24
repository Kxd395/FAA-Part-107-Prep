import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LearnPage from "./page";

afterEach(() => {
  cleanup();
});

vi.mock("../../hooks/useQuestionBank", () => ({
  useQuestionBank: () => ({
    questions: [
      {
        id: "Q-1",
        category: "Airspace",
        subcategory: "Class C",
        question_text: "Q1",
        figure_reference: null,
        options: [
          { id: "A", text: "A1" },
          { id: "B", text: "B1" },
          { id: "C", text: "C1" },
          { id: "D", text: "D1" },
        ],
        correct_option_id: "B",
        explanation_correct: "Because",
        explanation_distractors: {},
        citation: "14 CFR 107.41",
        difficulty_level: 2,
        tags: [],
        source_type: "confirmed_test",
      },
      {
        id: "Q-2",
        category: "Airspace",
        subcategory: "Class D",
        question_text: "Q2",
        figure_reference: null,
        options: [
          { id: "A", text: "A2" },
          { id: "B", text: "B2" },
          { id: "C", text: "C2" },
          { id: "D", text: "D2" },
        ],
        correct_option_id: "C",
        explanation_correct: "Because",
        explanation_distractors: {},
        citation: "14 CFR 107.41",
        difficulty_level: 2,
        tags: [],
        source_type: "confirmed_test",
      },
    ],
    loaded: true,
    loading: false,
    error: null,
    warning: null,
    snapshotInfo: null,
    source: "local",
    counts: { All: 2, Regulations: 0, Airspace: 2, Weather: 0, "Loading & Performance": 0, Operations: 0 },
    reload: vi.fn(),
    clearSnapshot: vi.fn(),
  }),
}));

vi.mock("../../hooks/useAdaptiveQuestionStats", () => ({
  useAdaptiveQuestionStats: () => ({
    userId: "local-user",
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

vi.mock("../../hooks/useLearningEventLogger", () => ({
  useLearningEventLogger: () => ({
    logEvent: vi.fn(),
  }),
}));

function seedLearnDraft() {
  localStorage.setItem(
    "part107_learn_draft_v1",
    JSON.stringify({
      version: 1,
      updatedAt: "2026-02-24T00:00:00.000Z",
      roundStartedAt: 1708732800000,
      selectedQuestionType: "confirmed_test",
      selectedCategory: "All",
      batchSize: 5,
      round: 1,
      phase: "quiz",
      batchIds: ["Q-1", "Q-2"],
      teachIndex: 0,
      quizOrderIds: ["Q-1", "Q-2"],
      quizIndex: 0,
      selectedAnswer: null,
      selectedConfidence: null,
      showResult: false,
      quizResults: [],
    })
  );
}

describe("LearnPage draft resume flow", () => {
  it("discards saved draft from setup", async () => {
    const user = userEvent.setup();
    seedLearnDraft();

    render(<LearnPage />);
    expect(await screen.findByText(/Saved Learn Session Found/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Discard Saved Session/i }));
    await waitFor(() => {
      expect(localStorage.getItem("part107_learn_draft_v1")).toBeNull();
    });
  });

  it("resumes saved quiz and allows save & exit back to setup", async () => {
    const user = userEvent.setup();
    seedLearnDraft();

    render(<LearnPage />);
    await user.click(await screen.findByRole("button", { name: /Resume Session/i }));
    expect(await screen.findByText(/Round 1 — Remaining/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Save & Exit/i })[0]);
    expect(await screen.findByRole("heading", { name: /^Learn Mode$/i })).toBeInTheDocument();
    expect(screen.getByText(/Saved Learn Session Found/i)).toBeInTheDocument();
  });
});
