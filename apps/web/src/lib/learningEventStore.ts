import type { OptionId, QuizMode } from "@part107/core";

const STORAGE_KEY = "part107_learning_events_v1";
const MAX_EVENTS_PER_USER = 5000;

export type LearningEventType =
  | "question_shown"
  | "answer_submitted"
  | "review_opened"
  | "citation_clicked";

export interface LearningEvent {
  id: string;
  userId: string;
  timestamp: string;
  type: LearningEventType;
  mode: QuizMode;
  questionId?: string;
  category?: string;
  subcategory?: string;
  selectedOption?: OptionId | null;
  correctOption?: OptionId | null;
  isCorrect?: boolean;
  citationLabel?: string;
  citationUrl?: string;
  questionTypeProfile?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

interface LearningEventPayload {
  version: 1;
  users: Record<string, LearningEvent[]>;
}

export interface LearningEventStore {
  load: (userId: string) => LearningEvent[];
  append: (userId: string, event: LearningEvent) => void;
  clear: (userId: string) => void;
}

function loadPayload(): LearningEventPayload {
  if (typeof window === "undefined") return { version: 1, users: {} };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, users: {} };
    const parsed = JSON.parse(raw) as LearningEventPayload;
    if (!parsed || parsed.version !== 1 || typeof parsed.users !== "object") {
      return { version: 1, users: {} };
    }
    return parsed;
  } catch {
    return { version: 1, users: {} };
  }
}

function persistPayload(payload: LearningEventPayload): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function createLocalStorageLearningEventStore(): LearningEventStore {
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

export const defaultLearningEventStore = createLocalStorageLearningEventStore();
