import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import AcronymsPage from "./page";

const EXPANSIONS: Record<string, string> = {
  RPIC: "Remote Pilot in Command",
  UAS: "Unmanned Aircraft System",
  sUAS: "small Unmanned Aircraft System",
  UA: "Unmanned Aircraft",
  VO: "Visual Observer",
  VLOS: "Visual Line of Sight",
  BVLOS: "Beyond Visual Line of Sight",
  FRIA: "FAA-Recognized Identification Area",
  RID: "Remote Identification",
  CRM: "Crew Resource Management",
  ATC: "Air Traffic Control",
  CTAF: "Common Traffic Advisory Frequency",
  LAANC: "Low Altitude Authorization and Notification Capability",
  NOTAM: "Notice to Airmen",
  TFR: "Temporary Flight Restriction",
  AGL: "Above Ground Level",
  MSL: "Mean Sea Level",
  METAR: "Meteorological Aerodrome Report",
  TAF: "Terminal Aerodrome Forecast",
};
const TERMS = Object.keys(EXPANSIONS);

function getCurrentQuizTerm() {
  const termElement = screen.getByText((content, element) => {
    const text = content.trim();
    const className =
      typeof element?.getAttribute("class") === "string" ? element.getAttribute("class") ?? "" : "";

    return TERMS.includes(text) && className.includes("text-6xl");
  });

  return termElement.textContent?.trim() ?? "";
}

vi.mock("../../hooks/useActiveUserId", () => ({
  useActiveUserId: () => "local-user",
}));

vi.mock("../../hooks/useLearningEventLogger", () => ({
  useLearningEventLogger: () => ({
    logEvent: vi.fn(),
  }),
}));

describe("AcronymsPage", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders three quiz choices", async () => {
    const user = userEvent.setup();

    render(<AcronymsPage />);

    await user.click(screen.getByRole("button", { name: /Quick Quiz/i }));

    const quizOptions = screen
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

    expect(quizOptions).toHaveLength(3);
  });

  it("auto-advances after a correct answer", async () => {
    vi.useFakeTimers();

    render(<AcronymsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Quick Quiz/i }));

    const currentTerm = getCurrentQuizTerm();
    const answerText = EXPANSIONS[currentTerm];

    expect(answerText).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: answerText }));

    expect(screen.getByText(/Loading the next question/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getByText(/1 correct in a row/i)).toBeInTheDocument();
    expect(screen.queryByText(/Loading the next question/i)).not.toBeInTheDocument();
    expect(getCurrentQuizTerm()).not.toBe(currentTerm);
  });

  it("shows correction feedback after a wrong answer", async () => {
    const user = userEvent.setup();

    render(<AcronymsPage />);

    await user.click(screen.getByRole("button", { name: /Quick Quiz/i }));

    const currentTerm = getCurrentQuizTerm();
    const correctAnswer = EXPANSIONS[currentTerm];
    const optionButtons = screen
      .getAllByRole("button")
      .filter((button) => {
        const label = button.textContent?.trim() ?? "";
        return (
          !!label &&
          label !== "Flip Cards" &&
          label !== "Quick Quiz" &&
          label !== "Reference Table"
        );
      });

    expect(optionButtons).toHaveLength(3);

    const wrongButton = optionButtons.find(
      (button) => (button.textContent?.trim() ?? "") !== correctAnswer
    );

    expect(wrongButton).toBeDefined();

    await user.click(wrongButton!);

    const feedback = screen.getByText(/You picked/i);

    expect(feedback.textContent).toContain(`The correct answer for ${currentTerm} is`);
    expect(screen.getByText(/0 correct in a row/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
  });
});
