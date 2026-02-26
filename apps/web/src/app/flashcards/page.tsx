"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canonicalQuestionKey,
  filterQuestionsByType,
  qualityFromOutcomeConfidence,
  sessionQueueDecisionFromQuality,
  type AttemptConfidence,
  type Question,
  type QuestionTypeProfile,
} from "@part107/core";
import { ReferenceModal, type ResolvedReference } from "../../components/ReferenceModal";
import {
  QuestionBankError,
  QuestionBankLoading,
  QuestionBankWarning,
} from "../../components/QuestionBankState";
import QuestionTypeOptionsGrid from "../../components/QuestionTypeOptionsGrid";
import { QuestionSelectionEmptyState } from "../../components/QuestionSelectionEmptyState";
import ActionBar from "../../components/quiz/ActionBar";
import ConfidencePanel from "../../components/quiz/ConfidencePanel";
import QuestionIssueReporter from "../../components/quiz/QuestionIssueReporter";
import SessionButton from "../../components/quiz/SessionButton";
import { useAdaptiveQuestionStats } from "../../hooks/useAdaptiveQuestionStats";
import { useActiveUserId } from "../../hooks/useActiveUserId";
import { useLearningEventLogger } from "../../hooks/useLearningEventLogger";
import { resolveFigureImageUrl } from "../../lib/figureImage";
import {
  applyLapseHandlingToQueueDecision,
  buildFlashcardPlanRecommendation,
  buildFlashcardDeckPreview,
  DEFAULT_FLASHCARD_SCHEDULER_SETTINGS,
  type FlashcardLapseHandling,
} from "../../lib/flashcardScheduler";
import {
  getFlashcardRemainingNewQuota,
  hasFlashcardSchedulerSettings,
  markFlashcardReviewCompleted,
  markFlashcardNewSeenToday,
  readFlashcardSchedulerProgress,
  readFlashcardSchedulerSettings,
  writeFlashcardSchedulerSettings,
} from "../../lib/flashcardSchedulerStore";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { reinsertQueueHeadWithGap } from "../../lib/queueReinsertion";
import { STUDY_CATEGORIES, countQuestionsByCategory } from "../../lib/questionBank";
import { recordLearningAttempt } from "../../lib/learningAttemptPipeline";
import { SELECTABLE_QUESTION_TYPE_OPTIONS as QUESTION_TYPE_OPTIONS } from "../../lib/questionTypeOptions";
import {
  readPreferredQuestionType,
  writePreferredQuestionType,
} from "../../lib/questionTypePreferenceStore";
import { readLearningPreferences, writeLearningPreferences } from "../../lib/learningPreferencesStore";

const DAILY_REVIEW_TARGET_OPTIONS = [10, 20, 30, 50] as const;
const MAX_NEW_PER_DAY_OPTIONS = [0, 5, 10, 20] as const;
const MAX_PER_CATEGORY_OPTIONS = [0, 2, 3, 5] as const;
const WEEKLY_REVIEW_GOAL_OPTIONS = [20, 40, 60, 80] as const;
const LAPSE_HANDLING_OPTIONS: Array<{
  value: FlashcardLapseHandling;
  label: string;
  description: string;
}> = [
  {
    value: "balanced",
    label: "Balanced",
    description: "Default spacing on misses.",
  },
  {
    value: "aggressive",
    label: "Aggressive",
    description: "Bring missed cards back ASAP.",
  },
  {
    value: "gentle",
    label: "Gentle",
    description: "Push missed cards slightly farther.",
  },
];

// ─── Component ───
export default function FlashcardsPage() {
  const {
    questions: allQuestions,
    loaded,
    loading,
    error,
    warning,
    snapshotInfo,
    reload,
    clearSnapshot,
  } = useQuestionBank();
  const activeUserId = useActiveUserId();
  const adaptive = useAdaptiveQuestionStats(activeUserId);
  const events = useLearningEventLogger(adaptive.userId);

  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionTypeProfile>("confirmed_test");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [started, setStarted] = useState(false);
  const [sessionCards, setSessionCards] = useState<Question[]>([]);
  const [initialDeckSize, setInitialDeckSize] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [learning, setLearning] = useState(0);
  const [reviews, setReviews] = useState(0);
  const [ratingConfidence, setRatingConfidence] = useState<AttemptConfidence>(3);
  const [dailyReviewTarget, setDailyReviewTarget] = useState<number>(
    DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.dailyReviewTarget
  );
  const [maxNewCardsPerDay, setMaxNewCardsPerDay] = useState<number>(
    DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.maxNewCardsPerDay
  );
  const [lapseHandling, setLapseHandling] = useState<FlashcardLapseHandling>(
    DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.lapseHandling
  );
  const [maxPerCategory, setMaxPerCategory] = useState<number>(
    DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.maxPerCategory
  );
  const [weeklyReviewGoal, setWeeklyReviewGoal] = useState<number>(
    DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.weeklyReviewGoal
  );
  const [schedulerHydratedForUserId, setSchedulerHydratedForUserId] = useState<string | null>(
    null
  );
  const [prefsHydratedForUserId, setPrefsHydratedForUserId] = useState<string | null>(null);
  const [dailySeenVersion, setDailySeenVersion] = useState(0);
  const [remainingNewQuota, setRemainingNewQuota] = useState(() =>
    getFlashcardRemainingNewQuota(
      activeUserId,
      DEFAULT_FLASHCARD_SCHEDULER_SETTINGS.maxNewCardsPerDay
    )
  );
  const [weeklyProgress, setWeeklyProgress] = useState(() =>
    readFlashcardSchedulerProgress(activeUserId)
  );
  const [figureRef, setFigureRef] = useState<ResolvedReference | null>(null);
  const questionShownAtRef = useRef(Date.now());
  const completionLoggedRef = useRef(false);

  const filteredQuestions = useMemo(
    () =>
      filterQuestionsByType(allQuestions, selectedQuestionType, {
        userStatsByKey: adaptive.statsByKey,
        adaptiveConfig: adaptive.config,
      }),
    [adaptive.config, adaptive.statsByKey, allQuestions, selectedQuestionType]
  );

  useEffect(() => {
    const stored = readFlashcardSchedulerSettings(activeUserId);
    const preferences = readLearningPreferences(activeUserId);
    const hasStoredSettings = hasFlashcardSchedulerSettings(activeUserId);
    setDailyReviewTarget(
      hasStoredSettings ? stored.dailyReviewTarget : preferences.defaultFlashcardDailyReviewTarget
    );
    setMaxNewCardsPerDay(stored.maxNewCardsPerDay);
    setLapseHandling(stored.lapseHandling);
    setMaxPerCategory(stored.maxPerCategory);
    setWeeklyReviewGoal(stored.weeklyReviewGoal);
    setWeeklyProgress(readFlashcardSchedulerProgress(activeUserId));
    setSchedulerHydratedForUserId(activeUserId);
    setPrefsHydratedForUserId(activeUserId);
    setDailySeenVersion((value) => value + 1);
  }, [activeUserId]);

  useEffect(() => {
    const preferred = readPreferredQuestionType(activeUserId);
    if (preferred) {
      setSelectedQuestionType(preferred);
    }
  }, [activeUserId]);

  useEffect(() => {
    writePreferredQuestionType(activeUserId, selectedQuestionType);
  }, [activeUserId, selectedQuestionType]);

  useEffect(() => {
    if (schedulerHydratedForUserId !== activeUserId) return;
    writeFlashcardSchedulerSettings(activeUserId, {
      dailyReviewTarget,
      maxNewCardsPerDay,
      lapseHandling,
      maxPerCategory,
      weeklyReviewGoal,
    });
  }, [
    activeUserId,
    dailyReviewTarget,
    lapseHandling,
    maxPerCategory,
    maxNewCardsPerDay,
    schedulerHydratedForUserId,
    weeklyReviewGoal,
  ]);

  useEffect(() => {
    if (prefsHydratedForUserId !== activeUserId) return;
    if (started) return;
    const current = readLearningPreferences(activeUserId);
    if (current.defaultFlashcardDailyReviewTarget === dailyReviewTarget) return;
    writeLearningPreferences(activeUserId, {
      ...current,
      defaultFlashcardDailyReviewTarget: dailyReviewTarget,
    });
  }, [activeUserId, dailyReviewTarget, prefsHydratedForUserId, started]);

  useEffect(() => {
    setRemainingNewQuota(getFlashcardRemainingNewQuota(activeUserId, maxNewCardsPerDay));
  }, [activeUserId, maxNewCardsPerDay, dailySeenVersion]);

  const deckPreview = useMemo(() => {
    const pool =
      selectedCategory === "All"
        ? filteredQuestions
        : filteredQuestions.filter((q) => q.category === selectedCategory);
    return buildFlashcardDeckPreview({
      questions: pool,
      statsByKey: adaptive.statsByKey,
      includeChoicesInCanonicalKey: adaptive.config.includeChoicesInCanonicalKey,
      settings: {
        dailyReviewTarget,
        maxNewCardsPerDay,
        lapseHandling,
        maxPerCategory,
        weeklyReviewGoal,
      },
      remainingNewQuota,
    });
  }, [
    adaptive.config.includeChoicesInCanonicalKey,
    adaptive.statsByKey,
    dailyReviewTarget,
    filteredQuestions,
    lapseHandling,
    maxNewCardsPerDay,
    maxPerCategory,
    remainingNewQuota,
    selectedCategory,
    weeklyReviewGoal,
  ]);

  const weeklyPlanRecommendation = useMemo(() => {
    const dayOfWeek = (new Date().getDay() + 6) % 7;
    return buildFlashcardPlanRecommendation({
      weeklyReviewGoal,
      weeklyCompleted: weeklyProgress.completedThisWeek,
      daysRemainingInWeek: Math.max(1, 7 - dayOfWeek),
      streakDays: weeklyProgress.streakDays,
    });
  }, [weeklyProgress.completedThisWeek, weeklyProgress.streakDays, weeklyReviewGoal]);

  const visibleCounts = useMemo(() => countQuestionsByCategory(filteredQuestions), [filteredQuestions]);

  const totalSetupCards = deckPreview.cards.length;
  const currentCard = sessionCards[0] ?? null;
  const total = sessionCards.length;

  const resetSession = useCallback(() => {
    setInitialDeckSize(0);
    setKnown(0);
    setLearning(0);
    setReviews(0);
    setRatingConfidence(3);
    setFlipped(false);
    setFigureRef(null);
    setSessionCards([]);
    completionLoggedRef.current = false;
  }, []);

  const beginSession = useCallback(() => {
    if (deckPreview.cards.length === 0) return;
    setSessionCards(deckPreview.cards);
    setInitialDeckSize(deckPreview.cards.length);
    setKnown(0);
    setLearning(0);
    setReviews(0);
    setRatingConfidence(3);
    setFlipped(false);
    setFigureRef(null);
    setStarted(true);
    completionLoggedRef.current = false;
    events.logEvent({
      type: "session_started",
      mode: "flashcards",
      category: selectedCategory,
      questionTypeProfile: selectedQuestionType,
      metadata: {
        deckSize: deckPreview.cards.length,
        totalPool: deckPreview.totalPool,
        dueNowCount: deckPreview.dueNowCount,
        usingUpcomingFallback: deckPreview.usingUpcomingFallback,
        dueNowReviewCount: deckPreview.dueNowReviewCount,
        dueNowNewCount: deckPreview.dueNowNewCount,
        dailyReviewTarget,
        maxNewCardsPerDay,
        remainingNewQuota,
        lapseHandling,
        maxPerCategory,
        weeklyReviewGoal,
        weeklyCompleted: weeklyProgress.completedThisWeek,
      },
    });
  }, [
    dailyReviewTarget,
    deckPreview,
    events,
    lapseHandling,
    maxPerCategory,
    maxNewCardsPerDay,
    remainingNewQuota,
    selectedCategory,
    selectedQuestionType,
    weeklyProgress.completedThisWeek,
    weeklyReviewGoal,
  ]);

  const handleToggleCard = useCallback(() => setFlipped((prev) => !prev), []);
  const handleShowQuestion = useCallback(() => setFlipped(false), []);

  const handleRateCard = useCallback(
    (rating: "know_it" | "still_learning", confidence: AttemptConfidence) => {
      if (!currentCard) return;
      const isCorrect = rating === "know_it";
      const canonicalKey = canonicalQuestionKey(currentCard, {
        includeChoices: adaptive.config.includeChoicesInCanonicalKey,
      });
      const isNewCard = !adaptive.statsByKey[canonicalKey];
      const qualityScore = qualityFromOutcomeConfidence(
        isCorrect ? "correct" : "incorrect",
        confidence
      );
      const queueDecision = applyLapseHandlingToQueueDecision(
        sessionQueueDecisionFromQuality(qualityScore),
        isCorrect,
        lapseHandling
      );
      const responseTimeMs = Math.max(0, Date.now() - questionShownAtRef.current);
      recordLearningAttempt({
        adaptive,
        events,
        question: currentCard,
        learningMode: "flashcards",
        attemptMode: "flashcard",
        isCorrect,
        selectedOptionId: null,
        responseTimeMs,
        confidence,
        questionTypeProfile: selectedQuestionType,
        metadata: {
          rating,
          qualityScore,
          queueAction: queueDecision.removeFromQueue
            ? "remove"
            : `reinsert_${queueDecision.gapMin}-${queueDecision.gapMax}`,
        },
      });
      if (isNewCard && markFlashcardNewSeenToday(activeUserId, canonicalKey)) {
        setDailySeenVersion((value) => value + 1);
      }
      setWeeklyProgress(markFlashcardReviewCompleted(activeUserId, 1));

      if (!isCorrect) {
        setLearning((n) => n + 1);
      } else if (queueDecision.removeFromQueue) {
        setKnown((n) => n + 1);
      }
      setReviews((n) => n + 1);
      setFlipped(false);
      setSessionCards((prev) => {
        if (queueDecision.removeFromQueue) {
          return prev.slice(1);
        }
        return reinsertQueueHeadWithGap(
          prev,
          queueDecision.gapMin ?? 2,
          queueDecision.gapMax ?? 4
        );
      });
    },
    [activeUserId, adaptive, currentCard, events, lapseHandling, selectedQuestionType]
  );

  const handleKnowIt = useCallback(() => {
    handleRateCard("know_it", ratingConfidence);
  }, [handleRateCard, ratingConfidence]);

  const handleStillLearning = useCallback(() => {
    handleRateCard("still_learning", ratingConfidence);
  }, [handleRateCard, ratingConfidence]);

  const handleSkip = useCallback(() => {
    if (!currentCard) return;
    events.logEvent({
      type: "question_skipped",
      mode: "flashcards",
      questionId: currentCard.id,
      category: currentCard.category,
      subcategory: currentCard.subcategory,
      questionTypeProfile: selectedQuestionType,
    });
    setFlipped(false);
    setSessionCards((prev) => {
      if (prev.length <= 1) return prev;
      const [head, ...rest] = prev;
      return [...rest, head];
    });
  }, [currentCard, events, selectedQuestionType]);

  const restart = useCallback(() => {
    setSessionCards(deckPreview.cards);
    setInitialDeckSize(deckPreview.cards.length);
    setKnown(0);
    setLearning(0);
    setReviews(0);
    setRatingConfidence(3);
    setFlipped(false);
    setFigureRef(null);
    completionLoggedRef.current = false;
  }, [deckPreview.cards]);

  // Keyboard navigation
  useEffect(() => {
    if (!started) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInteractiveTarget =
        !!target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName));
      if (isInteractiveTarget) return;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleToggleCard();
        return;
      }
      if (flipped && (e.key === "ArrowRight" || e.key === "k")) {
        handleKnowIt();
        return;
      }
      if (flipped && (e.key === "ArrowLeft" || e.key === "l")) {
        handleStillLearning();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flipped, handleKnowIt, handleStillLearning, handleToggleCard, started]);

  useEffect(() => {
    if (!started || !currentCard) return;
    questionShownAtRef.current = Date.now();
    events.logEvent({
      type: "question_shown",
      mode: "flashcards",
      questionId: currentCard.id,
      category: currentCard.category,
      subcategory: currentCard.subcategory,
      questionTypeProfile: selectedQuestionType,
    });
  }, [currentCard, events, selectedQuestionType, started]);

  useEffect(() => {
    if (!started || total !== 0 || completionLoggedRef.current) return;
    completionLoggedRef.current = true;
    events.logEvent({
      type: "session_completed",
      mode: "flashcards",
      category: selectedCategory,
      questionTypeProfile: selectedQuestionType,
      metadata: {
        initialDeckSize,
        known,
        learning,
        reviews,
      },
    });
  }, [
    events,
    initialDeckSize,
    known,
    learning,
    reviews,
    selectedCategory,
    selectedQuestionType,
    started,
    total,
  ]);

  // ─── Loading / Error ───
  if (loading && !loaded) {
    return <QuestionBankLoading label="Loading question bank..." />;
  }

  if (error && !loaded) {
    return <QuestionBankError error={error} onRetry={() => void reload()} />;
  }

  // ─── Setup Screen ───
  if (!started) {
    return (
      <div className="mx-auto max-w-lg space-y-8 pt-8">
        {warning && (
          <QuestionBankWarning
            warning={warning}
            snapshotInfo={snapshotInfo}
            onTryLive={() => void reload({ preferLive: true })}
            onClearSnapshot={clearSnapshot}
          />
        )}
        <div className="text-center">
          <div className="text-5xl">🃏</div>
          <h1 className="mt-4 text-3xl font-bold">Flashcards</h1>
          <p className="mt-2 text-[var(--muted)]">
            Flip to reveal the answer. Rate yourself <strong>Know It</strong> or{" "}
            <strong>Still Learning</strong>. Spaced repetition resurfaces cards you struggle with.
          </p>
        </div>

        {deckPreview.usingUpcomingFallback && totalSetupCards > 0 && (
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-xs text-brand-300">
            No cards are due right now. Showing the {totalSetupCards} soonest cards so you can keep
            practicing.
          </div>
        )}
        {deckPreview.limitedByDailyTarget && totalSetupCards > 0 && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-300">
            Daily target applied: showing first {totalSetupCards} cards for this session.
          </div>
        )}
        {deckPreview.limitedByNewCap && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            New-card cap applied: {deckPreview.remainingNewQuota} new-card slots left today.
          </div>
        )}
        {deckPreview.limitedByCategoryCap && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-300">
            Category cap applied: max {maxPerCategory} card{maxPerCategory === 1 ? "" : "s"} per
            category in this deck.
          </div>
        )}
        {totalSetupCards === 0 && deckPreview.dueNowNewCount > 0 && deckPreview.remainingNewQuota === 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            New-card cap reached for today. Increase max new cards/day or return tomorrow.
          </div>
        )}

        {/* Question type selector */}
        {totalSetupCards === 0 && <QuestionSelectionEmptyState context="flashcards" />}
        <QuestionTypeOptionsGrid
          title="Question Pool"
          options={QUESTION_TYPE_OPTIONS}
          selectedQuestionType={selectedQuestionType}
          onSelectQuestionType={setSelectedQuestionType}
          variant="compact"
        />

        {/* Category selector */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Category</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => setSelectedCategory("All")}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedCategory === "All"
                  ? "border-brand-500/60 bg-brand-500/10"
                  : "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/30"
              }`}
            >
              <div className="text-sm font-semibold text-white">All Categories</div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {filteredQuestions.length} cards
              </div>
            </button>
            {STUDY_CATEGORIES.filter((c) => c !== "All").map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedCategory === cat
                    ? "border-brand-500/60 bg-brand-500/10"
                    : "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/30"
                }`}
              >
                <div className="text-sm font-semibold text-white">{cat}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {visibleCounts[cat] ?? 0} cards
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-center text-[var(--muted)]">
            Due now
            <div className="mt-1 font-semibold text-white">{deckPreview.dueNowCount}</div>
          </div>
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-center text-[var(--muted)]">
            Reviews due
            <div className="mt-1 font-semibold text-white">{deckPreview.dueNowReviewCount}</div>
          </div>
          <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-center text-[var(--muted)]">
            New slots left
            <div className="mt-1 font-semibold text-white">{deckPreview.remainingNewQuota}</div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
          <div className="text-sm font-semibold text-white">Weekly Plan</div>
          <div className="mt-2 text-xs text-[var(--muted)]">
            Week progress: {weeklyProgress.completedThisWeek}/{weeklyReviewGoal} reviews
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            Streak: {weeklyProgress.streakDays} day{weeklyProgress.streakDays === 1 ? "" : "s"}
          </div>
          <div className="mt-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-xs text-white">
            {weeklyPlanRecommendation.message}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Daily Review Target</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DAILY_REVIEW_TARGET_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDailyReviewTarget(option)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  dailyReviewTarget === option
                    ? "border-brand-400 bg-brand-500/20 text-white"
                    : "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Max New Cards / Day</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MAX_NEW_PER_DAY_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMaxNewCardsPerDay(option)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  maxNewCardsPerDay === option
                    ? "border-brand-400 bg-brand-500/20 text-white"
                    : "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Lapse Handling</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {LAPSE_HANDLING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setLapseHandling(option.value)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  lapseHandling === option.value
                    ? "border-brand-400 bg-brand-500/20 text-white"
                    : "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Max Cards Per Category</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MAX_PER_CATEGORY_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMaxPerCategory(option)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  maxPerCategory === option
                    ? "border-brand-400 bg-brand-500/20 text-white"
                    : "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {option === 0 ? "Unlimited" : option}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Weekly Review Goal</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WEEKLY_REVIEW_GOAL_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setWeeklyReviewGoal(option)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  weeklyReviewGoal === option
                    ? "border-brand-400 bg-brand-500/20 text-white"
                    : "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={beginSession}
          disabled={totalSetupCards === 0}
          className="w-full rounded-xl bg-brand-600 py-4 text-lg font-semibold text-white transition-all hover:bg-brand-700 hover:scale-[1.02] disabled:opacity-60"
        >
          Start Flashcards ({totalSetupCards} cards) →
        </button>
      </div>
    );
  }

  // ─── Complete Screen ───
  if (total === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-6 pt-12 text-center">
        {warning && (
          <QuestionBankWarning
            warning={warning}
            snapshotInfo={snapshotInfo}
            onTryLive={() => void reload({ preferLive: true })}
            onClearSnapshot={clearSnapshot}
          />
        )}
        <div className="text-6xl">🎉</div>
        <h1 className="text-3xl font-bold">Deck Complete!</h1>
        <p className="text-sm text-[var(--muted)]">
          {reviews} review actions across {initialDeckSize} due cards.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
            <div className="text-2xl font-bold text-green-400">{known}</div>
            <div className="text-sm text-[var(--muted)]">Know It</div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="text-2xl font-bold text-amber-400">{learning}</div>
            <div className="text-sm text-[var(--muted)]">Still Learning</div>
          </div>
        </div>
        <div className="flex gap-3">
          <SessionButton
            variant="brand-solid"
            onClick={restart}
            className="flex-1 py-3"
          >
            Restart Deck
          </SessionButton>
          <SessionButton
            variant="muted-outline"
            onClick={() => {
              setStarted(false);
              resetSession();
            }}
            className="flex-1 py-3 font-semibold"
          >
            Change Topic
          </SessionButton>
        </div>
        <Link
          href="/study"
          className="block text-sm text-brand-400 hover:text-brand-300 transition-colors"
        >
          Back to Study Mode →
        </Link>
      </div>
    );
  }

  // ─── Card View ───
  const progressPct = initialDeckSize > 0 ? Math.round((known / initialDeckSize) * 100) : 0;
  const q = currentCard!;

  const correctOption = q.options.find((o) => o.id === q.correct_option_id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {warning && (
        <QuestionBankWarning
          warning={warning}
          snapshotInfo={snapshotInfo}
          onTryLive={() => void reload({ preferLive: true })}
          onClearSnapshot={clearSnapshot}
        />
      )}
      {/* Progress bar */}
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <span>
          Mastered {known} of {initialDeckSize}
        </span>
        <span>
          Remaining {total} &nbsp; • &nbsp; 📖 {learning}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--card-border)]">
        <div
          className="h-2 rounded-full bg-brand-500 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Category badge */}
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">
          {q.category}
        </span>
        {q.acs_code && (
          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
            {q.acs_code}
          </span>
        )}
        <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-400">
          Difficulty {q.difficulty_level}/3
        </span>
      </div>

      {/* Card surface */}
      <div className="min-h-[340px]">
        {!flipped ? (
          <div
            role="button"
            tabIndex={0}
            onClick={handleToggleCard}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleToggleCard();
              }
            }}
            className="block min-h-[340px] w-full rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-left transition-all duration-200 hover:border-brand-500/40"
          >
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-500">
              Question
            </div>
            <div className="text-lg leading-relaxed text-white">{q.question_text}</div>

            {(q.figure_reference || q.image_ref) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const imageUrl = resolveFigureImageUrl(q);
                  if (!imageUrl) return;
                  setFigureRef({
                    url: imageUrl,
                    label: q.figure_reference ?? "Figure",
                    type: "image",
                    description: q.figure_reference ?? "Question figure",
                  });
                }}
                className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/20"
              >
                📊 View {q.figure_reference ?? "Figure"}
              </button>
            )}

            <div className="mt-8 text-center text-xs text-[var(--muted)] animate-shimmer">
              Tap or press Space to reveal answer
            </div>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={handleToggleCard}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleToggleCard();
              }
            }}
            className="min-h-[340px] cursor-pointer rounded-2xl border border-green-500/30 bg-[var(--card)] p-8 animate-slide-up"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-green-400">
                Correct Answer
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShowQuestion();
                }}
                className="rounded-lg border border-[var(--card-border)] px-2.5 py-1 text-xs text-[var(--muted)] transition-colors hover:text-white"
              >
                Show Question
              </button>
            </div>
            <div className="text-lg font-semibold text-green-400">
              {correctOption?.text ?? "Correct answer unavailable."}
            </div>
            <div className="mt-4 text-sm leading-relaxed text-[var(--foreground)]/90">
              {q.explanation_correct}
            </div>
            {q.citation && (
              <div className="mt-4 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-xs text-[var(--muted)]">
                📖 {q.citation}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfidencePanel
        title={
          <>
            Confidence for next rating: <code>{ratingConfidence}/5</code>
          </>
        }
        value={ratingConfidence}
        onChange={setRatingConfidence}
        selectorMode="triad"
        selectorSize="md"
        selectorClassName="mt-2 flex flex-wrap justify-center gap-2"
        hint={
          flipped
            ? "Use NS/N/C for your next Know It/Still Learning click."
            : "Set NS/N/C now, then flip the card and rate."
        }
      />

      <QuestionIssueReporter
        mode="flashcards"
        question={q}
        selectedOptionId={null}
        questionTypeProfile={selectedQuestionType}
        confidence={ratingConfidence}
      />

      {/* Action buttons — only visible when flipped */}
      {flipped && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleStillLearning}
              className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-4 text-center font-semibold text-amber-400 transition-all hover:scale-[1.02] hover:bg-amber-500/20"
            >
              📖 Still Learning
              <span className="mt-1 block text-xs text-[var(--muted)]">← or L key</span>
            </button>
            <button
              onClick={handleKnowIt}
              className="w-full rounded-xl border border-green-500/40 bg-green-500/10 py-4 text-center font-semibold text-green-400 transition-all hover:scale-[1.02] hover:bg-green-500/20"
            >
              ✅ Know It
              <span className="mt-1 block text-xs text-[var(--muted)]">→ or K key</span>
            </button>
          </div>
          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-3 text-center text-xs text-[var(--muted)]">
            One click records your selected confidence with each rating.
          </div>
        </div>
      )}

      {/* Back to setup */}
      <ActionBar layout="text">
        <SessionButton
          variant="text-muted"
          onClick={() => {
            setStarted(false);
            resetSession();
          }}
        >
          ← Change Topic
        </SessionButton>
        <SessionButton
          variant="text-muted"
          onClick={handleSkip}
        >
          Skip →
        </SessionButton>
      </ActionBar>

      {figureRef && (
        <ReferenceModal ref_={figureRef} onClose={() => setFigureRef(null)} />
      )}
    </div>
  );
}
