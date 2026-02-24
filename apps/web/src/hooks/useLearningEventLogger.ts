"use client";

import { useCallback, useMemo } from "react";
import {
  defaultLearningEventStore,
  type LearningEvent,
  type LearningEventStore,
} from "../lib/learningEventStore";
import { sendLearningEventToSink } from "../lib/analyticsSink";
import { validateLearningEventInput } from "../lib/learningEventSchema";

function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useLearningEventLogger(
  userId: string,
  store: LearningEventStore = defaultLearningEventStore
) {
  const logEvent = useCallback(
    (event: Omit<LearningEvent, "id" | "userId" | "timestamp">) => {
      const validationError = validateLearningEventInput(event);
      if (validationError) {
        console.warn(`[learning-events] dropped invalid event: ${validationError}`);
        return;
      }
      const nextEvent: LearningEvent = {
        ...event,
        id: generateEventId(),
        userId,
        timestamp: new Date().toISOString(),
      };
      store.append(userId, nextEvent);
      void sendLearningEventToSink(nextEvent);
    },
    [store, userId]
  );

  const clearEvents = useCallback(() => {
    store.clear(userId);
  }, [store, userId]);

  const getEvents = useCallback(() => {
    return store.load(userId);
  }, [store, userId]);

  return useMemo(
    () => ({
      logEvent,
      clearEvents,
      getEvents,
    }),
    [clearEvents, getEvents, logEvent]
  );
}
