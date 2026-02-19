import { canonicalQuestionKey, isMastered, type AdaptiveQuizConfig, type UserQuestionStats } from "./adaptive";
import type { Question } from "./types";

export const QUESTION_TYPE_PROFILES = [
  "real_exam",
  "acs_mastery",
  "mixed",
  "weak_spots",
] as const;

export type QuestionTypeProfile = (typeof QUESTION_TYPE_PROFILES)[number];

export const QUESTION_TYPE_PROFILE_LABELS: Record<QuestionTypeProfile, string> = {
  real_exam: "Exclude ACS Code-Matching",
  acs_mastery: "ACS Mastery",
  mixed: "Mixed",
  weak_spots: "Weak Spots Only",
};

export function normalizeQuestionTypeProfile(input: string | null | undefined): QuestionTypeProfile | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return QUESTION_TYPE_PROFILES.find((profile) => profile === normalized) ?? null;
}

export function isAcsCodeMatchingQuestion(question: Question): boolean {
  const text = question.question_text.trim().toLowerCase();
  return (
    question.source_type === "acs_generated" ||
    text.startsWith("under part 107 acs, which concept is covered by knowledge code") ||
    text.startsWith("which acs knowledge code matches this topic")
  );
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

  if (profile === "real_exam") {
    return questions.filter((question) => !isAcsCodeMatchingQuestion(question));
  }

  if (profile === "acs_mastery") {
    return questions.filter((question) => isAcsCodeMatchingQuestion(question));
  }

  const statsByKey = options.userStatsByKey ?? {};
  const weak: Q[] = [];
  const unseen: Q[] = [];
  const mastered: Q[] = [];

  for (const question of questions) {
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
