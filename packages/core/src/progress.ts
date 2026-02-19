import type { OptionId, QuizMode } from "./types";

export interface ProgressQuestionResult {
  questionId: string;
  userAnswer: OptionId | null;
  correctAnswer: OptionId;
  isCorrect: boolean;
  category: string;
}

export interface ProgressSessionRecord {
  id: string;
  mode: QuizMode;
  timestamp: string;
  category: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  timeSpentMs: number;
  questions: ProgressQuestionResult[];
}

export interface ProgressCategoryStat {
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
  categoryBreakdown: ProgressCategoryStat[];
  weakSpots: ProgressCategoryStat[];
  recentTrend: { date: string; percentage: number; mode: QuizMode }[];
}

export function computeProgressStats(
  sessions: readonly ProgressSessionRecord[],
  passPercent: number = 70
): ProgressStats {
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
      ? Math.round((examSessions.filter((s) => s.passed).length / examSessions.length) * 100)
      : 0;
  const bestExamScore =
    examSessions.length > 0 ? Math.max(...examSessions.map((s) => s.percentage)) : 0;

  let currentStreak = 0;
  for (const session of sessions) {
    if (session.passed) currentStreak++;
    else break;
  }

  let longestStreak = 0;
  let running = 0;
  for (const session of sessions) {
    if (session.passed) {
      running++;
      longestStreak = Math.max(longestStreak, running);
    } else {
      running = 0;
    }
  }

  const categoryMap = new Map<string, { correct: number; total: number }>();
  for (const question of allQuestions) {
    const entry = categoryMap.get(question.category) ?? { correct: 0, total: 0 };
    entry.total++;
    if (question.isCorrect) entry.correct++;
    categoryMap.set(question.category, entry);
  }

  const categoryBreakdown: ProgressCategoryStat[] = Array.from(categoryMap.entries())
    .map(([category, { correct, total }]) => ({
      category,
      correct,
      total,
      percentage: Math.round((correct / total) * 100),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));

  const weakSpots = categoryBreakdown
    .filter((c) => c.percentage < passPercent)
    .sort((a, b) => a.percentage - b.percentage);

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
}
