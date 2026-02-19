import type { Question } from "./types";

export interface CanonicalKeyOptions {
  includeChoices?: boolean;
}

export interface UserQuestionStats {
  userId: string;
  canonicalKey: string;
  attempts: number;
  correct: number;
  incorrect: number;
  correctStreak: number;
  wrongStreak?: number;
  lastAttemptAt: string;
  lastCorrectAt?: string | null;
  lastResultWasCorrect: boolean | null;
  masteryScore: number;
  last10Bits?: number;
  last10Count?: number;
  last10Accuracy?: number;
  last20Bits?: number;
  last20Count?: number;
  last20Accuracy?: number;
  momentum?: number;
  volatility?: number;
  emaAccuracy?: number;
  emaResponseTimeMs?: number | null;
  averageResponseTimeMs?: number | null;
  totalResponseTimeMs?: number;
  intervalDays?: number;
  nextDueAt?: string | null;
}

export interface AdaptiveQuizConfig {
  minAttempts: number;
  minAccuracy: number;
  minStreak: number;
  excludeMastered: boolean;
  includeMasteredOnShortfall: boolean;
  reviewRate: number;
  includeChoicesInCanonicalKey: boolean;
  recentMissWindowMs: number;
  recentMissBoost: number;
  emaAlpha: number;
  posteriorPriorCorrect: number;
  posteriorPriorIncorrect: number;
  recencyPenaltyDays: number;
  recencyPenaltyMax: number;
  volatilityPenaltyMax: number;
  fastResponseTimeMs: number;
  slowResponseTimeMs: number;
  minIntervalDays: number;
  maxIntervalDays: number;
  weakWeightBoost: number;
  dueWeightBoost: number;
  noveltyWeightBoost: number;
}

export const DEFAULT_ADAPTIVE_QUIZ_CONFIG: AdaptiveQuizConfig = {
  minAttempts: 3,
  minAccuracy: 0.85,
  minStreak: 3,
  excludeMastered: true,
  includeMasteredOnShortfall: true,
  reviewRate: 0.05,
  includeChoicesInCanonicalKey: true,
  recentMissWindowMs: 48 * 60 * 60 * 1000,
  recentMissBoost: 1.35,
  emaAlpha: 0.2,
  posteriorPriorCorrect: 1,
  posteriorPriorIncorrect: 1,
  recencyPenaltyDays: 30,
  recencyPenaltyMax: 0.15,
  volatilityPenaltyMax: 0.1,
  fastResponseTimeMs: 30_000,
  slowResponseTimeMs: 90_000,
  minIntervalDays: 1,
  maxIntervalDays: 30,
  weakWeightBoost: 2,
  dueWeightBoost: 1.5,
  noveltyWeightBoost: 0.5,
};

export interface DedupeQuestionsResult<Q extends Question = Question> {
  questions: Q[];
  keyByQuestionId: Record<string, string>;
  duplicatesRemoved: number;
}

export interface AdaptiveSelectionInput<Q extends Question = Question> {
  userId: string;
  desiredQuizSize: number;
  fullQuestionBank: readonly Q[];
  userStatsByKey?: Record<string, UserQuestionStats>;
  config?: Partial<AdaptiveQuizConfig>;
  rng?: () => number;
}

export interface AdaptiveSelectionResult<Q extends Question = Question> {
  questions: Q[];
  keyByQuestionId: Record<string, string>;
  meta: {
    dedupedCount: number;
    duplicatesRemoved: number;
    masteredExcluded: number;
    backfilledFromMastered: number;
  };
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeChoices(question: Question): string {
  return [...question.options]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((choice) => `${choice.id}:${normalizeText(choice.text)}`)
    .join("|");
}

function hashFnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `q_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

const LAST10_WINDOW = 10;
const LAST20_WINDOW = 20;
const LAST10_MASK = (1 << LAST10_WINDOW) - 1;
const LAST20_MASK = (1 << LAST20_WINDOW) - 1;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function popcount32(value: number): number {
  let v = value >>> 0;
  let count = 0;
  while (v !== 0) {
    v &= v - 1;
    count++;
  }
  return count;
}

function updateRollingBits(previousBits: number, isCorrect: boolean, mask: number): number {
  return ((previousBits << 1) | (isCorrect ? 1 : 0)) & mask;
}

function computeRollingAccuracy(bits: number, attempts: number, window: number): number {
  const sampleSize = Math.min(Math.max(0, attempts), window);
  if (sampleSize <= 0) return 0;
  const sampleMask = sampleSize >= 31 ? 0x7fffffff : (1 << sampleSize) - 1;
  const sampleBits = bits & sampleMask;
  return popcount32(sampleBits) / sampleSize;
}

function computeVolatility(bits: number, sampleSize: number): number {
  if (sampleSize <= 1) return 0;
  let flips = 0;
  for (let i = 0; i < sampleSize - 1; i++) {
    const current = (bits >> i) & 1;
    const next = (bits >> (i + 1)) & 1;
    if (current !== next) flips++;
  }
  return flips / (sampleSize - 1);
}

function computePosteriorMean(
  stats: Pick<UserQuestionStats, "attempts" | "correct">,
  config: AdaptiveQuizConfig
): number {
  const a = Math.max(0, config.posteriorPriorCorrect);
  const b = Math.max(0, config.posteriorPriorIncorrect);
  return (stats.correct + a) / (stats.attempts + a + b);
}

export function canonicalQuestionKey(
  question: Question,
  options: CanonicalKeyOptions = {}
): string {
  const includeChoices = options.includeChoices ?? true;
  const parts = [normalizeText(question.question_text)];
  if (includeChoices) {
    parts.push(normalizeChoices(question));
  }
  return hashFnv1a(parts.join("||"));
}

export function dedupeQuestions<Q extends Question = Question>(
  questions: readonly Q[],
  options: CanonicalKeyOptions = {}
): DedupeQuestionsResult<Q> {
  const seen = new Set<string>();
  const keyByQuestionId: Record<string, string> = {};
  const deduped: Q[] = [];
  let duplicatesRemoved = 0;

  for (const question of questions) {
    const key = canonicalQuestionKey(question, options);
    keyByQuestionId[question.id] = key;

    if (seen.has(key)) {
      duplicatesRemoved++;
      continue;
    }

    seen.add(key);
    deduped.push(question);
  }

  return {
    questions: deduped,
    keyByQuestionId,
    duplicatesRemoved,
  };
}

export function computeAccuracy(stats: Pick<UserQuestionStats, "attempts" | "correct">): number {
  if (stats.attempts <= 0) return 0;
  return stats.correct / stats.attempts;
}

export function computeMasteryScore(
  stats: Pick<UserQuestionStats, "attempts" | "correct" | "lastAttemptAt"> &
    Partial<Pick<UserQuestionStats, "last10Bits" | "last10Accuracy" | "volatility">>,
  config: Partial<AdaptiveQuizConfig> = {},
  nowMs: number = Date.now()
): number {
  const resolved = { ...DEFAULT_ADAPTIVE_QUIZ_CONFIG, ...config };
  const base = computePosteriorMean(stats, resolved);
  const last10Bits = stats.last10Bits ?? 0;
  const last10Accuracy =
    typeof stats.last10Accuracy === "number"
      ? clamp(stats.last10Accuracy, 0, 1)
      : computeRollingAccuracy(last10Bits, stats.attempts, LAST10_WINDOW);
  const recent = stats.attempts >= LAST10_WINDOW ? last10Accuracy : base;
  const volatility =
    typeof stats.volatility === "number"
      ? clamp(stats.volatility, 0, 1)
      : computeVolatility(last10Bits, Math.min(stats.attempts, LAST10_WINDOW));

  let recencyScore = 0;
  const parsed = Date.parse(stats.lastAttemptAt);
  if (Number.isFinite(parsed)) {
    const ageDays = Math.max(0, (nowMs - parsed) / (24 * 60 * 60 * 1000));
    const penaltyRatio = clamp(ageDays / Math.max(1, resolved.recencyPenaltyDays), 0, 1);
    recencyScore = penaltyRatio * resolved.recencyPenaltyMax;
  }

  const volatilityPenalty = volatility * resolved.volatilityPenaltyMax;
  const score = 0.6 * base + 0.4 * recent - recencyScore - volatilityPenalty;
  return clamp(score, 0, 1);
}

export function isMastered(
  stats: Pick<UserQuestionStats, "attempts" | "correct" | "correctStreak"> &
    Partial<Pick<UserQuestionStats, "masteryScore" | "lastAttemptAt" | "last10Bits" | "last10Accuracy" | "volatility">>,
  config: Partial<AdaptiveQuizConfig> = {}
): boolean {
  const resolved = { ...DEFAULT_ADAPTIVE_QUIZ_CONFIG, ...config };
  const masteryScore =
    typeof stats.masteryScore === "number"
      ? stats.masteryScore
      : computeMasteryScore(
          {
            attempts: stats.attempts,
            correct: stats.correct,
            lastAttemptAt: stats.lastAttemptAt ?? new Date(0).toISOString(),
            last10Bits: stats.last10Bits,
            last10Accuracy: stats.last10Accuracy,
            volatility: stats.volatility,
          },
          resolved
        );
  return (
    stats.attempts >= resolved.minAttempts &&
    masteryScore >= resolved.minAccuracy &&
    stats.correctStreak >= resolved.minStreak
  );
}

export interface UpdateUserQuestionStatsInput {
  userId: string;
  canonicalKey: string;
  previous?: UserQuestionStats;
  isCorrect: boolean;
  responseTimeMs?: number | null;
  config?: Partial<AdaptiveQuizConfig>;
  answeredAtMs?: number;
}

export function updateUserQuestionStats({
  userId,
  canonicalKey,
  previous,
  isCorrect,
  responseTimeMs,
  config = {},
  answeredAtMs = Date.now(),
}: UpdateUserQuestionStatsInput): UserQuestionStats {
  const resolved = { ...DEFAULT_ADAPTIVE_QUIZ_CONFIG, ...config };
  const alpha = clamp(resolved.emaAlpha, 0.01, 1);
  const attempts = (previous?.attempts ?? 0) + 1;
  const correct = (previous?.correct ?? 0) + (isCorrect ? 1 : 0);
  const incorrect = (previous?.incorrect ?? 0) + (isCorrect ? 0 : 1);
  const correctStreak = isCorrect ? (previous?.correctStreak ?? 0) + 1 : 0;
  const wrongStreak = isCorrect ? 0 : (previous?.wrongStreak ?? 0) + 1;
  const lastAttemptAt = new Date(answeredAtMs).toISOString();
  const lastCorrectAt = isCorrect ? lastAttemptAt : (previous?.lastCorrectAt ?? null);

  const last10Bits = updateRollingBits(previous?.last10Bits ?? 0, isCorrect, LAST10_MASK);
  const last20Bits = updateRollingBits(previous?.last20Bits ?? 0, isCorrect, LAST20_MASK);
  const last10Count = popcount32(last10Bits);
  const last20Count = popcount32(last20Bits);
  const last10Accuracy = computeRollingAccuracy(last10Bits, attempts, LAST10_WINDOW);
  const last20Accuracy = computeRollingAccuracy(last20Bits, attempts, LAST20_WINDOW);
  const momentum = last10Accuracy - last20Accuracy;
  const volatility = computeVolatility(last10Bits, Math.min(attempts, LAST10_WINDOW));

  const instantAccuracy = isCorrect ? 1 : 0;
  const emaAccuracy =
    previous?.emaAccuracy === undefined
      ? instantAccuracy
      : alpha * instantAccuracy + (1 - alpha) * previous.emaAccuracy;

  const hasResponseTime = Number.isFinite(responseTimeMs ?? NaN) && (responseTimeMs ?? 0) >= 0;
  const responseTimeValue = hasResponseTime ? (responseTimeMs as number) : 0;
  const safeResponseTimeMs = hasResponseTime ? responseTimeValue : null;
  const totalResponseTimeMs =
    (previous?.totalResponseTimeMs ?? 0) + responseTimeValue;
  const averageResponseTimeMs = hasResponseTime
    ? totalResponseTimeMs / attempts
    : (previous?.averageResponseTimeMs ?? null);
  const emaResponseTimeMs = hasResponseTime
    ? previous?.emaResponseTimeMs === null || previous?.emaResponseTimeMs === undefined
      ? responseTimeValue
      : alpha * responseTimeValue + (1 - alpha) * previous.emaResponseTimeMs
    : (previous?.emaResponseTimeMs ?? null);

  const previousInterval = clamp(
    previous?.intervalDays ?? resolved.minIntervalDays,
    resolved.minIntervalDays,
    resolved.maxIntervalDays
  );
  let intervalDays = resolved.minIntervalDays;
  if (isCorrect) {
    const effectiveTime = safeResponseTimeMs ?? resolved.slowResponseTimeMs + 1;
    const multiplier = effectiveTime <= resolved.fastResponseTimeMs ? 2 : 1.5;
    intervalDays = clamp(previousInterval * multiplier, resolved.minIntervalDays, resolved.maxIntervalDays);
  }
  const nextDueAt = new Date(answeredAtMs + intervalDays * 24 * 60 * 60 * 1000).toISOString();

  const nextBase: UserQuestionStats = {
    userId,
    canonicalKey,
    attempts,
    correct,
    incorrect,
    correctStreak,
    wrongStreak,
    lastAttemptAt,
    lastCorrectAt,
    lastResultWasCorrect: isCorrect,
    masteryScore: previous?.masteryScore ?? 0,
    last10Bits,
    last10Count,
    last10Accuracy,
    last20Bits,
    last20Count,
    last20Accuracy,
    momentum,
    volatility,
    emaAccuracy,
    emaResponseTimeMs,
    averageResponseTimeMs,
    totalResponseTimeMs,
    intervalDays,
    nextDueAt,
  };

  nextBase.masteryScore = computeMasteryScore(nextBase, resolved, answeredAtMs);
  return nextBase;
}

function weightedSampleWithoutReplacement<T>(
  items: readonly T[],
  count: number,
  getWeight: (item: T) => number,
  rng: () => number
): T[] {
  const pool = [...items];
  const selected: T[] = [];

  while (selected.length < count && pool.length > 0) {
    const weights = pool.map((item) => Math.max(0.0001, getWeight(item)));
    const total = weights.reduce((sum, value) => sum + value, 0);

    let index = 0;
    if (total <= 0) {
      index = Math.floor(rng() * pool.length);
    } else {
      let threshold = rng() * total;
      for (let i = 0; i < pool.length; i++) {
        threshold -= weights[i];
        if (threshold <= 0) {
          index = i;
          break;
        }
      }
    }

    selected.push(pool[index]);
    pool.splice(index, 1);
  }

  return selected;
}

function buildQuestionWeight(
  stats: UserQuestionStats | undefined,
  config: AdaptiveQuizConfig,
  nowMs: number
): number {
  if (!stats) {
    return Math.max(0.01, config.weakWeightBoost + config.noveltyWeightBoost);
  }
  const mastery = clamp(
    stats.masteryScore ??
      computeMasteryScore(
        {
          attempts: stats.attempts,
          correct: stats.correct,
          lastAttemptAt: stats.lastAttemptAt,
          last10Bits: stats.last10Bits,
          last10Accuracy: stats.last10Accuracy,
          volatility: stats.volatility,
        },
        config,
        nowMs
      ),
    0,
    1
  );
  const weaknessWeight = Math.max(0.01, 1 - mastery);
  let weight = weaknessWeight * config.weakWeightBoost;

  if (stats.attempts <= 0) {
    weight += config.noveltyWeightBoost;
  }

  const nextDueMs = stats.nextDueAt ? Date.parse(stats.nextDueAt) : NaN;
  if (Number.isFinite(nextDueMs) && nextDueMs <= nowMs) {
    weight += config.dueWeightBoost;
  }

  if (stats?.lastResultWasCorrect === false) {
    const lastAttemptMs = Date.parse(stats.lastAttemptAt);
    if (Number.isFinite(lastAttemptMs)) {
      const age = nowMs - lastAttemptMs;
      if (age >= 0 && age <= config.recentMissWindowMs) {
        weight *= config.recentMissBoost;
      }
    }
  }

  return weight;
}

function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function selectAdaptiveQuestions<Q extends Question = Question>({
  userId,
  desiredQuizSize,
  fullQuestionBank,
  userStatsByKey = {},
  config = {},
  rng = Math.random,
}: AdaptiveSelectionInput<Q>): AdaptiveSelectionResult<Q> {
  const resolved = { ...DEFAULT_ADAPTIVE_QUIZ_CONFIG, ...config };
  const nowMs = Date.now();
  const requestedCount = Math.max(0, Math.floor(desiredQuizSize));

  const deduped = dedupeQuestions(fullQuestionBank, {
    includeChoices: resolved.includeChoicesInCanonicalKey,
  });

  type Candidate = {
    question: Q;
    canonicalKey: string;
    stats?: UserQuestionStats;
    mastered: boolean;
  };

  const candidates: Candidate[] = deduped.questions.map((question) => {
    const canonicalKey = deduped.keyByQuestionId[question.id];
    const stats = userStatsByKey[canonicalKey];
    return {
      question,
      canonicalKey,
      stats,
      mastered: stats ? isMastered(stats, resolved) : false,
    };
  });

  const mastered = candidates.filter((item) => item.mastered);
  const unmastered = candidates.filter((item) => !item.mastered);

  let selected: Candidate[] = [];
  let backfilledFromMastered = 0;

  if (resolved.excludeMastered) {
    selected = weightedSampleWithoutReplacement(
      unmastered,
      Math.min(requestedCount, unmastered.length),
      (item) => buildQuestionWeight(item.stats, resolved, nowMs),
      rng
    );

    if (
      selected.length < requestedCount &&
      resolved.includeMasteredOnShortfall &&
      mastered.length > 0
    ) {
      const needed = requestedCount - selected.length;
      const backfill = weightedSampleWithoutReplacement(
        mastered,
        Math.min(needed, mastered.length),
        (item) => buildQuestionWeight(item.stats, resolved, nowMs),
        rng
      );
      selected = [...selected, ...backfill];
      backfilledFromMastered = backfill.length;
    }
  } else {
    const targetReview = Math.min(
      mastered.length,
      Math.max(0, Math.round(requestedCount * resolved.reviewRate))
    );
    const reviewSelection = weightedSampleWithoutReplacement(
      mastered,
      targetReview,
      (item) => buildQuestionWeight(item.stats, resolved, nowMs),
      rng
    );

    const nonMasteredSelection = weightedSampleWithoutReplacement(
      unmastered,
      Math.min(requestedCount - reviewSelection.length, unmastered.length),
      (item) => buildQuestionWeight(item.stats, resolved, nowMs),
      rng
    );

    selected = [...reviewSelection, ...nonMasteredSelection];

    if (selected.length < requestedCount) {
      const alreadyPicked = new Set(selected.map((item) => item.question.id));
      const remaining = candidates.filter((item) => !alreadyPicked.has(item.question.id));
      const fill = weightedSampleWithoutReplacement(
        remaining,
        Math.min(requestedCount - selected.length, remaining.length),
        (item) => buildQuestionWeight(item.stats, resolved, nowMs),
        rng
      );
      selected = [...selected, ...fill];
    }
  }

  const orderedQuestions = shuffleInPlace(
    selected.map((item) => item.question),
    rng
  );

  return {
    questions: orderedQuestions,
    keyByQuestionId: deduped.keyByQuestionId,
    meta: {
      dedupedCount: deduped.questions.length,
      duplicatesRemoved: deduped.duplicatesRemoved,
      masteredExcluded: resolved.excludeMastered ? mastered.length : 0,
      backfilledFromMastered,
    },
  };
}
