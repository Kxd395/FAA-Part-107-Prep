import { describe, expect, it } from "vitest";
import {
  buildExamQuestionSet,
  buildRealExamBlueprintQuestionSet,
  buildTimeLimitMs,
  computeRemainingTime,
  normalizeCategory,
  REAL_EXAM_BLUEPRINT_TARGETS,
} from "./quiz";
import type { Question } from "./types";

function makeQuestion(id: number, category: Question["category"] = "Regulations"): Question {
  return {
    id: `Q-${id}`,
    category,
    subcategory: "General",
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

describe("quiz helpers", () => {
  it("normalizes supported categories", () => {
    expect(normalizeCategory("airspace")).toBe("Airspace");
    expect(normalizeCategory("ALL")).toBe("All");
    expect(normalizeCategory("unknown")).toBeNull();
  });

  it("uses full exam limits for all-category exams", () => {
    const all = Array.from({ length: 80 }, (_, i) => makeQuestion(i + 1));
    const set = buildExamQuestionSet(all, "All");

    expect(set.questions).toHaveLength(60);
    expect(set.timeLimitMs).toBe(2 * 60 * 60 * 1000);
  });

  it("uses per-question timing for category exams", () => {
    const regulations = Array.from({ length: 12 }, (_, i) => makeQuestion(i + 1, "Regulations"));
    const set = buildExamQuestionSet(regulations, "Regulations");

    expect(set.questions).toHaveLength(12);
    expect(set.timeLimitMs).toBe(buildTimeLimitMs(12, "Regulations"));
    expect(set.timeLimitMs).toBe(12 * 2 * 60 * 1000);
  });

  it("computes remaining exam time", () => {
    const start = 1_000;
    const limit = 10_000;

    expect(computeRemainingTime(start, limit, 4_000)).toBe(7_000);
    expect(computeRemainingTime(start, limit, 11_500)).toBe(0);
  });

  it("builds full exam sets with blueprint category targets when enough questions exist", () => {
    const categories: Array<Question["category"]> = [
      "Regulations",
      "Airspace",
      "Weather",
      "Loading & Performance",
      "Operations",
    ];
    const bank = categories.flatMap((category, categoryIndex) =>
      Array.from({ length: 40 }, (_, i) => makeQuestion(categoryIndex * 100 + i + 1, category))
    );

    const result = buildRealExamBlueprintQuestionSet(bank);
    const counts = result.questions.reduce<Record<string, number>>((acc, question) => {
      acc[question.category] = (acc[question.category] ?? 0) + 1;
      return acc;
    }, {});

    expect(result.questions).toHaveLength(60);
    expect(counts.Regulations).toBe(REAL_EXAM_BLUEPRINT_TARGETS.Regulations);
    expect(counts.Airspace).toBe(REAL_EXAM_BLUEPRINT_TARGETS.Airspace);
    expect(counts.Weather).toBe(REAL_EXAM_BLUEPRINT_TARGETS.Weather);
    expect(counts["Loading & Performance"]).toBe(REAL_EXAM_BLUEPRINT_TARGETS["Loading & Performance"]);
    expect(counts.Operations).toBe(REAL_EXAM_BLUEPRINT_TARGETS.Operations);
  });

  it("backfills from remaining categories when a target category is short", () => {
    const bank = [
      ...Array.from({ length: 40 }, (_, i) => makeQuestion(i + 1, "Regulations")),
      ...Array.from({ length: 40 }, (_, i) => makeQuestion(i + 101, "Airspace")),
      ...Array.from({ length: 40 }, (_, i) => makeQuestion(i + 201, "Weather")),
      ...Array.from({ length: 2 }, (_, i) => makeQuestion(i + 301, "Loading & Performance")),
      ...Array.from({ length: 40 }, (_, i) => makeQuestion(i + 401, "Operations")),
    ];

    const result = buildRealExamBlueprintQuestionSet(bank);
    const counts = result.questions.reduce<Record<string, number>>((acc, question) => {
      acc[question.category] = (acc[question.category] ?? 0) + 1;
      return acc;
    }, {});

    expect(result.questions).toHaveLength(60);
    expect(counts["Loading & Performance"]).toBe(2);
  });
});
