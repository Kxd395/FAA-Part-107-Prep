import { type AttemptEvent, defaultAttemptEventStore } from "./attemptEventStore";
import { defaultLearningEventStore } from "./learningEventStore";

export interface RedactedLearningEvent {
  id: string;
  timestamp: string;
  type: string;
  mode: string;
  isCorrect?: boolean;
  questionTypeProfile?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface RedactedAttemptEvent {
  attemptId: string;
  timestamp: string;
  mode: AttemptEvent["mode"];
  correct: boolean;
  responseTimeMs: number | null;
  difficulty: number;
  hasQuizId: boolean;
  topicTagCount: number;
}

export interface TelemetrySupportBundle {
  version: 1;
  exportedAt: string;
  userId: string;
  learningEvents: {
    total: number;
    byMode: Record<string, number>;
    byType: Record<string, number>;
    events: RedactedLearningEvent[];
  };
  attemptEvents: {
    total: number;
    byMode: Record<string, number>;
    events: RedactedAttemptEvent[];
  };
}

function incrementCounter(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

export function buildTelemetrySupportBundle(userId: string): TelemetrySupportBundle {
  const learningEventsRaw = defaultLearningEventStore.load(userId);
  const learningByMode: Record<string, number> = {};
  const learningByType: Record<string, number> = {};

  const learningEvents = learningEventsRaw.map((event) => {
    incrementCounter(learningByMode, event.mode);
    incrementCounter(learningByType, event.type);
    return {
      id: event.id,
      timestamp: event.timestamp,
      type: event.type,
      mode: event.mode,
      isCorrect: event.isCorrect,
      questionTypeProfile: event.questionTypeProfile,
      metadata: event.metadata,
    } satisfies RedactedLearningEvent;
  });

  const attemptEventsRaw = defaultAttemptEventStore.load(userId);
  const attemptByMode: Record<string, number> = {};
  const attemptEvents = attemptEventsRaw.map((event) => {
    incrementCounter(attemptByMode, event.mode);
    return {
      attemptId: event.attemptId,
      timestamp: event.timestamp,
      mode: event.mode,
      correct: event.correct,
      responseTimeMs: event.responseTimeMs,
      difficulty: event.difficulty,
      hasQuizId: Boolean(event.quizId),
      topicTagCount: event.topicTags.length,
    } satisfies RedactedAttemptEvent;
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    userId,
    learningEvents: {
      total: learningEvents.length,
      byMode: learningByMode,
      byType: learningByType,
      events: learningEvents,
    },
    attemptEvents: {
      total: attemptEvents.length,
      byMode: attemptByMode,
      events: attemptEvents,
    },
  };
}

export function downloadJsonFile(filename: string, payload: unknown): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
