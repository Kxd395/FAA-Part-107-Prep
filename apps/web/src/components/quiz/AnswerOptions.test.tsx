import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AnswerOptions from "./AnswerOptions";

const options = [
  { id: "A", text: "Option A" },
  { id: "B", text: "Option B" },
  { id: "C", text: "Option C" },
] as const;

describe("AnswerOptions", () => {
  it("supports selection interactions in exam mode", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <AnswerOptions
        options={[...options]}
        mode="exam"
        selectedOption={"B"}
        onSelect={onSelect}
      />
    );

    const optionA = screen.getByRole("button", { name: /Option A/i });
    await user.click(optionA);

    expect(onSelect).toHaveBeenCalledWith("A");
    expect(screen.getByRole("button", { name: /Option B/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows feedback markers in study mode after incorrect answer", () => {
    render(
      <AnswerOptions
        options={[...options]}
        mode="study"
        selectedOption={"B"}
        correctOptionId={"A"}
        answerState="incorrect"
        onSelect={vi.fn()}
        disabled
      />
    );

    expect(screen.getAllByText("✓").length).toBeGreaterThan(0);
    expect(screen.getAllByText("✗").length).toBeGreaterThan(0);
  });
});
