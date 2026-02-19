"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  QUESTION_TYPE_PROFILE_LABELS,
  formatClockTime,
  normalizeQuestionTypeProfile,
  type QuestionTypeProfile,
  useExamSession,
} from "@part107/core";
import CitationLinks, { ReferenceModal, type ResolvedReference } from "../../components/ReferenceModal";
import AnswerOptions from "../../components/quiz/AnswerOptions";
import ProgressHeader from "../../components/quiz/ProgressHeader";
import QuestionCard from "../../components/quiz/QuestionCard";
import SessionSummaryCard from "../../components/quiz/SessionSummaryCard";
import { useAdaptiveQuestionStats } from "../../hooks/useAdaptiveQuestionStats";
import { useProgress, type QuestionResult } from "../../hooks/useProgress";
import { useQuestionBank } from "../../hooks/useQuestionBank";

const PASSING_PERCENT = 70;

const QUESTION_TYPE_OPTIONS: Array<{
  value: QuestionTypeProfile;
  title: string;
  description: string;
}> = [
  {
    value: "real_exam",
    title: "Real Exam Style (Recommended)",
    description: "Prioritizes realistic FAA-style scenario/regulation prompts and excludes ACS code-matching items.",
  },
  {
    value: "acs_mastery",
    title: "ACS Mastery",
    description: "Focuses on ACS knowledge-code mapping and code recall.",
  },
  {
    value: "mixed",
    title: "Mixed",
    description: "Uses the full pool: exam-style + ACS mastery prompts.",
  },
  {
    value: "weak_spots",
    title: "Weak Spots Only",
    description: "Pulls from questions you are missing or have not mastered.",
  },
];

export default function ExamPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32">
          <div className="text-[var(--muted)]">Loading exam mode…</div>
        </div>
      }
    >
      <ExamPageClient />
    </Suspense>
  );
}

function ExamPageClient() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const questionTypeParam = searchParams.get("type");
  const parsedQuestionType = normalizeQuestionTypeProfile(questionTypeParam) ?? "real_exam";
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionTypeProfile>(
    parsedQuestionType
  );

  const { saveSession } = useProgress();
  const adaptive = useAdaptiveQuestionStats();
  const { questions: allQuestions, loaded, loading, error, reload } = useQuestionBank();
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

  useEffect(() => {
    const nextType = normalizeQuestionTypeProfile(questionTypeParam);
    if (!nextType) return;
    setSelectedQuestionType(nextType);
  }, [questionTypeParam]);

  useEffect(() => {
    if (exam.phase === "in-progress") {
      setSessionSaved(false);
    }
  }, [exam.phase, exam.startTime]);

  useEffect(() => {
    if (exam.phase !== "review" || sessionSaved || exam.questions.length === 0) return;

    adaptive.recordExamReview(
      exam.review.rows.map((row) => ({
        question: row.question,
        isCorrect: row.isCorrect,
      }))
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
  }, [adaptive, exam, saveSession, sessionSaved]);

  if (loading && !loaded) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-[var(--muted)]">Loading question bank…</div>
      </div>
    );
  }

  if (error && !loaded) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-incorrect/30 bg-incorrect/10 p-6 text-center">
        <h1 className="text-xl font-bold text-incorrect">Couldn&apos;t load questions</h1>
        <p className="text-sm text-[var(--muted)]">{error}</p>
        <button
          onClick={() => void reload()}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (exam.phase === "setup") {
    const preview = exam.getSetupPreview(categoryParam, selectedQuestionType);
    const timeDisplay =
      preview.category === "All" ? "2 Hours" : `${Math.round(preview.timeLimitMs / 60000)} min`;

    return (
      <div className="mx-auto max-w-lg space-y-8 pt-8">
        <div className="text-center">
          <div className="text-5xl">🎯</div>
          <h1 className="mt-4 text-3xl font-bold">
            {preview.category === "All" ? "Practice Exam" : `${preview.category} Test`}
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            {preview.category === "All"
              ? "Simulates the real FAA Part 107 knowledge test. No feedback until the end — just like exam day."
              : `Test your knowledge of ${preview.category}. No feedback until the end.`}
          </p>
        </div>

        {preview.invalidCategory && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Unknown category &quot;{categoryParam}&quot;. Falling back to full practice exam.
          </div>
        )}

        {preview.invalidQuestionType && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Unknown question type &quot;{questionTypeParam}&quot;. Falling back to Real Exam Style.
          </div>
        )}

        {preview.category !== "All" && (
          <div className="flex justify-center">
            <span className="rounded-full bg-brand-500/10 px-4 py-1.5 text-sm font-medium text-brand-500">
              📂 Topic: {preview.category}
            </span>
          </div>
        )}

        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Question Type</div>
          <div className="grid gap-2">
            {QUESTION_TYPE_OPTIONS.map((option) => (
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
                <div className="text-sm font-semibold text-white">{option.title}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{option.description}</div>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-xs text-[var(--muted)]">
            Note: Real Exam Style emphasizes practical FAA-style questions. ACS Mastery is intended for knowledge
            code memorization and may feel less like the real test.
          </div>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Questions</span>
            <span className="font-medium text-white">{preview.questionCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Time Limit</span>
            <span className="font-medium text-white">{timeDisplay}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Passing Score</span>
            <span className="font-medium text-white">70%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Feedback</span>
            <span className="font-medium text-amber-400">After submission only</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Question Type</span>
            <span className="font-medium text-white">{QUESTION_TYPE_PROFILE_LABELS[preview.questionTypeProfile]}</span>
          </div>
        </div>

        <button
          onClick={() => exam.startExam(preview.category, selectedQuestionType)}
          disabled={preview.questionCount === 0}
          className="w-full rounded-xl bg-brand-600 py-4 text-lg font-semibold text-white transition-all hover:bg-brand-700 hover:scale-[1.02] disabled:opacity-60"
        >
          {preview.category === "All" ? "Begin Exam →" : `Begin ${preview.category} Test →`}
        </button>

        {preview.questionCount === 0 && (
          <div className="text-center text-sm text-[var(--muted)]">
            No questions available for {QUESTION_TYPE_PROFILE_LABELS[preview.questionTypeProfile]} in this category.
          </div>
        )}

        {preview.category !== "All" && (
          <Link
            href="/exam"
            className="block text-center text-sm text-[var(--muted)] hover:text-white transition-colors"
          >
            or take the full practice exam →
          </Link>
        )}
      </div>
    );
  }

  if (exam.phase === "review") {
    return (
      <div className="space-y-8">
        <div className="mx-auto max-w-lg text-center space-y-4">
          <div className="text-6xl">{exam.review.passed ? "🎉" : "📚"}</div>
          <h1 className="text-3xl font-bold">
            {exam.review.passed ? "You Passed!" : "Not Quite — Keep Going!"}
          </h1>

          <SessionSummaryCard
            passed={exam.review.passed}
            percentage={exam.review.scorePercent}
            correct={exam.review.correctCount}
            total={exam.questions.length}
            subtitle={`Time used: ${formatClockTime(exam.review.totalTimeMs)}`}
          />

          <div className="flex gap-3">
            <button
              onClick={() => exam.startExam(exam.examCategory, exam.questionTypeProfile)}
              className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
            >
              Retake Exam
            </button>
            <Link
              href="/study"
              className="flex-1 rounded-xl border border-[var(--card-border)] py-3 text-center font-semibold text-[var(--muted)] hover:text-white"
            >
              Study Mode
            </Link>
          </div>

          <Link
            href="/progress"
            className="block text-center text-sm text-brand-400 hover:text-brand-300 transition-colors"
          >
            📊 View Progress Dashboard →
          </Link>
        </div>

        <div>
          <h2 className="mb-4 text-xl font-bold">Question Review</h2>
          <div className="space-y-4">
            {exam.review.rows.map((result, i) => (
              <div
                key={result.question.id}
                className={`rounded-xl border p-4 ${
                  result.isCorrect ? "border-correct/20 bg-correct/5" : "border-incorrect/20 bg-incorrect/5"
                }`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <span>{result.isCorrect ? "✅" : "❌"}</span>
                  <span className="font-medium">Q{i + 1}</span>
                  <span className="text-[var(--muted)]">
                    {result.question.category} → {result.question.subcategory}
                  </span>
                </div>

                <p className="mt-2 text-sm">{result.question.question_text}</p>

                {!result.isCorrect && (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="text-incorrect">Your answer: {result.userAnswer ?? "Unanswered"}</div>
                    <div className="text-correct">Correct: {result.question.correct_option_id}</div>
                    <p className="text-gray-400">{result.question.explanation_correct}</p>
                    <CitationLinks citation={result.question.citation} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!exam.currentQuestion) {
    return (
      <div className="mx-auto max-w-lg space-y-5 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center">
        <h1 className="text-2xl font-bold">Exam Unavailable</h1>
        <p className="text-sm text-[var(--muted)]">No questions are available for this exam selection.</p>
        <Link
          href="/exam"
          className="inline-block rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Back to Exam Setup
        </Link>
      </div>
    );
  }

  const isTimeLow = exam.remainingMs < 10 * 60 * 1000;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ProgressHeader
        left={`Q ${exam.currentIndex + 1} / ${exam.questions.length} (${exam.answeredCount} answered)`}
        right={`⏱ ${formatClockTime(exam.remainingMs)}`}
        progress={exam.progressPercent}
        progressClassName={isTimeLow ? "bg-incorrect animate-pulse" : "bg-brand-500"}
      />

      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-400">
          {QUESTION_TYPE_PROFILE_LABELS[exam.questionTypeProfile]}
        </span>
      </div>

      <QuestionCard question={exam.currentQuestion} onOpenFigure={setFigureRef} />

      <AnswerOptions
        options={exam.currentQuestion.options}
        mode="exam"
        selectedOption={exam.currentAnswer}
        onSelect={exam.selectAnswer}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={exam.previousQuestion}
          disabled={exam.currentIndex === 0}
          className="rounded-xl border border-[var(--card-border)] px-4 py-2.5 text-sm text-[var(--muted)] hover:text-white disabled:opacity-30"
        >
          ← Prev
        </button>
        <button
          onClick={exam.toggleFlagCurrent}
          className={`rounded-xl border px-4 py-2.5 text-sm ${
            exam.flagged.has(exam.currentQuestion.id)
              ? "border-amber-500 bg-amber-500/10 text-amber-400"
              : "border-[var(--card-border)] text-[var(--muted)] hover:text-white"
          }`}
        >
          🚩 {exam.flagged.has(exam.currentQuestion.id) ? "Flagged" : "Flag for Review"}
        </button>
        <button
          onClick={() => setShowNavigator((prev) => !prev)}
          className="rounded-xl border border-[var(--card-border)] px-4 py-2.5 text-sm text-[var(--muted)] hover:text-white"
        >
          📋 Navigator
        </button>
        <div className="flex-1" />
        {exam.currentIndex < exam.questions.length - 1 ? (
          <button
            onClick={exam.nextQuestion}
            className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={exam.submitExam}
            className="rounded-xl bg-correct px-6 py-2.5 text-sm font-semibold text-white hover:bg-correct-dark"
          >
            Submit Exam ✓
          </button>
        )}
      </div>

      {showNavigator && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium text-white">Question Navigator</span>
            <span className="text-[var(--muted)]">
              {exam.answeredCount}/{exam.questions.length} answered • {exam.flagged.size} flagged
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

          <div className="mt-3 flex items-center gap-4 text-xs text-[var(--muted)]">
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-brand-500" /> Current
            </span>
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-white/10" /> Answered
            </span>
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-amber-500/20 border border-amber-500/30" />
              Flagged
            </span>
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-[var(--background)]" /> Unanswered
            </span>
          </div>
        </div>
      )}

      {figureRef && <ReferenceModal ref_={figureRef} onClose={() => setFigureRef(null)} />}
    </div>
  );
}
