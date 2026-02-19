import type { Question } from "./types";

export const STUDY_CATEGORIES = [
  "All",
  "Regulations",
  "Airspace",
  "Weather",
  "Operations",
  "Loading & Performance",
] as const;

export type StudyCategory = (typeof STUDY_CATEGORIES)[number];

export const FULL_EXAM_QUESTION_COUNT = 60;
export const FULL_EXAM_TIME_LIMIT_MS = 2 * 60 * 60 * 1000;

export function shuffleQuestions<T>(questions: readonly T[]): T[] {
  const copy = [...questions];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function normalizeCategory(input: string | null | undefined): StudyCategory | null {
  if (!input) return null;
  return STUDY_CATEGORIES.find((c) => c.toLowerCase() === input.toLowerCase()) ?? null;
}

export function filterQuestionsByCategory(
  allQuestions: readonly Question[],
  category: StudyCategory
): Question[] {
  if (category === "All") return [...allQuestions];
  return allQuestions.filter((q) => q.category === category);
}

export function buildTimeLimitMs(questionCount: number, category: StudyCategory): number {
  if (category === "All") return FULL_EXAM_TIME_LIMIT_MS;
  return questionCount * 2 * 60 * 1000;
}

export function computeRemainingTime(
  startTimeMs: number,
  timeLimitMs: number,
  nowMs: number = Date.now()
): number {
  const elapsed = nowMs - startTimeMs;
  return Math.max(0, timeLimitMs - elapsed);
}

export function formatClockTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function buildExamQuestionSet(
  allQuestions: readonly Question[],
  category: StudyCategory,
  fullExamQuestionCount: number = FULL_EXAM_QUESTION_COUNT
): {
  category: StudyCategory;
  questions: Question[];
  timeLimitMs: number;
} {
  const pool = filterQuestionsByCategory(allQuestions, category);
  const targetCount = category === "All" ? fullExamQuestionCount : pool.length;
  const questions = shuffleQuestions(pool).slice(0, Math.min(targetCount, pool.length));
  return {
    category,
    questions,
    timeLimitMs: buildTimeLimitMs(questions.length, category),
  };
}
