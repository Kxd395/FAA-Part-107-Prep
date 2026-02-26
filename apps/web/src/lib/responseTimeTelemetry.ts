import type { AttemptEvent, AttemptMode } from "./attemptEventStore";

export interface ResponseTimeModeSummary {
  mode: AttemptMode;
  attempts: number;
  sampled: number;
  nullCount: number;
  zeroCount: number;
  nullRatePercent: number;
  zeroRatePercent: number;
  p50Ms: number | null;
  p95Ms: number | null;
}

export interface ResponseTimeTelemetrySummary {
  attempts: number;
  sampled: number;
  nullCount: number;
  zeroCount: number;
  nullRatePercent: number;
  zeroRatePercent: number;
  p50Ms: number | null;
  p95Ms: number | null;
  hasNullAnomaly: boolean;
  hasZeroAnomaly: boolean;
  modes: ResponseTimeModeSummary[];
}

const NULL_ANOMALY_THRESHOLD_PERCENT = 15;
const ZERO_ANOMALY_THRESHOLD_PERCENT = 10;
const MIN_ATTEMPTS_FOR_ANOMALY = 20;

function roundPercent(value: number): number {
  return Math.round(value * 100);
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return Math.round(sorted[index]);
}

function summarizeMode(mode: AttemptMode, attempts: AttemptEvent[]): ResponseTimeModeSummary {
  const responseTimes = attempts
    .map((attempt) => attempt.responseTimeMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const sampled = responseTimes.length;
  const nullCount = attempts.length - sampled;
  const zeroCount = responseTimes.filter((value) => value <= 0).length;
  const nullRatePercent = attempts.length > 0 ? roundPercent(nullCount / attempts.length) : 0;
  const zeroRatePercent = sampled > 0 ? roundPercent(zeroCount / sampled) : 0;
  return {
    mode,
    attempts: attempts.length,
    sampled,
    nullCount,
    zeroCount,
    nullRatePercent,
    zeroRatePercent,
    p50Ms: percentile(responseTimes, 0.5),
    p95Ms: percentile(responseTimes, 0.95),
  };
}

export function computeResponseTimeTelemetry(
  attempts: AttemptEvent[]
): ResponseTimeTelemetrySummary {
  const byMode = new Map<AttemptMode, AttemptEvent[]>();
  for (const attempt of attempts) {
    if (!byMode.has(attempt.mode)) {
      byMode.set(attempt.mode, []);
    }
    byMode.get(attempt.mode)!.push(attempt);
  }

  const modeSummaries = Array.from(byMode.entries())
    .map(([mode, rows]) => summarizeMode(mode, rows))
    .sort((a, b) => b.attempts - a.attempts);
  const responseTimes = attempts
    .map((attempt) => attempt.responseTimeMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const sampled = responseTimes.length;
  const nullCount = attempts.length - sampled;
  const zeroCount = responseTimes.filter((value) => value <= 0).length;
  const nullRatePercent = attempts.length > 0 ? roundPercent(nullCount / attempts.length) : 0;
  const zeroRatePercent = sampled > 0 ? roundPercent(zeroCount / sampled) : 0;

  return {
    attempts: attempts.length,
    sampled,
    nullCount,
    zeroCount,
    nullRatePercent,
    zeroRatePercent,
    p50Ms: percentile(responseTimes, 0.5),
    p95Ms: percentile(responseTimes, 0.95),
    hasNullAnomaly:
      attempts.length >= MIN_ATTEMPTS_FOR_ANOMALY &&
      nullRatePercent >= NULL_ANOMALY_THRESHOLD_PERCENT,
    hasZeroAnomaly:
      sampled >= MIN_ATTEMPTS_FOR_ANOMALY &&
      zeroRatePercent >= ZERO_ANOMALY_THRESHOLD_PERCENT,
    modes: modeSummaries,
  };
}
