import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import QuestionTypeOptionsGrid from "./QuestionTypeOptionsGrid";
import { SELECTABLE_QUESTION_TYPE_OPTIONS } from "../lib/questionTypeOptions";

describe("QuestionTypeOptionsGrid", () => {
  it("renders options and forwards selected value changes", async () => {
    const user = userEvent.setup();
    const onSelectQuestionType = vi.fn();

    render(
      <QuestionTypeOptionsGrid
        title="Question Pool"
        options={SELECTABLE_QUESTION_TYPE_OPTIONS.slice(0, 2)}
        selectedQuestionType="confirmed_test"
        onSelectQuestionType={onSelectQuestionType}
      />
    );

    expect(screen.getByText("Question Pool")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /all questions \(random\)/i }));

    expect(onSelectQuestionType).toHaveBeenCalledWith("all_random");
  });

  it("renders compact variant and shows selected description", async () => {
    const user = userEvent.setup();
    const onSelectQuestionType = vi.fn();
    cleanup();

    render(
      <QuestionTypeOptionsGrid
        title="Question Pool"
        options={SELECTABLE_QUESTION_TYPE_OPTIONS.slice(0, 2)}
        selectedQuestionType="confirmed_test"
        onSelectQuestionType={onSelectQuestionType}
        variant="compact"
      />
    );

    expect(screen.getAllByText(/Questions verified from real FAA-style sources/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /all questions \(random\)/i }));

    expect(onSelectQuestionType).toHaveBeenCalledWith("all_random");
  });
});
