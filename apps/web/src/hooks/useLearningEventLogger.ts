"use client";

import { useCallback } from "react";
import {
  defaultLearningEventStore,
  type LearningEvent,
  type LearningEventStore,
} from "../lib/learningEventStore";

function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useLearningEventLogger(
  userId: string,
  store: LearningEventStore = defaultLearningEventStore
) {
  const logEvent = useCallback(
    (event: Omit<LearningEvent, "id" | "userId" | "timestamp">) => {
      store.append(userId, {
        ...event,
        id: generateEventId(),
        userId,
        timestamp: new Date().toISOString(),
      });
    },
    [store, userId]
  );

  const clearEvents = useCallback(() => {
    store.clear(userId);
  }, [store, userId]);

  const getEvents = useCallback(() => {
    return store.load(userId);
  }, [store, userId]);

  return {
    logEvent,
    clearEvents,
    getEvents,
  };
}
