import {
  FLASHCARD_SR_STORAGE_KEY,
  LEARN_DRAFT_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
  userScopedStorageKey,
} from "./progressStorage";
import { QUESTION_COLLECTION_STORAGE_KEY } from "./questionCollectionStore";

export const PORTABLE_STATE_CHANGED_EVENT = "part107:portable-state-changed";

export interface PortableStateChangedDetail {
  userId: string;
  keys: string[];
}

const USER_SCOPED_PAYLOAD_CONFIG = {
  part107_adaptive_stats_v2: 2,
  part107_attempt_events_v1: 1,
  part107_learning_events_v1: 1,
} as const;

type UserScopedPayloadKey = keyof typeof USER_SCOPED_PAYLOAD_CONFIG;

interface UserScopedPayload {
  version: number;
  users: Record<string, unknown>;
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isUserScopedPayloadKey(key: string): key is UserScopedPayloadKey {
  return key in USER_SCOPED_PAYLOAD_CONFIG;
}

function parseUserScopedPayload(
  raw: string | null,
  expectedVersion: number
): UserScopedPayload | null {
  const parsed = safeParseJson<UserScopedPayload>(raw);
  if (!parsed || parsed.version !== expectedVersion || typeof parsed.users !== "object") return null;
  return parsed;
}

function firstObjectValue(record: Record<string, unknown>): unknown {
  const firstKey = Object.keys(record)[0];
  return firstKey ? record[firstKey] : undefined;
}

function readScopedPayloadForUser(
  storageKey: UserScopedPayloadKey,
  userId: string
): string | null {
  const expectedVersion = USER_SCOPED_PAYLOAD_CONFIG[storageKey];
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  const parsed = parseUserScopedPayload(raw, expectedVersion);
  if (!parsed) {
    return raw;
  }

  const userPayload = parsed.users[userId];
  if (userPayload === undefined || userPayload === null) return null;
  return JSON.stringify({ version: expectedVersion, users: { [userId]: userPayload } });
}

function writeScopedPayloadForUser(
  storageKey: UserScopedPayloadKey,
  userId: string,
  value: string | null
): void {
  const expectedVersion = USER_SCOPED_PAYLOAD_CONFIG[storageKey];
  const existingRaw = localStorage.getItem(storageKey);
  const existingParsed = parseUserScopedPayload(existingRaw, expectedVersion) ?? {
    version: expectedVersion,
    users: {},
  };

  if (value === null) {
    delete existingParsed.users[userId];
    if (Object.keys(existingParsed.users).length === 0) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, JSON.stringify(existingParsed));
    }
    return;
  }

  const incomingParsed = parseUserScopedPayload(value, expectedVersion);
  if (!incomingParsed) {
    localStorage.setItem(storageKey, value);
    return;
  }

  const userPayload = incomingParsed.users[userId] ?? firstObjectValue(incomingParsed.users);
  if (userPayload === undefined || userPayload === null) {
    delete existingParsed.users[userId];
  } else {
    existingParsed.users[userId] = userPayload;
  }

  if (Object.keys(existingParsed.users).length === 0) {
    localStorage.removeItem(storageKey);
  } else {
    localStorage.setItem(storageKey, JSON.stringify(existingParsed));
  }
}

function resolveLocalStorageKey(portableKey: string, userId: string): string {
  if (
    portableKey === PROGRESS_STORAGE_KEY ||
    portableKey === FLASHCARD_SR_STORAGE_KEY ||
    portableKey === LEARN_DRAFT_STORAGE_KEY ||
    portableKey === QUESTION_COLLECTION_STORAGE_KEY
  ) {
    return userScopedStorageKey(portableKey, userId);
  }
  return portableKey;
}

function dispatchPortableStateChanged(userId: string, keys: readonly string[]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PortableStateChangedDetail>(PORTABLE_STATE_CHANGED_EVENT, {
      detail: { userId, keys: [...keys] },
    })
  );
}

export function readPortableStateForUser(
  keys: readonly string[],
  userId: string
): Record<string, string | null> {
  if (typeof window === "undefined") return {};
  const data: Record<string, string | null> = {};

  for (const key of keys) {
    if (isUserScopedPayloadKey(key)) {
      data[key] = readScopedPayloadForUser(key, userId);
      continue;
    }
    data[key] = localStorage.getItem(resolveLocalStorageKey(key, userId));
  }

  return data;
}

export function writePortableStateForUser(
  keys: readonly string[],
  userId: string,
  data: Record<string, string | null>
): void {
  if (typeof window === "undefined") return;

  for (const key of keys) {
    const value = data[key] ?? null;
    if (isUserScopedPayloadKey(key)) {
      writeScopedPayloadForUser(key, userId, value);
      continue;
    }

    const storageKey = resolveLocalStorageKey(key, userId);
    if (value === null) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, value);
    }
  }

  dispatchPortableStateChanged(userId, keys);
}
