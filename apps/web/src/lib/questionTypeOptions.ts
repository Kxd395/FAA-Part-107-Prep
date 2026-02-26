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

export const QUESTION_TYPE_OPTION_LABELS: Record<QuestionTypeProfile, string> = {
  confirmed_test: "Confirmed Test Questions",
  all_random: "All Questions (Random)",
  acs_practice: "ACS Practice Only",
  acs_mastery: "ACS Mastery (Legacy)",
  mixed: "Mixed (Legacy)",
  part107_bank: "Part107 Question Bank",
  carrington_bank: "Carrington Question Bank",
  carrington_strict: "Carrington Bank (Strict)",
  real_exam: "Real Exam MCQ (Legacy)",
  weak_spots: "Weak Spots Only",
};

export const SELECTABLE_QUESTION_TYPE_PROFILES: readonly QuestionTypeProfile[] = [
  "confirmed_test",
  "all_random",
  ...SOURCE_PACK_REGISTRY.map((entry) => entry.profile),
  "real_exam",
  "weak_spots",
];

export function normalizeSelectableQuestionTypeProfile(
  input: string | null | undefined
): QuestionTypeProfile | null {
  const normalized = normalizeQuestionTypeProfile(input);
  if (!normalized) return null;
  if (normalized === "carrington_bank") {
    return "carrington_strict";
  }
  return SELECTABLE_QUESTION_TYPE_PROFILES.includes(normalized) ? normalized : null;
}

export const SELECTABLE_QUESTION_TYPE_OPTIONS: ReadonlyArray<QuestionTypeOption> = [
  {
    value: "confirmed_test",
    title: "✅ Confirmed Test Questions",
    description: "Questions verified from real FAA-style sources (Review/UAG/SPA).",
  },
  {
    value: "all_random",
    title: "🎲 All Questions (Random)",
    description: "Combined direct exam-style pool across all loaded materials.",
  },
  ...SOURCE_PACK_REGISTRY.map((entry) => ({
    value: entry.profile,
    title:
      entry.profile === "part107_bank"
        ? "📘 Part107 Question Bank"
        : "📙 Carrington Bank (Strict)",
    description: entry.description,
  })),
  {
    value: "real_exam",
    title: "Real Exam MCQ (Legacy)",
    description: "Standard FAA-style MCQs only. Excludes ACS code-mapping drill format questions.",
  },
  {
    value: "weak_spots",
    title: "🔥 Weak Spots Only",
    description: "Prioritizes realistic MCQs you still struggle with.",
  },
];
