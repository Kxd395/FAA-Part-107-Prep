import {
  normalizeQuestionTypeProfile,
  type QuestionTypeProfile,
} from "@part107/core";
import { SOURCE_PACK_REGISTRY } from "./sourcePackRegistry";

export interface QuestionTypeOption {
  value: QuestionTypeProfile;
  title: string;
  description: string;
}

const PART107_BANK_PROFILE = "part107_bank" as unknown as QuestionTypeProfile;
const CARRINGTON_BANK_LEGACY_PROFILE = "carrington_bank" as unknown as QuestionTypeProfile;
const CARRINGTON_STRICT_PROFILE = "carrington_strict" as unknown as QuestionTypeProfile;

export const QUESTION_TYPE_OPTION_LABELS: Record<string, string> = {
  confirmed_test: "Confirmed Test Questions",
  all_random: "All Questions (Random)",
  acs_practice: "ACS Practice Only",
  acs_mastery: "ACS Mastery (Legacy)",
  mixed: "Mixed (Legacy)",
  [PART107_BANK_PROFILE]: "Part107 Question Bank",
  [CARRINGTON_BANK_LEGACY_PROFILE]: "Carrington Question Bank",
  [CARRINGTON_STRICT_PROFILE]: "Carrington Bank (Strict)",
  real_exam: "Real Exam MCQ (Legacy)",
  weak_spots: "Weak Spots Only",
};

export const SELECTABLE_QUESTION_TYPE_PROFILES: readonly QuestionTypeProfile[] = [
  "confirmed_test",
  "all_random",
  ...SOURCE_PACK_REGISTRY.map((entry) => entry.profile as QuestionTypeProfile),
  "real_exam",
  "weak_spots",
];

export const STANDARD_PRACTICE_QUESTION_TYPE_PROFILES: readonly QuestionTypeProfile[] = [
  "confirmed_test",
  "all_random",
  "real_exam",
  "weak_spots",
];

export function normalizeSelectableQuestionTypeProfile(
  input: string | null | undefined
): QuestionTypeProfile | null {
  const normalizedInput = input?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  if (normalizedInput === "carrington_bank" || normalizedInput === "carrington_strict") {
    return CARRINGTON_STRICT_PROFILE;
  }
  if (normalizedInput === "part107_bank") {
    return PART107_BANK_PROFILE;
  }
  const normalized = normalizeQuestionTypeProfile(input);
  if (!normalized) return null;
  return SELECTABLE_QUESTION_TYPE_PROFILES.includes(normalized) ? normalized : null;
}

export function normalizeStandardPracticeQuestionTypeProfile(
  input: string | null | undefined
): QuestionTypeProfile | null {
  const normalized = normalizeSelectableQuestionTypeProfile(input);
  if (!normalized) return null;
  return STANDARD_PRACTICE_QUESTION_TYPE_PROFILES.includes(normalized) ? normalized : null;
}

export const SELECTABLE_QUESTION_TYPE_OPTIONS: ReadonlyArray<QuestionTypeOption> = [
  {
    value: "confirmed_test",
    title: "Confirmed Test Questions",
    description: "Questions verified from real FAA-style sources (Review/UAG/SPA).",
  },
  {
    value: "all_random",
    title: "All Questions (Random)",
    description: "Combined direct exam-style pool across all loaded materials.",
  },
  ...SOURCE_PACK_REGISTRY.map((entry) => ({
    value: entry.profile as QuestionTypeProfile,
    title: String(entry.profile) === "part107_bank" ? "Part107 Question Bank" : "Carrington Bank (Strict)",
    description: entry.description,
  })),
  {
    value: "real_exam",
    title: "Real Exam MCQ (Legacy)",
    description: "Standard FAA-style MCQs only. Excludes ACS code-mapping drill format questions.",
  },
  {
    value: "weak_spots",
    title: "Weak Spots Only",
    description: "Prioritizes realistic MCQs you still struggle with.",
  },
];

export const STANDARD_PRACTICE_QUESTION_TYPE_OPTIONS: ReadonlyArray<QuestionTypeOption> =
  SELECTABLE_QUESTION_TYPE_OPTIONS.filter((option) =>
    STANDARD_PRACTICE_QUESTION_TYPE_PROFILES.includes(option.value)
  );
