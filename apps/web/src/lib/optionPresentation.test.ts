import { describe, expect, it } from "vitest";
import {
  buildOptionPresentation,
  getDisplayLabelForOption,
  getOptionTextById,
} from "./optionPresentation";

const question = {
  id: "Q1",
  options: [
    { id: "A", text: "Alpha" },
    { id: "B", text: "Bravo" },
    { id: "C", text: "Charlie" },
    { id: "D", text: "Delta" },
  ],
  correct_option_id: "C",
} as const;

describe("optionPresentation", () => {
  it("creates a stable order for the same context and question", () => {
    const first = buildOptionPresentation(question, "study:1");
    const second = buildOptionPresentation(question, "study:1");

    expect(first.options.map((option) => option.id)).toEqual(
      second.options.map((option) => option.id)
    );
    expect(first.options).toHaveLength(3);
    expect(first.options.map((option) => option.displayLabel)).toEqual(["A", "B", "C"]);
  });

  it("maps the correct answer to the displayed label", () => {
    const presentation = buildOptionPresentation(question, "exam:123");

    expect(presentation.correctDisplayLabel).toBe(
      presentation.displayLabelByOptionId[question.correct_option_id]
    );
    expect(getDisplayLabelForOption(presentation.displayLabelByOptionId, "C")).toBe(
      presentation.correctDisplayLabel
    );
  });

  it("returns readable fallback values for missing options", () => {
    expect(getDisplayLabelForOption({}, null)).toBe("Unanswered");
    expect(getOptionTextById(question.options, null)).toBeNull();
    expect(getOptionTextById(question.options, "B")).toBe("Bravo");
  });

  it("keeps answer-label mapping stable within a study/exam session key", () => {
    const studyOne = buildOptionPresentation(question, "study:1700000000000");
    const studyTwo = buildOptionPresentation(question, "study:1700000000000");
    const examOne = buildOptionPresentation(question, "exam:1700000000000");
    const examTwo = buildOptionPresentation(question, "exam:1700000000000");

    expect(studyOne.options.map((option) => option.id)).toEqual(
      studyTwo.options.map((option) => option.id)
    );
    expect(examOne.options.map((option) => option.id)).toEqual(
      examTwo.options.map((option) => option.id)
    );
    expect(studyOne.correctDisplayLabel).toBe(
      studyOne.displayLabelByOptionId[question.correct_option_id]
    );
    expect(examOne.correctDisplayLabel).toBe(
      examOne.displayLabelByOptionId[question.correct_option_id]
    );
  });

  it("always includes the correct option when reducing to 3 choices", () => {
    const presentation = buildOptionPresentation(question, "study:reduced");
    const optionIds = presentation.options.map((option) => option.id);
    expect(optionIds).toContain(question.correct_option_id);
    expect(optionIds).toHaveLength(3);
  });
});
