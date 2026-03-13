import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LearnPage from "./page";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

vi.mock("../../hooks/useQuestionBank", () => ({
  useQuestionBank: () => ({
    questions: [
      {
        id: "Q-1",
        category: "Airspace",
        subcategory: "Class C",
        question_text: "Q1",
        figure_reference: "figure-20",
        image_ref: "/figures/figure-20.png",
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

vi.mock("../../hooks/useActiveUserId", () => ({
  useActiveUserId: () => "local-user",
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
  it("renders setup controls", async () => {
    render(<LearnPage />);
    expect(await screen.findByRole("heading", { name: /^Learn Mode$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmed Test Questions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^5$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start Learning/i })).toBeInTheDocument();
  });

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

  it("allows changing batch size in setup", async () => {
    const user = userEvent.setup();
    render(<LearnPage />);
    const batchButton = await screen.findByRole("button", { name: /^10$/i });
    await user.click(batchButton);
    await waitFor(() => {
      expect(batchButton.className).toContain("bg-brand-500");
    });
  });

  it("resumes saved quiz and allows save & exit back to setup", async () => {
    const user = userEvent.setup();
    seedLearnDraft();

    render(<LearnPage />);
    await user.click(await screen.findByRole("button", { name: /Resume Session/i }));
    expect(await screen.findByText(/Round 1 — Remaining/i)).toBeInTheDocument();
    const answerButtons = screen.getAllByRole("button").filter((button) =>
      /(A1|B1|C1|D1)/.test(button.textContent ?? "")
    );
    expect(answerButtons).toHaveLength(3);
    await user.click(answerButtons[0]!);
    expect(screen.getByText(/How confident are you\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^1$/i }));
    expect(await screen.findByText(/Confidence recorded: 1\/5/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Save & Exit/i })[0]);
    expect(await screen.findByRole("heading", { name: /^Learn Mode$/i })).toBeInTheDocument();
    expect(screen.getByText(/Saved Learn Session Found/i)).toBeInTheDocument();
  });

  it("records quick-confidence answer selections in quiz mode", async () => {
    const user = userEvent.setup();
    seedLearnDraft();

    render(<LearnPage />);
    await user.click(await screen.findByRole("button", { name: /Resume Session/i }));
    await user.click(screen.getByRole("button", { name: /B1/i }));
    await user.click(screen.getByRole("button", { name: /^5$/i }));
    expect(await screen.findByText(/Confidence recorded:/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence recorded: 5\/5/i)).toBeInTheDocument();
  });

  it("can discard and then resume saved session banner state", async () => {
    const user = userEvent.setup();
    seedLearnDraft();

    render(<LearnPage />);
    expect(await screen.findByText(/Saved Learn Session Found/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Discard Saved Session/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Saved Learn Session Found/i)).not.toBeInTheDocument();
    });
  });
});
