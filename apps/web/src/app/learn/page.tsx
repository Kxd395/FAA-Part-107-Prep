"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  filterQuestionsByType,
  qualityFromOutcomeConfidence,
  sessionQueueDecisionFromQuality,
  type AttemptConfidence,
  type OptionId,
  type Question,
  type QuestionTypeProfile,
} from "@part107/core";
import { useAdaptiveQuestionStats } from "../../hooks/useAdaptiveQuestionStats";
import {
  QuestionBankError,
  QuestionBankLoading,
  QuestionBankWarning,
} from "../../components/QuestionBankState";
import { QuestionSelectionEmptyState } from "../../components/QuestionSelectionEmptyState";
import { useProgress } from "../../hooks/useProgress";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import {
  clearLearnDraft,
  loadLearnDraft,
  saveLearnDraft,
  type LearnDraft,
  type LearnDraftQuizResult,
} from "../../lib/learnDraftStore";
import { useLearningEventLogger } from "../../hooks/useLearningEventLogger";
import {
  buildOptionPresentation,
  getDisplayLabelForOption,
  getOptionTextById,
} from "../../lib/optionPresentation";
import { reinsertQueueHeadWithGap } from "../../lib/queueReinsertion";
import { STUDY_CATEGORIES, countQuestionsByCategory } from "../../lib/questionBank";
import { recordLearningAttempt } from "../../lib/learningAttemptPipeline";

// ─── Question type options (shared pattern) ───
const QUESTION_TYPE_OPTIONS: Array<{
  value: QuestionTypeProfile;
  title: string;
  description: string;
}> = [
  { value: "confirmed_test", title: "✅ Confirmed Test Questions", description: "Only real-exam questions (66)." },
  { value: "all_random", title: "🎲 All Questions", description: "Full 85-question direct exam-style pool." },
  { value: "real_exam", title: "Real Exam MCQ", description: "Excludes ACS drill format." },
  { value: "weak_spots", title: "🔥 Weak Spots", description: "Questions you still struggle with." },
];

type LearnPhase = "setup" | "teach" | "quiz" | "result";
const QUIZ_REINSERT_MIN_GAP = 2;
const QUIZ_REINSERT_MAX_GAP = 5;
const LEARN_QUIZ_ID_PREFIX = "learn-round";
const LEARN_QUIZ_DEFAULT_CONFIDENCE: AttemptConfidence = 3;

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface LearnQuizSummary {
  firstPassResults: LearnDraftQuizResult[];
  latestResults: LearnDraftQuizResult[];
  firstPassCorrect: number;
  masteredCount: number;
  uniqueQuestions: number;
  attempts: number;
}

function summarizeLearnQuizResults(results: LearnDraftQuizResult[]): LearnQuizSummary {
  const firstByQuestion = new Map<string, LearnDraftQuizResult>();
  const latestByQuestion = new Map<string, LearnDraftQuizResult>();

  for (const result of results) {
    if (!firstByQuestion.has(result.questionId)) {
      firstByQuestion.set(result.questionId, result);
    }
    latestByQuestion.set(result.questionId, result);
  }

  const firstPassResults = Array.from(firstByQuestion.values());
  const latestResults = Array.from(latestByQuestion.values());
  const firstPassCorrect = firstPassResults.filter((result) => result.correct).length;
  const masteredCount = latestResults.filter((result) => result.correct).length;

  return {
    firstPassResults,
    latestResults,
    firstPassCorrect,
    masteredCount,
    uniqueQuestions: firstPassResults.length,
    attempts: results.length,
  };
}

export default function LearnPage() {
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
  const adaptive = useAdaptiveQuestionStats();
  const events = useLearningEventLogger(adaptive.userId);
  const { saveSession } = useProgress();

  // Setup state
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionTypeProfile>("confirmed_test");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [batchSize, setBatchSize] = useState(5);

  // Session state
  const [phase, setPhase] = useState<LearnPhase>("setup");
  const [batch, setBatch] = useState<Question[]>([]);
  const [teachIndex, setTeachIndex] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizOrder, setQuizOrder] = useState<Question[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [selectedConfidence, setSelectedConfidence] = useState<AttemptConfidence | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [quizResults, setQuizResults] = useState<LearnDraftQuizResult[]>([]);
  const [round, setRound] = useState(1);
  const [roundStartedAt, setRoundStartedAt] = useState<number>(Date.now());
  const [resumeDraft, setResumeDraft] = useState<LearnDraft | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [savedProgressSignature, setSavedProgressSignature] = useState<string | null>(null);
  const quizQuestionShownAtRef = useRef(Date.now());
  const completionEventSignatureRef = useRef<string | null>(null);

  // Filtering
  const filteredQuestions = useMemo(
    () =>
      filterQuestionsByType(allQuestions, selectedQuestionType, {
        userStatsByKey: adaptive.statsByKey,
        adaptiveConfig: adaptive.config,
      }),
    [adaptive.config, adaptive.statsByKey, allQuestions, selectedQuestionType]
  );

  const categoryQuestions = useMemo(() => {
    return selectedCategory === "All"
      ? filteredQuestions
      : filteredQuestions.filter((q) => q.category === selectedCategory);
  }, [filteredQuestions, selectedCategory]);

  const visibleCounts = useMemo(() => countQuestionsByCategory(filteredQuestions), [filteredQuestions]);
  const questionById = useMemo(
    () => new Map(allQuestions.map((question) => [question.id, question])),
    [allQuestions]
  );
  const teachQuestion = phase === "teach" ? (batch[teachIndex] ?? null) : null;
  const quizQuestion = phase === "quiz" ? (quizOrder[0] ?? null) : null;
  const teachOptionPresentation = useMemo(
    () =>
      teachQuestion
        ? buildOptionPresentation(teachQuestion, `learn:${roundStartedAt}`)
        : null,
    [roundStartedAt, teachQuestion]
  );
  const quizOptionPresentation = useMemo(
    () =>
      quizQuestion ? buildOptionPresentation(quizQuestion, `learn:${roundStartedAt}`) : null,
    [quizQuestion, roundStartedAt]
  );

  const buildProgressSignature = useCallback(
    (results: LearnDraftQuizResult[]) => {
      const summary = summarizeLearnQuizResults(results);
      return `${round}:${summary.firstPassResults.length}:${summary.firstPassResults
        .map((result) => `${result.questionId}:${result.userAnswer ?? "?"}`)
        .join("|")}`;
    },
    [round]
  );

  const persistLearnProgress = useCallback(
    (results: LearnDraftQuizResult[]) => {
      const summary = summarizeLearnQuizResults(results);
      if (summary.firstPassResults.length === 0) return;

      const signature = buildProgressSignature(results);
      if (savedProgressSignature === signature) return;

      saveSession({
        mode: "study",
        category: selectedCategory,
        questionTypeProfile: selectedQuestionType,
        score: summary.firstPassCorrect,
        total: summary.firstPassResults.length,
        timeSpentMs: Math.max(0, Date.now() - roundStartedAt),
        questions: summary.firstPassResults.map((result) => ({
          questionId: result.questionId,
          userAnswer: (result.userAnswer as OptionId | null) ?? null,
          correctAnswer: result.correctAnswer as OptionId,
          isCorrect: result.correct,
          category: result.category,
        })),
      });
      setSavedProgressSignature(signature);
    },
    [
      buildProgressSignature,
      roundStartedAt,
      saveSession,
      savedProgressSignature,
      selectedCategory,
      selectedQuestionType,
    ]
  );

  const persistDraft = useCallback(
    (
      nextPhase: LearnPhase,
      override: Partial<{
        batch: Question[];
        teachIndex: number;
        quizOrder: Question[];
        quizIndex: number;
      selectedAnswer: string | null;
      selectedConfidence: AttemptConfidence | null;
      showResult: boolean;
        quizResults: LearnDraftQuizResult[];
        round: number;
        roundStartedAt: number;
      }> = {}
    ) => {
      if (nextPhase === "setup") return;

      const draft: LearnDraft = {
        version: 1,
        updatedAt: new Date().toISOString(),
        selectedQuestionType,
        selectedCategory,
        batchSize,
        round: override.round ?? round,
        phase: nextPhase,
        batchIds: (override.batch ?? batch).map((q) => q.id),
        teachIndex: override.teachIndex ?? teachIndex,
        quizOrderIds: (override.quizOrder ?? quizOrder).map((q) => q.id),
        quizIndex: override.quizIndex ?? quizIndex,
        selectedAnswer: override.selectedAnswer ?? selectedAnswer,
        selectedConfidence: override.selectedConfidence ?? selectedConfidence,
        showResult: override.showResult ?? showResult,
        quizResults: override.quizResults ?? quizResults,
        roundStartedAt: override.roundStartedAt ?? roundStartedAt,
      };

      saveLearnDraft(draft);
      setResumeDraft(draft);
    },
    [
      batch,
      batchSize,
      quizIndex,
      quizOrder,
      quizResults,
      round,
      roundStartedAt,
      selectedAnswer,
      selectedConfidence,
      selectedCategory,
      selectedQuestionType,
      showResult,
      teachIndex,
    ]
  );

  const handleDiscardSavedSession = useCallback(() => {
    clearLearnDraft();
    setResumeDraft(null);
  }, []);

  const handleResumeSavedSession = useCallback(() => {
    if (!resumeDraft) return;

    const restoredBatch = resumeDraft.batchIds
      .map((id) => questionById.get(id))
      .filter((question): question is Question => !!question);
    const restoredQuizOrder = resumeDraft.quizOrderIds
      .map((id) => questionById.get(id))
      .filter((question): question is Question => !!question);

    if (
      restoredBatch.length !== resumeDraft.batchIds.length ||
      restoredQuizOrder.length !== resumeDraft.quizOrderIds.length
    ) {
      clearLearnDraft();
      setResumeDraft(null);
      return;
    }

    setSelectedQuestionType(resumeDraft.selectedQuestionType);
    setSelectedCategory(resumeDraft.selectedCategory);
    setBatchSize(resumeDraft.batchSize);
    setRound(resumeDraft.round);
    setRoundStartedAt(resumeDraft.roundStartedAt);
    setBatch(restoredBatch);
    setTeachIndex(Math.max(0, Math.min(resumeDraft.teachIndex, Math.max(0, restoredBatch.length - 1))));
    const resumeIndex = Math.max(0, Math.min(resumeDraft.quizIndex, Math.max(0, restoredQuizOrder.length - 1)));
    const normalizedQuizQueue =
      restoredQuizOrder.length === 0
        ? restoredQuizOrder
        : [...restoredQuizOrder.slice(resumeIndex), ...restoredQuizOrder.slice(0, resumeIndex)];
    setQuizOrder(normalizedQuizQueue);
    setQuizIndex(0);
    setSelectedAnswer(resumeDraft.selectedAnswer);
    setSelectedConfidence(resumeDraft.selectedConfidence ?? null);
    setShowResult(resumeDraft.showResult);
    setQuizResults(resumeDraft.quizResults);
    setPhase(resumeDraft.phase);
    events.logEvent({
      type: "session_resumed",
      mode: "learn",
      category: resumeDraft.selectedCategory,
      questionTypeProfile: resumeDraft.selectedQuestionType,
      metadata: {
        phase: resumeDraft.phase,
        round: resumeDraft.round,
        batchSize: resumeDraft.batchSize,
        quizQueueSize: restoredQuizOrder.length,
      },
    });
  }, [events, questionById, resumeDraft]);

  const handleSaveAndExit = useCallback(() => {
    events.logEvent({
      type: "session_saved",
      mode: "learn",
      category: selectedCategory,
      questionTypeProfile: selectedQuestionType,
      metadata: {
        phase,
        round,
        batchSize,
        teachIndex,
        quizQueueSize: quizOrder.length,
        attempts: quizResults.length,
      },
    });
    persistLearnProgress(quizResults);
    persistDraft(phase);
    setPhase("setup");
  }, [
    batchSize,
    events,
    persistDraft,
    persistLearnProgress,
    phase,
    quizOrder.length,
    quizResults,
    round,
    selectedCategory,
    selectedQuestionType,
    teachIndex,
  ]);

  const handleBackToSetup = useCallback(() => {
    handleDiscardSavedSession();
    setPhase("setup");
    setBatch([]);
    setTeachIndex(0);
    setQuizOrder([]);
    setQuizIndex(0);
    setSelectedAnswer(null);
    setSelectedConfidence(null);
    setShowResult(false);
    setQuizResults([]);
    setRound(1);
    setRoundStartedAt(Date.now());
    setSavedProgressSignature(null);
  }, [handleDiscardSavedSession]);

  useEffect(() => {
    if (!loaded || draftHydrated) return;
    setResumeDraft(loadLearnDraft());
    setDraftHydrated(true);
  }, [draftHydrated, loaded]);

  useEffect(() => {
    if (!draftHydrated || phase === "setup") return;
    persistDraft(phase);
  }, [
    batch,
    draftHydrated,
    persistDraft,
    phase,
    quizIndex,
    quizOrder,
    quizResults,
    round,
    roundStartedAt,
    selectedAnswer,
    selectedConfidence,
    showResult,
    teachIndex,
  ]);

  useEffect(() => {
    if (phase !== "result") return;
    persistLearnProgress(quizResults);
  }, [persistLearnProgress, phase, quizResults]);

  useEffect(() => {
    if (phase !== "teach") return;
    const current = batch[teachIndex];
    if (!current) return;

    events.logEvent({
      type: "question_shown",
      mode: "learn",
      questionId: current.id,
      category: current.category,
      subcategory: current.subcategory,
      questionTypeProfile: selectedQuestionType,
      metadata: {
        phase: "teach",
        round,
        teachIndex,
      },
    });
  }, [batch, events, phase, round, selectedQuestionType, teachIndex]);

  useEffect(() => {
    if (phase !== "quiz" || showResult || quizOrder.length === 0) return;
    quizQuestionShownAtRef.current = Date.now();
    const current = quizOrder[0];
    if (!current) return;

    events.logEvent({
      type: "question_shown",
      mode: "learn",
      questionId: current.id,
      category: current.category,
      subcategory: current.subcategory,
      questionTypeProfile: selectedQuestionType,
      metadata: {
        phase: "quiz",
        round,
        quizQueueSize: quizOrder.length,
      },
    });
  }, [events, phase, quizOrder, round, selectedQuestionType, showResult]);

  useEffect(() => {
    if (phase !== "quiz" || !showResult) return;
    const current = quizOrder[0];
    if (!current) return;

    events.logEvent({
      type: "review_opened",
      mode: "learn",
      questionId: current.id,
      category: current.category,
      subcategory: current.subcategory,
      isCorrect: selectedAnswer === current.correct_option_id,
      questionTypeProfile: selectedQuestionType,
      metadata: {
        phase: "quiz",
        round,
      },
    });
  }, [events, phase, quizOrder, round, selectedAnswer, selectedQuestionType, showResult]);

  useEffect(() => {
    if (phase !== "result") return;
    const summary = summarizeLearnQuizResults(quizResults);
    const signature = `${round}:${summary.uniqueQuestions}:${summary.firstPassCorrect}:${summary.masteredCount}:${summary.attempts}`;
    if (completionEventSignatureRef.current === signature) return;
    completionEventSignatureRef.current = signature;

    events.logEvent({
      type: "session_completed",
      mode: "learn",
      category: selectedCategory,
      questionTypeProfile: selectedQuestionType,
      metadata: {
        round,
        firstPassCorrect: summary.firstPassCorrect,
        masteredCount: summary.masteredCount,
        uniqueQuestions: summary.uniqueQuestions,
        attempts: summary.attempts,
      },
    });
  }, [events, phase, quizResults, round, selectedCategory, selectedQuestionType]);

  // Start a new learn round
  const startRound = useCallback(
    (roundNum: number) => {
      const offset = (roundNum - 1) * batchSize;
      const nextBatch = shuffleArray(categoryQuestions).slice(offset, offset + batchSize);
      if (nextBatch.length === 0) return;
      setBatch(nextBatch);
      setTeachIndex(0);
      setQuizOrder([]);
      setQuizIndex(0);
      setSelectedAnswer(null);
      setSelectedConfidence(null);
      setShowResult(false);
      setQuizResults([]);
      setPhase("teach");
      setRound(roundNum);
      setRoundStartedAt(Date.now());
      setSavedProgressSignature(null);
      completionEventSignatureRef.current = null;
      events.logEvent({
        type: "session_started",
        mode: "learn",
        category: selectedCategory,
        questionTypeProfile: selectedQuestionType,
        metadata: {
          round: roundNum,
          batchSize,
          roundQuestionCount: nextBatch.length,
          availableQuestionCount: categoryQuestions.length,
        },
      });
    },
    [batchSize, categoryQuestions, events, selectedCategory, selectedQuestionType]
  );

  const startQuizPhase = useCallback(() => {
    setQuizOrder(shuffleArray(batch));
    setQuizIndex(0);
    setSelectedAnswer(null);
    setSelectedConfidence(null);
    setShowResult(false);
    setQuizResults([]);
    setPhase("quiz");
  }, [batch]);

  const skipTeachQuestion = useCallback(() => {
    const current = batch[teachIndex];
    if (current) {
      events.logEvent({
        type: "question_skipped",
        mode: "learn",
        questionId: current.id,
        category: current.category,
        subcategory: current.subcategory,
        questionTypeProfile: selectedQuestionType,
        metadata: {
          phase: "teach",
          round,
        },
      });
    }
    if (batch.length <= 1) return;
    setBatch((prev) => {
      if (teachIndex < 0 || teachIndex >= prev.length) return prev;
      const next = [...prev];
      const [skipped] = next.splice(teachIndex, 1);
      if (!skipped) return prev;
      next.push(skipped);
      return next;
    });
    setTeachIndex((prev) => (prev >= batch.length - 1 ? 0 : prev));
  }, [batch, events, round, selectedQuestionType, teachIndex]);

  const submitQuizAnswerWithConfidence = useCallback(
    (confidence: AttemptConfidence) => {
      if (showResult || !selectedAnswer) return;
      setSelectedConfidence(confidence);
      setShowResult(true);
      const q = quizOrder[0];
      if (!q) return;
      const isCorrect = selectedAnswer === q.correct_option_id;
      const qualityScore = qualityFromOutcomeConfidence(
        isCorrect ? "correct" : "incorrect",
        confidence
      );
      const responseTimeMs = Math.max(0, Date.now() - quizQuestionShownAtRef.current);
      recordLearningAttempt({
        adaptive,
        events,
        question: q,
        learningMode: "learn",
        attemptMode: "quiz",
        isCorrect,
        selectedOptionId: selectedAnswer as OptionId,
        responseTimeMs,
        quizId: `${LEARN_QUIZ_ID_PREFIX}-${round}`,
        confidence,
        questionTypeProfile: selectedQuestionType,
        metadata: {
          round,
          quizQueueSize: quizOrder.length,
          qualityScore,
        },
      });
      setQuizResults((prev) => [
        ...prev,
        {
          questionId: q.id,
          correct: isCorrect,
          userAnswer: selectedAnswer,
          correctAnswer: q.correct_option_id,
          category: q.category,
        },
      ]);
    },
    [adaptive, events, quizOrder, round, selectedAnswer, selectedQuestionType, showResult]
  );

  const skipQuizQuestion = useCallback(() => {
    if (showResult || quizOrder.length <= 1) return;
    const current = quizOrder[0];
    if (current) {
      events.logEvent({
        type: "question_skipped",
        mode: "learn",
        questionId: current.id,
        category: current.category,
        subcategory: current.subcategory,
        questionTypeProfile: selectedQuestionType,
        metadata: {
          phase: "quiz",
          round,
          quizQueueSize: quizOrder.length,
        },
      });
    }

    setQuizOrder((prev) => {
      const [skipped, ...rest] = prev;
      if (!skipped) return prev;
      return [...rest, skipped];
    });
    setQuizIndex(0);
    setSelectedAnswer(null);
    setSelectedConfidence(null);
    setShowResult(false);
  }, [events, quizOrder, round, selectedQuestionType, showResult]);

  const advanceQuizQueue = useCallback(() => {
    if (!showResult) return;
    const currentQuestion = quizOrder[0];
    if (!currentQuestion) return;

    const wasCorrect = selectedAnswer === currentQuestion.correct_option_id;
    const qualityScore = qualityFromOutcomeConfidence(
      wasCorrect ? "correct" : "incorrect",
      selectedConfidence
    );
    const queueDecision = sessionQueueDecisionFromQuality(qualityScore);

    if (queueDecision.removeFromQueue && quizOrder.length <= 1) {
      setQuizOrder([]);
      setQuizIndex(0);
      setSelectedAnswer(null);
      setSelectedConfidence(null);
      setShowResult(false);
      setPhase("result");
      return;
    }

    setQuizOrder((prev) =>
      queueDecision.removeFromQueue
        ? prev.slice(1)
        : reinsertQueueHeadWithGap(
            prev,
            queueDecision.gapMin ?? QUIZ_REINSERT_MIN_GAP,
            queueDecision.gapMax ?? QUIZ_REINSERT_MAX_GAP
          )
    );
    setQuizIndex(0);
    setSelectedAnswer(null);
    setSelectedConfidence(null);
    setShowResult(false);
  }, [quizOrder, selectedAnswer, selectedConfidence, showResult]);

  // ─── Loading / Error ───
  if (loading && !loaded) {
    return <QuestionBankLoading label="Loading question bank..." />;
  }

  if (error && !loaded) {
    return <QuestionBankError error={error} onRetry={() => void reload()} />;
  }

  // ─── Setup ───
  if (phase === "setup") {
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
          <div className="text-5xl">🧠</div>
          <h1 className="mt-4 text-3xl font-bold">Learn Mode</h1>
          <p className="mt-2 text-[var(--muted)]">
            <strong>Read first, then test.</strong> You&apos;ll see each question with its correct answer
            and full explanation. Then you&apos;ll be quizzed on the same batch to lock it in.
          </p>
        </div>

        {resumeDraft && (
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-4 text-sm">
            <div className="font-semibold text-white">Saved Learn Session Found</div>
            <p className="mt-1 text-[var(--muted)]">
              Phase: {resumeDraft.phase} - Round {resumeDraft.round} - Updated{" "}
              {new Date(resumeDraft.updatedAt).toLocaleString()}
            </p>
            <div className="mt-3 flex gap-3">
              <button
                onClick={handleResumeSavedSession}
                className="rounded-lg bg-brand-600 px-3 py-2 font-semibold text-white hover:bg-brand-700"
              >
                Resume Session
              </button>
              <button
                onClick={handleDiscardSavedSession}
                className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-[var(--muted)] hover:text-white"
              >
                Discard Saved Session
              </button>
            </div>
          </div>
        )}

        {/* Batch size */}
        {categoryQuestions.length === 0 && <QuestionSelectionEmptyState context="learn" />}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-white">Questions per Round</div>
          <div className="flex gap-2">
            {[3, 5, 10, 15, 20].map((n) => (
              <button
                key={n}
                onClick={() => setBatchSize(n)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  batchSize === n
                    ? "bg-brand-500 text-white"
                    : "bg-[var(--card)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Question type */}
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

        {/* Category */}
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
              <div className="mt-1 text-xs text-[var(--muted)]">{filteredQuestions.length} questions</div>
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
                <div className="mt-1 text-xs text-[var(--muted)]">{visibleCounts[cat] ?? 0} questions</div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            handleDiscardSavedSession();
            startRound(1);
          }}
          disabled={categoryQuestions.length === 0}
          className="w-full rounded-xl bg-brand-600 py-4 text-lg font-semibold text-white transition-all hover:bg-brand-700 hover:scale-[1.02] disabled:opacity-60"
        >
          Start Learning ({Math.min(batchSize, categoryQuestions.length)} questions) →
        </button>
      </div>
    );
  }

  // ─── Teach Phase ───
  if (phase === "teach") {
    const q = batch[teachIndex];
    const progress = ((teachIndex + 1) / batch.length) * 100;

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
        {/* Header */}
        <div className="flex items-center justify-between text-sm text-[var(--muted)]">
          <span>
            📖 Learning {teachIndex + 1} of {batch.length}
          </span>
          <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">
            Round {round}
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--card-border)]">
          <div className="h-2 rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Question + Answer */}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">
                {q.category}
              </span>
              {q.acs_code && (
                <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
                  {q.acs_code}
                </span>
              )}
            </div>
            <div className="text-lg leading-relaxed text-white">{q.question_text}</div>
          </div>

          {/* All options with correct highlighted */}
          <div className="space-y-2">
            {(teachOptionPresentation?.options ?? q.options).map((opt) => {
              const isCorrect = opt.id === q.correct_option_id;
              const displayLabel = teachOptionPresentation?.displayLabelByOptionId[opt.id] ?? opt.id;
              return (
                <div
                  key={opt.id}
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    isCorrect
                      ? "border-green-500/50 bg-green-500/10 text-green-300"
                      : "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)]"
                  }`}
                >
                  <span className="font-semibold">{displayLabel}.</span> {opt.text}
                  {isCorrect && <span className="ml-2">✅</span>}
                </div>
              );
            })}
          </div>

          {/* Explanation */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Why this is correct
            </div>
            <div className="text-sm leading-relaxed text-[var(--foreground)]/90">
              {q.explanation_correct}
            </div>
          </div>

          {/* Why distractors are wrong */}
          {Object.entries(q.explanation_distractors).length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Why other answers are wrong
              </div>
              {(teachOptionPresentation?.options ?? q.options).map((opt) => {
                if (opt.id === q.correct_option_id) return null;
                const distractorExplanation = q.explanation_distractors[opt.id];
                if (!distractorExplanation) return null;
                const displayLabel = teachOptionPresentation?.displayLabelByOptionId[opt.id] ?? opt.id;

                return (
                  <div key={opt.id} className="text-sm text-[var(--muted)]">
                    <span className="font-semibold text-amber-300">{displayLabel}.</span>{" "}
                    {distractorExplanation}
                  </div>
                );
              })}
            </div>
          )}

          {/* Citation */}
          {q.citation && (
            <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-xs text-[var(--muted)]">
              📖 {q.citation}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="space-y-3">
          <div className="flex gap-3">
            {teachIndex > 0 && (
              <button
                onClick={() => setTeachIndex((i) => i - 1)}
                className="flex-1 rounded-xl border border-[var(--card-border)] py-3 font-semibold text-[var(--muted)] hover:text-white"
              >
                ← Previous
              </button>
            )}
            {teachIndex < batch.length - 1 ? (
              <button
                onClick={() => setTeachIndex((i) => i + 1)}
                className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={startQuizPhase}
                className="flex-1 rounded-xl bg-purple-600 py-3 font-semibold text-white hover:bg-purple-700"
              >
                🧪 Now Quiz Me on These →
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={skipTeachQuestion}
              className="flex-1 rounded-xl border border-[var(--card-border)] py-2.5 text-sm text-[var(--muted)] hover:text-white"
            >
              Skip for now →
            </button>
            <button
              onClick={handleSaveAndExit}
              className="flex-1 rounded-xl border border-brand-500/30 bg-brand-500/10 py-2.5 text-sm font-medium text-brand-300 hover:bg-brand-500/20"
            >
              Save & Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Quiz Phase ───
  if (phase === "quiz") {
    const q = quizOrder[0];
    const masteredCount = Math.max(0, batch.length - quizOrder.length);
    const progress = batch.length > 0 ? (masteredCount / batch.length) * 100 : 0;
    const isCurrentCorrect = !!q && selectedAnswer === q.correct_option_id;

    if (!q) {
      return (
        <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center">
          <h1 className="text-xl font-semibold text-white">Quiz Queue Empty</h1>
          <p className="text-sm text-[var(--muted)]">
            No quiz items remain in this round. Continue to results.
          </p>
          <button
            onClick={() => setPhase("result")}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            See Results →
          </button>
        </div>
      );
    }

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
        <div className="flex items-center justify-between text-sm text-[var(--muted)]">
          <span>
            🧪 Mastered {masteredCount} of {batch.length}
          </span>
          <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-400">
            Round {round} — Remaining {quizOrder.length}
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--card-border)]">
          <div className="h-2 rounded-full bg-purple-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">
              {q.category}
            </span>
          </div>
          <div className="text-lg leading-relaxed text-white">{q.question_text}</div>

          <div className="space-y-2">
            {(quizOptionPresentation?.options ?? q.options).map((opt) => {
              const isCorrect = opt.id === q.correct_option_id;
              const isSelected = opt.id === selectedAnswer;
              const displayLabel = quizOptionPresentation?.displayLabelByOptionId[opt.id] ?? opt.id;
              let className =
                "rounded-xl border px-4 py-3 text-sm text-left w-full transition-all ";

              if (showResult) {
                if (isCorrect) {
                  className += "border-green-500/50 bg-green-500/10 text-green-300";
                } else if (isSelected && !isCorrect) {
                  className += "border-red-500/50 bg-red-500/10 text-red-300";
                } else {
                  className += "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] opacity-50";
                }
              } else {
                className += isSelected
                  ? "border-brand-500/50 bg-brand-500/10 text-white"
                  : "border-[var(--card-border)] bg-[var(--card)] text-white hover:border-brand-500/40 cursor-pointer";
              }

              return (
                <div key={opt.id} className="relative">
                  <button
                    onClick={() => {
                      if (showResult) return;
                      setSelectedAnswer(opt.id);
                      setSelectedConfidence(null);
                    }}
                    className={className}
                    disabled={showResult}
                  >
                    <span className="font-semibold">{displayLabel}.</span> {opt.text}
                    {showResult && isCorrect && <span className="ml-2">✅</span>}
                    {showResult && isSelected && !isCorrect && <span className="ml-2">❌</span>}
                  </button>
                </div>
              );
            })}
          </div>

          {!showResult && selectedAnswer && (
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
              <div className="text-sm font-semibold text-white">How confident are you? (before reveal)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => submitQuizAnswerWithConfidence(value as AttemptConfidence)}
                    className="rounded-lg border border-purple-400/40 bg-purple-500/10 px-3 py-1.5 text-sm text-purple-200 hover:bg-purple-500/20"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback after answering */}
          {showResult && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl border p-4 text-sm ${
                selectedAnswer === q.correct_option_id
                  ? "border-green-500/30 bg-green-500/10 text-green-300"
                  : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              {selectedAnswer === q.correct_option_id ? (
                <div>
                  <strong>Correct!</strong> {q.explanation_correct}
                </div>
              ) : (
                (() => {
                  const selectedDisplayLabel = getDisplayLabelForOption(
                    quizOptionPresentation?.displayLabelByOptionId ?? {},
                    (selectedAnswer as OptionId | null) ?? null
                  );
                  const correctDisplayLabel =
                    quizOptionPresentation?.correctDisplayLabel ?? q.correct_option_id;
                  const correctAnswerText = getOptionTextById(q.options, q.correct_option_id);

                  return (
                    <div>
                      <strong>Incorrect.</strong>{" "}
                      {q.explanation_distractors[selectedAnswer as keyof typeof q.explanation_distractors] ??
                        "That's not the right answer."}{" "}
                      The correct answer is <strong>{correctDisplayLabel}</strong>
                      {correctAnswerText ? ` (${correctAnswerText})` : ""}.{" "}
                      {selectedAnswer ? `You picked ${selectedDisplayLabel}. ` : ""}
                      {q.explanation_correct}
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {!showResult && (
            <button
              onClick={skipQuizQuestion}
              disabled={!!selectedAnswer}
              className="flex-1 rounded-xl border border-[var(--card-border)] py-2.5 text-sm text-[var(--muted)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Skip for now →
            </button>
          )}
          <button
            onClick={handleSaveAndExit}
            className="flex-1 rounded-xl border border-brand-500/30 bg-brand-500/10 py-2.5 text-sm font-medium text-brand-300 hover:bg-brand-500/20"
          >
            Save & Exit
          </button>
        </div>

        {showResult && (
          <div className="text-center text-xs text-[var(--muted)]">
            Confidence recorded: {selectedConfidence ?? LEARN_QUIZ_DEFAULT_CONFIDENCE}/5
          </div>
        )}

        {showResult && (
          <button
            onClick={advanceQuizQueue}
            className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
          >
            {isCurrentCorrect
              ? quizOrder.length <= 1
                ? "See Results →"
                : "Next Question →"
              : "Still Learning — Review Again →"}
          </button>
        )}
      </div>
    );
  }

  // ─── Result Phase ───
  const summary = summarizeLearnQuizResults(quizResults);
  const firstPassTotal = batch.length > 0 ? batch.length : summary.uniqueQuestions;
  const firstPassCorrect = summary.firstPassCorrect;
  const firstPassPct = firstPassTotal > 0 ? Math.round((firstPassCorrect / firstPassTotal) * 100) : 0;
  const masteredTotal = batch.length > 0 ? batch.length : summary.uniqueQuestions;
  const masteredCount = summary.masteredCount;
  const masteredPct = masteredTotal > 0 ? Math.round((masteredCount / masteredTotal) * 100) : 0;
  const retryCount = Math.max(0, summary.attempts - summary.uniqueQuestions);
  const perfectFirstPass = firstPassTotal > 0 && firstPassCorrect === firstPassTotal;
  const allMastered = masteredTotal > 0 && masteredCount === masteredTotal;

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-8 text-center">
      {warning && (
        <QuestionBankWarning
          warning={warning}
          snapshotInfo={snapshotInfo}
          onTryLive={() => void reload({ preferLive: true })}
          onClearSnapshot={clearSnapshot}
        />
      )}
      <div className="text-6xl">{perfectFirstPass ? "🎉" : allMastered ? "💪" : firstPassPct >= 70 ? "👍" : "📚"}</div>
      <h1 className="text-3xl font-bold">
        {perfectFirstPass ? "Perfect First Pass!" : allMastered ? "Mastered After Review!" : firstPassPct >= 70 ? "Good Progress!" : "Keep Practicing!"}
      </h1>
      <p className="text-[var(--muted)]">
        Round {round}: First-pass <strong>{firstPassCorrect}</strong> of <strong>{firstPassTotal}</strong>{" "}
        ({firstPassPct}%). Eventual mastery <strong>{masteredCount}</strong> of{" "}
        <strong>{masteredTotal}</strong> ({masteredPct}%).
      </p>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <div className="text-2xl font-bold text-green-400">{firstPassCorrect}</div>
          <div className="text-sm text-[var(--muted)]">First-pass Correct</div>
        </div>
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-4">
          <div className="text-2xl font-bold text-brand-300">{masteredCount}</div>
          <div className="text-sm text-[var(--muted)]">Mastered</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="text-2xl font-bold text-amber-300">{retryCount}</div>
          <div className="text-sm text-[var(--muted)]">Retries</div>
        </div>
      </div>

      <div className="flex gap-3">
        {!allMastered && (
          <button
            onClick={() => {
              // Re-teach only currently unmastered items (latest outcome incorrect).
              const missedIds = new Set(
                summary.latestResults
                  .filter((result) => !result.correct)
                  .map((result) => result.questionId)
              );
              const missedBatch = batch.filter((q) => missedIds.has(q.id));
              setBatch(missedBatch);
              setTeachIndex(0);
              setPhase("teach");
              setRoundStartedAt(Date.now());
              setSavedProgressSignature(null);
            }}
            className="flex-1 rounded-xl bg-amber-600 py-3 font-semibold text-white hover:bg-amber-700"
          >
            📖 Re-learn Missed ({masteredTotal - masteredCount})
          </button>
        )}
        <button
          onClick={() => startRound(round + 1)}
          disabled={round * batchSize >= categoryQuestions.length}
          className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Next Round →
        </button>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleSaveAndExit}
          className="w-full rounded-xl border border-brand-500/30 bg-brand-500/10 py-2.5 text-sm font-medium text-brand-300 hover:bg-brand-500/20"
        >
          Save & Exit
        </button>
        <button
          onClick={handleBackToSetup}
          className="block w-full text-sm text-[var(--muted)] hover:text-white transition-colors"
        >
          ← Back to Setup
        </button>
      </div>
    </div>
  );
}
