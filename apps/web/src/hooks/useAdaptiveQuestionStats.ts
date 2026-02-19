"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ADAPTIVE_QUIZ_CONFIG,
  canonicalQuestionKey,
  updateUserQuestionStats,
  type OptionId,
  type AdaptiveQuizConfig,
  type Question,
  type UserQuestionStats,
} from "@part107/core";
import { defaultAdaptiveStatsStore, type AdaptiveStatsStore } from "../lib/adaptiveStatsStore";
import {
  defaultAttemptEventStore,
  type AttemptEventStore,
  type AttemptMode,
} from "../lib/attemptEventStore";

const DEFAULT_USER_ID = "local-user";

export interface ExamReviewInput {
  question: Question;
  isCorrect: boolean;
  userAnswer?: OptionId | null;
}

interface RecordAnswerContext {
  mode?: AttemptMode;
  selectedOptionId?: OptionId | null;
  responseTimeMs?: number | null;
  quizId?: string | null;
  confidence?: 1 | 2 | 3 | 4 | 5 | null;
}

function generateAttemptId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAdaptiveQuestionStats(
  userId: string = DEFAULT_USER_ID,
  config: Partial<AdaptiveQuizConfig> = {},
  store: AdaptiveStatsStore = defaultAdaptiveStatsStore,
  attemptStore: AttemptEventStore = defaultAttemptEventStore
) {
  const resolvedConfig = useMemo(
    () => ({ ...DEFAULT_ADAPTIVE_QUIZ_CONFIG, ...config }),
    [config]
  );

  const [statsByKey, setStatsByKey] = useState<Record<string, UserQuestionStats>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setStatsByKey(store.load(userId));
    setLoaded(true);
  }, [store, userId]);

  const clear = useCallback(() => {
    setStatsByKey({});
    store.clear(userId);
    attemptStore.clear(userId);
  }, [attemptStore, store, userId]);

  const getAttemptEvents = useCallback(() => {
    return attemptStore.load(userId);
  }, [attemptStore, userId]);

  const recordAnswer = useCallback(
    (
      question: Question,
      isCorrect: boolean,
      answeredAtMs: number = Date.now(),
      context: RecordAnswerContext = {}
    ) => {
      const canonicalKey = canonicalQuestionKey(question, {
        includeChoices: resolvedConfig.includeChoicesInCanonicalKey,
      });

      setStatsByKey((prev) => {
        const updated = updateUserQuestionStats({
          userId,
          canonicalKey,
          previous: prev[canonicalKey],
          isCorrect,
          responseTimeMs: context.responseTimeMs,
          config: resolvedConfig,
          answeredAtMs,
        });

        const next = { ...prev, [canonicalKey]: updated };
        store.save(userId, next);
        return next;
      });

      attemptStore.append(userId, {
        attemptId: generateAttemptId(),
        userId,
        questionKey: canonicalKey,
        questionId: question.id,
        timestamp: new Date(answeredAtMs).toISOString(),
        mode: context.mode ?? "practice",
        correct: isCorrect,
        responseTimeMs: context.responseTimeMs ?? null,
        selectedOptionId: context.selectedOptionId ?? null,
        quizId: context.quizId ?? null,
        topicTags: [question.category, question.subcategory, ...question.tags],
        difficulty: question.difficulty_level,
        confidence: context.confidence ?? null,
      });
    },
    [attemptStore, resolvedConfig, store, userId]
  );

  const recordExamReview = useCallback(
    (
      rows: ExamReviewInput[],
      answeredAtMs: number = Date.now(),
      context: Pick<RecordAnswerContext, "mode" | "quizId"> = {}
    ) => {
      if (rows.length === 0) return;

      setStatsByKey((prev) => {
        const next = { ...prev };

        for (const row of rows) {
          const canonicalKey = canonicalQuestionKey(row.question, {
            includeChoices: resolvedConfig.includeChoicesInCanonicalKey,
          });
          next[canonicalKey] = updateUserQuestionStats({
            userId,
            canonicalKey,
            previous: next[canonicalKey],
            isCorrect: row.isCorrect,
            responseTimeMs: null,
            config: resolvedConfig,
            answeredAtMs,
          });

          attemptStore.append(userId, {
            attemptId: generateAttemptId(),
            userId,
            questionKey: canonicalKey,
            questionId: row.question.id,
            timestamp: new Date(answeredAtMs).toISOString(),
            mode: context.mode ?? "mock",
            correct: row.isCorrect,
            responseTimeMs: null,
            selectedOptionId: row.userAnswer ?? null,
            quizId: context.quizId ?? null,
            topicTags: [row.question.category, row.question.subcategory, ...row.question.tags],
            difficulty: row.question.difficulty_level,
            confidence: null,
          });
        }

        store.save(userId, next);
        return next;
      });
    },
    [attemptStore, resolvedConfig, store, userId]
  );

  return {
    loaded,
    userId,
    config: resolvedConfig,
    statsByKey,
    recordAnswer,
    recordExamReview,
    getAttemptEvents,
    clear,
  };
}
