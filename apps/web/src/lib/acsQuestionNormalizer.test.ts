import { describe, expect, it } from "vitest";
import type { Question } from "@part107/core";
import { isCodeOnlyAnswerQuestion, normalizeAcsCodeOnlyQuestions } from "./acsQuestionNormalizer";

function buildQuestion(overrides: Partial<Question>): Question {
  return {
    id: "Q-1",
    category: "Airspace",
    subcategory: "General",
    question_text: "Placeholder",
    figure_reference: null,
    options: [
      { id: "A", text: "Option A" },
      { id: "B", text: "Option B" },
      { id: "C", text: "Option C" },
      { id: "D", text: "Option D" },
    ],
    correct_option_id: "A",
    explanation_correct: "Correct.",
    explanation_distractors: {
      B: "Wrong.",
      C: "Wrong.",
      D: "Wrong.",
    },
    citation: "14 CFR §107.41",
    difficulty_level: 2,
    tags: [],
    ...overrides,
  };
}

describe("acs question normalizer", () => {
  it("detects code-only answer questions", () => {
    const codeOnly = buildQuestion({
      options: [
        { id: "A", text: "UA.II.B.K3" },
        { id: "B", text: "UA.II.B.K2" },
        { id: "C", text: "UA.II.B.K4a" },
        { id: "D", text: "UA.II.B.K5" },
      ],
    });
    const wordOptions = buildQuestion({
      options: [
        { id: "A", text: "Operations near airports." },
        { id: "B", text: "ATC authorizations and related operating limitations." },
        { id: "C", text: "Potential flight hazards." },
        { id: "D", text: "Basic weather minimums." },
      ],
    });

    expect(isCodeOnlyAnswerQuestion(codeOnly)).toBe(true);
    expect(isCodeOnlyAnswerQuestion(wordOptions)).toBe(false);
  });

  it("rewrites code-only ACS questions using paired word templates", () => {
    const wordTemplate = buildQuestion({
      id: "AIR-ACS-008",
      question_text: "Under Part 107 ACS, which concept is covered by knowledge code UA.II.B.K3?",
      options: [
        { id: "A", text: "Basic weather minimums." },
        { id: "B", text: "ATC authorizations and related operating limitations." },
        { id: "C", text: "Operations near airports." },
        { id: "D", text: "Potential flight hazards." },
      ],
      correct_option_id: "C",
      citation: "ACS UA.II.B.K3",
      acs_code: "UA.II.B.K3",
      tags: ["acs-mastery", "airspace"],
      source: "ACS Mastery (UA.II.B.K3)",
    });

    const codeOnly = buildQuestion({
      id: "AIR-ACS-009",
      question_text: 'Which ACS knowledge code matches this topic: "Operations near airports."?',
      options: [
        { id: "A", text: "UA.II.B.K3" },
        { id: "B", text: "UA.II.B.K2" },
        { id: "C", text: "UA.II.B.K4a" },
        { id: "D", text: "UA.II.B.K5" },
      ],
      correct_option_id: "A",
      citation: "ACS UA.II.B.K3",
      acs_code: "UA.II.B.K3",
      tags: ["acs-mastery", "airspace"],
      source: "ACS Mastery (UA.II.B.K3)",
    });

    const [templateAfter, normalized] = normalizeAcsCodeOnlyQuestions([wordTemplate, codeOnly]);

    expect(templateAfter).toEqual(wordTemplate);
    expect(normalized.question_text).toBe(
      'Which concept best matches this Part 107 topic: "Operations near airports"?'
    );
    expect(normalized.options).toEqual(wordTemplate.options);
    expect(normalized.correct_option_id).toBe("C");
    expect(normalized.explanation_correct).toContain("Operations near airports.");
    expect(normalized.tags).toEqual(["airspace"]);
    expect(normalized.source).toContain("word-normalized");
  });

  it("leaves unmatched code-only questions unchanged", () => {
    const codeOnly = buildQuestion({
      id: "AIR-ACS-999",
      question_text: 'Which ACS knowledge code matches this topic: "Unmatched topic"?',
      options: [
        { id: "A", text: "UA.XX.X.K1" },
        { id: "B", text: "UA.XX.X.K2" },
        { id: "C", text: "UA.XX.X.K3" },
      ],
      correct_option_id: "B",
      acs_code: "UA.XX.X.K2",
    });

    const [unchanged] = normalizeAcsCodeOnlyQuestions([codeOnly]);
    expect(unchanged).toEqual(codeOnly);
  });
});

