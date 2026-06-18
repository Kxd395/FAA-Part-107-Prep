import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import PhoneticPage from "./page";

const DIGIT_WORDS: Record<string, string> = {
  "0": "Zero",
  "1": "One",
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
};

function getCurrentPhoneticCharacter() {
  const characterElement = screen.getByRole("heading", {
    name: /^Current phonetic character:/i,
  });

  return characterElement.textContent?.trim() ?? "";
}

vi.mock("../../hooks/useActiveUserId", () => ({
  useActiveUserId: () => "local-user",
}));

vi.mock("../../hooks/useLearningEventLogger", () => ({
  useLearningEventLogger: () => ({
    logEvent: vi.fn(),
  }),
}));

describe("PhoneticPage", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("advances to the next card without leaking the answer side", async () => {
    const user = userEvent.setup();

    render(<PhoneticPage />);

    const card = screen.getByRole("button", { name: /Study A/i });
    expect(within(card).getByText(/^A$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^AL FAH$/i)).not.toBeInTheDocument();

    await user.click(card);
    const revealedCard = screen.getByRole("button", { name: /Study A/i });
    expect(within(revealedCard).getByText(/Alfa/i)).toBeInTheDocument();
    expect(within(revealedCard).getByText(/^AL FAH$/i)).toBeInTheDocument();

    await user.click(card);

    const nextCard = screen.getByRole("button", { name: /Study B/i });
    expect(nextCard).not.toBe(card);
    expect(within(nextCard).getByText(/^B$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^BRAH VOH$/i)).not.toBeInTheDocument();
  });

  it("keeps quiz answer order stable after selecting an option", async () => {
    const user = userEvent.setup();
    const randomValues = [
      0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
      0.0, 0.99,
      0.99, 0.0,
    ];
    let randomIndex = 0;
    vi.spyOn(Math, "random").mockImplementation(() => randomValues[randomIndex++] ?? 0.5);

    render(<PhoneticPage />);

    await user.selectOptions(screen.getByRole("combobox"), "digits");
    await user.click(screen.getByRole("button", { name: /Quick Quiz/i }));

    const getQuizOptions = () =>
      screen
        .getAllByRole("button")
        .map((button) => button.textContent?.trim() ?? "")
        .filter(
          (label) =>
            !!label &&
            label !== "Flip Cards" &&
            label !== "Quick Quiz" &&
            label !== "Reference Table" &&
            label !== "Next"
        );

    const before = getQuizOptions();
    expect(before).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: before[0] }));

    const after = getQuizOptions();
    expect(after).toEqual(before);
  });

  it("auto-advances after a correct quiz answer", async () => {
    vi.useFakeTimers();

    render(<PhoneticPage />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "digits" } });
    fireEvent.click(screen.getByRole("button", { name: /Quick Quiz/i }));

    const currentCharacter = getCurrentPhoneticCharacter();
    const correctAnswer = DIGIT_WORDS[currentCharacter];
    expect(correctAnswer).toBeDefined();
    expect(screen.getByText(/0 correct in a row/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: correctAnswer }));
    expect(screen.getByText(/Loading the next question/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getByText(/1 correct in a row/i)).toBeInTheDocument();
    expect(screen.queryByText(/Loading the next question/i)).not.toBeInTheDocument();
  });

  it("shows correction feedback after a wrong quiz answer", async () => {
    const user = userEvent.setup();

    render(<PhoneticPage />);

    await user.selectOptions(screen.getByRole("combobox"), "digits");
    await user.click(screen.getByRole("button", { name: /Quick Quiz/i }));

    const currentCharacter = getCurrentPhoneticCharacter();
    const correctAnswer = DIGIT_WORDS[currentCharacter];
    expect(correctAnswer).toBeDefined();

    const wrongAnswer = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim() ?? "")
      .find(
        (label) =>
          !!label &&
          label !== "Flip Cards" &&
          label !== "Quick Quiz" &&
          label !== "Reference Table" &&
          label !== correctAnswer
      );

    expect(wrongAnswer).toBeDefined();
    await user.click(screen.getByRole("button", { name: wrongAnswer! }));

    expect(
      screen.getByText((_, element) =>
        element?.textContent === `You picked ${wrongAnswer}. The correct answer for ${currentCharacter} is ${correctAnswer}.`
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/0 correct in a row/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
  });
});
