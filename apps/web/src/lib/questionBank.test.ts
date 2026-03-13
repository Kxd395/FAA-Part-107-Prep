import { describe, expect, it } from "vitest";
import type { Question } from "@part107/core";

import { countQuestionsByCategory } from "./questionBank";

function makeQuestion(
  id: string,
  category: Question["category"],
  subcategory: string
): Question {
  return {
    id,
    category,
    subcategory,
    question_text: `Question ${id}`,
    figure_reference: null,
    options: [
      { id: "A", text: "A" },
      { id: "B", text: "B" },
      { id: "C", text: "C" },
      { id: "D", text: "D" },
    ],
    correct_option_id: "A",
    explanation_correct: "A",
    explanation_distractors: { B: "B", C: "C", D: "D" },
    citation: "14 CFR §107.31",
    difficulty_level: 2,
    tags: [],
  };
}

describe("countQuestionsByCategory", () => {
  it("counts nested study subcategories as first-class study slices", () => {
    const questions = [
      makeQuestion("ops-airport", "Operations", "Airport Operations"),
      makeQuestion("ops-emergency", "Operations", "Emergency Procedures"),
      makeQuestion("regs-remote-id", "Regulations", "Remote ID"),
      makeQuestion("radio-direct", "Radio Communications", "Phonetic Alphabet"),
      makeQuestion("weather", "Weather", "Weather Theory"),
    ];

    const counts = countQuestionsByCategory(questions);

    expect(counts.All).toBe(5);
    expect(counts.Operations).toBe(2);
    expect(counts["Airport Operations"]).toBe(1);
    expect(counts["Emergency Procedures"]).toBe(1);
    expect(counts["Remote ID"]).toBe(1);
    expect(counts["Radio Communications"]).toBe(1);
    expect(counts.Weather).toBe(1);
  });
});
