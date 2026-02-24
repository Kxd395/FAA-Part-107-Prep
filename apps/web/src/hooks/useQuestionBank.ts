"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type StudyCategory } from "@part107/core";
import {
  countQuestionsByCategory,
  fetchQuestions,
  type AppQuestion,
} from "../lib/questionBank";
import { type QuestionApiResponse } from "../lib/questionContracts";

const RETRY_DELAYS_MS = [250, 500] as const;
const QUESTION_SNAPSHOT_KEY = "part107_question_bank_snapshot_v1";
const SNAPSHOT_SOFT_TTL_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_HARD_TTL_MS = 14 * 24 * 60 * 60 * 1000;

interface QuestionBankSnapshot {
  version: 1;
  updatedAt: string;
  source: QuestionApiResponse["meta"]["source"];
  questions: AppQuestion[];
}

interface LoadedQuestionBankSnapshot extends QuestionBankSnapshot {
  ageMs: number;
}

export interface QuestionBankSnapshotInfo {
  updatedAt: string;
  ageMs: number;
}

interface UseQuestionBankResult {
  questions: AppQuestion[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  warning: string | null;
  snapshotInfo: QuestionBankSnapshotInfo | null;
  source: QuestionApiResponse["meta"]["source"] | null;
  counts: Record<StudyCategory, number>;
  reload: (options?: { preferLive?: boolean }) => Promise<void>;
  clearSnapshot: () => void;
}

function loadQuestionSnapshot(): LoadedQuestionBankSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(QUESTION_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuestionBankSnapshot;
    if (parsed?.version !== 1 || !Array.isArray(parsed.questions)) return null;
    if (typeof parsed.updatedAt !== "string") return null;
    if (parsed.source !== "local" && parsed.source !== "remote") return null;
    const updatedAtMs = Date.parse(parsed.updatedAt);
    if (!Number.isFinite(updatedAtMs)) return null;
    return {
      ...parsed,
      ageMs: Math.max(0, Date.now() - updatedAtMs),
    };
  } catch {
    return null;
  }
}

function saveQuestionSnapshot(snapshot: QuestionBankSnapshot): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUESTION_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

function clearQuestionSnapshot(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(QUESTION_SNAPSHOT_KEY);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      if (signal) {
        signal.removeEventListener("abort", abort);
      }
      resolve();
    }, ms);
    const abort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (!signal) return;
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function useQuestionBank(): UseQuestionBankResult {
  const [questions, setQuestions] = useState<AppQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [snapshotInfo, setSnapshotInfo] = useState<QuestionBankSnapshotInfo | null>(null);
  const [source, setSource] = useState<QuestionApiResponse["meta"]["source"] | null>(null);

  const load = useCallback(async (signal?: AbortSignal, options?: { preferLive?: boolean }) => {
    setLoading(true);
    setError(null);
    setWarning(null);
    setSnapshotInfo(null);

    let lastError: unknown = null;
    try {
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          const response = await fetchQuestions({ category: "All", signal });
          setQuestions(response.questions);
          setSource(response.meta.source);
          setLoaded(true);
          saveQuestionSnapshot({
            version: 1,
            updatedAt: new Date().toISOString(),
            source: response.meta.source,
            questions: response.questions,
          });
          return;
        } catch (err) {
          if (signal?.aborted) return;
          lastError = err;
          if (attempt < RETRY_DELAYS_MS.length) {
            await sleep(RETRY_DELAYS_MS[attempt], signal);
            continue;
          }
          throw err;
        }
      }
    } catch {
      if (signal?.aborted) return;
      const snapshot = loadQuestionSnapshot();
      if (
        !options?.preferLive &&
        snapshot &&
        snapshot.questions.length > 0 &&
        snapshot.ageMs <= SNAPSHOT_HARD_TTL_MS
      ) {
        setQuestions(snapshot.questions);
        setSource(snapshot.source);
        setLoaded(true);
        setSnapshotInfo({ updatedAt: snapshot.updatedAt, ageMs: snapshot.ageMs });
        const failedMessage =
          lastError instanceof Error ? lastError.message : "Failed to load live question source";
        const freshness =
          snapshot.ageMs > SNAPSHOT_SOFT_TTL_MS
            ? " Snapshot is stale."
            : "";
        setWarning(
          `Using cached question snapshot from ${new Date(snapshot.updatedAt).toLocaleString()}.${freshness} ${failedMessage}.`
        );
        return;
      }
      if (snapshot && snapshot.ageMs > SNAPSHOT_HARD_TTL_MS) {
        setWarning(
          `Cached question snapshot is older than ${Math.round(
            SNAPSHOT_HARD_TTL_MS / (24 * 60 * 60 * 1000)
          )} days and was ignored.`
        );
      }
      const message = lastError instanceof Error ? lastError.message : "Failed to load question bank";
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
    warning,
    snapshotInfo,
    source,
    counts,
    reload: async (options) => {
      await load(undefined, options);
    },
    clearSnapshot: () => {
      clearQuestionSnapshot();
      setSnapshotInfo(null);
    },
  };
}
