import { progressStorageKey, userScopedStorageKey } from "./progressStorage";
import { STUDY_CATEGORIES, type StudyCategory } from "./questionBank";

export const LEARNING_PREFERENCES_STORAGE_KEY = "part107_learning_preferences_v1";

export interface LearningPreferences {
  defaultStudyCategory: StudyCategory;
  defaultExamCategory: StudyCategory;
  defaultLearnBatchSize: number;
  defaultFlashcardDailyReviewTarget: number;
  weeklyStudyGoalSessions: number;
  weeklyExamGoalSessions: number;
}

export interface WeeklyGoalProgress {
  studySessions: number;
  examSessions: number;
  windowDays: number;
}

interface ProgressSessionLike {
  mode?: string;
  timestamp?: string;
}

const DEFAULT_STUDY_GOAL = 5;
const DEFAULT_EXAM_GOAL = 2;
const DEFAULT_LEARN_BATCH_SIZE = 5;
const DEFAULT_FLASHCARD_DAILY_TARGET = 20;

export const DEFAULT_LEARNING_PREFERENCES: LearningPreferences = {
  defaultStudyCategory: "All",
  defaultExamCategory: "All",
  defaultLearnBatchSize: DEFAULT_LEARN_BATCH_SIZE,
  defaultFlashcardDailyReviewTarget: DEFAULT_FLASHCARD_DAILY_TARGET,
  weeklyStudyGoalSessions: DEFAULT_STUDY_GOAL,
  weeklyExamGoalSessions: DEFAULT_EXAM_GOAL,
};

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isStudyCategory(value: string): value is StudyCategory {
  return (STUDY_CATEGORIES as readonly string[]).includes(value);
}

function normalizeCategory(value: unknown): StudyCategory {
  if (typeof value !== "string") return "All";
  return isStudyCategory(value) ? value : "All";
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.round(Number(value));
  return Math.max(min, Math.min(max, rounded));
}

function normalizeLearningPreferences(input: unknown): LearningPreferences {
  if (!input || typeof input !== "object") return DEFAULT_LEARNING_PREFERENCES;
  const candidate = input as Partial<LearningPreferences>;
  return {
    defaultStudyCategory: normalizeCategory(candidate.defaultStudyCategory),
    defaultExamCategory: normalizeCategory(candidate.defaultExamCategory),
    defaultLearnBatchSize: clampInteger(
      candidate.defaultLearnBatchSize,
      3,
      20,
      DEFAULT_LEARN_BATCH_SIZE
    ),
    defaultFlashcardDailyReviewTarget: clampInteger(
      candidate.defaultFlashcardDailyReviewTarget,
      5,
      200,
      DEFAULT_FLASHCARD_DAILY_TARGET
    ),
    weeklyStudyGoalSessions: clampInteger(
      candidate.weeklyStudyGoalSessions,
      1,
      30,
      DEFAULT_STUDY_GOAL
    ),
    weeklyExamGoalSessions: clampInteger(
      candidate.weeklyExamGoalSessions,
      0,
      15,
      DEFAULT_EXAM_GOAL
    ),
  };
}

export function readLearningPreferences(userId: string): LearningPreferences {
  if (typeof window === "undefined") return DEFAULT_LEARNING_PREFERENCES;
  const raw = localStorage.getItem(userScopedStorageKey(LEARNING_PREFERENCES_STORAGE_KEY, userId));
  return normalizeLearningPreferences(safeParse(raw));
}

export function writeLearningPreferences(userId: string, preferences: LearningPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    userScopedStorageKey(LEARNING_PREFERENCES_STORAGE_KEY, userId),
    JSON.stringify(normalizeLearningPreferences(preferences))
  );
}

export function readWeeklyGoalProgress(
  userId: string,
  nowMs: number = Date.now(),
  windowDays: number = 7
): WeeklyGoalProgress {
  if (typeof window === "undefined") {
    return { studySessions: 0, examSessions: 0, windowDays };
  }
  const raw = localStorage.getItem(progressStorageKey(userId));
  const parsed = safeParse(raw);
  const sessions = Array.isArray(parsed) ? (parsed as ProgressSessionLike[]) : [];
  const cutoffMs = nowMs - Math.max(1, windowDays) * 24 * 60 * 60 * 1000;
  let studySessions = 0;
  let examSessions = 0;

  for (const session of sessions) {
    const timestampMs = Date.parse(typeof session.timestamp === "string" ? session.timestamp : "");
    if (!Number.isFinite(timestampMs) || timestampMs < cutoffMs) continue;
    if (session.mode === "study" || session.mode === "learn" || session.mode === "flashcards") {
      studySessions += 1;
      continue;
    }
    if (session.mode === "exam") {
      examSessions += 1;
    }
  }

  return { studySessions, examSessions, windowDays };
}
