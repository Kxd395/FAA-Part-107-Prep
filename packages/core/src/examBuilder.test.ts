import { describe, expect, it } from "vitest";
import { buildExamRun, parseExamRunSettings } from "./examBuilder";
import type { Question } from "./types";

function makeQuestion(
  id: number,
  category: Question["category"] = "Regulations",
  subcategory = "General"
): Question {
  return {
    id: `Q-${id}`,
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
    explanation_correct: "A is correct",
    explanation_distractors: { B: "B is wrong", C: "C is wrong", D: "D is wrong" },
    citation: "14 CFR §107.31",
    difficulty_level: 2,
    tags: [],
  };
}

describe("examBuilder", () => {
  it("parses run settings defensively", () => {
    expect(parseExamRunSettings()).toEqual({ questionLimit: null, timeLimitMs: null });
    expect(parseExamRunSettings({ questionLimit: 3.9, timeLimitMs: 90_500.9 })).toEqual({
      questionLimit: 3,
      timeLimitMs: 90_500,
    });
    expect(parseExamRunSettings({ questionLimit: 0, timeLimitMs: -1 })).toEqual({
      questionLimit: null,
      timeLimitMs: null,
    });
  });

  it("falls back to defaults when category or type are invalid", () => {
    const result = buildExamRun({
      allQuestions: [makeQuestion(1, "Regulations")],
      categoryInput: "unknown",
      questionTypeInput: "unknown",
    });

    expect(result.category).toBe("All");
    expect(result.questionTypeProfile).toBe("real_exam");
    expect(result.invalidCategory).toBe(true);
    expect(result.invalidQuestionType).toBe(true);
  });

  it("builds a full blueprint-backed exam when the bank is large enough", () => {
    const categories: Array<Question["category"]> = [
      "Regulations",
      "Airspace",
      "Weather",
      "Loading & Performance",
      "Operations",
    ];
    const bank = categories.flatMap((category, categoryIndex) =>
      Array.from({ length: 30 }, (_, i) =>
        makeQuestion(categoryIndex * 100 + i + 1, category, `${category} Basics`)
      )
    );

    const result = buildExamRun({
      allQuestions: bank,
      categoryInput: "All",
      questionTypeInput: "real_exam",
    });

    expect(result.questions).toHaveLength(60);
    expect(result.timeLimitMs).toBe(2 * 60 * 60 * 1000);
  });

  it("applies question limit and time override through the pure builder", () => {
    const bank = Array.from({ length: 5 }, (_, i) => makeQuestion(i + 1, "Regulations"));

    const result = buildExamRun({
      allQuestions: bank,
      categoryInput: "Regulations",
      questionTypeInput: "real_exam",
      runSettings: {
        questionLimit: 2,
        timeLimitMs: 90_000,
      },
    });

    expect(result.questions).toHaveLength(2);
    expect(result.timeLimitMs).toBe(90_000);
  });
});
