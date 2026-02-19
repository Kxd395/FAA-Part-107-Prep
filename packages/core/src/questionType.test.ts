import { describe, expect, it } from "vitest";
import { canonicalQuestionKey } from "./adaptive";
import {
  filterQuestionsByType,
  isAcsCodeMatchingQuestion,
  normalizeQuestionTypeProfile,
} from "./questionType";
import type { Question } from "./types";

function makeQuestion(
  id: string,
  questionText: string,
  overrides: Partial<Question> = {}
): Question {
  return {
    id,
    category: "Airspace",
    subcategory: "General",
    question_text: questionText,
    figure_reference: null,
    options: [
      { id: "A", text: "Option A" },
      { id: "B", text: "Option B" },
      { id: "C", text: "Option C" },
    ],
    correct_option_id: "A",
    explanation_correct: "A is correct.",
    explanation_distractors: { B: "B wrong", C: "C wrong" },
    citation: "14 CFR §107.41",
    difficulty_level: 2,
    tags: [],
    ...overrides,
  };
}

describe("questionType", () => {
  it("normalizes question type input", () => {
    expect(normalizeQuestionTypeProfile("Real Exam")).toBe("real_exam");
    expect(normalizeQuestionTypeProfile("weak-spots")).toBe("weak_spots");
    expect(normalizeQuestionTypeProfile("unknown")).toBeNull();
  });

  it("identifies ACS code matching prompts", () => {
    const acs = makeQuestion("q1", "Which ACS knowledge code matches this topic: \"Operations near airports.\"?");
    const normal = makeQuestion("q2", "What should a remote PIC verify before takeoff?");
    expect(isAcsCodeMatchingQuestion(acs)).toBe(true);
    expect(isAcsCodeMatchingQuestion(normal)).toBe(false);
  });

  it("identifies ACS code-matching questions via acs-mastery tag", () => {
    const acsByTag = makeQuestion("q3", "Pick the best answer.", {
      tags: ["acs-mastery"],
      source_type: "acs_generated",
    });

    expect(isAcsCodeMatchingQuestion(acsByTag)).toBe(true);
  });

  it("does not classify non-ACS prompts as ACS based on source metadata alone", () => {
    const realisticPromptFromAcsSource = makeQuestion("q4", "What should a remote PIC verify before takeoff?", {
      source_type: "acs_generated",
      citation: "ACS UA.III.B.K1k",
      tags: [],
    });

    expect(isAcsCodeMatchingQuestion(realisticPromptFromAcsSource)).toBe(false);
  });

  it("does not classify non-ACS prompts as ACS just because they carry an acs_code", () => {
    const normalWithAcsCode: Question = {
      ...makeQuestion("q5", "What should a remote PIC verify before takeoff?"),
      acs_code: "UA.I.A.K1",
      source_type: undefined,
    };

    expect(isAcsCodeMatchingQuestion(normalWithAcsCode)).toBe(false);
  });

  it("filters real exam and mastery pools correctly", () => {
    const acs = makeQuestion("q1", "Under Part 107 ACS, which concept is covered by knowledge code UA.II.B.K3?", {
      source_type: "acs_generated",
      tags: ["acs-mastery"],
    });
    const normal = makeQuestion("q2", "What should a remote PIC verify before takeoff?");
    const pool = [acs, normal];

    expect(filterQuestionsByType(pool, "real_exam").map((q) => q.id)).toEqual(["q2"]);
    expect(filterQuestionsByType(pool, "acs_mastery").map((q) => q.id)).toEqual(["q1"]);
  });

  it("returns weak/unmastered set for weak_spots profile", () => {
    const q1 = makeQuestion("q1", "Question one");
    const q2 = makeQuestion("q2", "Question two");
    const key1 = canonicalQuestionKey(q1);
    const key2 = canonicalQuestionKey(q2);

    const weakOnly = filterQuestionsByType([q1, q2], "weak_spots", {
      userStatsByKey: {
        [key1]: {
          userId: "u1",
          canonicalKey: key1,
          attempts: 5,
          correct: 1,
          incorrect: 4,
          correctStreak: 0,
          lastAttemptAt: new Date().toISOString(),
          lastResultWasCorrect: false,
          masteryScore: 0.2,
        },
        [key2]: {
          userId: "u1",
          canonicalKey: key2,
          attempts: 5,
          correct: 5,
          incorrect: 0,
          correctStreak: 5,
          lastAttemptAt: new Date().toISOString(),
          lastResultWasCorrect: true,
          masteryScore: 0.98,
        },
      },
    });

    expect(weakOnly.map((q) => q.id)).toEqual(["q1"]);
  });
});
