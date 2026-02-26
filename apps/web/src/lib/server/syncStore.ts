import {
  resolveImportedData,
  type ImportMergeMode,
} from "../progressImportMerge";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { signSyncSnapshot } from "./snapshotSignature";

const SYNC_KEYS = [
  "part107_progress",
  "part107_adaptive_stats_v2",
  "part107_attempt_events_v1",
  "part107_learning_events_v1",
  "part107_flashcard_sr",
  "part107_learn_draft_v1",
] as const;

export interface SyncSnapshotEnvelope {
  version: 1;
  exportedAt: string;
  data: Record<string, string | null>;
  signature?: string;
}

export interface SyncUploadPayload {
  userId: string;
  mode: ImportMergeMode;
  snapshot: SyncSnapshotEnvelope;
}

export interface SyncRecord {
  userId: string;
  snapshot: SyncSnapshotEnvelope;
  updatedAt: string;
}

interface PersistedSyncState {
  version: 1;
  records: Record<string, SyncRecord>;
}

const SYNC_STORE_DIR = path.join(process.cwd(), ".data");
const SYNC_STORE_FILE = path.join(SYNC_STORE_DIR, "sync-store-v1.json");
const REMOTE_TIMEOUT_MS = 5_000;
const REMOTE_RETRY_DELAYS_MS = [200, 500] as const;
const REMOTE_BREAKER_FAILURE_THRESHOLD = 3;
const REMOTE_BREAKER_COOLDOWN_MS = 30_000;

declare global {
  var __part107SyncCache__: PersistedSyncState | undefined;
  var __part107SyncRemoteBreaker__:
    | {
        failures: number;
        openUntil: number | null;
      }
    | undefined;
}

function getRemoteStoreUrl(): string {
  return process.env.SYNC_STORE_URL?.trim() ?? "";
}

function getRemoteStoreToken(): string {
  return process.env.SYNC_STORE_TOKEN?.trim() ?? "";
}

function isRemoteStoreEnabled(): boolean {
  return getRemoteStoreUrl().length > 0;
}

function getBreakerState(): { failures: number; openUntil: number | null } {
  if (!globalThis.__part107SyncRemoteBreaker__) {
    globalThis.__part107SyncRemoteBreaker__ = { failures: 0, openUntil: null };
  }
  return globalThis.__part107SyncRemoteBreaker__;
}

function resetBreakerState(): void {
  const breaker = getBreakerState();
  breaker.failures = 0;
  breaker.openUntil = null;
}

function recordRemoteFailure(): void {
  const breaker = getBreakerState();
  breaker.failures += 1;
  if (breaker.failures >= REMOTE_BREAKER_FAILURE_THRESHOLD) {
    breaker.openUntil = Date.now() + REMOTE_BREAKER_COOLDOWN_MS;
  }
}

function isBreakerOpen(): boolean {
  const breaker = getBreakerState();
  if (!breaker.openUntil) return false;
  if (Date.now() >= breaker.openUntil) {
    breaker.openUntil = null;
    breaker.failures = 0;
    return false;
  }
  return true;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchRemoteStore(pathname: string, init?: RequestInit): Promise<Response> {
  if (isBreakerOpen()) {
    throw new Error("Remote sync store circuit breaker is open");
  }

  const url = `${getRemoteStoreUrl()}${pathname}`;
  const token = getRemoteStoreToken();
  const withAuth: RequestInit = {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= REMOTE_RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...withAuth,
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok && response.status >= 500) {
        throw new Error(`Remote sync store ${response.status}`);
      }
      resetBreakerState();
      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      recordRemoteFailure();
      if (attempt < REMOTE_RETRY_DELAYS_MS.length) {
        await sleep(REMOTE_RETRY_DELAYS_MS[attempt]);
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Remote sync store request failed");
}

async function loadState(): Promise<PersistedSyncState> {
  if (isRemoteStoreEnabled()) {
    // Remote managed store mode delegates reads to configured store endpoint.
    return { version: 1, records: {} };
  }
  if (globalThis.__part107SyncCache__) {
    return globalThis.__part107SyncCache__;
  }

  try {
    const raw = await readFile(SYNC_STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedSyncState;
    if (parsed?.version === 1 && typeof parsed.records === "object" && parsed.records) {
      globalThis.__part107SyncCache__ = parsed;
      return parsed;
    }
  } catch {
    // fall through to create empty state
  }

  const empty: PersistedSyncState = { version: 1, records: {} };
  globalThis.__part107SyncCache__ = empty;
  return empty;
}

async function saveState(state: PersistedSyncState): Promise<void> {
  if (isRemoteStoreEnabled()) return;
  await mkdir(SYNC_STORE_DIR, { recursive: true });
  await writeFile(SYNC_STORE_FILE, JSON.stringify(state), "utf8");
  globalThis.__part107SyncCache__ = state;
}

export async function clearSyncStoreForTests(): Promise<void> {
  resetBreakerState();
  if (isRemoteStoreEnabled()) return;
  const state = await loadState();
  state.records = {};
  await saveState(state);
}

export async function getSyncedSnapshot(userId: string): Promise<SyncRecord | null> {
  if (isRemoteStoreEnabled()) {
    const response = await fetchRemoteStore(`/sync/${encodeURIComponent(userId)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Failed to read remote sync store");
    return (await response.json()) as SyncRecord;
  }
  const state = await loadState();
  return state.records[userId] ?? null;
}

export async function mergeAndSaveSnapshot(payload: SyncUploadPayload): Promise<{
  accepted: boolean;
  mergedSummary: { changedKeys: string[]; conflicts: number };
  record: SyncRecord;
}> {
  const state = await loadState();
  const existing = state.records[payload.userId];
  const currentData: Record<string, string | null> = {};
  for (const key of SYNC_KEYS) {
    currentData[key] = existing?.snapshot.data[key] ?? null;
  }

  const { resolvedData, changedKeys } = resolveImportedData(
    payload.snapshot.data,
    currentData,
    SYNC_KEYS,
    payload.mode
  );

  const mergedSnapshot: SyncSnapshotEnvelope = {
    version: 1,
    exportedAt: payload.snapshot.exportedAt,
    data: {
      ...existing?.snapshot.data,
      ...resolvedData,
    },
  };
  const signature = signSyncSnapshot(mergedSnapshot);
  if (signature) {
    mergedSnapshot.signature = signature;
  }

  const record: SyncRecord = {
    userId: payload.userId,
    snapshot: mergedSnapshot,
    updatedAt: new Date().toISOString(),
  };

  if (isRemoteStoreEnabled()) {
    const response = await fetchRemoteStore(`/sync/${encodeURIComponent(payload.userId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(record),
    });
    if (!response.ok) {
      throw new Error("Failed to write remote sync store");
    }
  } else {
    state.records[payload.userId] = record;
    await saveState(state);
  }

  return {
    accepted: true,
    mergedSummary: {
      changedKeys,
      conflicts: 0,
    },
    record,
  };
}
