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
  it("hydrates preferred question type for active user", async () => {
    localStorage.setItem("part107_default_question_type_v1", "weak_spots");
    render(<LearnPage />);

    const weakSpotsButton = await screen.findByRole("button", { name: /Weak Spots Only/i });
    await waitFor(() => {
      expect(weakSpotsButton.className).toContain("border-brand-500/60");
    });
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

  it("hydrates default learn batch size from learning preferences", async () => {
    localStorage.setItem(
      "part107_learning_preferences_v1",
      JSON.stringify({
        defaultStudyCategory: "All",
        defaultExamCategory: "All",
        defaultLearnBatchSize: 10,
        defaultFlashcardDailyReviewTarget: 20,
        weeklyStudyGoalSessions: 5,
        weeklyExamGoalSessions: 2,
      })
    );
    render(<LearnPage />);
    const batchButton = await screen.findByRole("button", { name: /^10$/i });
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
    expect(screen.getByRole("img", { name: /figure-20/i })).toBeInTheDocument();
    expect(screen.getByText(/Confidence for next answer:/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^2$/i }));
    expect(screen.getByText("2/5", { selector: "code" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Save & Exit/i })[0]);
    expect(await screen.findByRole("heading", { name: /^Learn Mode$/i })).toBeInTheDocument();
    expect(screen.getByText(/Saved Learn Session Found/i)).toBeInTheDocument();
  });

  it("keeps confidence editable while review is visible", async () => {
    const user = userEvent.setup();
    seedLearnDraft();

    render(<LearnPage />);
    await user.click(await screen.findByRole("button", { name: /Resume Session/i }));
    await user.click(screen.getByRole("button", { name: /B1/i }));

    expect(await screen.findByText(/Confidence recorded:/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence for next answer:/i)).toBeInTheDocument();
    expect(screen.getByText(/Adjust this before Next\/Review Again/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^5$/i }));
    expect(screen.getByText("5/5", { selector: "code" })).toBeInTheDocument();
  });

  it("supports figure modal open/close parity for keyboard and mobile viewport", async () => {
    const user = userEvent.setup();
    seedLearnDraft();
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 390 });
    window.dispatchEvent(new Event("resize"));

    render(<LearnPage />);
    await user.click(await screen.findByRole("button", { name: /Resume Session/i }));

    const figureButton = screen.getByRole("button", { name: /Figure 20/i });
    await user.click(figureButton);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    figureButton.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: originalInnerWidth });
  });
});
