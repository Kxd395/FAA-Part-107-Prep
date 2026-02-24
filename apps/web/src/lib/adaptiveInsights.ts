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
  confidenceAttemptCount: number;
  averageConfidencePercent: number | null;
  calibrationScorePercent: number | null;
  overconfidenceRatePercent: number | null;
}

function roundPercent(value: number): number {
  return Math.round(value * 100);
}

function confidenceToProbability(confidence: 1 | 2 | 3 | 4 | 5): number {
  if (confidence === 1) return 0.2;
  if (confidence === 2) return 0.4;
  if (confidence === 3) return 0.6;
  if (confidence === 4) return 0.8;
  return 0.95;
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

  const confidenceAttempts = sortedAttempts.filter(
    (attempt) => attempt.mode !== "flashcard" && attempt.confidence !== null
  );
  const confidenceAttemptCount = confidenceAttempts.length;
  const averageConfidencePercent =
    confidenceAttemptCount > 0
      ? roundPercent(
          confidenceAttempts.reduce((sum, attempt) => sum + (attempt.confidence ?? 0), 0) /
            (confidenceAttemptCount * 5)
        )
      : null;

  const calibrationScorePercent =
    confidenceAttemptCount > 0
      ? (() => {
          const brier =
            confidenceAttempts.reduce((sum, attempt) => {
              const probability = confidenceToProbability(attempt.confidence as 1 | 2 | 3 | 4 | 5);
              const outcome = attempt.correct ? 1 : 0;
              return sum + (probability - outcome) ** 2;
            }, 0) / confidenceAttemptCount;
          return roundPercent(Math.max(0, 1 - brier));
        })()
      : null;

  const confidentIncorrectCount = confidenceAttempts.filter(
    (attempt) => !attempt.correct && (attempt.confidence ?? 0) >= 4
  ).length;
  const totalIncorrectWithConfidence = confidenceAttempts.filter((attempt) => !attempt.correct).length;
  const overconfidenceRatePercent =
    totalIncorrectWithConfidence > 0
      ? roundPercent(confidentIncorrectCount / totalIncorrectWithConfidence)
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
    confidenceAttemptCount,
    averageConfidencePercent,
    calibrationScorePercent,
    overconfidenceRatePercent,
  };
}
