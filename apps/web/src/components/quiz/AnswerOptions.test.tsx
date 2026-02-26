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

  it("renders custom display labels while preserving underlying option ids", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <AnswerOptions
        options={[...options]}
        mode="exam"
        selectedOption={null}
        displayLabelByOptionId={{ A: "C", B: "A", C: "B" }}
        onSelect={onSelect}
      />
    );

    expect(screen.getByRole("button", { name: /C Option A/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /C Option A/i }));
    expect(onSelect).toHaveBeenCalledWith("A");
  });

  it("supports split confidence actions", async () => {
    const onSelect = vi.fn();
    const onSelectWithConfidence = vi.fn();
    const user = userEvent.setup();

    render(
      <AnswerOptions
        options={[...options]}
        mode="study"
        selectedOption={null}
        answerState="unanswered"
        onSelect={onSelect}
        onSelectWithConfidence={onSelectWithConfidence}
        showConfidenceSplit
        defaultConfidence={3}
        confidentConfidence={5}
      />
    );

    const optionAButtons = screen.getAllByRole("button", { name: /Option A/i });
    await user.click(optionAButtons[optionAButtons.length - 1]);
    expect(onSelectWithConfidence).toHaveBeenCalledWith("A", 3);

    await user.click(screen.getByRole("button", { name: /Answer A as Not Sure/i }));
    expect(onSelectWithConfidence).toHaveBeenCalledWith("A", 1);

    await user.click(screen.getByRole("button", { name: /Answer A as Confident/i }));
    expect(onSelectWithConfidence).toHaveBeenCalledWith("A", 5);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("supports high-only split confidence mode", async () => {
    const onSelect = vi.fn();
    const onSelectWithConfidence = vi.fn();
    const user = userEvent.setup();

    render(
      <AnswerOptions
        options={[...options]}
        mode="study"
        selectedOption={null}
        answerState="unanswered"
        onSelect={onSelect}
        onSelectWithConfidence={onSelectWithConfidence}
        showConfidenceSplit
        splitConfidenceMode="high_only"
        confidentConfidence={5}
      />
    );

    const optionAButtons = screen.getAllByRole("button", { name: /Option A/i });
    await user.click(optionAButtons[optionAButtons.length - 1]);
    expect(onSelect).toHaveBeenCalledWith("A");
    expect(onSelectWithConfidence).not.toHaveBeenCalled();

    const highConfidenceButtons = screen.getAllByRole("button", {
      name: /Answer A with high confidence/i,
    });
    await user.click(highConfidenceButtons[highConfidenceButtons.length - 1]);
    expect(onSelectWithConfidence).toHaveBeenCalledWith("A", 5);
  });
});
