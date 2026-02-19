import type { OptionId } from "@part107/core";

const STORAGE_KEY = "part107_attempt_events_v1";
const MAX_EVENTS_PER_USER = 20000;

export type AttemptMode = "pretest" | "practice" | "quiz" | "mock";

export interface AttemptEvent {
  attemptId: string;
  userId: string;
  questionKey: string;
  questionId: string;
  timestamp: string;
  mode: AttemptMode;
  correct: boolean;
  responseTimeMs: number | null;
  selectedOptionId: OptionId | null;
  quizId: string | null;
  topicTags: string[];
  difficulty: number;
  confidence: 1 | 2 | 3 | 4 | 5 | null;
}

interface AttemptEventPayload {
  version: 1;
  users: Record<string, AttemptEvent[]>;
}

export interface AttemptEventStore {
  load: (userId: string) => AttemptEvent[];
  append: (userId: string, event: AttemptEvent) => void;
  clear: (userId: string) => void;
}

function loadPayload(): AttemptEventPayload {
  if (typeof window === "undefined") return { version: 1, users: {} };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, users: {} };
    const parsed = JSON.parse(raw) as AttemptEventPayload;
    if (!parsed || parsed.version !== 1 || typeof parsed.users !== "object") {
      return { version: 1, users: {} };
    }
    return parsed;
  } catch {
    return { version: 1, users: {} };
  }
}

function persistPayload(payload: AttemptEventPayload): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function createLocalStorageAttemptEventStore(): AttemptEventStore {
  return {
    load(userId) {
      const payload = loadPayload();
      return payload.users[userId] ?? [];
    },
    append(userId, event) {
      const payload = loadPayload();
      const existing = payload.users[userId] ?? [];
      const next = [...existing, event];
      payload.users[userId] = next.slice(Math.max(0, next.length - MAX_EVENTS_PER_USER));
      persistPayload(payload);
    },
    clear(userId) {
      const payload = loadPayload();
      delete payload.users[userId];
      persistPayload(payload);
    },
  };
}

export const defaultAttemptEventStore = createLocalStorageAttemptEventStore();
