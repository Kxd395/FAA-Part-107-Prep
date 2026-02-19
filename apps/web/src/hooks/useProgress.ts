"use client";

import { useState, useEffect, useCallback } from "react";
import {
  computeProgressStats,
  type ProgressCategoryStat,
  type ProgressQuestionResult,
  type ProgressSessionRecord,
  type ProgressStats,
} from "@part107/core";

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
const STORAGE_KEY = "part107_progress";
const PASSING_PERCENT = 70;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadSessions(): SessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSessions(sessions: SessionRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useProgress() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setSessions(loadSessions());
    setLoaded(true);
  }, []);

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
        persistSessions(updated);
        return updated;
      });
      return newRecord;
    },
    []
  );

  // ------ Delete a session ------
  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      persistSessions(updated);
      return updated;
    });
  }, []);

  // ------ Clear all data ------
  const clearAll = useCallback(() => {
    setSessions([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

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
