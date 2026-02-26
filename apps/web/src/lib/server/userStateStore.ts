import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveImportedData, type ImportMergeMode } from "../progressImportMerge";

const USER_STATE_DIR = path.join(process.cwd(), ".data");
const USER_STATE_FILE = path.join(USER_STATE_DIR, "user-state-v1.json");

const USER_STATE_KEYS = [
  "part107_progress",
  "part107_adaptive_stats_v2",
  "part107_attempt_events_v1",
  "part107_learning_events_v1",
  "part107_flashcard_sr",
  "part107_learn_draft_v1",
] as const;

type UserStateKey = (typeof USER_STATE_KEYS)[number];

export interface UserStateRecord {
  userId: string;
  updatedAt: string;
  data: Record<string, string | null>;
}

interface PersistedUserState {
  version: 1;
  records: Record<string, UserStateRecord>;
}

declare global {
  var __part107UserStateCache__: PersistedUserState | undefined;
}

async function loadState(): Promise<PersistedUserState> {
  if (globalThis.__part107UserStateCache__) {
    return globalThis.__part107UserStateCache__;
  }

  try {
    const raw = await readFile(USER_STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedUserState;
    if (parsed?.version === 1 && parsed.records && typeof parsed.records === "object") {
      globalThis.__part107UserStateCache__ = parsed;
      return parsed;
    }
  } catch {
    // fall through
  }

  const empty: PersistedUserState = { version: 1, records: {} };
  globalThis.__part107UserStateCache__ = empty;
  return empty;
}

async function saveState(state: PersistedUserState): Promise<void> {
  await mkdir(USER_STATE_DIR, { recursive: true });
  await writeFile(USER_STATE_FILE, JSON.stringify(state), "utf8");
  globalThis.__part107UserStateCache__ = state;
}

function pickTrackedData(input: Record<string, unknown>): Record<UserStateKey, string | null> {
  const data = {} as Record<UserStateKey, string | null>;
  for (const key of USER_STATE_KEYS) {
    const value = input[key];
    data[key] = typeof value === "string" || value === null ? value : null;
  }
  return data;
}

export async function clearUserStateStoreForTests(): Promise<void> {
  const state = await loadState();
  state.records = {};
  await saveState(state);
}

export async function getUserState(userId: string): Promise<UserStateRecord | null> {
  const state = await loadState();
  return state.records[userId] ?? null;
}

export async function saveUserState(
  userId: string,
  incomingData: Record<string, unknown>,
  mode: ImportMergeMode
): Promise<{ record: UserStateRecord; changedKeys: string[] }> {
  const state = await loadState();
  const existing = state.records[userId];
  const currentData: Record<string, string | null> = {};
  for (const key of USER_STATE_KEYS) {
    currentData[key] = existing?.data[key] ?? null;
  }

  const sanitizedIncoming = pickTrackedData(incomingData);
  const resolved = resolveImportedData(
    sanitizedIncoming,
    currentData,
    USER_STATE_KEYS,
    mode
  );

  const nextData = {
    ...(existing?.data ?? {}),
    ...resolved.resolvedData,
  };
  const updatedAt =
    resolved.changedKeys.length === 0 && existing?.updatedAt
      ? existing.updatedAt
      : new Date().toISOString();
  const record: UserStateRecord = {
    userId,
    updatedAt,
    data: nextData,
  };

  state.records[userId] = record;
  await saveState(state);
  return { record, changedKeys: resolved.changedKeys };
}
