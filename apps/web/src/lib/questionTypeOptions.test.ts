import { describe, expect, it } from "vitest";
import type { QuestionTypeProfile } from "@part107/core";
import {
  SELECTABLE_QUESTION_TYPE_OPTIONS,
  SELECTABLE_QUESTION_TYPE_PROFILES,
  normalizeSelectableQuestionTypeProfile,
} from "./questionTypeOptions";

describe("questionTypeOptions", () => {
  it("normalizes supported question type inputs", () => {
    expect(normalizeSelectableQuestionTypeProfile("confirmed_test")).toBe("confirmed_test");
    expect(normalizeSelectableQuestionTypeProfile("Confirmed-Test")).toBe("confirmed_test");
    expect(normalizeSelectableQuestionTypeProfile("weak spots")).toBe("weak_spots");
    expect(normalizeSelectableQuestionTypeProfile("carrington_bank")).toBe(
      "carrington_strict" as unknown as QuestionTypeProfile
    );
  });

  it("rejects unsupported question type inputs", () => {
    expect(normalizeSelectableQuestionTypeProfile("mixed")).toBeNull();
    expect(normalizeSelectableQuestionTypeProfile("acs_mastery")).toBeNull();
    expect(normalizeSelectableQuestionTypeProfile("")).toBeNull();
    expect(normalizeSelectableQuestionTypeProfile(null)).toBeNull();
  });

  it("keeps options and selectable profiles in sync", () => {
    const optionValues = SELECTABLE_QUESTION_TYPE_OPTIONS.map((option) => option.value);
    expect(optionValues).toEqual([...SELECTABLE_QUESTION_TYPE_PROFILES]);
  });
});
