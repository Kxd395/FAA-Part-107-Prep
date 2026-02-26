import type { UserQuestionStats } from "@part107/core";
import { LOCAL_USER_ID } from "./analyticsTaxonomy";
import {
  FLASHCARD_SR_STORAGE_KEY,
  LEARN_DRAFT_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
  normalizeUserId,
  progressStorageKey,
  userScopedStorageKey,
} from "./progressStorage";

const ADAPTIVE_V2_KEY = "part107_adaptive_stats_v2";
const ADAPTIVE_V1_KEY = "part107_adaptive_stats_v1";
const ATTEMPT_KEY = "part107_attempt_events_v1";
const LEARNING_KEY = "part107_learning_events_v1";

const ATTEMPT_EVENT_CAP = 20_000;
const LEARNING_EVENT_CAP = 5_000;

interface Timestamped {
  timestamp?: string;
}

interface ProgressSessionLike extends Timestamped {
  id: string;
}

interface AttemptEventLike {
  attemptId: string;
  timestamp: string;
}

interface LearningEventLike {
  id: string;
  timestamp: string;
}

interface AdaptiveStatsPayloadV2 {
  version: 2;
  users: Record<string, Record<string, UserQuestionStats>>;
}

interface AdaptiveStatsPayloadV1 {
  version: 1;
  userId: string;
  statsByKey: Record<string, UserQuestionStats>;
}

interface AttemptPayload {
  version: 1;
  users: Record<string, AttemptEventLike[]>;
}

interface LearningPayload {
  version: 1;
  users: Record<string, LearningEventLike[]>;
}

export interface LocalUserMigrationSummary {
  userId: string;
  progress: boolean;
  adaptive: boolean;
  adaptiveLegacy: boolean;
  attempts: boolean;
  learningEvents: boolean;
  flashcardSchedule: boolean;
  learnDraft: boolean;
  migrated: boolean;
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function parseMs(iso: string | undefined): number {
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeProgressSessions(
  currentSessions: ProgressSessionLike[],
  legacySessions: ProgressSessionLike[]
): ProgressSessionLike[] {
  const byId = new Map<string, ProgressSessionLike>();
  for (const session of [...currentSessions, ...legacySessions]) {
    const existing = byId.get(session.id);
    if (!existing || parseMs(session.timestamp) >= parseMs(existing.timestamp)) {
      byId.set(session.id, session);
    }
  }
  return Array.from(byId.values()).sort((a, b) => parseMs(b.timestamp) - parseMs(a.timestamp));
}

function mergeAttemptEvents(
  currentEvents: AttemptEventLike[],
  legacyEvents: AttemptEventLike[]
): AttemptEventLike[] {
  const byId = new Map<string, AttemptEventLike>();
  for (const event of [...currentEvents, ...legacyEvents]) {
    const existing = byId.get(event.attemptId);
    if (!existing || parseMs(event.timestamp) >= parseMs(existing.timestamp)) {
      byId.set(event.attemptId, event);
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => parseMs(a.timestamp) - parseMs(b.timestamp))
    .slice(Math.max(0, byId.size - ATTEMPT_EVENT_CAP));
}

function mergeLearningEvents(
  currentEvents: LearningEventLike[],
  legacyEvents: LearningEventLike[]
): LearningEventLike[] {
  const byId = new Map<string, LearningEventLike>();
  for (const event of [...currentEvents, ...legacyEvents]) {
    const existing = byId.get(event.id);
    if (!existing || parseMs(event.timestamp) >= parseMs(existing.timestamp)) {
      byId.set(event.id, event);
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => parseMs(a.timestamp) - parseMs(b.timestamp))
    .slice(Math.max(0, byId.size - LEARNING_EVENT_CAP));
}

function chooseAdaptiveStats(
  current: UserQuestionStats | undefined,
  incoming: UserQuestionStats | undefined
): UserQuestionStats | undefined {
  if (!incoming) return current;
  if (!current) return incoming;

  const currentAttempts = current.attempts ?? 0;
  const incomingAttempts = incoming.attempts ?? 0;
  if (incomingAttempts > currentAttempts) return incoming;
  if (incomingAttempts < currentAttempts) return current;
  return parseMs(incoming.lastAttemptAt) >= parseMs(current.lastAttemptAt) ? incoming : current;
}

function mergeAdaptiveStats(
  userId: string,
  currentStats: Record<string, UserQuestionStats>,
  legacyStats: Record<string, UserQuestionStats>
): Record<string, UserQuestionStats> {
  const merged: Record<string, UserQuestionStats> = { ...currentStats };
  for (const [questionKey, legacy] of Object.entries(legacyStats)) {
    const chosen = chooseAdaptiveStats(merged[questionKey], legacy) ?? legacy;
    merged[questionKey] = { ...chosen, userId };
  }
  return merged;
}

function migrateProgress(userId: string): boolean {
  const legacyRaw = localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (!legacyRaw) return false;

  const targetKey = progressStorageKey(userId);
  if (targetKey === PROGRESS_STORAGE_KEY) return false;

  const legacySessions = safeParseJson<ProgressSessionLike[]>(legacyRaw);
  const currentRaw = localStorage.getItem(targetKey);
  const currentSessions = safeParseJson<ProgressSessionLike[]>(currentRaw) ?? [];

  if (!legacySessions) {
    if (!currentRaw) {
      localStorage.setItem(targetKey, legacyRaw);
    }
  } else {
    const merged = mergeProgressSessions(currentSessions, legacySessions);
    localStorage.setItem(targetKey, JSON.stringify(merged));
  }

  localStorage.removeItem(PROGRESS_STORAGE_KEY);
  return true;
}

function loadAdaptivePayloadV2(): AdaptiveStatsPayloadV2 | null {
  const payload = safeParseJson<AdaptiveStatsPayloadV2>(localStorage.getItem(ADAPTIVE_V2_KEY));
  if (!payload || payload.version !== 2 || typeof payload.users !== "object") return null;
  return payload;
}

function migrateAdaptiveV2(userId: string): boolean {
  const payload = loadAdaptivePayloadV2();
  if (!payload) return false;

  const legacyStats = payload.users[LOCAL_USER_ID];
  if (!legacyStats) return false;

  payload.users[userId] = mergeAdaptiveStats(userId, payload.users[userId] ?? {}, legacyStats);
  delete payload.users[LOCAL_USER_ID];
  localStorage.setItem(ADAPTIVE_V2_KEY, JSON.stringify(payload));
  return true;
}

function migrateAdaptiveV1(userId: string): boolean {
  const payloadV1 = safeParseJson<AdaptiveStatsPayloadV1>(localStorage.getItem(ADAPTIVE_V1_KEY));
  if (
    !payloadV1 ||
    payloadV1.version !== 1 ||
    typeof payloadV1.statsByKey !== "object" ||
    !payloadV1.userId
  ) {
    return false;
  }

  if (payloadV1.userId !== LOCAL_USER_ID && payloadV1.userId !== userId) {
    return false;
  }

  const payloadV2 = loadAdaptivePayloadV2() ?? { version: 2, users: {} };
  payloadV2.users[userId] = mergeAdaptiveStats(userId, payloadV2.users[userId] ?? {}, payloadV1.statsByKey);
  localStorage.setItem(ADAPTIVE_V2_KEY, JSON.stringify(payloadV2));
  localStorage.removeItem(ADAPTIVE_V1_KEY);
  return true;
}

function migrateAttemptPayload(userId: string): boolean {
  const payload = safeParseJson<AttemptPayload>(localStorage.getItem(ATTEMPT_KEY));
  if (!payload || payload.version !== 1 || typeof payload.users !== "object") return false;

  const legacyEvents = payload.users[LOCAL_USER_ID];
  if (!legacyEvents) return false;

  payload.users[userId] = mergeAttemptEvents(payload.users[userId] ?? [], legacyEvents);
  delete payload.users[LOCAL_USER_ID];
  localStorage.setItem(ATTEMPT_KEY, JSON.stringify(payload));
  return true;
}

function migrateLearningPayload(userId: string): boolean {
  const payload = safeParseJson<LearningPayload>(localStorage.getItem(LEARNING_KEY));
  if (!payload || payload.version !== 1 || typeof payload.users !== "object") return false;

  const legacyEvents = payload.users[LOCAL_USER_ID];
  if (!legacyEvents) return false;

  payload.users[userId] = mergeLearningEvents(payload.users[userId] ?? [], legacyEvents);
  delete payload.users[LOCAL_USER_ID];
  localStorage.setItem(LEARNING_KEY, JSON.stringify(payload));
  return true;
}

function mergeFlashcardSchedule(
  currentRaw: string | null,
  legacyRaw: string | null
): string | null {
  const current = safeParseJson<Record<string, { due?: number; interval?: number; ease?: number }>>(currentRaw) ?? {};
  const legacy = safeParseJson<Record<string, { due?: number; interval?: number; ease?: number }>>(legacyRaw) ?? {};

  if (Object.keys(current).length === 0 && Object.keys(legacy).length === 0) {
    return currentRaw ?? legacyRaw ?? null;
  }

  const merged = { ...current };
  for (const [questionId, record] of Object.entries(legacy)) {
    const existing = merged[questionId];
    if (!existing || (record.due ?? 0) >= (existing.due ?? 0)) {
      merged[questionId] = record;
    }
  }
  return JSON.stringify(merged);
}

function parseUpdatedAt(raw: string | null): number {
  const parsed = safeParseJson<{ updatedAt?: string }>(raw);
  if (!parsed?.updatedAt) return 0;
  return parseMs(parsed.updatedAt);
}

function mergeLearnDraft(currentRaw: string | null, legacyRaw: string | null): string | null {
  if (!legacyRaw) return currentRaw ?? null;
  if (!currentRaw) return legacyRaw;
  return parseUpdatedAt(legacyRaw) >= parseUpdatedAt(currentRaw) ? legacyRaw : currentRaw;
}

function migrateFlashcardSchedule(userId: string): boolean {
  const legacyRaw = localStorage.getItem(FLASHCARD_SR_STORAGE_KEY);
  if (!legacyRaw) return false;

  const scopedKey = userScopedStorageKey(FLASHCARD_SR_STORAGE_KEY, userId);
  if (scopedKey === FLASHCARD_SR_STORAGE_KEY) return false;

  const merged = mergeFlashcardSchedule(localStorage.getItem(scopedKey), legacyRaw);
  if (merged === null) {
    localStorage.removeItem(scopedKey);
  } else {
    localStorage.setItem(scopedKey, merged);
  }
  localStorage.removeItem(FLASHCARD_SR_STORAGE_KEY);
  return true;
}

function migrateLearnDraft(userId: string): boolean {
  const legacyRaw = localStorage.getItem(LEARN_DRAFT_STORAGE_KEY);
  if (!legacyRaw) return false;

  const scopedKey = userScopedStorageKey(LEARN_DRAFT_STORAGE_KEY, userId);
  if (scopedKey === LEARN_DRAFT_STORAGE_KEY) return false;

  const merged = mergeLearnDraft(localStorage.getItem(scopedKey), legacyRaw);
  if (merged === null) {
    localStorage.removeItem(scopedKey);
  } else {
    localStorage.setItem(scopedKey, merged);
  }
  localStorage.removeItem(LEARN_DRAFT_STORAGE_KEY);
  return true;
}

export function migrateLegacyLocalUserStateToUser(userId: string): LocalUserMigrationSummary {
  const normalizedUserId = normalizeUserId(userId);
  const summary: LocalUserMigrationSummary = {
    userId: normalizedUserId,
    progress: false,
    adaptive: false,
    adaptiveLegacy: false,
    attempts: false,
    learningEvents: false,
    flashcardSchedule: false,
    learnDraft: false,
    migrated: false,
  };

  if (typeof window === "undefined" || normalizedUserId === LOCAL_USER_ID) {
    return summary;
  }

  summary.progress = migrateProgress(normalizedUserId);
  summary.adaptive = migrateAdaptiveV2(normalizedUserId);
  summary.adaptiveLegacy = migrateAdaptiveV1(normalizedUserId);
  summary.attempts = migrateAttemptPayload(normalizedUserId);
  summary.learningEvents = migrateLearningPayload(normalizedUserId);
  summary.flashcardSchedule = migrateFlashcardSchedule(normalizedUserId);
  summary.learnDraft = migrateLearnDraft(normalizedUserId);
  summary.migrated =
    summary.progress ||
    summary.adaptive ||
    summary.adaptiveLegacy ||
    summary.attempts ||
    summary.learningEvents ||
    summary.flashcardSchedule ||
    summary.learnDraft;

  return summary;
}
