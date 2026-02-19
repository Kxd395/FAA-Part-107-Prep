"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type StudyCategory } from "@part107/core";
import {
  countQuestionsByCategory,
  fetchQuestions,
  type AppQuestion,
  type QuestionApiResponse,
} from "../lib/questionBank";

interface UseQuestionBankResult {
  questions: AppQuestion[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  source: QuestionApiResponse["meta"]["source"] | null;
  counts: Record<StudyCategory, number>;
  reload: () => Promise<void>;
}

export function useQuestionBank(): UseQuestionBankResult {
  const [questions, setQuestions] = useState<AppQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<QuestionApiResponse["meta"]["source"] | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchQuestions({ category: "All", signal });
      setQuestions(response.questions);
      setSource(response.meta.source);
      setLoaded(true);
    } catch (err) {
      if (signal?.aborted) return;
      const message = err instanceof Error ? err.message : "Failed to load question bank";
      setError(message);
      setLoaded(false);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const counts = useMemo(() => countQuestionsByCategory(questions), [questions]);

  return {
    questions,
    loaded,
    loading,
    error,
    source,
    counts,
    reload: async () => {
      await load();
    },
  };
}
