import { canonicalQuestionKey, isMastered, type AdaptiveQuizConfig, type UserQuestionStats } from "./adaptive";
import type { Question } from "./types";

export const QUESTION_TYPE_PROFILES = [
  "real_exam",
  "acs_mastery",
  "mixed",
  "weak_spots",
  "confirmed_test",
  "all_random",
  "acs_practice",
] as const;

export type QuestionTypeProfile = (typeof QUESTION_TYPE_PROFILES)[number];

export const QUESTION_TYPE_PROFILE_LABELS: Record<QuestionTypeProfile, string> = {
  real_exam: "Real Exam MCQ (No ACS Mapping)",
  acs_mastery: "ACS Code Mapping Drill",
  mixed: "Mixed",
  weak_spots: "Weak Spots Only",
  confirmed_test: "Confirmed Test Questions",
  all_random: "All Questions (Random)",
  acs_practice: "ACS Practice Only",
};

// ---------------------------------------------------------------------------
// Source-based helpers
// ---------------------------------------------------------------------------
const CONFIRMED_SOURCE_PREFIXES = ["review.md", "uag", "spa"];

/**
 * Returns `true` when a question's `source` field indicates it came from a
 * confirmed real-test origin (Review.md, UAG, or SPA question banks).
 */
export function isConfirmedTestQuestion(question: Question): boolean {
  const src = (question.source ?? "").trim().toLowerCase();
  if (!src) return false;
  return CONFIRMED_SOURCE_PREFIXES.some((prefix) => src.startsWith(prefix));
}

export function normalizeQuestionTypeProfile(input: string | null | undefined): QuestionTypeProfile | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return QUESTION_TYPE_PROFILES.find((profile) => profile === normalized) ?? null;
}

const ACS_MASTERY_TAG = "acs-mastery";
const ACS_CODE_MATCHING_PATTERNS = [
  /^\s*which(?:\s+acs)?\s+knowledge\s+code\s+matches\s+this\s+topic/i,
  /^\s*under\s+part\s+107\s+acs,\s*which\s+concept\s+is\s+covered\s+by\s+knowledge\s+code/i,
];

export function isAcsCodeMatchingQuestion(question: Question): boolean {
  const tags = question.tags ?? [];
  if (tags.some((tag) => tag.trim().toLowerCase() === ACS_MASTERY_TAG)) {
    return true;
  }

  const text = question.question_text.trim();
  return ACS_CODE_MATCHING_PATTERNS.some((pattern) => pattern.test(text));
}

export interface FilterQuestionsByTypeOptions {
  userStatsByKey?: Record<string, UserQuestionStats>;
  adaptiveConfig?: Partial<AdaptiveQuizConfig>;
}

export function filterQuestionsByType<Q extends Question = Question>(
  questions: readonly Q[],
  profile: QuestionTypeProfile,
  options: FilterQuestionsByTypeOptions = {}
): Q[] {
  if (profile === "mixed") {
    return [...questions];
  }

  if (profile === "all_random") {
    return [...questions];
  }

  if (profile === "confirmed_test") {
    return questions.filter((question) => isConfirmedTestQuestion(question));
  }

  if (profile === "acs_practice") {
    return questions.filter((question) => !isConfirmedTestQuestion(question));
  }

  if (profile === "real_exam") {
    return questions.filter((question) => !isAcsCodeMatchingQuestion(question));
  }

  if (profile === "acs_mastery") {
    return questions.filter((question) => isAcsCodeMatchingQuestion(question));
  }

  const realisticPool = questions.filter((question) => !isAcsCodeMatchingQuestion(question));
  const pool = realisticPool.length > 0 ? realisticPool : [...questions];
  const statsByKey = options.userStatsByKey ?? {};
  const weak: Q[] = [];
  const unseen: Q[] = [];
  const mastered: Q[] = [];

  for (const question of pool) {
    const key = canonicalQuestionKey(question, {
      includeChoices: options.adaptiveConfig?.includeChoicesInCanonicalKey ?? true,
    });
    const stats = statsByKey[key];

    if (!stats) {
      unseen.push(question);
      continue;
    }

    if (isMastered(stats, options.adaptiveConfig)) {
      mastered.push(question);
    } else {
      weak.push(question);
    }
  }

  if (weak.length > 0) return weak;
  if (unseen.length > 0) return unseen;
  return mastered;
}
