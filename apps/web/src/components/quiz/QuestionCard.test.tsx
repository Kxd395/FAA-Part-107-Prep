import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import QuestionCard from "./QuestionCard";

const baseQuestion = {
  id: "Q-1",
  category: "Regulations",
  subcategory: "General",
  question_text: "What is required before flight?",
  figure_reference: "figure-20",
  options: [
    { id: "A", text: "Option A" },
    { id: "B", text: "Option B" },
    { id: "C", text: "Option C" },
  ],
  correct_option_id: "A",
  explanation_correct: "Because A is correct",
  explanation_distractors: { B: "B is wrong", C: "C is wrong" },
  citation: "14 CFR §107.31",
  difficulty_level: 2,
  tags: [],
} as const;

describe("QuestionCard", () => {
  it("opens figure modal payload when image is clicked", async () => {
    const onOpenFigure = vi.fn();
    const user = userEvent.setup();

    render(
      <QuestionCard
        question={{ ...baseQuestion, image_ref: "/figures/figure-20.png" }}
        onOpenFigure={onOpenFigure}
      />
    );

    await user.click(screen.getByRole("button"));

    expect(onOpenFigure).toHaveBeenCalledTimes(1);
    expect(onOpenFigure).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "image",
        url: "/figures/figure-20.png",
      })
    );
  });

  it("renders text-based figure block when figure_text is present", () => {
    render(
      <QuestionCard
        question={{ ...baseQuestion, figure_reference: "figure-12", figure_text: "KMDW 121853Z ..." }}
        onOpenFigure={vi.fn()}
      />
    );

    expect(screen.getByText("KMDW 121853Z ...")).toBeInTheDocument();
  });
});
