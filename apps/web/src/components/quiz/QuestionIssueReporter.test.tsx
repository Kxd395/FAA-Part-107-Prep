import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Question } from "@part107/core";
import QuestionIssueReporter from "./QuestionIssueReporter";

const baseQuestion: Pick<
  Question,
  "id" | "category" | "subcategory" | "question_text" | "options" | "correct_option_id" | "source" | "source_type"
> = {
  id: "Q-1",
  category: "Regulations",
  subcategory: "General",
  question_text: "Sample question?",
  options: [
    { id: "A", text: "Option A" },
    { id: "B", text: "Option B" },
    { id: "C", text: "Option C" },
  ],
  correct_option_id: "A",
  source: "part107-question-bank",
  source_type: "confirmed_test",
};

describe("QuestionIssueReporter", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("submits issue reports with one-line note and question context", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ accepted: true }), { status: 202 }));

    render(
      <QuestionIssueReporter
        mode="study"
        question={baseQuestion}
        selectedOptionId="B"
        questionTypeProfile="confirmed_test"
        confidence={3}
      />
    );

    await user.click(screen.getByRole("button", { name: /Report issue/i }));
    await user.type(screen.getByPlaceholderText(/One line: what is wrong/i), "Answer key is wrong.");
    await user.click(screen.getByRole("button", { name: /^Send$/i }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.report.questionId).toBe("Q-1");
    expect(body.report.selectedOptionId).toBe("B");
    expect(body.report.note).toBe("Answer key is wrong.");
    expect(await screen.findByText(/Issue submitted\. Thanks\./i)).toBeInTheDocument();
  });

  it("shows an error message when submission fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "failed" }), { status: 500 })
    );

    render(<QuestionIssueReporter mode="exam" question={baseQuestion} />);
    await user.click(screen.getByRole("button", { name: /Report issue/i }));
    await user.type(screen.getByPlaceholderText(/One line: what is wrong/i), "Bad citation");
    await user.click(screen.getByRole("button", { name: /^Send$/i }));

    expect(await screen.findByText(/Could not submit right now/i)).toBeInTheDocument();
  });
});
