import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FlashcardsPage from "./page";

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
    recordAnswer: vi.fn(),
  }),
}));

vi.mock("../../hooks/useLearningEventLogger", () => ({
  useLearningEventLogger: () => ({
    logEvent: vi.fn(),
  }),
}));

describe("FlashcardsPage", () => {
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
});
