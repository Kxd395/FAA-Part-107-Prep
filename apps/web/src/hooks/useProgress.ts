"use client";

import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface QuestionResult {
  questionId: string;
  userAnswer: "A" | "B" | "C" | "D" | null;
  correctAnswer: "A" | "B" | "C" | "D";
  isCorrect: boolean;
  category: string;
}

export interface SessionRecord {
  id: string;
  mode: "study" | "exam";
  /** ISO timestamp */
  timestamp: string;
  /** Category filter (study mode) or "All" */
  category: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  timeSpentMs: number;
  questions: QuestionResult[];
}

export interface CategoryStat {
  category: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface ProgressStats {
  totalSessions: number;
  totalQuestions: number;
  totalCorrect: number;
  overallAccuracy: number;
  studySessions: number;
  examSessions: number;
  examPassRate: number;
  bestExamScore: number;
  currentStreak: number;
  longestStreak: number;
  categoryBreakdown: CategoryStat[];
  weakSpots: CategoryStat[];
  recentTrend: { date: string; percentage: number; mode: string }[];
}

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
  const getStats = useCallback((): ProgressStats => {
    const totalSessions = sessions.length;
    const allQuestions = sessions.flatMap((s) => s.questions);
    const totalQuestions = allQuestions.length;
    const totalCorrect = allQuestions.filter((q) => q.isCorrect).length;
    const overallAccuracy =
      totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const studySessions = sessions.filter((s) => s.mode === "study").length;
    const examSessions = sessions.filter((s) => s.mode === "exam");
    const examPassRate =
      examSessions.length > 0
        ? Math.round(
            (examSessions.filter((e) => e.passed).length / examSessions.length) * 100
          )
        : 0;
    const bestExamScore =
      examSessions.length > 0
        ? Math.max(...examSessions.map((e) => e.percentage))
        : 0;

    // Streak: consecutive sessions with ≥70% (newest first)
    let currentStreak = 0;
    for (const s of sessions) {
      if (s.passed) currentStreak++;
      else break;
    }
    let longestStreak = 0;
    let streak = 0;
    for (const s of sessions) {
      if (s.passed) {
        streak++;
        longestStreak = Math.max(longestStreak, streak);
      } else {
        streak = 0;
      }
    }

    // Category breakdown
    const catMap = new Map<string, { correct: number; total: number }>();
    for (const q of allQuestions) {
      const cat = q.category;
      const entry = catMap.get(cat) ?? { correct: 0, total: 0 };
      entry.total++;
      if (q.isCorrect) entry.correct++;
      catMap.set(cat, entry);
    }
    const categoryBreakdown: CategoryStat[] = Array.from(catMap.entries())
      .map(([category, { correct, total }]) => ({
        category,
        correct,
        total,
        percentage: Math.round((correct / total) * 100),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));

    // Weak spots: categories below passing
    const weakSpots = categoryBreakdown
      .filter((c) => c.percentage < PASSING_PERCENT)
      .sort((a, b) => a.percentage - b.percentage);

    // Recent trend (last 20 sessions, oldest → newest for chart)
    const recentTrend = sessions
      .slice(0, 20)
      .reverse()
      .map((s) => ({
        date: new Date(s.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        percentage: s.percentage,
        mode: s.mode,
      }));

    return {
      totalSessions,
      totalQuestions,
      totalCorrect,
      overallAccuracy,
      studySessions,
      examSessions: examSessions.length,
      examPassRate,
      bestExamScore,
      currentStreak,
      longestStreak,
      categoryBreakdown,
      weakSpots,
      recentTrend,
    };
  }, [sessions]);

  return {
    sessions,
    loaded,
    saveSession,
    deleteSession,
    clearAll,
    getStats,
  };
}
