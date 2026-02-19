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
  lastAttemptAt: string;
  lastResultWasCorrect: boolean | null;
  masteryScore: number;
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
  stats: Pick<UserQuestionStats, "attempts" | "correct" | "correctStreak" | "lastAttemptAt">,
  config: Partial<AdaptiveQuizConfig> = {},
  nowMs: number = Date.now()
): number {
  const resolved = { ...DEFAULT_ADAPTIVE_QUIZ_CONFIG, ...config };
  const accuracy = computeAccuracy(stats);
  const streakScore = Math.min(1, stats.correctStreak / Math.max(1, resolved.minStreak));

  let recencyScore = 0;
  const parsed = Date.parse(stats.lastAttemptAt);
  if (Number.isFinite(parsed)) {
    const ageDays = Math.max(0, (nowMs - parsed) / (24 * 60 * 60 * 1000));
    recencyScore = Math.exp(-ageDays / 30);
  }

  const score = accuracy * 0.65 + streakScore * 0.25 + recencyScore * 0.1;
  return Math.max(0, Math.min(1, score));
}

export function isMastered(
  stats: Pick<UserQuestionStats, "attempts" | "correct" | "correctStreak">,
  config: Partial<AdaptiveQuizConfig> = {}
): boolean {
  const resolved = { ...DEFAULT_ADAPTIVE_QUIZ_CONFIG, ...config };
  const accuracy = computeAccuracy(stats);
  return (
    stats.attempts >= resolved.minAttempts &&
    accuracy >= resolved.minAccuracy &&
    stats.correctStreak >= resolved.minStreak
  );
}

export interface UpdateUserQuestionStatsInput {
  userId: string;
  canonicalKey: string;
  previous?: UserQuestionStats;
  isCorrect: boolean;
  config?: Partial<AdaptiveQuizConfig>;
  answeredAtMs?: number;
}

export function updateUserQuestionStats({
  userId,
  canonicalKey,
  previous,
  isCorrect,
  config = {},
  answeredAtMs = Date.now(),
}: UpdateUserQuestionStatsInput): UserQuestionStats {
  const attempts = (previous?.attempts ?? 0) + 1;
  const correct = (previous?.correct ?? 0) + (isCorrect ? 1 : 0);
  const incorrect = (previous?.incorrect ?? 0) + (isCorrect ? 0 : 1);
  const correctStreak = isCorrect ? (previous?.correctStreak ?? 0) + 1 : 0;
  const lastAttemptAt = new Date(answeredAtMs).toISOString();

  const nextBase: UserQuestionStats = {
    userId,
    canonicalKey,
    attempts,
    correct,
    incorrect,
    correctStreak,
    lastAttemptAt,
    lastResultWasCorrect: isCorrect,
    masteryScore: previous?.masteryScore ?? 0,
  };

  nextBase.masteryScore = computeMasteryScore(nextBase, config, answeredAtMs);
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
  const mastery = stats?.masteryScore ?? 0;
  let weight = Math.max(0.01, 1 - mastery);

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
