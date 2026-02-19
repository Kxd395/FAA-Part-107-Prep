"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";
import { useProgress, QuestionResult } from "../../hooks/useProgress";
import CitationLinks, { ReferenceModal, ResolvedReference } from "../../components/ReferenceModal";

// Types (same as study page — shared after npm install)
interface QuestionOption {
  id: "A" | "B" | "C" | "D";
  text: string;
}

interface Question {
  id: string;
  category: string;
  subcategory: string;
  question_text: string;
  figure_reference: string | null;
  image_ref?: string | null;
  figure_text?: string | null;
  options: QuestionOption[];
  correct_option_id: "A" | "B" | "C" | "D";
  explanation_correct: string;
  explanation_distractors: Partial<Record<"A" | "B" | "C" | "D", string>>;
  citation: string;
  difficulty_level: number;
  tags: string[];
  source_type?: string;
}

import regulationsData from "../../../../../packages/content/questions/regulations.json";
import airspaceData from "../../../../../packages/content/questions/airspace.json";
import weatherData from "../../../../../packages/content/questions/weather.json";
import operationsData from "../../../../../packages/content/questions/operations.json";
import loadingPerformanceData from "../../../../../packages/content/questions/loading_performance.json";

const ALL_QUESTIONS: Question[] = [
  ...(regulationsData as Question[]),
  ...(airspaceData as Question[]),
  ...(weatherData as Question[]),
  ...(operationsData as Question[]),
  ...(loadingPerformanceData as Question[]),
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const EXAM_TIME_MS = 2 * 60 * 60 * 1000; // 2 hours
const EXAM_QUESTION_COUNT = 60;
const PASSING_PERCENT = 70;
const CATEGORY_OPTIONS = [
  "All",
  "Regulations",
  "Airspace",
  "Weather",
  "Operations",
  "Loading & Performance",
] as const;

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

function normalizeCategory(input: string | null | undefined): string | null {
  if (!input) return null;
  return CATEGORY_OPTIONS.find((c) => c.toLowerCase() === input.toLowerCase()) ?? null;
}

function ExamPageClient() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const { saveSession } = useProgress();

  const [phase, setPhase] = useState<ExamPhase>("setup");
  const [examCategory, setExamCategory] = useState<string>("All");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, "A" | "B" | "C" | "D">>(new Map());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState(0);
  const [timeLimitMs, setTimeLimitMs] = useState(EXAM_TIME_MS);
  const [remainingMs, setRemainingMs] = useState(EXAM_TIME_MS);
  const [showNavigator, setShowNavigator] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Figure/image modal state
  const [figureRef, setFigureRef] = useState<ResolvedReference | null>(null);

  // Start exam — optionally filtered to a category
  const startExam = (category?: string) => {
    const cat = normalizeCategory(category ?? examCategory) ?? "All";
    const pool =
      cat === "All"
        ? ALL_QUESTIONS
        : ALL_QUESTIONS.filter(
            (q) => q.category.toLowerCase() === cat.toLowerCase()
          );
    if (pool.length === 0) {
      setQuestions([]);
      setExamCategory("All");
      setPhase("setup");
      return;
    }
    const count = cat === "All" ? EXAM_QUESTION_COUNT : pool.length;
    const examQuestions = shuffle(pool).slice(0, Math.min(count, pool.length));
    const nextTimeLimitMs =
      cat === "All" ? EXAM_TIME_MS : examQuestions.length * 2 * 60 * 1000;
    setQuestions(examQuestions);
    setExamCategory(cat);
    setCurrentIndex(0);
    setAnswers(new Map());
    setFlagged(new Set());
    setStartTime(Date.now());
    setTimeLimitMs(nextTimeLimitMs);
    setRemainingMs(nextTimeLimitMs);
    setSessionSaved(false);
    setPhase("in-progress");
  };

  // Timer
  useEffect(() => {
    if (phase !== "in-progress") return;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, timeLimitMs - elapsed);
      setRemainingMs(remaining);
      if (remaining <= 0) {
        setPhase("review");
      }
    }, 1000);
    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startTime, timeLimitMs]);

  // Auto-save exam results when entering review phase
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
  }, [phase, sessionSaved, questions, answers, remainingMs, saveSession, examCategory, timeLimitMs]);

  // Select answer
  const selectAnswer = (optionId: "A" | "B" | "C" | "D") => {
    const q = questions[currentIndex];
    if (!q) return;
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(q.id, optionId);
      return next;
    });
  };

  // Toggle flag
  const toggleFlag = () => {
    const q = questions[currentIndex];
    if (!q) return;
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.add(q.id);
      return next;
    });
  };

  // Submit exam
  const submitExam = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("review");
  };

  const currentQuestion = questions[currentIndex] ?? null;
  const currentAnswer = currentQuestion ? answers.get(currentQuestion.id) : null;

  // -----------------------------------------------------------
  // SETUP SCREEN
  // -----------------------------------------------------------
  if (phase === "setup") {
    const normalizedCategory = normalizeCategory(categoryParam);
    const invalidCategory = !!categoryParam && !normalizedCategory;
    const effectiveCategory = normalizedCategory ?? "All";

    // Determine the pool for the setup display
    const isCategoryExam = effectiveCategory !== "All";
    const categoryPool = isCategoryExam
      ? ALL_QUESTIONS.filter(
          (q) => q.category.toLowerCase() === effectiveCategory.toLowerCase()
        )
      : ALL_QUESTIONS;
    const questionCount = isCategoryExam
      ? categoryPool.length
      : Math.min(EXAM_QUESTION_COUNT, ALL_QUESTIONS.length);
    const timeDisplay = isCategoryExam
      ? `${categoryPool.length * 2} min`
      : "2 Hours";

    return (
      <div className="mx-auto max-w-lg space-y-8 pt-8">
        <div className="text-center">
          <div className="text-5xl">🎯</div>
          <h1 className="mt-4 text-3xl font-bold">
            {isCategoryExam ? `${effectiveCategory} Test` : "Practice Exam"}
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            {isCategoryExam
              ? `Test your knowledge of ${effectiveCategory}. No feedback until the end.`
              : "Simulates the real FAA Part 107 knowledge test. No feedback until the end — just like exam day."}
          </p>
        </div>
        {invalidCategory && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Unknown category &quot;{categoryParam}&quot;. Falling back to full practice exam.
          </div>
        )}
        {isCategoryExam && (
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
          onClick={() => startExam(isCategoryExam ? effectiveCategory : "All")}
          disabled={questionCount === 0}
          className="w-full rounded-xl bg-brand-600 py-4 text-lg font-semibold text-white transition-all hover:bg-brand-700 hover:scale-[1.02]"
        >
          {isCategoryExam ? `Begin ${effectiveCategory} Test →` : "Begin Exam →"}
        </button>
        {questionCount === 0 && (
          <div className="text-center text-sm text-[var(--muted)]">
            No questions found for this category yet.
          </div>
        )}
        {isCategoryExam && (
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

  // -----------------------------------------------------------
  // REVIEW SCREEN (After Submission)
  // -----------------------------------------------------------
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
        {/* Score Summary */}
        <div className="mx-auto max-w-lg text-center space-y-4">
          <div className="text-6xl">{passed ? "🎉" : "📚"}</div>
          <h1 className="text-3xl font-bold">
            {passed ? "You Passed!" : "Not Quite — Keep Going!"}
          </h1>
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
            <div className={`text-5xl font-bold ${passed ? "text-correct" : "text-incorrect"}`}>
              {scorePercent}%
            </div>
            <div className="mt-2 text-[var(--muted)]">
              {correctCount} of {questions.length} correct
            </div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              Time used: {formatTime(totalTime)}
            </div>
          </div>
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

        {/* Detailed Review */}
        <div>
          <h2 className="mb-4 text-xl font-bold">Question Review</h2>
          <div className="space-y-4">
            {results.map((r, i) => (
              <div
                key={r.question.id}
                className={`rounded-xl border p-4 ${
                  r.isCorrect
                    ? "border-correct/20 bg-correct/5"
                    : "border-incorrect/20 bg-incorrect/5"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span>{r.isCorrect ? "✅" : "❌"}</span>
                      <span className="font-medium">Q{i + 1}</span>
                      <span className="text-[var(--muted)]">
                        {r.question.category} → {r.question.subcategory}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{r.question.question_text}</p>
                    {!r.isCorrect && (
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="text-incorrect">
                          Your answer: {r.userAnswer ?? "Unanswered"}
                        </div>
                        <div className="text-correct">
                          Correct: {r.question.correct_option_id}
                        </div>
                        <p className="text-gray-400">
                          {r.question.explanation_correct}
                        </p>
                        <CitationLinks citation={r.question.citation} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------
  // IN-PROGRESS EXAM SCREEN
  // -----------------------------------------------------------
  if (!currentQuestion) {
    return (
      <div className="mx-auto max-w-lg space-y-5 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 text-center">
        <h1 className="text-2xl font-bold">Exam Unavailable</h1>
        <p className="text-sm text-[var(--muted)]">
          No questions are available for this exam selection.
        </p>
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
  const isTimeLow = remainingMs < 10 * 60 * 1000; // under 10 min

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Timer + Progress */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--muted)]">
          Q {currentIndex + 1} / {questions.length}
          <span className="ml-3 text-xs">({answeredCount} answered)</span>
        </span>
        <span
          className={`font-mono text-sm font-bold ${isTimeLow ? "text-incorrect animate-pulse" : "text-white"}`}
        >
          ⏱ {formatTime(remainingMs)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--card)]">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <p className="text-lg leading-relaxed whitespace-pre-line">
          {currentQuestion.question_text}
        </p>
        {/* Chart / Sectional Image — clickable to open in modal */}
        {currentQuestion.image_ref && (
          <div
            className="mt-4 rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-2 overflow-hidden cursor-pointer hover:border-brand-500/50 transition-colors"
            onClick={() =>
              setFigureRef({
                label: currentQuestion.figure_reference
                  ? currentQuestion.figure_reference.replace("-", " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                  : "Figure",
                type: "image",
                url: currentQuestion.image_ref!,
                description: `AKTS Supplement — ${currentQuestion.figure_reference ?? "Figure"}`,
              })
            }
          >
            <p className="mb-2 text-xs font-medium text-[var(--muted)] text-center uppercase tracking-wide">
              📊 {currentQuestion.figure_reference?.replace("-", " ").replace(/\b\w/g, (c: string) => c.toUpperCase())} <span className="text-brand-400 ml-1">(tap to enlarge)</span>
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentQuestion.image_ref}
              alt={currentQuestion.figure_reference ?? "Figure"}
              className="w-full rounded-lg max-h-[500px] object-contain"
            />
          </div>
        )}
        {/* Text-based figure (METAR, TAF, Winds Aloft, Load Factor) */}
        {!currentQuestion.image_ref && currentQuestion.figure_text && (
          <div className="mt-4 rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
            <p className="mb-2 text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
              📊 {currentQuestion.figure_reference?.replace("-", " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </p>
            <pre className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto">
              {currentQuestion.figure_text}
            </pre>
          </div>
        )}
        {/* Fallback */}
        {currentQuestion.figure_reference && !currentQuestion.image_ref && !currentQuestion.figure_text && (
          <div className="mt-4 rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--background)] p-4 text-center text-sm text-[var(--muted)]">
            📊 Refer to {currentQuestion.figure_reference.replace("-", " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
          </div>
        )}
      </div>

      {/* Options — NO feedback in exam mode */}
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

      {/* Navigation + Flag + Submit */}
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
          onClick={() => setShowNavigator(!showNavigator)}
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

      {/* Question Navigator Panel */}
      {showNavigator && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium text-white">Question Navigator</span>
            <span className="text-[var(--muted)]">
              {answeredCount}/{questions.length} answered •{" "}
              {flagged.size} flagged
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
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-brand-500" />{" "}
              Current
            </span>
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-white/10" />{" "}
              Answered
            </span>
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-amber-500/20 border border-amber-500/30" />{" "}
              Flagged
            </span>
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-[var(--background)]" />{" "}
              Unanswered
            </span>
          </div>
        </div>
      )}

      {/* Figure image modal (opens when user taps an image) */}
      {figureRef && (
        <ReferenceModal ref_={figureRef} onClose={() => setFigureRef(null)} />
      )}
    </div>
  );
}
