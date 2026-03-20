"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type AttemptConfidence,
  FULL_EXAM_QUESTION_COUNT,
  REAL_EXAM_BLUEPRINT_TARGETS,
  QUESTION_TYPE_PROFILE_LABELS,
  formatClockTime,
  type QuestionTypeProfile,
  useExamSession,
} from "@part107/core";
import CitationLinks, { ReferenceModal, type ResolvedReference } from "../../../components/ReferenceModal";
import {
  QuestionBankError,
  QuestionBankLoading,
  QuestionBankWarning,
} from "../../../components/QuestionBankState";
import { QuestionSelectionEmptyState } from "../../../components/QuestionSelectionEmptyState";
import AnswerOptions from "../../../components/quiz/AnswerOptions";
import ProgressHeader from "../../../components/quiz/ProgressHeader";
import QuestionCard from "../../../components/quiz/QuestionCard";
import QuestionIssueReporter from "../../../components/quiz/QuestionIssueReporter";
import SessionSummaryCard from "../../../components/quiz/SessionSummaryCard";
import { useActiveUserId } from "../../../hooks/useActiveUserId";
import { useAdaptiveQuestionStats } from "../../../hooks/useAdaptiveQuestionStats";
import { useLearningEventLogger } from "../../../hooks/useLearningEventLogger";
import { useProgress, type QuestionResult } from "../../../hooks/useProgress";
import { useQuestionBank } from "../../../hooks/useQuestionBank";
import { extractCitationText, mergeCitations } from "../../../lib/citationContext";
import {
  buildOptionPresentation,
  getDisplayLabelForOption,
  getOptionTextById,
} from "../../../lib/optionPresentation";
import {
  normalizeStandardPracticeQuestionTypeProfile,
  STANDARD_PRACTICE_QUESTION_TYPE_OPTIONS,
} from "../../../lib/questionTypeOptions";
import { recordLearningAttempt } from "../../../lib/learningAttemptPipeline";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Grid3X3,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";

const PASSING_PERCENT = 70;
const EXAM_DEFAULT_CONFIDENCE: AttemptConfidence = 3;
const EXAM_CONFIDENT_CONFIDENCE: AttemptConfidence = 5;

export default function V2ExamPage() {
  return (
    <Suspense fallback={<QuestionBankLoading label="Loading exam mode…" />}>
      <ExamPageClient />
    </Suspense>
  );
}

function ExamPageClient() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const questionTypeParam = searchParams.get("type");
  const invalidQuestionTypeParam =
    !!questionTypeParam && !normalizeStandardPracticeQuestionTypeProfile(questionTypeParam);
  const parsedQuestionType =
    normalizeStandardPracticeQuestionTypeProfile(questionTypeParam) ?? "all_random";
  const [selectedQuestionType, setSelectedQuestionType] =
    useState<QuestionTypeProfile>(parsedQuestionType);

  const activeUserId = useActiveUserId();
  const { saveSession } = useProgress(activeUserId);
  const adaptive = useAdaptiveQuestionStats(activeUserId);
  const events = useLearningEventLogger(adaptive.userId);
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

  const exam = useExamSession({
    allQuestions,
    passPercent: PASSING_PERCENT,
    initialQuestionTypeProfile: selectedQuestionType,
    adaptive: {
      userId: adaptive.userId,
      userStatsByKey: adaptive.statsByKey,
      config: adaptive.config,
    },
  });

  const [sessionSaved, setSessionSaved] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [figureRef, setFigureRef] = useState<ResolvedReference | null>(null);
  const [answerConfidenceByQuestionId, setAnswerConfidenceByQuestionId] = useState<
    Map<string, AttemptConfidence>
  >(new Map());
  const lastReviewLoggedStartRef = useRef<number | null>(null);

  /* ---- sync URL → state ---- */
  useEffect(() => {
    const nextType = normalizeStandardPracticeQuestionTypeProfile(questionTypeParam);
    if (!nextType) return;
    setSelectedQuestionType(nextType);
  }, [questionTypeParam]);

  /* ---- reset on new exam ---- */
  useEffect(() => {
    if (exam.phase === "in-progress") {
      setSessionSaved(false);
      setAnswerConfidenceByQuestionId(new Map());
    }
  }, [exam.phase, exam.startTime]);

  /* ---- log question shown ---- */
  useEffect(() => {
    if (exam.phase !== "in-progress" || !exam.currentQuestion) return;
    events.logEvent({
      type: "question_shown",
      mode: "exam",
      questionId: exam.currentQuestion.id,
      category: exam.currentQuestion.category,
      subcategory: exam.currentQuestion.subcategory,
      questionTypeProfile: exam.questionTypeProfile,
    });
  }, [events, exam.phase, exam.currentQuestion, exam.questionTypeProfile]);

  /* ---- log review opened ---- */
  useEffect(() => {
    if (exam.phase !== "review" || exam.questions.length === 0) return;
    if (lastReviewLoggedStartRef.current === exam.startTime) return;
    lastReviewLoggedStartRef.current = exam.startTime;
    events.logEvent({
      type: "review_opened",
      mode: "exam",
      category: exam.examCategory,
      questionTypeProfile: exam.questionTypeProfile,
      metadata: {
        scorePercent: exam.review.scorePercent,
        correctCount: exam.review.correctCount,
        totalQuestions: exam.questions.length,
      },
    });
  }, [
    events,
    exam.examCategory,
    exam.phase,
    exam.questionTypeProfile,
    exam.questions.length,
    exam.review.correctCount,
    exam.review.scorePercent,
    exam.startTime,
  ]);

  /* ---- answer handler ---- */
  const handleAnswerSelect = useCallback(
    (optionId: "A" | "B" | "C" | "D", confidence: AttemptConfidence = EXAM_DEFAULT_CONFIDENCE) => {
      if (!exam.currentQuestion) return;
      setAnswerConfidenceByQuestionId((prev) => {
        const next = new Map(prev);
        next.set(exam.currentQuestion!.id, confidence);
        return next;
      });
      recordLearningAttempt({
        adaptive,
        events,
        question: exam.currentQuestion,
        learningMode: "exam",
        attemptMode: "mock",
        isCorrect: optionId === exam.currentQuestion.correct_option_id,
        selectedOptionId: optionId,
        responseTimeMs: 0,
        confidence,
        questionTypeProfile: exam.questionTypeProfile,
        persistAdaptive: false,
      });
      exam.selectAnswer(optionId);
    },
    [adaptive, events, exam],
  );

  /* ---- persist session on review ---- */
  useEffect(() => {
    if (exam.phase !== "review" || sessionSaved || exam.questions.length === 0) return;

    adaptive.recordExamReview(
      exam.review.rows.map((row) => ({
        question: row.question,
        isCorrect: row.isCorrect,
        userAnswer: row.userAnswer,
        confidence: answerConfidenceByQuestionId.get(row.question.id) ?? null,
      })),
      Date.now(),
      { mode: "mock", quizId: String(exam.startTime) },
    );

    const questionResults: QuestionResult[] = exam.review.rows.map((row) => ({
      questionId: row.question.id,
      userAnswer: row.userAnswer,
      correctAnswer: row.question.correct_option_id,
      isCorrect: row.isCorrect,
      category: row.question.category,
    }));

    saveSession({
      mode: "exam",
      category: exam.examCategory,
      questionTypeProfile: exam.questionTypeProfile,
      score: exam.review.correctCount,
      total: exam.questions.length,
      timeSpentMs: exam.review.totalTimeMs,
      questions: questionResults,
    });

    setSessionSaved(true);
  }, [adaptive, answerConfidenceByQuestionId, exam, saveSession, sessionSaved]);

  /* ================================================================ */
  /*  Loading / Error gates                                           */
  /* ================================================================ */
  if (loading && !loaded) return <QuestionBankLoading label="Loading question bank…" />;
  if (error && !loaded) return <QuestionBankError error={error} onRetry={() => void reload()} />;

  /* ================================================================ */
  /*  SETUP phase                                                     */
  /* ================================================================ */
  if (exam.phase === "setup") {
    const preview = exam.getSetupPreview(categoryParam, selectedQuestionType);
    const timeDisplay =
      preview.category === "All"
        ? "2 Hours"
        : `${Math.round(preview.timeLimitMs / 60000)} min`;
    const fullRealExamShortfall =
      preview.category === "All" && preview.questionTypeProfile === "real_exam"
        ? Math.max(0, FULL_EXAM_QUESTION_COUNT - preview.questionCount)
        : 0;

    return (
      <div className="mx-auto max-w-lg space-y-8 px-4 pt-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/15">
            <Clock className="h-8 w-8 text-purple-400" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
            {preview.category === "All" ? "Practice Exam" : `${preview.category} Test`}
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            {preview.category === "All"
              ? "Simulates the real FAA Part 107 knowledge test. No feedback until the end."
              : `Test your knowledge of ${preview.category}. No feedback until the end.`}
          </p>
        </div>

        {/* Warnings */}
        {preview.invalidCategory && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Unknown category &quot;{categoryParam}&quot;. Falling back to full practice exam.
          </div>
        )}
        {invalidQuestionTypeParam && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Question type &quot;{questionTypeParam}&quot; is not available. Falling back to Real Exam MCQ.
          </div>
        )}

        {/* Question type picker */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-[var(--foreground)]">Question Type</div>
          <div className="grid gap-2">
            {STANDARD_PRACTICE_QUESTION_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedQuestionType(option.value)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedQuestionType === option.value
                    ? "border-brand-500/60 bg-brand-500/10"
                    : "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/30"
                }`}
              >
                <div className="text-sm font-semibold text-[var(--foreground)]">{option.title}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {fullRealExamShortfall > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Real UAG target is {FULL_EXAM_QUESTION_COUNT} questions. This pool has{" "}
            {preview.questionCount}, so this run is short by {fullRealExamShortfall}.
          </div>
        )}

        {/* Exam info card */}
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 space-y-4">
          {([
            ["Questions", String(preview.questionCount)],
            ["Time Limit", timeDisplay],
            ["Passing Score", "70%"],
            ["Feedback", "After submission only"],
            ["Type", QUESTION_TYPE_PROFILE_LABELS[preview.questionTypeProfile]],
          ] as const).map(([label, val]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">{label}</span>
              <span className={`font-medium ${label === "Feedback" ? "text-amber-400" : "text-[var(--foreground)]"}`}>
                {val}
              </span>
            </div>
          ))}
        </div>

        {/* Blueprint details */}
        {preview.category === "All" && preview.questionTypeProfile === "real_exam" && (
          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-xs text-[var(--muted)]">
            <div className="font-semibold text-[var(--foreground)]">Real Exam Blueprint (60Q target)</div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Regulations (15-25%)</span>
              <span className="text-right">{REAL_EXAM_BLUEPRINT_TARGETS.Regulations}</span>
              <span>Airspace (15-25%)</span>
              <span className="text-right">{REAL_EXAM_BLUEPRINT_TARGETS.Airspace}</span>
              <span>Weather (10-20%)</span>
              <span className="text-right">{REAL_EXAM_BLUEPRINT_TARGETS.Weather}</span>
              <span>Loading &amp; Perf (~10%)</span>
              <span className="text-right">{REAL_EXAM_BLUEPRINT_TARGETS["Loading & Performance"]}</span>
              <span>Operations (35-45%)</span>
              <span className="text-right">{REAL_EXAM_BLUEPRINT_TARGETS.Operations}</span>
            </div>
          </div>
        )}

        {/* Start button */}
        <button
          onClick={() => exam.startExam(preview.category, selectedQuestionType)}
          disabled={preview.questionCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-4 text-lg font-semibold text-white transition-all hover:bg-brand-700 hover:scale-[1.02] disabled:opacity-60"
        >
          {preview.category === "All" ? "Begin Exam" : `Begin ${preview.category} Test`}
          <ArrowRight className="h-5 w-5" />
        </button>

        {preview.questionCount === 0 && <QuestionSelectionEmptyState context="exam" />}

        {preview.category !== "All" && (
          <Link
            href="/v2/exam"
            className="block text-center text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            or take the full practice exam →
          </Link>
        )}
      </div>
    );
  }

  /* ================================================================ */
  /*  REVIEW phase                                                    */
  /* ================================================================ */
  if (exam.phase === "review") {
    return (
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        {/* Score hero */}
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-white/5 to-white/[0.02]">
            {exam.review.passed ? (
              <CheckCircle2 className="h-10 w-10 text-correct" />
            ) : (
              <XCircle className="h-10 w-10 text-incorrect" />
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
            {exam.review.passed ? "You Passed!" : "Not Quite — Keep Going!"}
          </h1>

          <SessionSummaryCard
            passed={exam.review.passed}
            percentage={exam.review.scorePercent}
            correct={exam.review.correctCount}
            total={exam.questions.length}
            subtitle={`Time used: ${formatClockTime(exam.review.totalTimeMs)}`}
          />

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => exam.startExam(exam.examCategory, exam.questionTypeProfile)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
            >
              <RotateCcw className="h-4 w-4" /> Retake
            </button>
            <Link
              href="/v2/study"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--card-border)] px-6 py-3 font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Study Mode
            </Link>
          </div>
        </div>

        {/* Per-question review */}
        <div>
          <h2 className="mb-4 text-xl font-bold text-[var(--foreground)]">Question Review</h2>
          <div className="space-y-4">
            {exam.review.rows.map((result, i) => {
              const reviewPres = buildOptionPresentation(result.question, `exam:${exam.startTime}`);
              const userLabel = getDisplayLabelForOption(reviewPres.displayLabelByOptionId, result.userAnswer);
              const correctLabel = reviewPres.correctDisplayLabel;
              const userText = getOptionTextById(result.question.options, result.userAnswer);
              const correctText = getOptionTextById(result.question.options, result.question.correct_option_id);

              return (
                <div
                  key={result.question.id}
                  className={`rounded-xl border p-4 ${
                    result.isCorrect
                      ? "border-correct/20 bg-correct/5"
                      : "border-incorrect/20 bg-incorrect/5"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm">
                    {result.isCorrect ? (
                      <CheckCircle2 className="h-4 w-4 text-correct" />
                    ) : (
                      <XCircle className="h-4 w-4 text-incorrect" />
                    )}
                    <span className="font-medium text-[var(--foreground)]">Q{i + 1}</span>
                    <span className="text-[var(--muted)]">
                      {result.question.category} → {result.question.subcategory}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--foreground)]">
                    {result.question.question_text}
                  </p>
                  {!result.isCorrect && (
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="text-incorrect">
                        Your answer: {userLabel}
                        {userText ? ` — ${userText}` : ""}
                      </div>
                      <div className="text-correct">
                        Correct: {correctLabel}
                        {correctText ? ` — ${correctText}` : ""}
                      </div>
                      <p className="text-[var(--muted)]">{result.question.explanation_correct}</p>
                      <CitationLinks
                        citation={result.question.citation}
                        label="📖 Correct answer reference:"
                        onReferenceClick={(ref) => {
                          events.logEvent({
                            type: "citation_clicked",
                            mode: "exam",
                            questionId: result.question.id,
                            category: result.question.category,
                            subcategory: result.question.subcategory,
                            citationLabel: `correct:${ref.label}`,
                            citationUrl: ref.url,
                            questionTypeProfile: exam.questionTypeProfile,
                          });
                        }}
                      />
                      <CitationLinks
                        citation={mergeCitations(
                          result.question.citation,
                          extractCitationText(
                            result.userAnswer
                              ? result.question.explanation_distractors[result.userAnswer]
                              : undefined,
                          ),
                        )}
                        label={`📖 Why "${userLabel}" reference:`}
                        onReferenceClick={(ref) => {
                          events.logEvent({
                            type: "citation_clicked",
                            mode: "exam",
                            questionId: result.question.id,
                            category: result.question.category,
                            subcategory: result.question.subcategory,
                            citationLabel: `selected:${result.userAnswer ?? "unanswered"}:${ref.label}`,
                            citationUrl: ref.url,
                            questionTypeProfile: exam.questionTypeProfile,
                          });
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  IN-PROGRESS — active exam                                       */
  /* ================================================================ */
  if (!exam.currentQuestion) {
    return (
      <div className="mx-auto max-w-lg space-y-5 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Exam Unavailable</h1>
        <p className="text-sm text-[var(--muted)]">No questions available for this selection.</p>
        <Link
          href="/v2/exam"
          className="inline-block rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Back to Exam Setup
        </Link>
      </div>
    );
  }

  const currentOptionPresentation = buildOptionPresentation(
    exam.currentQuestion,
    `exam:${exam.startTime}`,
  );
  const isTimeLow = exam.remainingMs < 10 * 60 * 1000;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {warning && (
        <QuestionBankWarning
          warning={warning}
          snapshotInfo={snapshotInfo}
          onTryLive={() => void reload({ preferLive: true })}
          onClearSnapshot={clearSnapshot}
        />
      )}

      <ProgressHeader
        left={`Q ${exam.currentIndex + 1} / ${exam.questions.length} (${exam.answeredCount} answered)`}
        right={`⏱ ${formatClockTime(exam.remainingMs)}`}
        progress={exam.progressPercent}
        progressClassName={isTimeLow ? "bg-incorrect animate-pulse" : "bg-brand-500"}
      />

      {isTimeLow && (
        <p className="flex items-center gap-2 text-sm text-incorrect" role="alert" aria-live="assertive">
          <AlertTriangle className="h-4 w-4" /> Less than 10 minutes remain.
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-400">
          {QUESTION_TYPE_PROFILE_LABELS[exam.questionTypeProfile]}
        </span>
      </div>

      <QuestionCard question={exam.currentQuestion} onOpenFigure={setFigureRef} />

      <QuestionIssueReporter
        mode="exam"
        question={exam.currentQuestion}
        selectedOptionId={exam.currentAnswer}
        questionTypeProfile={exam.questionTypeProfile}
        confidence={answerConfidenceByQuestionId.get(exam.currentQuestion.id) ?? null}
      />

      <AnswerOptions
        options={currentOptionPresentation.options}
        mode="exam"
        selectedOption={exam.currentAnswer}
        displayLabelByOptionId={currentOptionPresentation.displayLabelByOptionId}
        onSelect={handleAnswerSelect}
        onSelectWithConfidence={handleAnswerSelect}
        showConfidenceSplit
        defaultConfidence={EXAM_DEFAULT_CONFIDENCE}
        confidentConfidence={EXAM_CONFIDENT_CONFIDENCE}
      />

      {/* Navigation controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={exam.previousQuestion}
          disabled={exam.currentIndex === 0}
          className="inline-flex items-center gap-1 rounded-xl border border-[var(--card-border)] px-4 py-2.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <button
          onClick={exam.toggleFlagCurrent}
          className={`inline-flex items-center gap-1 rounded-xl border px-4 py-2.5 text-sm ${
            exam.flagged.has(exam.currentQuestion.id)
              ? "border-amber-500 bg-amber-500/10 text-amber-400"
              : "border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Flag className="h-4 w-4" />
          {exam.flagged.has(exam.currentQuestion.id) ? "Flagged" : "Flag"}
        </button>
        <button
          onClick={() => setShowNavigator((prev) => !prev)}
          className="inline-flex items-center gap-1 rounded-xl border border-[var(--card-border)] px-4 py-2.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <Grid3X3 className="h-4 w-4" /> Nav
        </button>
        <div className="flex-1" />
        {exam.currentIndex < exam.questions.length - 1 ? (
          <button
            onClick={exam.nextQuestion}
            className="inline-flex items-center gap-1 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={exam.submitExam}
            className="inline-flex items-center gap-1 rounded-xl bg-correct px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            <Send className="h-4 w-4" /> Submit
          </button>
        )}
      </div>

      {/* Navigator grid */}
      {showNavigator && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--foreground)]">Question Navigator</span>
            <span className="text-[var(--muted)]">
              {exam.answeredCount}/{exam.questions.length} answered · {exam.flagged.size} flagged
            </span>
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {exam.questions.map((question, i) => {
              const isAnswered = exam.answers.has(question.id);
              const isFlagged = exam.flagged.has(question.id);
              const isCurrent = i === exam.currentIndex;
              return (
                <button
                  key={question.id}
                  onClick={() => {
                    exam.goToQuestion(i);
                    setShowNavigator(false);
                  }}
                  className={`h-8 rounded text-xs font-medium transition-all ${
                    isCurrent
                      ? "bg-brand-500 text-white ring-2 ring-brand-500/50"
                      : isFlagged
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : isAnswered
                          ? "bg-white/10 text-white"
                          : "bg-[var(--background)] text-[var(--muted)]"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded bg-brand-500" /> Current
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded bg-white/10" /> Answered
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded border border-amber-500/30 bg-amber-500/20" /> Flagged
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded bg-[var(--background)]" /> Unanswered
            </span>
          </div>
        </div>
      )}

      {figureRef && <ReferenceModal ref_={figureRef} onClose={() => setFigureRef(null)} />}
    </div>
  );
}
