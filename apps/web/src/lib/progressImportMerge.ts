const ATTEMPT_EVENT_CAP = 20_000;
const LEARNING_EVENT_CAP = 5_000;

export type ImportMergeMode = "merge" | "overwrite";

export interface ImportResolution {
  resolvedData: Record<string, string | null>;
  changedKeys: string[];
}

export interface ImportPreview {
  includedKeys: string[];
  changedKeys: string[];
}

interface Timestamped {
  timestamp?: string;
}

interface Identified {
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

interface AdaptiveStatsLike {
  attempts?: number;
  lastAttemptAt?: string;
}

function safeParseJson<T>(raw: string | null | undefined): T | null {
  if (!raw || typeof raw !== "string") return null;
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

function mergeTimestampedById<T extends Identified & Timestamped>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of [...a, ...b]) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    if (parseMs(item.timestamp) >= parseMs(existing.timestamp)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values()).sort((x, y) => parseMs(y.timestamp) - parseMs(x.timestamp));
}

function mergeAttemptEvents(a: AttemptEventLike[], b: AttemptEventLike[]): AttemptEventLike[] {
  const byId = new Map<string, AttemptEventLike>();
  for (const event of [...a, ...b]) {
    const existing = byId.get(event.attemptId);
    if (!existing || parseMs(event.timestamp) >= parseMs(existing.timestamp)) {
      byId.set(event.attemptId, event);
    }
  }
  return Array.from(byId.values())
    .sort((x, y) => parseMs(x.timestamp) - parseMs(y.timestamp))
    .slice(Math.max(0, byId.size - ATTEMPT_EVENT_CAP));
}

function mergeLearningEvents(a: LearningEventLike[], b: LearningEventLike[]): LearningEventLike[] {
  const byId = new Map<string, LearningEventLike>();
  for (const event of [...a, ...b]) {
    const existing = byId.get(event.id);
    if (!existing || parseMs(event.timestamp) >= parseMs(existing.timestamp)) {
      byId.set(event.id, event);
    }
  }
  return Array.from(byId.values())
    .sort((x, y) => parseMs(x.timestamp) - parseMs(y.timestamp))
    .slice(Math.max(0, byId.size - LEARNING_EVENT_CAP));
}

function mergeProgressSessions(currentRaw: string | null, incomingRaw: string | null): string | null {
  const current = safeParseJson<Array<Identified & Timestamped>>(currentRaw) ?? [];
  const incoming = safeParseJson<Array<Identified & Timestamped>>(incomingRaw) ?? [];
  if (incoming.length === 0 && current.length === 0) return currentRaw ?? incomingRaw ?? null;
  return JSON.stringify(mergeTimestampedById(current, incoming));
}

function chooseAdaptiveStats(
  current: AdaptiveStatsLike | undefined,
  incoming: AdaptiveStatsLike | undefined
): AdaptiveStatsLike | undefined {
  if (!incoming) return current;
  if (!current) return incoming;
  const currentAttempts = current.attempts ?? 0;
  const incomingAttempts = incoming.attempts ?? 0;
  if (incomingAttempts > currentAttempts) return incoming;
  if (incomingAttempts < currentAttempts) return current;
  return parseMs(incoming.lastAttemptAt) >= parseMs(current.lastAttemptAt) ? incoming : current;
}

function mergeAdaptive(currentRaw: string | null, incomingRaw: string | null): string | null {
  const current = safeParseJson<{ version: number; users: Record<string, Record<string, AdaptiveStatsLike>> }>(
    currentRaw
  );
  const incoming = safeParseJson<{ version: number; users: Record<string, Record<string, AdaptiveStatsLike>> }>(
    incomingRaw
  );
  if (!incoming || incoming.version !== 2) return currentRaw ?? incomingRaw ?? null;
  if (!current || current.version !== 2) return incomingRaw;

  const mergedUsers: Record<string, Record<string, AdaptiveStatsLike>> = { ...current.users };
  for (const [userId, incomingStats] of Object.entries(incoming.users)) {
    const currentStats = mergedUsers[userId] ?? {};
    const mergedStats: Record<string, AdaptiveStatsLike> = { ...currentStats };
    for (const [key, incomingValue] of Object.entries(incomingStats)) {
      mergedStats[key] = chooseAdaptiveStats(currentStats[key], incomingValue) ?? incomingValue;
    }
    mergedUsers[userId] = mergedStats;
  }

  return JSON.stringify({ version: 2, users: mergedUsers });
}

function mergeAttemptPayload(currentRaw: string | null, incomingRaw: string | null): string | null {
  const current = safeParseJson<{ version: number; users: Record<string, AttemptEventLike[]> }>(currentRaw);
  const incoming = safeParseJson<{ version: number; users: Record<string, AttemptEventLike[]> }>(incomingRaw);
  if (!incoming || incoming.version !== 1) return currentRaw ?? incomingRaw ?? null;
  if (!current || current.version !== 1) return incomingRaw;

  const users: Record<string, AttemptEventLike[]> = { ...current.users };
  for (const [userId, incomingEvents] of Object.entries(incoming.users)) {
    users[userId] = mergeAttemptEvents(users[userId] ?? [], incomingEvents);
  }
  return JSON.stringify({ version: 1, users });
}

function mergeLearningPayload(currentRaw: string | null, incomingRaw: string | null): string | null {
  const current = safeParseJson<{ version: number; users: Record<string, LearningEventLike[]> }>(currentRaw);
  const incoming = safeParseJson<{ version: number; users: Record<string, LearningEventLike[]> }>(incomingRaw);
  if (!incoming || incoming.version !== 1) return currentRaw ?? incomingRaw ?? null;
  if (!current || current.version !== 1) return incomingRaw;

  const users: Record<string, LearningEventLike[]> = { ...current.users };
  for (const [userId, incomingEvents] of Object.entries(incoming.users)) {
    users[userId] = mergeLearningEvents(users[userId] ?? [], incomingEvents);
  }
  return JSON.stringify({ version: 1, users });
}

function mergeFlashcardSr(currentRaw: string | null, incomingRaw: string | null): string | null {
  const current = safeParseJson<Record<string, { due?: number; interval?: number; ease?: number }>>(currentRaw) ?? {};
  const incoming =
    safeParseJson<Record<string, { due?: number; interval?: number; ease?: number }>>(incomingRaw) ?? {};
  const merged: Record<string, { due?: number; interval?: number; ease?: number }> = { ...current };
  for (const [questionId, record] of Object.entries(incoming)) {
    const existing = merged[questionId];
    if (!existing || (record.due ?? 0) >= (existing.due ?? 0)) {
      merged[questionId] = record;
    }
  }
  return JSON.stringify(merged);
}

function mergeLearnDraft(currentRaw: string | null, incomingRaw: string | null): string | null {
  const current = safeParseJson<{ updatedAt?: string }>(currentRaw);
  const incoming = safeParseJson<{ updatedAt?: string }>(incomingRaw);
  if (!incoming) return currentRaw ?? incomingRaw ?? null;
  if (!current) return incomingRaw;
  return parseMs(incoming.updatedAt) >= parseMs(current.updatedAt) ? incomingRaw : currentRaw;
}

export function resolveImportedData(
  snapshotData: Record<string, string | null>,
  currentData: Record<string, string | null>,
  keys: readonly string[],
  mode: ImportMergeMode
): ImportResolution {
  const resolvedData: Record<string, string | null> = {};
  const changedKeys: string[] = [];

  for (const key of keys) {
    const incoming = snapshotData[key] ?? null;
    const current = currentData[key] ?? null;
    let resolved = current;

    if (mode === "overwrite") {
      resolved = incoming;
    } else {
      if (incoming === null) {
        resolved = current;
      } else if (current === null) {
        resolved = incoming;
      } else if (key === "part107_progress") {
        resolved = mergeProgressSessions(current, incoming);
      } else if (key === "part107_adaptive_stats_v2") {
        resolved = mergeAdaptive(current, incoming);
      } else if (key === "part107_attempt_events_v1") {
        resolved = mergeAttemptPayload(current, incoming);
      } else if (key === "part107_learning_events_v1") {
        resolved = mergeLearningPayload(current, incoming);
      } else if (key === "part107_flashcard_sr") {
        resolved = mergeFlashcardSr(current, incoming);
      } else if (key === "part107_learn_draft_v1") {
        resolved = mergeLearnDraft(current, incoming);
      } else {
        resolved = incoming;
      }
    }

    resolvedData[key] = resolved;
    if (resolved !== current) {
      changedKeys.push(key);
    }
  }

  return { resolvedData, changedKeys };
}

export function computeImportPreview(
  snapshotData: Record<string, string | null>,
  currentData: Record<string, string | null>,
  keys: readonly string[],
  mode: ImportMergeMode
): ImportPreview {
  const { changedKeys } = resolveImportedData(snapshotData, currentData, keys, mode);
  const includedKeys = keys.filter((key) => snapshotData[key] !== undefined);
  return {
    includedKeys,
    changedKeys,
  };
}
