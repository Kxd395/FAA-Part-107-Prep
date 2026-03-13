import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FlashcardsPage from "./page";
import { writeFlashcardSchedulerSettings } from "../../lib/flashcardSchedulerStore";

const mocks = vi.hoisted(() => ({
  recordAnswer: vi.fn(),
  questions: [] as Array<Record<string, unknown>>,
}));

function makeQuestion(
  id: string,
  questionText: string,
  correctText: string,
  explanation: string
) {
  return {
    id,
    category: "Airspace",
    subcategory: "Class C",
    question_text: questionText,
    figure_reference: "Figure 20",
    image_ref: "/figures/figure-20.png",
    options: [
      { id: "A", text: "Nothing" },
      { id: "B", text: correctText },
      { id: "C", text: "Call tower after" },
      { id: "D", text: "Only fly at night" },
    ],
    correct_option_id: "B",
    explanation_correct: explanation,
    explanation_distractors: {},
    citation: "14 CFR 107.41",
    difficulty_level: 2,
    tags: [],
    source_type: "confirmed_test",
  };
}

vi.mock("../../hooks/useQuestionBank", () => ({
  useQuestionBank: () => ({
    questions: mocks.questions,
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
  const defaultQuestions = [
    makeQuestion(
      "Q-1",
      "What must a remote pilot do before entering Class C airspace?",
      "ATC authorization",
      "ATC authorization is required."
    ),
  ];

  afterEach(() => {
    mocks.questions = [...defaultQuestions];
  });

  beforeEach(() => {
    mocks.questions = [...defaultQuestions];
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders setup controls", () => {
    render(<FlashcardsPage />);
    expect(screen.getByRole("heading", { name: /Flashcards/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /3-Choice Drill/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmed Test Questions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All Categories/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crew Resource Management/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start Flashcards/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /FAA Acronyms/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /NATO Phonetic Alphabet/i })).toBeInTheDocument();
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
    expect(screen.getByText(/^Question$/i)).toBeInTheDocument();
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

  it("records high-confidence rating via quick action", async () => {
    const user = userEvent.setup();
    mocks.recordAnswer.mockReset();
    render(<FlashcardsPage />);

    await user.click(screen.getByRole("button", { name: /All Questions/i }));
    await user.click(screen.getByRole("button", { name: /Start Flashcards/i }));

    await user.click(screen.getByRole("button", { name: /Tap or press Space to reveal answer/i }));
    await user.click(screen.getByRole("button", { name: /Know It with high confidence/i }));
    expect(await screen.findByText(/Deck Complete!/i)).toBeInTheDocument();
    expect(mocks.recordAnswer).toHaveBeenCalled();
  });

  it("supports 3-choice drill mode with answer-first review", async () => {
    const user = userEvent.setup();
    mocks.recordAnswer.mockReset();
    render(<FlashcardsPage />);

    await user.click(screen.getByRole("button", { name: /3-Choice Drill/i }));
    await user.click(screen.getByRole("button", { name: /All Questions/i }));
    await user.click(screen.getByRole("button", { name: /Start Flashcards/i }));

    const optionButtons = screen.getAllByRole("button").filter((button) =>
      /(Nothing|ATC authorization|Call tower after|Only fly at night)/.test(button.textContent ?? "")
    );
    expect(optionButtons).toHaveLength(3);
    expect(screen.queryByText(/Tap or press Space to reveal answer/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ATC authorization/i }));
    expect(await screen.findByText(/Correct\./i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    expect(await screen.findByText(/Deck Complete!/i)).toBeInTheDocument();
    expect(mocks.recordAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "Q-1" }),
      true,
      expect.any(Number),
      expect.objectContaining({
        mode: "flashcard",
        selectedOptionId: "B",
        confidence: 3,
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

  it("allows switching question pool option", async () => {
    const user = userEvent.setup();
    render(<FlashcardsPage />);

    const weakSpotsButton = screen.getByRole("button", { name: /Weak Spots/i });
    await user.click(weakSpotsButton);
    expect(weakSpotsButton.className).toContain("border-brand-500/60");
  });

  it("opens and closes figure modal from the card face", async () => {
    const user = userEvent.setup();
    render(<FlashcardsPage />);

    await user.click(screen.getByRole("button", { name: /All Questions/i }));
    await user.click(screen.getByRole("button", { name: /Start Flashcards/i }));
    const figureButtons = screen.getAllByRole("button", { name: /View Figure 20/i });
    await user.click(figureButtons[figureButtons.length - 1]!);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("does not leak the next card answer when advancing after a reveal", async () => {
    const user = userEvent.setup();
    mocks.questions = [
      makeQuestion(
        "Q-1",
        "What must a remote pilot do before entering Class C airspace?",
        "ATC authorization",
        "ATC authorization is required."
      ),
      makeQuestion(
        "Q-2",
        "What document must a remote pilot present to the FAA on request?",
        "Remote pilot certificate",
        "The remote pilot certificate must be presented on request."
      ),
    ];

    render(<FlashcardsPage />);

    await user.click(screen.getByRole("button", { name: /All Questions/i }));
    await user.click(screen.getByRole("button", { name: /Start Flashcards/i }));
    await user.click(screen.getByRole("button", { name: /Tap or press Space to reveal answer/i }));
    expect(screen.getByText(/ATC authorization is required\./i)).toBeInTheDocument();

    const knowItButton = screen
      .getAllByRole("button")
      .find((button) => (button.textContent ?? "").includes("Know It"));
    expect(knowItButton).toBeDefined();
    await user.click(knowItButton!);

    expect(
      await screen.findByText(/What document must a remote pilot present to the FAA on request\?/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Remote pilot certificate/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Correct Answer/i)).not.toBeInTheDocument();
  });
});
