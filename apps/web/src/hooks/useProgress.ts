"use client";

import { useState, useEffect, useCallback } from "react";
import {
  computeProgressStats,
  type ProgressCategoryStat,
  type ProgressQuestionResult,
  type ProgressSessionRecord,
  type ProgressStats,
} from "@part107/core";
import { LOCAL_USER_ID } from "../lib/analyticsTaxonomy";
import { PROGRESS_STORAGE_KEY, progressStorageKey } from "../lib/progressStorage";
import {
  PORTABLE_STATE_CHANGED_EVENT,
  type PortableStateChangedDetail,
} from "../lib/portableStateStorage";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type QuestionResult = ProgressQuestionResult;
export type SessionRecord = ProgressSessionRecord;
export type CategoryStat = ProgressCategoryStat;
export type { ProgressStats };

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const PASSING_PERCENT = 70;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadSessions(userId: string): SessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(progressStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSessions(userId: string, sessions: SessionRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(progressStorageKey(userId), JSON.stringify(sessions));
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useProgress(userId: string = LOCAL_USER_ID) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reloadSessions = useCallback(() => {
    setSessions(loadSessions(userId));
    setLoaded(true);
  }, [userId]);

  // Load from localStorage on mount
  useEffect(() => {
    reloadSessions();
  }, [reloadSessions]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePortableStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<PortableStateChangedDetail>).detail;
      if (!detail || detail.userId !== userId) return;
      if (!detail.keys.includes(PROGRESS_STORAGE_KEY)) return;
      reloadSessions();
    };

    window.addEventListener(PORTABLE_STATE_CHANGED_EVENT, handlePortableStateChanged as EventListener);
    return () => {
      window.removeEventListener(
        PORTABLE_STATE_CHANGED_EVENT,
        handlePortableStateChanged as EventListener
      );
    };
  }, [reloadSessions, userId]);

  // ------ Save a new session ------
  const saveSession = useCallback(
    (record: Omit<SessionRecord, "id" | "timestamp" | "percentage" | "passed">) => {
      const pct = record.total > 0 ? Math.round((record.score / record.total) * 100) : 0;
      const newRecord: SessionRecord = {
        ...record,
        id: generateId(),
        timestamp: new Date().toISOString(),
        percentage: pct,
        passed: pct >= PASSING_PERCENT,
      };
      setSessions((prev) => {
        const updated = [newRecord, ...prev];
        persistSessions(userId, updated);
        return updated;
      });
      return newRecord;
    },
    [userId]
  );

  // ------ Delete a session ------
  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      persistSessions(userId, updated);
      return updated;
    });
  }, [userId]);

  // ------ Clear all data ------
  const clearAll = useCallback(() => {
    setSessions([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(progressStorageKey(userId));
    }
  }, [userId]);

  // ------ Compute stats ------
  const getStats = useCallback(
    (): ProgressStats => computeProgressStats(sessions, PASSING_PERCENT),
    [sessions]
  );

  return {
    sessions,
    loaded,
    saveSession,
    deleteSession,
    clearAll,
    getStats,
  };
}
