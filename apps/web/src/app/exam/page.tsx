"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  buildExamQuestionSet,
  computeRemainingTime,
  formatClockTime,
  normalizeCategory,
  type OptionId,
} from "@part107/core";
import CitationLinks, { ReferenceModal, type ResolvedReference } from "../../components/ReferenceModal";
import ProgressHeader from "../../components/quiz/ProgressHeader";
import QuestionCard from "../../components/quiz/QuestionCard";
import SessionSummaryCard from "../../components/quiz/SessionSummaryCard";
import { useProgress, type QuestionResult } from "../../hooks/useProgress";
import { ALL_QUESTIONS, type AppQuestion, type StudyCategory } from "../../lib/questionBank";

const PASSING_PERCENT = 70;

type ExamPhase = "setup" | "in-progress" | "review";

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
  const { saveSession } = useProgress();

  const [phase, setPhase] = useState<ExamPhase>("setup");
  const [examCategory, setExamCategory] = useState<StudyCategory>("All");
  const [questions, setQuestions] = useState<AppQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, OptionId>>(new Map());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState(0);
  const [timeLimitMs, setTimeLimitMs] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [showNavigator, setShowNavigator] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [figureRef, setFigureRef] = useState<ResolvedReference | null>(null);

  const startExam = (categoryInput?: string) => {
    const category = normalizeCategory(categoryInput ?? examCategory) ?? "All";
    const nextSet = buildExamQuestionSet(ALL_QUESTIONS, category);

    if (nextSet.questions.length === 0) {
      setQuestions([]);
      setExamCategory("All");
      setPhase("setup");
      return;
    }

    const now = Date.now();
    setQuestions(nextSet.questions as AppQuestion[]);
    setExamCategory(nextSet.category);
    setCurrentIndex(0);
    setAnswers(new Map());
    setFlagged(new Set());
    setStartTime(now);
    setTimeLimitMs(nextSet.timeLimitMs);
    setRemainingMs(nextSet.timeLimitMs);
    setSessionSaved(false);
    setShowNavigator(false);
    setPhase("in-progress");
  };

  useEffect(() => {
    if (phase !== "in-progress") return;

    timerRef.current = setInterval(() => {
      const remaining = computeRemainingTime(startTime, timeLimitMs);
      setRemainingMs(remaining);
      if (remaining <= 0) {
        setPhase("review");
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startTime, timeLimitMs]);

  useEffect(() => {
    if (phase !== "review" || sessionSaved || questions.length === 0) return;

    const questionResults: QuestionResult[] = questions.map((q) => {
      const userAnswer = answers.get(q.id) ?? null;
      return {
        questionId: q.id,
        userAnswer,
        correctAnswer: q.correct_option_id,
        isCorrect: userAnswer === q.correct_option_id,
        category: q.category,
      };
    });

    const correctCount = questionResults.filter((r) => r.isCorrect).length;
    saveSession({
      mode: "exam",
      category: examCategory,
      score: correctCount,
      total: questions.length,
      timeSpentMs: Math.max(0, timeLimitMs - remainingMs),
      questions: questionResults,
    });
    setSessionSaved(true);
  }, [answers, examCategory, phase, questions, remainingMs, saveSession, sessionSaved, timeLimitMs]);

  const selectAnswer = (optionId: OptionId) => {
    const question = questions[currentIndex];
    if (!question) return;

    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(question.id, optionId);
      return next;
    });
  };

  const toggleFlag = () => {
    const question = questions[currentIndex];
    if (!question) return;

    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(question.id)) next.delete(question.id);
      else next.add(question.id);
      return next;
    });
  };

  const submitExam = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("review");
  };

  const currentQuestion = questions[currentIndex] ?? null;
  const currentAnswer = currentQuestion ? answers.get(currentQuestion.id) : null;

  if (phase === "setup") {
    const normalizedCategory = normalizeCategory(categoryParam);
    const invalidCategory = !!categoryParam && !normalizedCategory;
    const effectiveCategory = normalizedCategory ?? "All";

    const preview = buildExamQuestionSet(ALL_QUESTIONS, effectiveCategory);
    const questionCount = preview.questions.length;
    const timeDisplay = effectiveCategory === "All" ? "2 Hours" : `${questionCount * 2} min`;

    return (
      <div className="mx-auto max-w-lg space-y-8 pt-8">
        <div className="text-center">
          <div className="text-5xl">🎯</div>
          <h1 className="mt-4 text-3xl font-bold">
            {effectiveCategory === "All" ? "Practice Exam" : `${effectiveCategory} Test`}
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            {effectiveCategory === "All"
              ? "Simulates the real FAA Part 107 knowledge test. No feedback until the end — just like exam day."
              : `Test your knowledge of ${effectiveCategory}. No feedback until the end.`}
          </p>
        </div>

        {invalidCategory && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Unknown category &quot;{categoryParam}&quot;. Falling back to full practice exam.
          </div>
        )}

        {effectiveCategory !== "All" && (
          <div className="flex justify-center">
            <span className="rounded-full bg-brand-500/10 px-4 py-1.5 text-sm font-medium text-brand-500">
              📂 Topic: {effectiveCategory}
            </span>
          </div>
        )}

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Questions</span>
            <span className="font-medium text-white">{questionCount}</span>
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
        </div>

        <button
          onClick={() => startExam(effectiveCategory)}
          disabled={questionCount === 0}
          className="w-full rounded-xl bg-brand-600 py-4 text-lg font-semibold text-white transition-all hover:bg-brand-700 hover:scale-[1.02] disabled:opacity-60"
        >
          {effectiveCategory === "All" ? "Begin Exam →" : `Begin ${effectiveCategory} Test →`}
        </button>

        {questionCount === 0 && (
          <div className="text-center text-sm text-[var(--muted)]">No questions found for this category yet.</div>
        )}

        {effectiveCategory !== "All" && (
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

  if (phase === "review") {
    let correctCount = 0;
    const results = questions.map((q) => {
      const userAnswer = answers.get(q.id);
      const isCorrect = userAnswer === q.correct_option_id;
      if (isCorrect) correctCount++;
      return { question: q, userAnswer, isCorrect };
    });

    const scorePercent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const passed = scorePercent >= PASSING_PERCENT;
    const totalTime = Math.max(0, timeLimitMs - remainingMs);

    return (
      <div className="space-y-8">
        <div className="mx-auto max-w-lg text-center space-y-4">
          <div className="text-6xl">{passed ? "🎉" : "📚"}</div>
          <h1 className="text-3xl font-bold">{passed ? "You Passed!" : "Not Quite — Keep Going!"}</h1>

          <SessionSummaryCard
            passed={passed}
            percentage={scorePercent}
            correct={correctCount}
            total={questions.length}
            subtitle={`Time used: ${formatClockTime(totalTime)}`}
          />

          <div className="flex gap-3">
            <button
              onClick={() => startExam()}
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
            {results.map((result, i) => (
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

  if (!currentQuestion) {
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

  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = answers.size;
  const isTimeLow = remainingMs < 10 * 60 * 1000;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ProgressHeader
        left={`Q ${currentIndex + 1} / ${questions.length} (${answeredCount} answered)`}
        right={`⏱ ${formatClockTime(remainingMs)}`}
        progress={progress}
        progressClassName={isTimeLow ? "bg-incorrect animate-pulse" : "bg-brand-500"}
      />

      <QuestionCard question={currentQuestion} onOpenFigure={setFigureRef} />

      <div className="space-y-3">
        {currentQuestion.options.map((option) => (
          <button
            key={option.id}
            onClick={() => selectAnswer(option.id)}
            className={`w-full rounded-xl border p-4 text-left transition-all ${
              currentAnswer === option.id
                ? "border-brand-500 bg-brand-500/10"
                : "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/30"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  currentAnswer === option.id
                    ? "bg-brand-500 text-white"
                    : "bg-[var(--background)] text-[var(--muted)]"
                }`}
              >
                {option.id}
              </span>
              <span className="pt-0.5">{option.text}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="rounded-xl border border-[var(--card-border)] px-4 py-2.5 text-sm text-[var(--muted)] hover:text-white disabled:opacity-30"
        >
          ← Prev
        </button>
        <button
          onClick={toggleFlag}
          className={`rounded-xl border px-4 py-2.5 text-sm ${
            flagged.has(currentQuestion.id)
              ? "border-amber-500 bg-amber-500/10 text-amber-400"
              : "border-[var(--card-border)] text-[var(--muted)] hover:text-white"
          }`}
        >
          🚩 {flagged.has(currentQuestion.id) ? "Flagged" : "Flag for Review"}
        </button>
        <button
          onClick={() => setShowNavigator((prev) => !prev)}
          className="rounded-xl border border-[var(--card-border)] px-4 py-2.5 text-sm text-[var(--muted)] hover:text-white"
        >
          📋 Navigator
        </button>
        <div className="flex-1" />
        {currentIndex < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIndex((i) => i + 1)}
            className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={submitExam}
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
              {answeredCount}/{questions.length} answered • {flagged.size} flagged
            </span>
          </div>

          <div className="grid grid-cols-10 gap-1.5">
            {questions.map((q, i) => {
              const isAnswered = answers.has(q.id);
              const isFlagged = flagged.has(q.id);
              const isCurrent = i === currentIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentIndex(i);
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
