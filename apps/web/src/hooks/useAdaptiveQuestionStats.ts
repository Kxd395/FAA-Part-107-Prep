"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ADAPTIVE_QUIZ_CONFIG,
  canonicalQuestionKey,
  updateUserQuestionStats,
  type AdaptiveQuizConfig,
  type Question,
  type UserQuestionStats,
} from "@part107/core";
import { defaultAdaptiveStatsStore, type AdaptiveStatsStore } from "../lib/adaptiveStatsStore";

const DEFAULT_USER_ID = "local-user";

export interface ExamReviewInput {
  question: Question;
  isCorrect: boolean;
}

export function useAdaptiveQuestionStats(
  userId: string = DEFAULT_USER_ID,
  config: Partial<AdaptiveQuizConfig> = {},
  store: AdaptiveStatsStore = defaultAdaptiveStatsStore
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
  }, [store, userId]);

  const recordAnswer = useCallback(
    (question: Question, isCorrect: boolean, answeredAtMs: number = Date.now()) => {
      const canonicalKey = canonicalQuestionKey(question, {
        includeChoices: resolvedConfig.includeChoicesInCanonicalKey,
      });

      setStatsByKey((prev) => {
        const updated = updateUserQuestionStats({
          userId,
          canonicalKey,
          previous: prev[canonicalKey],
          isCorrect,
          config: resolvedConfig,
          answeredAtMs,
        });

        const next = { ...prev, [canonicalKey]: updated };
        store.save(userId, next);
        return next;
      });
    },
    [resolvedConfig, store, userId]
  );

  const recordExamReview = useCallback(
    (rows: ExamReviewInput[], answeredAtMs: number = Date.now()) => {
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
            config: resolvedConfig,
            answeredAtMs,
          });
        }

        store.save(userId, next);
        return next;
      });
    },
    [resolvedConfig, store, userId]
  );

  return {
    loaded,
    userId,
    config: resolvedConfig,
    statsByKey,
    recordAnswer,
    recordExamReview,
    clear,
  };
}
