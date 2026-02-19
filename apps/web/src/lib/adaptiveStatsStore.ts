import type { UserQuestionStats } from "@part107/core";

const STORAGE_KEY = "part107_adaptive_stats_v2";
const LEGACY_STORAGE_KEY = "part107_adaptive_stats_v1";

interface AdaptiveStatsPayloadV2 {
  version: 2;
  users: Record<string, Record<string, UserQuestionStats>>;
}

interface AdaptiveStatsPayloadV1 {
  version: 1;
  userId: string;
  statsByKey: Record<string, UserQuestionStats>;
}

export interface AdaptiveStatsStore {
  load: (userId: string) => Record<string, UserQuestionStats>;
  save: (userId: string, statsByKey: Record<string, UserQuestionStats>) => void;
  clear: (userId: string) => void;
}

function loadPayloadV2(): AdaptiveStatsPayloadV2 | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdaptiveStatsPayloadV2;
    if (!parsed || parsed.version !== 2 || typeof parsed.users !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function loadLegacyPayloadV1(): AdaptiveStatsPayloadV1 | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdaptiveStatsPayloadV1;
    if (!parsed || parsed.version !== 1 || typeof parsed.statsByKey !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistPayloadV2(payload: AdaptiveStatsPayloadV2): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function createLocalStorageAdaptiveStatsStore(): AdaptiveStatsStore {
  return {
    load(userId) {
      const payloadV2 = loadPayloadV2();
      if (payloadV2) {
        return payloadV2.users[userId] ?? {};
      }

      const payloadV1 = loadLegacyPayloadV1();
      if (!payloadV1) return {};

      if (payloadV1.userId === userId) {
        return payloadV1.statsByKey ?? {};
      }

      return {};
    },
    save(userId, statsByKey) {
      const existing = loadPayloadV2() ?? { version: 2, users: {} };
      existing.users[userId] = statsByKey;
      persistPayloadV2(existing);
    },
    clear(userId) {
      const existing = loadPayloadV2();
      if (!existing) return;
      delete existing.users[userId];
      persistPayloadV2(existing);
    },
  };
}

export const defaultAdaptiveStatsStore = createLocalStorageAdaptiveStatsStore();
