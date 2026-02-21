import type { Question } from "./types";
import { dedupeQuestions } from "./adaptive";

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

export const REAL_EXAM_BLUEPRINT_TARGETS = {
  Regulations: 11,
  Airspace: 11,
  Weather: 9,
  "Loading & Performance": 6,
  Operations: 23,
} as const;

const REAL_EXAM_BLUEPRINT_CATEGORIES = [
  "Regulations",
  "Airspace",
  "Weather",
  "Loading & Performance",
  "Operations",
] as const;

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
  const deduped = dedupeQuestions(pool);
  const targetCount = category === "All" ? fullExamQuestionCount : deduped.questions.length;
  const questions = shuffleQuestions(deduped.questions).slice(
    0,
    Math.min(targetCount, deduped.questions.length)
  );
  return {
    category,
    questions,
    timeLimitMs: buildTimeLimitMs(questions.length, category),
  };
}

export function buildRealExamBlueprintQuestionSet<T extends Question = Question>(
  allQuestions: readonly T[],
  fullExamQuestionCount: number = FULL_EXAM_QUESTION_COUNT
): {
  questions: T[];
  targetCounts: Record<(typeof REAL_EXAM_BLUEPRINT_CATEGORIES)[number], number>;
} {
  const grouped = new Map<string, T[]>();
  for (const question of allQuestions) {
    if (!grouped.has(question.category)) grouped.set(question.category, []);
    grouped.get(question.category)!.push(question);
  }

  for (const [category, questions] of grouped) {
    grouped.set(category, shuffleQuestions(questions));
  }

  const selected: T[] = [];
  const selectedIds = new Set<string>();

  for (const category of REAL_EXAM_BLUEPRINT_CATEGORIES) {
    const target = REAL_EXAM_BLUEPRINT_TARGETS[category];
    const pool = grouped.get(category) ?? [];
    const taken = pool.slice(0, Math.min(target, pool.length));
    for (const question of taken) {
      selected.push(question);
      selectedIds.add(question.id);
    }
  }

  if (selected.length < fullExamQuestionCount) {
    const remaining = shuffleQuestions(
      allQuestions.filter((question) => !selectedIds.has(question.id))
    );
    selected.push(...remaining.slice(0, fullExamQuestionCount - selected.length));
  }

  return {
    questions: shuffleQuestions(selected.slice(0, fullExamQuestionCount)),
    targetCounts: { ...REAL_EXAM_BLUEPRINT_TARGETS },
  };
}
