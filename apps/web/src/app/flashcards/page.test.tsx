import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import FlashcardsPage from "./page";
import { writeFlashcardSchedulerSettings } from "../../lib/flashcardSchedulerStore";

const mocks = vi.hoisted(() => ({
  recordAnswer: vi.fn(),
}));

vi.mock("../../hooks/useQuestionBank", () => ({
  useQuestionBank: () => ({
    questions: [
      {
        id: "Q-1",
        category: "Airspace",
        subcategory: "Class C",
        question_text: "What must a remote pilot do before entering Class C airspace?",
        figure_reference: null,
        options: [
          { id: "A", text: "Nothing" },
          { id: "B", text: "ATC authorization" },
          { id: "C", text: "Call tower after" },
          { id: "D", text: "Only fly at night" },
        ],
        correct_option_id: "B",
        explanation_correct: "ATC authorization is required.",
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
    counts: { All: 1, Regulations: 0, Airspace: 1, Weather: 0, "Loading & Performance": 0, Operations: 0 },
    reload: vi.fn(),
    clearSnapshot: vi.fn(),
  }),
}));

vi.mock("../../hooks/useAdaptiveQuestionStats", () => ({
  useAdaptiveQuestionStats: () => ({
    userId: "local-user",
    statsByKey: {},
    config: { includeChoicesInCanonicalKey: false },
    recordAnswer: mocks.recordAnswer,
  }),
}));

vi.mock("../../hooks/useActiveUserId", () => ({
  useActiveUserId: () => "local-user",
}));

vi.mock("../../hooks/useLearningEventLogger", () => ({
  useLearningEventLogger: () => ({
    logEvent: vi.fn(),
  }),
}));

describe("FlashcardsPage", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("reveals answer and returns to question without blank card", async () => {
    const user = userEvent.setup();
    render(<FlashcardsPage />);

    await user.click(screen.getByRole("button", { name: /All Questions/i }));
    await user.click(screen.getByRole("button", { name: /Start Flashcards/i }));
    expect(
      screen.getByText(/What must a remote pilot do before entering Class C airspace\?/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Tap or press Space to reveal answer/i }));
    expect(screen.getByText(/Correct Answer/i)).toBeInTheDocument();
    expect(screen.getByText(/ATC authorization is required\./i)).toBeInTheDocument();

    await user.click(screen.getByText(/Show Question/i, { selector: "button" }));
    expect(screen.getByText(/Question/i)).toBeInTheDocument();
    expect(
      screen.getByText(/What must a remote pilot do before entering Class C airspace\?/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Tap or press Space to reveal answer/i)).toBeInTheDocument();
  });

  it("supports keyboard reveal and rating shortcuts", async () => {
    const user = userEvent.setup();
    render(<FlashcardsPage />);

    await user.click(screen.getByRole("button", { name: /All Questions/i }));
    await user.click(screen.getByRole("button", { name: /Start Flashcards/i }));

    fireEvent.keyDown(window, { key: " " });
    expect(screen.getAllByText(/Correct Answer/i).length).toBeGreaterThan(0);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getAllByText(/Deck Complete!/i).length).toBeGreaterThan(0);
  });

  it("supports optional high-confidence split rating actions", async () => {
    const user = userEvent.setup();
    render(<FlashcardsPage />);

    await user.click(screen.getByRole("button", { name: /All Questions/i }));
    await user.click(screen.getByRole("button", { name: /Start Flashcards/i }));
    await user.click(screen.getByRole("button", { name: /Tap or press Space to reveal answer/i }));

    await user.click(screen.getByRole("button", { name: /Know It with high confidence/i }));
    expect(screen.getAllByText(/Deck Complete!/i).length).toBeGreaterThan(0);
  });

  it("shows confidence selector before reveal and applies selected confidence", async () => {
    const user = userEvent.setup();
    mocks.recordAnswer.mockReset();
    render(<FlashcardsPage />);

    await user.click(screen.getByRole("button", { name: /All Questions/i }));
    await user.click(screen.getByRole("button", { name: /Start Flashcards/i }));

    expect(screen.getByText(/Confidence for next rating:/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^2$/i }));
    expect(screen.getByText("2/5", { selector: "code" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Tap or press Space to reveal answer/i }));
    await user.click(screen.getByRole("button", { name: /^✅ Know It/i }));
    expect(mocks.recordAnswer).toHaveBeenCalledWith(
      expect.any(Object),
      true,
      expect.any(Number),
      expect.objectContaining({
        confidence: 2,
      })
    );
  });

  it("disables start when max new cards/day is reached with only new cards available", async () => {
    writeFlashcardSchedulerSettings("local-user", {
      dailyReviewTarget: 20,
      maxNewCardsPerDay: 0,
      lapseHandling: "balanced",
      maxPerCategory: 0,
      weeklyReviewGoal: 40,
    });

    render(<FlashcardsPage />);

    const startButton = screen.getByRole("button", { name: /Start Flashcards/i });
    expect(startButton).toBeDisabled();
    expect(startButton).toHaveTextContent("0 cards");
  });

  it("hydrates preferred question type for active user", () => {
    localStorage.setItem("part107_default_question_type_v1", "weak_spots");
    render(<FlashcardsPage />);

    const weakSpotsButton = screen.getByRole("button", { name: /Weak Spots Only/i });
    return waitFor(() => {
      expect(weakSpotsButton.className).toContain("border-brand-500/60");
    });
  });

  it("renders weekly plan controls in setup", () => {
    render(<FlashcardsPage />);
    expect(screen.getByText(/Weekly Plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Week progress:/i)).toBeInTheDocument();
    expect(screen.getByText(/Weekly Review Goal/i)).toBeInTheDocument();
  });

  it("hydrates default flashcard daily target from learning preferences when scheduler settings are missing", async () => {
    localStorage.setItem(
      "part107_learning_preferences_v1",
      JSON.stringify({
        defaultStudyCategory: "All",
        defaultExamCategory: "All",
        defaultLearnBatchSize: 5,
        defaultFlashcardDailyReviewTarget: 30,
        weeklyStudyGoalSessions: 5,
        weeklyExamGoalSessions: 2,
      })
    );

    render(<FlashcardsPage />);
    const targetButton = await screen.findByRole("button", { name: /^30$/i });
    await waitFor(() => {
      expect(targetButton.className).toContain("border-brand-400");
    });
  });
});
