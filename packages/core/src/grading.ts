export type AttemptOutcome = "correct" | "incorrect";
export type AttemptConfidence = 1 | 2 | 3 | 4 | 5;
export type QualityScore = 0 | 1 | 2 | 3 | 4 | 5;

export interface SessionQueueDecision {
  removeFromQueue: boolean;
  gapMin: number | null;
  gapMax: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeConfidence(
  confidence: number | null | undefined,
  fallback: AttemptConfidence = 3
): AttemptConfidence {
  if (!Number.isFinite(confidence ?? NaN)) return fallback;
  return clamp(Math.round(confidence as number), 1, 5) as AttemptConfidence;
}

export function qualityFromOutcomeConfidence(
  outcome: AttemptOutcome,
  confidence: number | null | undefined
): QualityScore {
  const normalizedConfidence = normalizeConfidence(
    confidence,
    outcome === "correct" ? 3 : 3
  );

  if (outcome === "correct") {
    if (normalizedConfidence >= 5) return 5;
    if (normalizedConfidence >= 3) return 4;
    return 3;
  }

  if (normalizedConfidence <= 2) return 2;
  if (normalizedConfidence === 3) return 1;
  return 0;
}

export function sessionQueueDecisionFromQuality(quality: QualityScore): SessionQueueDecision {
  if (quality >= 4) {
    return {
      removeFromQueue: true,
      gapMin: null,
      gapMax: null,
    };
  }

  if (quality === 3) {
    return {
      removeFromQueue: false,
      gapMin: 5,
      gapMax: 8,
    };
  }

  if (quality === 2) {
    return {
      removeFromQueue: false,
      gapMin: 2,
      gapMax: 4,
    };
  }

  return {
    removeFromQueue: false,
    gapMin: 1,
    gapMax: 2,
  };
}

export function nextIntervalDaysFromQuality(
  previousIntervalDays: number | null | undefined,
  quality: QualityScore,
  minIntervalDays: number,
  maxIntervalDays: number
): number {
  const minInterval = Math.max(1, Math.floor(minIntervalDays));
  const maxInterval = Math.max(minInterval, Math.floor(maxIntervalDays));
  const previous = clamp(
    Math.round(previousIntervalDays ?? minInterval),
    minInterval,
    maxInterval
  );

  let next: number;
  if (quality <= 2) {
    next = minInterval;
  } else if (quality === 3) {
    next = Math.max(2, Math.round(previous * 1.3));
  } else if (quality === 4) {
    next = Math.max(3, Math.round(previous * 2.0));
  } else {
    next = Math.max(4, Math.round(previous * 2.5));
  }

  return clamp(next, minInterval, maxInterval);
}
