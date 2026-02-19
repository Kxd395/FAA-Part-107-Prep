import type { UserQuestionStats } from "@part107/core";
import type { AttemptEvent } from "./attemptEventStore";

export interface AdaptiveInsights {
  trackedQuestions: number;
  dueNowCount: number;
  dueWithin24hCount: number;
  atRiskCount: number;
  last10AttemptCount: number;
  last10CorrectCount: number;
  last10AccuracyPercent: number | null;
  previous10AccuracyPercent: number | null;
  momentumPercent: number | null;
  averageRollingLast10Percent: number | null;
  averageRollingMomentumPercent: number | null;
}

function roundPercent(value: number): number {
  return Math.round(value * 100);
}

export function computeAdaptiveInsights({
  statsByKey,
  attempts,
  nowMs = Date.now(),
}: {
  statsByKey: Record<string, UserQuestionStats>;
  attempts: AttemptEvent[];
  nowMs?: number;
}): AdaptiveInsights {
  const stats = Object.values(statsByKey);
  const dueNowCount = stats.filter((item) => {
    const dueMs = item.nextDueAt ? Date.parse(item.nextDueAt) : NaN;
    return Number.isFinite(dueMs) && dueMs <= nowMs;
  }).length;
  const dueWithin24hCount = stats.filter((item) => {
    const dueMs = item.nextDueAt ? Date.parse(item.nextDueAt) : NaN;
    return Number.isFinite(dueMs) && dueMs > nowMs && dueMs <= nowMs + 24 * 60 * 60 * 1000;
  }).length;
  const atRiskCount = stats.filter((item) => item.attempts >= 3 && item.masteryScore < 0.6).length;

  const sortedAttempts = [...attempts].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
  );
  const last10 = sortedAttempts.slice(0, 10);
  const previous10 = sortedAttempts.slice(10, 20);

  const last10CorrectCount = last10.filter((item) => item.correct).length;
  const last10AccuracyPercent =
    last10.length > 0 ? roundPercent(last10CorrectCount / last10.length) : null;

  const previous10CorrectCount = previous10.filter((item) => item.correct).length;
  const previous10AccuracyPercent =
    previous10.length > 0 ? roundPercent(previous10CorrectCount / previous10.length) : null;

  const momentumPercent =
    last10AccuracyPercent !== null && previous10AccuracyPercent !== null
      ? last10AccuracyPercent - previous10AccuracyPercent
      : null;

  const withRolling = stats.filter((item) => typeof item.last10Accuracy === "number");
  const averageRollingLast10Percent =
    withRolling.length > 0
      ? roundPercent(
          withRolling.reduce((sum, item) => sum + (item.last10Accuracy ?? 0), 0) / withRolling.length
        )
      : null;

  const withMomentum = stats.filter((item) => typeof item.momentum === "number");
  const averageRollingMomentumPercent =
    withMomentum.length > 0
      ? Math.round(
          withMomentum.reduce((sum, item) => sum + (item.momentum ?? 0), 0) / withMomentum.length / 0.01
        )
      : null;

  return {
    trackedQuestions: stats.length,
    dueNowCount,
    dueWithin24hCount,
    atRiskCount,
    last10AttemptCount: last10.length,
    last10CorrectCount,
    last10AccuracyPercent,
    previous10AccuracyPercent,
    momentumPercent,
    averageRollingLast10Percent,
    averageRollingMomentumPercent,
  };
}
