import {
  canonicalQuestionKey,
  type Question,
  type SessionQueueDecision,
  type UserQuestionStats,
} from "@part107/core";

export type FlashcardLapseHandling = "balanced" | "aggressive" | "gentle";

export interface FlashcardSchedulerSettings {
  dailyReviewTarget: number;
  maxNewCardsPerDay: number;
  lapseHandling: FlashcardLapseHandling;
  maxPerCategory: number;
  weeklyReviewGoal: number;
}

export const DEFAULT_FLASHCARD_SCHEDULER_SETTINGS: FlashcardSchedulerSettings = {
  dailyReviewTarget: 20,
  maxNewCardsPerDay: 10,
  lapseHandling: "balanced",
  maxPerCategory: 0,
  weeklyReviewGoal: 40,
};

export interface FlashcardDeckPreview {
  cards: Question[];
  totalPool: number;
  dueNowCount: number;
  dueNowReviewCount: number;
  dueNowNewCount: number;
  usingUpcomingFallback: boolean;
  remainingNewQuota: number;
  limitedByDailyTarget: boolean;
  limitedByNewCap: boolean;
  limitedByCategoryCap: boolean;
}

interface BuildFlashcardDeckPreviewInput {
  questions: Question[];
  statsByKey: Record<string, UserQuestionStats>;
  includeChoicesInCanonicalKey: boolean;
  settings: FlashcardSchedulerSettings;
  remainingNewQuota: number;
  upcomingFallbackCount?: number;
  nowMs?: number;
}

interface RankedQuestion {
  question: Question;
  canonicalKey: string;
  dueAtMs: number;
  masteryScore: number;
  hasHistory: boolean;
}

export interface FlashcardPlanRecommendation {
  remainingThisWeek: number;
  recommendedPerDay: number;
  message: string;
}

const DEFAULT_UPCOMING_FALLBACK_COUNT = 20;

function getRankedQuestion(
  question: Question,
  statsByKey: Record<string, UserQuestionStats>,
  includeChoicesInCanonicalKey: boolean
): RankedQuestion {
  const canonicalKey = canonicalQuestionKey(question, {
    includeChoices: includeChoicesInCanonicalKey,
  });
  const stats = statsByKey[canonicalKey];
  const parsedDue = Date.parse(stats?.nextDueAt ?? "");
  return {
    question,
    canonicalKey,
    dueAtMs: Number.isFinite(parsedDue) ? parsedDue : 0,
    masteryScore: typeof stats?.masteryScore === "number" ? stats.masteryScore : 0,
    hasHistory: !!stats,
  };
}

function applyCategoryCap(
  items: RankedQuestion[],
  maxPerCategory: number
): { items: RankedQuestion[]; limited: boolean } {
  if (!Number.isFinite(maxPerCategory) || maxPerCategory <= 0) {
    return { items, limited: false };
  }
  const cap = Math.max(1, Math.round(maxPerCategory));
  const counts = new Map<string, number>();
  const capped: RankedQuestion[] = [];
  let skipped = 0;

  for (const item of items) {
    const category = item.question.category;
    const categoryCount = counts.get(category) ?? 0;
    if (categoryCount >= cap) {
      skipped += 1;
      continue;
    }
    counts.set(category, categoryCount + 1);
    capped.push(item);
  }

  return { items: capped, limited: skipped > 0 };
}

export function buildFlashcardDeckPreview({
  questions,
  statsByKey,
  includeChoicesInCanonicalKey,
  settings,
  remainingNewQuota,
  upcomingFallbackCount = DEFAULT_UPCOMING_FALLBACK_COUNT,
  nowMs = Date.now(),
}: BuildFlashcardDeckPreviewInput): FlashcardDeckPreview {
  if (questions.length === 0) {
    return {
      cards: [],
      totalPool: 0,
      dueNowCount: 0,
      dueNowReviewCount: 0,
      dueNowNewCount: 0,
      usingUpcomingFallback: false,
      remainingNewQuota: Math.max(0, remainingNewQuota),
      limitedByDailyTarget: false,
      limitedByNewCap: false,
      limitedByCategoryCap: false,
    };
  }

  const ranked = questions
    .map((question) =>
      getRankedQuestion(question, statsByKey, includeChoicesInCanonicalKey)
    )
    .sort((a, b) => {
      if (a.dueAtMs !== b.dueAtMs) return a.dueAtMs - b.dueAtMs;
      if (a.masteryScore !== b.masteryScore) return a.masteryScore - b.masteryScore;
      return a.question.id.localeCompare(b.question.id);
    });

  const dueNow = ranked.filter((entry) => entry.dueAtMs <= nowMs);
  const dueNowReview = dueNow.filter((entry) => entry.hasHistory);
  const dueNowNew = dueNow.filter((entry) => !entry.hasHistory);
  const allowedNewDue = dueNowNew.slice(0, Math.max(0, remainingNewQuota));
  const limitedByNewCap = dueNowNew.length > allowedNewDue.length;

  const applyDailyTarget = (items: RankedQuestion[]) => {
    const capped = items.slice(0, Math.max(0, settings.dailyReviewTarget));
    return {
      cards: capped.map((entry) => entry.question),
      limited: items.length > capped.length,
    };
  };

  const dueNowCandidates = [...dueNowReview, ...allowedNewDue];
  const categoryCappedDue = applyCategoryCap(dueNowCandidates, settings.maxPerCategory);
  if (dueNow.length > 0 && dueNowCandidates.length === 0) {
    return {
      cards: [],
      totalPool: questions.length,
      dueNowCount: dueNow.length,
      dueNowReviewCount: dueNowReview.length,
      dueNowNewCount: dueNowNew.length,
      usingUpcomingFallback: false,
      remainingNewQuota: Math.max(0, remainingNewQuota),
      limitedByDailyTarget: false,
      limitedByNewCap,
      limitedByCategoryCap: false,
    };
  }

  if (categoryCappedDue.items.length > 0) {
    const capped = applyDailyTarget(categoryCappedDue.items);
    return {
      cards: capped.cards,
      totalPool: questions.length,
      dueNowCount: dueNow.length,
      dueNowReviewCount: dueNowReview.length,
      dueNowNewCount: dueNowNew.length,
      usingUpcomingFallback: false,
      remainingNewQuota: Math.max(0, remainingNewQuota),
      limitedByDailyTarget: capped.limited,
      limitedByNewCap,
      limitedByCategoryCap: categoryCappedDue.limited,
    };
  }

  const upcomingCandidates = ranked.slice(0, Math.min(upcomingFallbackCount, ranked.length));
  const categoryCappedUpcoming = applyCategoryCap(upcomingCandidates, settings.maxPerCategory);
  const cappedUpcoming = applyDailyTarget(categoryCappedUpcoming.items);
  return {
    cards: cappedUpcoming.cards,
    totalPool: questions.length,
    dueNowCount: 0,
    dueNowReviewCount: 0,
    dueNowNewCount: 0,
    usingUpcomingFallback: true,
    remainingNewQuota: Math.max(0, remainingNewQuota),
    limitedByDailyTarget: cappedUpcoming.limited,
    limitedByNewCap: false,
    limitedByCategoryCap: categoryCappedUpcoming.limited,
  };
}

export function applyLapseHandlingToQueueDecision(
  decision: SessionQueueDecision,
  isCorrect: boolean,
  lapseHandling: FlashcardLapseHandling
): SessionQueueDecision {
  if (isCorrect || decision.removeFromQueue) return decision;

  if (lapseHandling === "aggressive") {
    return {
      removeFromQueue: false,
      gapMin: 1,
      gapMax: 2,
    };
  }

  if (lapseHandling === "gentle") {
    const gapMin = (decision.gapMin ?? 2) + 2;
    const gapMax = Math.max((decision.gapMax ?? 4) + 2, gapMin);
    return {
      removeFromQueue: false,
      gapMin,
      gapMax,
    };
  }

  return decision;
}

export function buildFlashcardPlanRecommendation({
  weeklyReviewGoal,
  weeklyCompleted,
  daysRemainingInWeek,
  streakDays,
}: {
  weeklyReviewGoal: number;
  weeklyCompleted: number;
  daysRemainingInWeek: number;
  streakDays: number;
}): FlashcardPlanRecommendation {
  const normalizedGoal = Math.max(0, Math.round(weeklyReviewGoal));
  const normalizedCompleted = Math.max(0, Math.round(weeklyCompleted));
  const remainingThisWeek = Math.max(0, normalizedGoal - normalizedCompleted);
  const remainingDays = Math.max(1, Math.round(daysRemainingInWeek));
  const recommendedPerDay =
    remainingThisWeek > 0 ? Math.max(1, Math.ceil(remainingThisWeek / remainingDays)) : 0;

  if (remainingThisWeek === 0) {
    return {
      remainingThisWeek,
      recommendedPerDay,
      message:
        streakDays >= 3
          ? `Goal met. Keep your ${streakDays}-day streak alive with light review.`
          : "Goal met. Optional light review keeps retention high.",
    };
  }

  if (streakDays >= 5) {
    return {
      remainingThisWeek,
      recommendedPerDay,
      message: `Strong ${streakDays}-day streak. Aim for ${recommendedPerDay}/day to hit goal.`,
    };
  }

  return {
    remainingThisWeek,
    recommendedPerDay,
    message: `Need ${remainingThisWeek} more this week (${recommendedPerDay}/day recommended).`,
  };
}
