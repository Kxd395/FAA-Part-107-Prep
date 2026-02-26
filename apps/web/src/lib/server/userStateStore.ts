import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveImportedData, type ImportMergeMode } from "../progressImportMerge";
import { serverLogger } from "./logger";
import { getSupabasePersistenceContext } from "./supabasePersistence";

const USER_STATE_DIR = path.join(process.cwd(), ".data");
const USER_STATE_FILE = path.join(USER_STATE_DIR, "user-state-v1.json");

const USER_STATE_KEYS = [
  "part107_progress",
  "part107_adaptive_stats_v2",
  "part107_attempt_events_v1",
  "part107_learning_events_v1",
  "part107_flashcard_sr",
  "part107_learn_draft_v1",
  "part107_question_collections_v1",
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

interface SupabaseUserStateRow {
  user_id: string;
  updated_at: string;
  data: Record<string, unknown> | null;
}

declare global {
  var __part107UserStateCache__: PersistedUserState | undefined;
}

async function loadLocalState(): Promise<PersistedUserState> {
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

async function saveLocalState(state: PersistedUserState): Promise<void> {
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

function toTrackedData(input: Record<string, unknown> | null | undefined): Record<string, string | null> {
  const data: Record<string, string | null> = {};
  for (const key of USER_STATE_KEYS) {
    const value = input?.[key];
    data[key] = typeof value === "string" || value === null ? value : null;
  }
  return data;
}

function toSupabaseUserStateRow(record: UserStateRecord): SupabaseUserStateRow {
  return {
    user_id: record.userId,
    updated_at: record.updatedAt,
    data: record.data,
  };
}

function fromSupabaseUserStateRow(row: SupabaseUserStateRow): UserStateRecord {
  return {
    userId: row.user_id,
    updatedAt: row.updated_at,
    data: toTrackedData(row.data),
  };
}

async function getUserStateRemote(userId: string): Promise<UserStateRecord | null> {
  const context = getSupabasePersistenceContext();
  if (!context) return null;

  const { client, config } = context;
  const { data, error } = await client
    .from(config.tables.userState)
    .select("user_id,updated_at,data")
    .eq("user_id", userId)
    .maybeSingle<SupabaseUserStateRow>();

  if (error) {
    throw error;
  }

  if (!data) return null;
  return fromSupabaseUserStateRow(data);
}

async function saveUserStateRemote(
  userId: string,
  incomingData: Record<string, unknown>,
  mode: ImportMergeMode
): Promise<{ record: UserStateRecord; changedKeys: string[] }> {
  const context = getSupabasePersistenceContext();
  if (!context) {
    throw new Error("Supabase persistence is not configured");
  }

  const { client, config } = context;
  const existing = await getUserStateRemote(userId);
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

  const { error } = await client
    .from(config.tables.userState)
    .upsert(toSupabaseUserStateRow(record), { onConflict: "user_id" });
  if (error) {
    throw error;
  }

  return { record, changedKeys: resolved.changedKeys };
}

async function getUserStateLocal(userId: string): Promise<UserStateRecord | null> {
  const state = await loadLocalState();
  return state.records[userId] ?? null;
}

async function saveUserStateLocal(
  userId: string,
  incomingData: Record<string, unknown>,
  mode: ImportMergeMode
): Promise<{ record: UserStateRecord; changedKeys: string[] }> {
  const state = await loadLocalState();
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
  await saveLocalState(state);
  return { record, changedKeys: resolved.changedKeys };
}

export async function clearUserStateStoreForTests(): Promise<void> {
  const state = await loadLocalState();
  state.records = {};
  await saveLocalState(state);
}

export async function getUserState(userId: string): Promise<UserStateRecord | null> {
  const context = getSupabasePersistenceContext();
  if (context) {
    try {
      return await getUserStateRemote(userId);
    } catch (error) {
      serverLogger.warn("Falling back to local user state store", {
        userId,
        error,
      });
    }
  }

  return getUserStateLocal(userId);
}

export async function saveUserState(
  userId: string,
  incomingData: Record<string, unknown>,
  mode: ImportMergeMode
): Promise<{ record: UserStateRecord; changedKeys: string[] }> {
  const context = getSupabasePersistenceContext();
  if (context) {
    try {
      return await saveUserStateRemote(userId, incomingData, mode);
    } catch (error) {
      serverLogger.warn("Falling back to local user state write", {
        userId,
        mode,
        error,
      });
    }
  }

  return saveUserStateLocal(userId, incomingData, mode);
}
