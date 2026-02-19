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

const STORAGE_KEY = "part107_adaptive_stats_v1";
const DEFAULT_USER_ID = "local-user";

interface StoredAdaptiveStats {
  version: 1;
  userId: string;
  statsByKey: Record<string, UserQuestionStats>;
}

function loadStoredStats(userId: string): Record<string, UserQuestionStats> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as StoredAdaptiveStats;
    if (!parsed || parsed.version !== 1 || parsed.userId !== userId || !parsed.statsByKey) {
      return {};
    }

    return parsed.statsByKey;
  } catch {
    return {};
  }
}

function persistStoredStats(userId: string, statsByKey: Record<string, UserQuestionStats>): void {
  if (typeof window === "undefined") return;
  const payload: StoredAdaptiveStats = {
    version: 1,
    userId,
    statsByKey,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export interface ExamReviewInput {
  question: Question;
  isCorrect: boolean;
}

export function useAdaptiveQuestionStats(
  userId: string = DEFAULT_USER_ID,
  config: Partial<AdaptiveQuizConfig> = {}
) {
  const resolvedConfig = useMemo(
    () => ({ ...DEFAULT_ADAPTIVE_QUIZ_CONFIG, ...config }),
    [config]
  );

  const [statsByKey, setStatsByKey] = useState<Record<string, UserQuestionStats>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setStatsByKey(loadStoredStats(userId));
    setLoaded(true);
  }, [userId]);

  const clear = useCallback(() => {
    setStatsByKey({});
    persistStoredStats(userId, {});
  }, [userId]);

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
        persistStoredStats(userId, next);
        return next;
      });
    },
    [resolvedConfig, userId]
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

        persistStoredStats(userId, next);
        return next;
      });
    },
    [resolvedConfig, userId]
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
