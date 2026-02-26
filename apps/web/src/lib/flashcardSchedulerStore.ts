import {
  DEFAULT_FLASHCARD_SCHEDULER_SETTINGS,
  type FlashcardLapseHandling,
  type FlashcardSchedulerSettings,
} from "./flashcardScheduler";
import { userScopedStorageKey } from "./progressStorage";

export const FLASHCARD_SCHEDULER_SETTINGS_STORAGE_KEY = "part107_flashcard_scheduler_settings_v1";
export const FLASHCARD_SCHEDULER_DAILY_STORAGE_KEY = "part107_flashcard_scheduler_daily_v1";
export const FLASHCARD_SCHEDULER_PROGRESS_STORAGE_KEY = "part107_flashcard_scheduler_progress_v1";

interface FlashcardSchedulerDailyState {
  date: string;
  seenNewCanonicalKeys: string[];
}

export interface FlashcardSchedulerProgressState {
  weekStamp: string;
  completedThisWeek: number;
  lastReviewDate: string | null;
  streakDays: number;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.round(Number(value));
  return Math.max(min, Math.min(max, rounded));
}

function normalizeLapseHandling(value: unknown): FlashcardLapseHandling {
  if (value === "aggressive" || value === "gentle") return value;
  return "balanced";
}

function todayDateStamp(nowMs: number = Date.now()): string {
  const date = new Date(nowMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekStamp(nowMs: number = Date.now()): string {
  const date = new Date(nowMs);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return todayDateStamp(date.getTime());
}

function parseDateStamp(value: string | null): number {
  if (!value) return NaN;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function dayDiff(fromDate: string | null, toDate: string): number | null {
  const fromMs = parseDateStamp(fromDate);
  const toMs = parseDateStamp(toDate);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function getSettingsStorageKey(userId: string): string {
  return userScopedStorageKey(FLASHCARD_SCHEDULER_SETTINGS_STORAGE_KEY, userId);
}

function getDailyStorageKey(userId: string): string {
  return userScopedStorageKey(FLASHCARD_SCHEDULER_DAILY_STORAGE_KEY, userId);
}

function getProgressStorageKey(userId: string): string {
  return userScopedStorageKey(FLASHCARD_SCHEDULER_PROGRESS_STORAGE_KEY, userId);
}

export function readFlashcardSchedulerSettings(userId: string): FlashcardSchedulerSettings {
  if (typeof window === "undefined") return DEFAULT_FLASHCARD_SCHEDULER_SETTINGS;
  const parsed = safeParse(localStorage.getItem(getSettingsStorageKey(userId)));
  if (!parsed || typeof parsed !== "object") return DEFAULT_FLASHCARD_SCHEDULER_SETTINGS;

  const candidate = parsed as Partial<FlashcardSchedulerSettings>;
  return {
    dailyReviewTarget: clampInteger(
      candidate.dailyReviewTarget,
      5,
      200,
      DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.dailyReviewTarget
    ),
    maxNewCardsPerDay: clampInteger(
      candidate.maxNewCardsPerDay,
      0,
      100,
      DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.maxNewCardsPerDay
    ),
    lapseHandling: normalizeLapseHandling(candidate.lapseHandling),
    maxPerCategory: clampInteger(
      candidate.maxPerCategory,
      0,
      50,
      DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.maxPerCategory
    ),
    weeklyReviewGoal: clampInteger(
      candidate.weeklyReviewGoal,
      0,
      300,
      DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.weeklyReviewGoal
    ),
  };
}

export function hasFlashcardSchedulerSettings(userId: string): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(getSettingsStorageKey(userId));
  if (!raw) return false;
  const parsed = safeParse(raw);
  return !!parsed && typeof parsed === "object";
}

export function writeFlashcardSchedulerSettings(
  userId: string,
  settings: FlashcardSchedulerSettings
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    getSettingsStorageKey(userId),
    JSON.stringify({
      dailyReviewTarget: clampInteger(settings.dailyReviewTarget, 5, 200, DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.dailyReviewTarget),
      maxNewCardsPerDay: clampInteger(settings.maxNewCardsPerDay, 0, 100, DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.maxNewCardsPerDay),
      lapseHandling: normalizeLapseHandling(settings.lapseHandling),
      maxPerCategory: clampInteger(settings.maxPerCategory, 0, 50, DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.maxPerCategory),
      weeklyReviewGoal: clampInteger(settings.weeklyReviewGoal, 0, 300, DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.weeklyReviewGoal),
    })
  );
}

export function readFlashcardDailyState(
  userId: string,
  nowMs: number = Date.now()
): FlashcardSchedulerDailyState {
  const today = todayDateStamp(nowMs);
  if (typeof window === "undefined") {
    return { date: today, seenNewCanonicalKeys: [] };
  }

  const parsed = safeParse(localStorage.getItem(getDailyStorageKey(userId)));
  if (!parsed || typeof parsed !== "object") {
    return { date: today, seenNewCanonicalKeys: [] };
  }

  const candidate = parsed as Partial<FlashcardSchedulerDailyState>;
  if (candidate.date !== today) {
    return { date: today, seenNewCanonicalKeys: [] };
  }

  const seenNewCanonicalKeys = Array.isArray(candidate.seenNewCanonicalKeys)
    ? candidate.seenNewCanonicalKeys.filter(
        (item): item is string => typeof item === "string" && item.length > 0
      )
    : [];
  return {
    date: today,
    seenNewCanonicalKeys: [...new Set(seenNewCanonicalKeys)],
  };
}

function writeFlashcardDailyState(userId: string, state: FlashcardSchedulerDailyState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getDailyStorageKey(userId), JSON.stringify(state));
}

export function getFlashcardRemainingNewQuota(
  userId: string,
  maxNewCardsPerDay: number,
  nowMs: number = Date.now()
): number {
  const cappedMax = Math.max(0, Math.round(maxNewCardsPerDay));
  const seenCount = readFlashcardDailyState(userId, nowMs).seenNewCanonicalKeys.length;
  return Math.max(0, cappedMax - seenCount);
}

export function markFlashcardNewSeenToday(
  userId: string,
  canonicalKey: string,
  nowMs: number = Date.now()
): boolean {
  if (canonicalKey.trim().length === 0) return false;
  const state = readFlashcardDailyState(userId, nowMs);
  if (state.seenNewCanonicalKeys.includes(canonicalKey)) return false;
  const nextState: FlashcardSchedulerDailyState = {
    date: state.date,
    seenNewCanonicalKeys: [...state.seenNewCanonicalKeys, canonicalKey],
  };
  writeFlashcardDailyState(userId, nextState);
  return true;
}

export function readFlashcardSchedulerProgress(
  userId: string,
  nowMs: number = Date.now()
): FlashcardSchedulerProgressState {
  const today = todayDateStamp(nowMs);
  const currentWeekStamp = weekStamp(nowMs);
  if (typeof window === "undefined") {
    return {
      weekStamp: currentWeekStamp,
      completedThisWeek: 0,
      lastReviewDate: null,
      streakDays: 0,
    };
  }

  const parsed = safeParse(localStorage.getItem(getProgressStorageKey(userId)));
  if (!parsed || typeof parsed !== "object") {
    return {
      weekStamp: currentWeekStamp,
      completedThisWeek: 0,
      lastReviewDate: null,
      streakDays: 0,
    };
  }

  const candidate = parsed as Partial<FlashcardSchedulerProgressState>;
  const completedThisWeek =
    candidate.weekStamp === currentWeekStamp
      ? clampInteger(candidate.completedThisWeek, 0, 50_000, 0)
      : 0;
  const lastReviewDate =
    typeof candidate.lastReviewDate === "string" &&
    Number.isFinite(parseDateStamp(candidate.lastReviewDate))
      ? candidate.lastReviewDate
      : null;
  const streakDays = clampInteger(candidate.streakDays, 0, 3650, 0);
  const lastDiff = dayDiff(lastReviewDate, today);

  return {
    weekStamp: currentWeekStamp,
    completedThisWeek,
    lastReviewDate,
    streakDays:
      lastReviewDate === null || lastDiff === null || lastDiff > 1 ? 0 : streakDays,
  };
}

function writeFlashcardSchedulerProgress(
  userId: string,
  state: FlashcardSchedulerProgressState
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(getProgressStorageKey(userId), JSON.stringify(state));
}

export function markFlashcardReviewCompleted(
  userId: string,
  count: number = 1,
  nowMs: number = Date.now()
): FlashcardSchedulerProgressState {
  const increment = clampInteger(count, 1, 1000, 1);
  const today = todayDateStamp(nowMs);
  const previous = readFlashcardSchedulerProgress(userId, nowMs);
  const diff = dayDiff(previous.lastReviewDate, today);

  const nextStreak =
    previous.lastReviewDate === today
      ? previous.streakDays
      : diff === 1
        ? Math.max(1, previous.streakDays + 1)
        : 1;
  const nextState: FlashcardSchedulerProgressState = {
    weekStamp: weekStamp(nowMs),
    completedThisWeek: previous.completedThisWeek + increment,
    lastReviewDate: today,
    streakDays: nextStreak,
  };
  writeFlashcardSchedulerProgress(userId, nextState);
  return nextState;
}
