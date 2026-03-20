"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  STUDY_CATEGORIES,
  filterQuestionsByCategory,
  filterQuestionsByType,
  normalizeCategory,
  type OptionId,
  type StudyCategory,
  type QuestionTypeProfile,
  useStudySession,
  formatClockTime,
} from "@part107/core";
import {
  QuestionBankError,
  QuestionBankLoading,
} from "../../../components/QuestionBankState";
import { ReferenceModal, type ResolvedReference } from "../../../components/ReferenceModal";
import { useActiveUserId } from "../../../hooks/useActiveUserId";
import { useAdaptiveQuestionStats } from "../../../hooks/useAdaptiveQuestionStats";
import { useLearningEventLogger } from "../../../hooks/useLearningEventLogger";
import { useProgress } from "../../../hooks/useProgress";
import { useQuestionBank } from "../../../hooks/useQuestionBank";
import { countQuestionsByCategory } from "../../../lib/questionBank";
import {
  buildOptionPresentation,
  getDisplayLabelForOption,
  getOptionTextById,
} from "../../../lib/optionPresentation";
import { recordLearningAttempt } from "../../../lib/learningAttemptPipeline";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Layers,
  RotateCcw,
  SkipForward,
  Target,
  TrendingUp,
  X,
  XCircle,
  Zap,
} from "lucide-react";

/* ================================================================== */
/*  V2 STUDY PAGE — REAL QUESTION BANK + INSTANT FEEDBACK             */
/* ================================================================== */

export default function V2StudyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32">
          <div className="text-zinc-500">Loading study mode…</div>
        </div>
      }
    >
      <V2StudyClient />
    </Suspense>
  );
}

function V2StudyClient() {
  const activeUserId = useActiveUserId();
  const { saveSession } = useProgress(activeUserId);
  const adaptive = useAdaptiveQuestionStats(activeUserId);
  const events = useLearningEventLogger(adaptive.userId);
  const {
    questions: allQuestions,
    loaded,
    loading,
    error,
    reload,
  } = useQuestionBank();

  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionTypeProfile>("all_random");

  const filteredQuestions = useMemo(
    () =>
      filterQuestionsByType(allQuestions, selectedQuestionType, {
        userStatsByKey: adaptive.statsByKey,
        adaptiveConfig: adaptive.config,
      }),
    [adaptive.config, adaptive.statsByKey, allQuestions, selectedQuestionType]
  );

  const categoryCounts = useMemo(
    () => countQuestionsByCategory(filteredQuestions),
    [filteredQuestions]
  );

  const selectableCategories = useMemo(
    () =>
      STUDY_CATEGORIES.filter(
        (cat) => cat === "All" || (categoryCounts[cat] ?? 0) > 0
      ),
    [categoryCounts]
  );

  const study = useStudySession({
    allQuestions: filteredQuestions,
    adaptive: {
      userId: adaptive.userId,
      userStatsByKey: adaptive.statsByKey,
      config: adaptive.config,
    },
  });

  const [figureRef, setFigureRef] = useState<ResolvedReference | null>(null);
  const questionShownAtRef = useRef(Date.now());

  // Reset timer when question changes
  useEffect(() => {
    questionShownAtRef.current = Date.now();
  }, [study.currentQuestion?.id]);

  // Save session on completion
  useEffect(() => {
    if (!study.isComplete || study.questions.length === 0) return;
    saveSession({
      mode: "study",
      category: study.selectedCategory,
      questionTypeProfile: selectedQuestionType,
      score: study.score.correct,
      total: study.score.total,
      timeSpentMs: Date.now() - study.sessionStartTime,
      questions: study.questionResults,
    });
  }, [study.isComplete, study.questions.length, study.selectedCategory, study.score, study.sessionStartTime, study.questionResults, selectedQuestionType, saveSession]);

  const handleAnswer = useCallback(
    (optionId: OptionId) => {
      if (!study.currentQuestion) return;
      const responseTimeMs = Date.now() - questionShownAtRef.current;
      const isCorrect = optionId === study.currentQuestion.correct_option_id;

      recordLearningAttempt({
        adaptive,
        events,
        question: study.currentQuestion,
        learningMode: "study",
        attemptMode: "practice",
        isCorrect,
        selectedOptionId: optionId,
        responseTimeMs,
        confidence: 3,
        questionTypeProfile: selectedQuestionType,
        persistAdaptive: true,
      });

      study.answerQuestion(optionId);
    },
    [adaptive, events, study, selectedQuestionType]
  );

  /* ── Loading / error ─────────────────────────────────────────── */
  if (loading && !loaded) {
    return <QuestionBankLoading label="Loading question bank..." />;
  }
  if (error && !loaded) {
    return <QuestionBankError error={error} onRetry={() => void reload()} />;
  }

  /* ── SETUP: Category selection ───────────────────────────────── */
  if (!study.quizStarted) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 lg:py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl lg:text-3xl font-black text-white">Study by Topic</h1>
          <p className="text-zinc-500 text-sm">
            Pick a category and get instant right/wrong feedback on every question. Questions are randomized and adapted to your weak spots.
          </p>
        </div>

        {/* Topic grid */}
        <div className="grid gap-3">
          {selectableCategories.map((cat) => {
            const count = categoryCounts[cat] ?? 0;
            const icons: Record<string, React.ReactNode> = {
              All: <Layers className="h-5 w-5" />,
              Regulations: <span className="text-lg font-bold">§</span>,
              Airspace: <span className="text-lg">◎</span>,
              Weather: <span className="text-lg">☁</span>,
              "Loading & Performance": <span className="text-lg">⚖</span>,
              Operations: <span className="text-lg">✈</span>,
            };

            return (
              <button
                key={cat}
                onClick={() => study.startQuiz(cat)}
                className="group w-full text-left rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] p-5 transition-all duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className="shrink-0 flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-400">
                    {icons[cat] ?? <BookOpen className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-white">{cat}</h3>
                      <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{count} questions</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick start row */}
        <div className="grid sm:grid-cols-3 gap-4">
          <button
            onClick={() => {
              setSelectedQuestionType("all_random");
              study.startQuiz("All");
            }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-all text-left"
          >
            <Layers className="h-5 w-5 text-blue-400 mb-3" />
            <h3 className="text-sm font-semibold text-white">Random Mix</h3>
            <p className="text-xs text-zinc-500 mt-1">All questions, shuffled</p>
          </button>
          <button
            onClick={() => {
              setSelectedQuestionType("confirmed_test");
              study.startQuiz("All");
            }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-all text-left"
          >
            <Target className="h-5 w-5 text-emerald-400 mb-3" />
            <h3 className="text-sm font-semibold text-white">Confirmed Test Qs</h3>
            <p className="text-xs text-zinc-500 mt-1">Verified FAA-style only</p>
          </button>
          <button
            onClick={() => {
              setSelectedQuestionType("weak_spots");
              study.startQuiz("All");
            }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-all text-left"
          >
            <Zap className="h-5 w-5 text-amber-400 mb-3" />
            <h3 className="text-sm font-semibold text-white">Weak Spots</h3>
            <p className="text-xs text-zinc-500 mt-1">Questions you miss most</p>
          </button>
        </div>
      </div>
    );
  }

  /* ── COMPLETE: Session summary ───────────────────────────────── */
  if (study.isComplete) {
    const pct = study.score.total > 0 ? Math.round((study.score.correct / study.score.total) * 100) : 0;
    const passed = pct >= 70;

    return (
      <div className="mx-auto max-w-2xl px-4 py-16 lg:py-24 space-y-8">
        <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-8 lg:p-12 text-center space-y-6">
          <div className={`inline-flex items-center justify-center h-20 w-20 rounded-full ${passed ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
            {passed ? <Check className="h-10 w-10 text-emerald-400" /> : <XCircle className="h-10 w-10 text-red-400" />}
          </div>
          <h1 className="text-3xl font-black text-white">Study Complete</h1>
          <div className={`text-5xl font-black ${passed ? "text-emerald-400" : "text-red-400"}`}>{pct}%</div>
          <p className="text-zinc-400">
            {study.score.correct} of {study.score.total} correct • {study.selectedCategory}
          </p>
          <div className="flex items-center gap-3 justify-center pt-4">
            <button
              onClick={study.restartQuiz}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25"
            >
              <RotateCcw className="h-4 w-4" /> Study Again
            </button>
            <button
              onClick={study.resetToSetup}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-3 text-sm font-medium text-zinc-300 hover:bg-white/[0.06] transition-all"
            >
              Change Topic
            </button>
            <Link
              href="/v2"
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-3 text-sm font-medium text-zinc-300 hover:bg-white/[0.06] transition-all"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Question results */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white">Review</h2>
          {study.questionResults.map((r, i) => (
            <div
              key={r.questionId}
              className={`rounded-xl border p-3 ${r.isCorrect ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-red-500/20 bg-red-500/[0.03]"}`}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className={`flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold ${r.isCorrect ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                  {i + 1}
                </span>
                <span className={`text-xs ${r.isCorrect ? "text-emerald-400" : "text-red-400"}`}>
                  {r.isCorrect ? "Correct" : `Wrong — answered ${r.userAnswer}, correct ${r.correctAnswer}`}
                </span>
                <span className="text-xs text-zinc-600 ml-auto">{r.category}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── ACTIVE: Study question with instant feedback ────────────── */
  const q = study.currentQuestion!;
  const optPresentation = buildOptionPresentation(q, `v2study:${study.sessionStartTime}`);
  const answered = study.answerState !== "unanswered";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:py-12 space-y-6">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-white">
          Q{study.currentIndex + 1}
          <span className="text-zinc-600"> / {study.questions.length}</span>
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
            style={{ width: `${study.progressPercent}%` }}
          />
        </div>
        <span className="text-xs text-zinc-600">
          {study.score.correct}/{study.score.total}
        </span>
      </div>

      {/* Category tag */}
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
          {q.category}
        </span>
        {q.subcategory && (
          <span className="rounded-full bg-white/[0.04] px-3 py-1 text-xs text-zinc-500">
            {q.subcategory}
          </span>
        )}
      </div>

      {/* Question text */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
        <p className="text-lg leading-relaxed text-white whitespace-pre-line">{q.question_text}</p>

        {q.figure_reference && (
          <button
            onClick={() =>
              setFigureRef({
                label: q.figure_reference ?? "Figure",
                type: "image",
                url: `/figures/${q.figure_reference}.png`,
                description: `AKTS Supplement — ${q.figure_reference}`,
              })
            }
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/[0.05] px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <ImageIcon className="h-4 w-4" />
            View {q.figure_reference}
          </button>
        )}
      </div>

      {/* Answer options — with INSTANT correct/incorrect feedback */}
      <div className="space-y-3">
        {optPresentation.options.map((opt) => {
          const displayLabel = optPresentation.displayLabelByOptionId[opt.id] ?? opt.id;
          const isSelected = study.selectedOption === opt.id;
          const isCorrect = opt.id === q.correct_option_id;

          // Determine styling based on answer state
          let borderColor = "border-white/[0.06]";
          let bg = "bg-white/[0.02] hover:bg-white/[0.04]";
          let labelBg = "bg-white/[0.06] text-zinc-400";
          let extraIcon: React.ReactNode = null;

          if (!answered) {
            // Not answered yet — clean state
            if (isSelected) {
              borderColor = "border-blue-500/30";
              bg = "bg-blue-500/[0.06]";
              labelBg = "bg-blue-500/20 text-blue-300";
            }
          } else {
            // Answered — show feedback
            if (isCorrect) {
              borderColor = "border-emerald-500/40";
              bg = "bg-emerald-500/[0.08] flash-correct";
              labelBg = "bg-emerald-500/20 text-emerald-300";
              extraIcon = <Check className="h-5 w-5 text-emerald-400 shrink-0" />;
            } else if (isSelected && !isCorrect) {
              borderColor = "border-red-500/40";
              bg = "bg-red-500/[0.08] flash-incorrect";
              labelBg = "bg-red-500/20 text-red-300";
              extraIcon = <X className="h-5 w-5 text-red-400 shrink-0" />;
            } else {
              bg = "bg-white/[0.01] opacity-50";
            }
          }

          return (
            <button
              key={opt.id}
              onClick={() => handleAnswer(opt.id)}
              disabled={answered}
              className={`w-full text-left rounded-xl border ${borderColor} ${bg} p-4 flex items-start gap-4 transition-all duration-200 answer-option ${answered ? "cursor-default" : ""}`}
            >
              <span className={`shrink-0 flex items-center justify-center h-8 w-8 rounded-lg text-sm font-bold ${labelBg} transition-colors`}>
                {displayLabel}
              </span>
              <span className="text-sm text-zinc-200 pt-1 leading-relaxed flex-1">{opt.text}</span>
              {extraIcon}
            </button>
          );
        })}
      </div>

      {/* Explanation — shown after answering */}
      {answered && q.explanation_correct && (
        <div className={`rounded-xl border p-5 ${study.answerState === "correct" ? "border-emerald-500/10 bg-emerald-500/[0.03]" : "border-red-500/10 bg-red-500/[0.03]"}`}>
          <h4 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${study.answerState === "correct" ? "text-emerald-400" : "text-red-400"}`}>
            {study.answerState === "correct" ? "✓ Correct!" : "✗ Incorrect"}
          </h4>
          <p className="text-sm text-zinc-300 leading-relaxed">{q.explanation_correct}</p>
          {study.answerState === "incorrect" && study.selectedOption && q.explanation_distractors?.[study.selectedOption] && (
            <p className="text-sm text-zinc-400 mt-2 pt-2 border-t border-white/[0.06]">
              <strong className="text-zinc-300">Why your answer was wrong: </strong>
              {q.explanation_distractors[study.selectedOption]}
            </p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={study.resetToSetup}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Topics
        </button>

        <div className="flex items-center gap-2">
          {!answered && (
            <button
              onClick={study.skipQuestion}
              className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <SkipForward className="h-3.5 w-3.5" /> Skip
            </button>
          )}

          {answered && (
            <button
              onClick={study.nextQuestion}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all"
            >
              Next Question <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Figure modal */}
      {figureRef && <ReferenceModal ref_={figureRef} onClose={() => setFigureRef(null)} />}
    </div>
  );
}
