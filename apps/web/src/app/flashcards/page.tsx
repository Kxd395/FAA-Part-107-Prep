"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canonicalQuestionKey,
  filterQuestionsByCategory,
  filterQuestionsByType,
  qualityFromOutcomeConfidence,
  sessionQueueDecisionFromQuality,
  type AttemptConfidence,
  type OptionId,
  type Question,
  type QuestionTypeProfile,
} from "@part107/core";
import AnswerOptions from "../../components/quiz/AnswerOptions";
import { ReferenceModal, type ResolvedReference } from "../../components/ReferenceModal";
import {
  QuestionBankError,
  QuestionBankLoading,
  QuestionBankWarning,
} from "../../components/QuestionBankState";
import { QuestionSelectionEmptyState } from "../../components/QuestionSelectionEmptyState";
import { useActiveUserId } from "../../hooks/useActiveUserId";
import { useAdaptiveQuestionStats } from "../../hooks/useAdaptiveQuestionStats";
import { useLearningEventLogger } from "../../hooks/useLearningEventLogger";
import { resolveFigureImageUrl } from "../../lib/figureImage";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { buildFlashcardDeckPreview } from "../../lib/flashcardScheduler";
import {
  getFlashcardRemainingNewQuota,
  markFlashcardNewSeenToday,
  readFlashcardSchedulerSettings,
} from "../../lib/flashcardSchedulerStore";
import {
  buildOptionPresentation,
  getDisplayLabelForOption,
  getOptionTextById,
} from "../../lib/optionPresentation";
import { reinsertQueueHeadWithGap } from "../../lib/queueReinsertion";
import {
  STUDY_CATEGORIES,
  countQuestionsByCategory,
  type StudyCategory,
} from "../../lib/questionBank";
import { recordLearningAttempt } from "../../lib/learningAttemptPipeline";

// ─── Supported question‑type profiles ───
const QUESTION_TYPE_OPTIONS: Array<{
  value: QuestionTypeProfile;
  title: string;
  description: string;
}> = [
  {
    value: "all_random",
    title: "🎲 All Questions",
    description: "Full question pool across all study materials.",
  },
  {
    value: "confirmed_test",
    title: "✅ Confirmed Test Questions",
    description: "Questions verified from real FAA exam sources only.",
  },
  {
    value: "real_exam",
    title: "Real Exam MCQ",
    description: "Excludes ACS drill format.",
  },
  {
    value: "weak_spots",
    title: "🔥 Weak Spots",
    description: "Questions you still struggle with.",
  },
];

type FlashcardRunMode = "flip" | "mcq";

const FLASHCARD_RUN_MODE_OPTIONS: Array<{
  value: FlashcardRunMode;
  title: string;
  description: string;
}> = [
  {
    value: "flip",
    title: "↔ Flip & Rate",
    description: "Reveal the answer, then rate whether you know it.",
  },
  {
    value: "mcq",
    title: "🧠 3-Choice Drill",
    description: "Answer a 3-choice question before seeing the explanation.",
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

  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionTypeProfile>("all_random");
  const [selectedCategory, setSelectedCategory] = useState<StudyCategory>("All");
  const [selectedRunMode, setSelectedRunMode] = useState<FlashcardRunMode>("flip");
  const [sessionRunMode, setSessionRunMode] = useState<FlashcardRunMode>("flip");
  const [started, setStarted] = useState(false);
  const [sessionCards, setSessionCards] = useState<Question[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState(0);
  const [initialDeckSize, setInitialDeckSize] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [revealedCardId, setRevealedCardId] = useState<string | null>(null);
  const [known, setKnown] = useState(0);
  const [learning, setLearning] = useState(0);
  const [reviews, setReviews] = useState(0);
  const [mcqSelectedOption, setMcqSelectedOption] = useState<OptionId | null>(null);
  const [mcqConfidence, setMcqConfidence] = useState<AttemptConfidence | null>(null);
  const [mcqAnswerState, setMcqAnswerState] = useState<"unanswered" | "correct" | "incorrect">(
    "unanswered"
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
  const schedulerSettings = readFlashcardSchedulerSettings(activeUserId);
  const remainingNewQuota = getFlashcardRemainingNewQuota(
    activeUserId,
    schedulerSettings.maxNewCardsPerDay
  );

  const deckPreview = useMemo(() => {
    const pool =
      selectedCategory === "All"
        ? filteredQuestions
        : filterQuestionsByCategory(filteredQuestions, selectedCategory);
    return buildFlashcardDeckPreview({
      questions: pool,
      statsByKey: adaptive.statsByKey,
      includeChoicesInCanonicalKey: adaptive.config.includeChoicesInCanonicalKey,
      settings: schedulerSettings,
      remainingNewQuota,
    });
  }, [
    adaptive.config.includeChoicesInCanonicalKey,
    adaptive.statsByKey,
    filteredQuestions,
    remainingNewQuota,
    schedulerSettings,
    selectedCategory,
  ]);

  const visibleCounts = useMemo(() => countQuestionsByCategory(filteredQuestions), [filteredQuestions]);
  const selectableCategories = useMemo(
    () =>
      STUDY_CATEGORIES.filter(
        (category) => category !== "All" && (visibleCounts[category] ?? 0) > 0
      ),
    [visibleCounts]
  );

  const totalSetupCards = deckPreview.cards.length;
  const currentCard = sessionCards[0] ?? null;
  const total = sessionCards.length;
  const isCurrentCardRevealed =
    !!currentCard && flipped && revealedCardId === currentCard.id;
  const currentOptionPresentation =
    currentCard && sessionRunMode === "mcq"
      ? buildOptionPresentation(currentCard, `flashcards:${sessionStartedAt}`)
      : null;

  const resetMcqState = useCallback(() => {
    setMcqSelectedOption(null);
    setMcqConfidence(null);
    setMcqAnswerState("unanswered");
  }, []);

  const resetSession = useCallback(() => {
    setInitialDeckSize(0);
    setKnown(0);
    setLearning(0);
    setReviews(0);
    setFlipped(false);
    setRevealedCardId(null);
    setSessionStartedAt(0);
    setFigureRef(null);
    setSessionCards([]);
    resetMcqState();
    completionLoggedRef.current = false;
  }, [resetMcqState]);

  useEffect(() => {
    if (selectedCategory !== "All" && (visibleCounts[selectedCategory] ?? 0) === 0) {
      setSelectedCategory("All");
    }
  }, [selectedCategory, visibleCounts]);

  const beginSession = useCallback(() => {
    if (deckPreview.cards.length === 0) return;
    const startedAt = Date.now();
    for (const question of deckPreview.cards) {
      const canonicalKey = canonicalQuestionKey(question, {
        includeChoices: adaptive.config.includeChoicesInCanonicalKey,
      });
      if (!adaptive.statsByKey[canonicalKey]) {
        markFlashcardNewSeenToday(activeUserId, canonicalKey);
      }
    }
    setSessionCards(deckPreview.cards);
    setSessionStartedAt(startedAt);
    setSessionRunMode(selectedRunMode);
    setInitialDeckSize(deckPreview.cards.length);
    setKnown(0);
    setLearning(0);
    setReviews(0);
    setFlipped(false);
    setRevealedCardId(null);
    setFigureRef(null);
    resetMcqState();
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
        runMode: selectedRunMode,
      },
    });
  }, [
    activeUserId,
    adaptive.config.includeChoicesInCanonicalKey,
    adaptive.statsByKey,
    deckPreview,
    events,
    resetMcqState,
    selectedCategory,
    selectedQuestionType,
    selectedRunMode,
  ]);

  const handleToggleCard = useCallback(() => {
    if (!currentCard) return;
    setFlipped((prev) => {
      const next = !prev;
      setRevealedCardId(next ? currentCard.id : null);
      return next;
    });
  }, [currentCard]);
  const handleShowQuestion = useCallback(() => {
    setFlipped(false);
    setRevealedCardId(null);
  }, []);

  const handleRateCard = useCallback(
    (rating: "know_it" | "still_learning", confidence: AttemptConfidence) => {
      if (!currentCard) return;
      const isCorrect = rating === "know_it";
      const qualityScore = qualityFromOutcomeConfidence(
        isCorrect ? "correct" : "incorrect",
        confidence
      );
      const queueDecision = sessionQueueDecisionFromQuality(qualityScore);
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

      if (!isCorrect) {
        setLearning((n) => n + 1);
      } else if (queueDecision.removeFromQueue) {
        setKnown((n) => n + 1);
      }
      setReviews((n) => n + 1);
      setFlipped(false);
      setRevealedCardId(null);
      resetMcqState();
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
    [adaptive, currentCard, events, resetMcqState, selectedQuestionType]
  );

  const handleKnowIt = useCallback(() => {
    handleRateCard("know_it", 3);
  }, [handleRateCard]);

  const handleKnowItConfident = useCallback(() => {
    handleRateCard("know_it", 5);
  }, [handleRateCard]);

  const handleStillLearning = useCallback(() => {
    handleRateCard("still_learning", 3);
  }, [handleRateCard]);

  const handleStillLearningConfident = useCallback(() => {
    handleRateCard("still_learning", 5);
  }, [handleRateCard]);

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
    setRevealedCardId(null);
    resetMcqState();
    setSessionCards((prev) => {
      if (prev.length <= 1) return prev;
      const [head, ...rest] = prev;
      return [...rest, head];
    });
  }, [currentCard, events, resetMcqState, selectedQuestionType]);

  const restart = useCallback(() => {
    const startedAt = Date.now();
    setSessionCards(deckPreview.cards);
    setSessionStartedAt(startedAt);
    setInitialDeckSize(deckPreview.cards.length);
    setKnown(0);
    setLearning(0);
    setReviews(0);
    setFlipped(false);
    setRevealedCardId(null);
    setFigureRef(null);
    resetMcqState();
    completionLoggedRef.current = false;
  }, [deckPreview.cards, resetMcqState]);

  const commitMcqAnswer = useCallback(() => {
    if (!currentCard || !mcqSelectedOption || !mcqConfidence) return;

    const isCorrect = mcqSelectedOption === currentCard.correct_option_id;
    const qualityScore = qualityFromOutcomeConfidence(
      isCorrect ? "correct" : "incorrect",
      mcqConfidence
    );
    const queueDecision = sessionQueueDecisionFromQuality(qualityScore);
    const responseTimeMs = Math.max(0, Date.now() - questionShownAtRef.current);

    recordLearningAttempt({
      adaptive,
      events,
      question: currentCard,
      learningMode: "flashcards",
      attemptMode: "flashcard",
      isCorrect,
      selectedOptionId: mcqSelectedOption,
      responseTimeMs,
      confidence: mcqConfidence,
      questionTypeProfile: selectedQuestionType,
      metadata: {
        rating: isCorrect ? "know_it" : "still_learning",
        qualityScore,
        queueAction: queueDecision.removeFromQueue
          ? "remove"
          : `reinsert_${queueDecision.gapMin}-${queueDecision.gapMax}`,
        runMode: "mcq",
      },
    });

    if (queueDecision.removeFromQueue) {
      setKnown((n) => n + 1);
    } else {
      setLearning((n) => n + 1);
    }
    setReviews((n) => n + 1);
    setFlipped(false);
    setRevealedCardId(null);
    resetMcqState();
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
  }, [
    adaptive,
    currentCard,
    events,
    mcqConfidence,
    mcqSelectedOption,
    resetMcqState,
    selectedQuestionType,
  ]);

  const handleMcqAnswer = useCallback(
    (optionId: OptionId, confidence: AttemptConfidence) => {
      if (!currentCard) return;
      setMcqSelectedOption(optionId);
      setMcqConfidence(confidence);
      setMcqAnswerState(optionId === currentCard.correct_option_id ? "correct" : "incorrect");
      setFlipped(true);
      setRevealedCardId(currentCard.id);
    },
    [currentCard]
  );

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

      if (sessionRunMode === "flip" && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        handleToggleCard();
        return;
      }
      if (sessionRunMode === "mcq" && !isCurrentCardRevealed && currentOptionPresentation) {
        const normalizedKey = e.key.toLowerCase();
        const optionIndex =
          normalizedKey === "a" || normalizedKey === "1"
            ? 0
            : normalizedKey === "b" || normalizedKey === "2"
            ? 1
            : normalizedKey === "c" || normalizedKey === "3"
            ? 2
            : -1;
        if (optionIndex >= 0) {
          const targetOption = currentOptionPresentation.options[optionIndex];
          if (targetOption) {
            e.preventDefault();
            handleMcqAnswer(targetOption.id, 3);
            return;
          }
        }
      }
      if (isCurrentCardRevealed && (e.key === "ArrowRight" || e.key === "k")) {
        if (sessionRunMode === "mcq") {
          commitMcqAnswer();
        } else {
          handleKnowIt();
        }
        return;
      }
      if (isCurrentCardRevealed && (e.key === "ArrowLeft" || e.key === "l")) {
        if (sessionRunMode === "flip") {
          handleStillLearning();
        }
      }
      if (sessionRunMode === "mcq" && isCurrentCardRevealed && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        commitMcqAnswer();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    commitMcqAnswer,
    currentOptionPresentation,
    handleKnowIt,
    handleMcqAnswer,
    handleStillLearning,
    handleToggleCard,
    isCurrentCardRevealed,
    sessionRunMode,
    started,
  ]);

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

        {/* Question type selector */}
        {totalSetupCards === 0 && <QuestionSelectionEmptyState context="flashcards" />}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Study Style</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {FLASHCARD_RUN_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedRunMode(opt.value)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedRunMode === opt.value
                    ? "border-brand-500/60 bg-brand-500/10"
                    : "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/30"
                }`}
              >
                <div className="text-sm font-semibold text-white">{opt.title}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Question Pool</div>
          <div className="grid gap-2">
            {QUESTION_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedQuestionType(opt.value)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedQuestionType === opt.value
                    ? "border-brand-500/60 bg-brand-500/10"
                    : "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/30"
                }`}
              >
                <div className="text-sm font-semibold text-white">{opt.title}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>

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
            {selectableCategories.map((cat) => (
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

        <button
          onClick={beginSession}
          disabled={totalSetupCards === 0}
          className="w-full rounded-xl bg-brand-600 py-4 text-lg font-semibold text-white transition-all hover:bg-brand-700 hover:scale-[1.02] disabled:opacity-60"
        >
          Start Flashcards ({totalSetupCards} cards) →
        </button>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Standalone Stacks</div>
          <p className="text-xs text-[var(--muted)]">
            Flashcard drills that live alongside the main deck setup, but use their own memorization flow.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/acronyms"
              className="group flex items-center gap-4 rounded-xl border border-sky-500/30 bg-sky-500/10 p-5 transition-all hover:border-sky-500/60 hover:scale-[1.01]"
            >
              <span className="text-3xl">🧾</span>
              <div>
                <div className="text-lg font-semibold text-white">FAA Acronyms</div>
                <div className="mt-0.5 text-sm text-[var(--muted)]">
                  RPIC, LAANC, NOTAM, TFR, VLOS, FRIA, METAR, TAF
                </div>
                <div className="mt-1 text-xs text-sky-400">
                  Drill the shorthand used across Part 107 questions →
                </div>
              </div>
            </Link>
            <Link
              href="/phonetic"
              className="group flex items-center gap-4 rounded-xl border border-violet-500/30 bg-violet-500/10 p-5 transition-all hover:border-violet-500/60 hover:scale-[1.01]"
            >
              <span className="text-3xl">🔤</span>
              <div>
                <div className="text-lg font-semibold text-white">NATO Phonetic Alphabet</div>
                <div className="mt-0.5 text-sm text-[var(--muted)]">
                  26 letters + 10 digits · pronunciation · reference table
                </div>
                <div className="mt-1 text-xs text-violet-400">
                  Radio communication flash drill →
                </div>
              </div>
            </Link>
          </div>
        </div>
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
          <button
            onClick={restart}
            className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Restart Deck
          </button>
          <button
            onClick={() => {
              setStarted(false);
              resetSession();
            }}
            className="flex-1 rounded-xl border border-[var(--card-border)] py-3 font-semibold text-[var(--muted)] hover:text-white"
          >
            Change Topic
          </button>
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
  const selectedOptionDisplayLabel =
    currentOptionPresentation && mcqSelectedOption
      ? getDisplayLabelForOption(currentOptionPresentation.displayLabelByOptionId, mcqSelectedOption)
      : null;
  const correctOptionDisplayLabel = currentOptionPresentation?.correctDisplayLabel ?? null;
  const selectedOptionText = getOptionTextById(q.options, mcqSelectedOption);
  const selectedDistractorExplanation =
    mcqSelectedOption && mcqAnswerState === "incorrect"
      ? q.explanation_distractors[mcqSelectedOption] ?? "That answer does not match the correct rule."
      : null;

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
        {!isCurrentCardRevealed && sessionRunMode === "flip" ? (
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
        ) : !isCurrentCardRevealed && sessionRunMode === "mcq" ? (
          <div className="min-h-[340px] rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-left">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-500">
              3-Choice Drill
            </div>
            <div className="text-lg leading-relaxed text-white">{q.question_text}</div>

            {(q.figure_reference || q.image_ref) && (
              <button
                type="button"
                onClick={() => {
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

            {currentOptionPresentation && (
              <div className="mt-6 space-y-3">
                <AnswerOptions
                  options={currentOptionPresentation.options}
                  mode="study"
                  selectedOption={mcqSelectedOption}
                  correctOptionId={q.correct_option_id}
                  displayLabelByOptionId={currentOptionPresentation.displayLabelByOptionId}
                  answerState="unanswered"
                  onSelect={(optionId) => handleMcqAnswer(optionId, 3)}
                  onSelectWithConfidence={handleMcqAnswer}
                  showConfidenceSplit
                  defaultConfidence={3}
                  confidentConfidence={5}
                />
                <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-3 text-center text-xs text-[var(--muted)]">
                  Click an answer or use <code>A-C</code> / <code>1-3</code>. Quick confidence buttons
                  submit `Not Sure`, `Neutral`, or `Confident`.
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {sessionRunMode === "flip" ? (
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
            ) : (
              <div className="min-h-[340px] rounded-2xl border border-brand-500/30 bg-[var(--card)] p-8 animate-slide-up">
                <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-400">
                  {mcqAnswerState === "correct" ? "Correct" : "Review"}
                </div>
                <div
                  className={`rounded-xl border p-4 text-sm ${
                    mcqAnswerState === "correct"
                      ? "border-green-500/30 bg-green-500/10 text-green-300"
                      : "border-red-500/30 bg-red-500/10 text-red-300"
                  }`}
                >
                  {mcqAnswerState === "correct" ? (
                    <div>
                      <strong>Correct.</strong> You picked{" "}
                      <strong>{selectedOptionDisplayLabel}</strong>
                      {selectedOptionText ? ` (${selectedOptionText})` : ""}.
                    </div>
                  ) : (
                    <div>
                      <strong>Incorrect.</strong> You picked{" "}
                      <strong>{selectedOptionDisplayLabel}</strong>
                      {selectedOptionText ? ` (${selectedOptionText})` : ""}. The correct answer is{" "}
                      <strong>{correctOptionDisplayLabel}</strong>
                      {correctOption?.text ? ` (${correctOption.text})` : ""}.
                    </div>
                  )}
                </div>
                {selectedDistractorExplanation && (
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-[var(--foreground)]/85">
                    {selectedDistractorExplanation}
                  </div>
                )}
                <div className="mt-4 text-sm leading-relaxed text-[var(--foreground)]/90">
                  {q.explanation_correct}
                </div>
                {q.citation && (
                  <div className="mt-4 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-xs text-[var(--muted)]">
                    📖 {q.citation}
                  </div>
                )}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={commitMcqAnswer}
                    className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action buttons — only visible when flipped */}
      {isCurrentCardRevealed && sessionRunMode === "flip" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <button
                onClick={handleStillLearning}
                className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-4 pr-12 text-center font-semibold text-amber-400 transition-all hover:scale-[1.02] hover:bg-amber-500/20"
              >
                📖 Still Learning
                <span className="mt-1 block text-xs text-[var(--muted)]">← or L key</span>
              </button>
              <button
                type="button"
                aria-label="Still Learning with high confidence"
                title="Still Learning with high confidence"
                onClick={handleStillLearningConfident}
                className="absolute right-2 top-2 rounded-md border border-amber-400/40 bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/30"
              >
                ☑
              </button>
            </div>
            <div className="relative">
              <button
                onClick={handleKnowIt}
                className="w-full rounded-xl border border-green-500/40 bg-green-500/10 py-4 pr-12 text-center font-semibold text-green-400 transition-all hover:scale-[1.02] hover:bg-green-500/20"
              >
                ✅ Know It
                <span className="mt-1 block text-xs text-[var(--muted)]">→ or K key</span>
              </button>
              <button
                type="button"
                aria-label="Know It with high confidence"
                title="Know It with high confidence"
                onClick={handleKnowItConfident}
                className="absolute right-2 top-2 rounded-md border border-green-400/40 bg-green-500/20 px-2 py-1 text-xs font-semibold text-green-200 hover:bg-green-500/30"
              >
                ☑
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-3 text-center text-xs text-[var(--muted)]">
            One click records confidence <code>3/5</code>. Tap <code>☑</code> for high confidence{" "}
            <code>5/5</code>.
          </div>
        </div>
      )}

      {/* Back to setup */}
      <div className="flex justify-between text-sm">
        <button
          onClick={() => {
            setStarted(false);
            resetSession();
          }}
          className="text-[var(--muted)] hover:text-white transition-colors"
        >
          ← Change Topic
        </button>
        <button
          onClick={handleSkip}
          className="text-[var(--muted)] hover:text-white transition-colors"
        >
          Skip →
        </button>
      </div>

      {figureRef && (
        <ReferenceModal ref_={figureRef} onClose={() => setFigureRef(null)} />
      )}
    </div>
  );
}
