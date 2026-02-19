"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { useProgress, QuestionResult } from "../../hooks/useProgress";
import CitationLinks, { ReferenceModal, ResolvedReference } from "../../components/ReferenceModal";

// -----------------------------------------------------------
// Types (inline for now — will import from @part107/core after npm install)
// -----------------------------------------------------------
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

type AnswerState = "unanswered" | "correct" | "incorrect";

// -----------------------------------------------------------
// Import all question data (will be dynamic in production)
// -----------------------------------------------------------
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

// Shuffle helper
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// -----------------------------------------------------------
// Category filter options
// -----------------------------------------------------------
const CATEGORIES = [
  "All",
  "Regulations",
  "Airspace",
  "Weather",
  "Operations",
  "Loading & Performance",
] as const;

export default function StudyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32">
          <div className="text-[var(--muted)]">Loading study mode…</div>
        </div>
      }
    >
      <StudyPageClient />
    </Suspense>
  );
}

function StudyPageClient() {
  // URL params — auto-start if ?category=X is in the URL
  const searchParams = useSearchParams();

  // Progress tracking
  const { saveSession } = useProgress();
  const questionResults = useRef<QuestionResult[]>([]);

  // Quiz state
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("unanswered");
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [quizStarted, setQuizStarted] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const autoStarted = useRef(false);

  // Figure/image modal state
  const [figureRef, setFigureRef] = useState<ResolvedReference | null>(null);

  // Filter and shuffle questions on category change
  const startQuiz = useCallback(
    (category: string) => {
      const filtered =
        category === "All"
          ? ALL_QUESTIONS
          : ALL_QUESTIONS.filter((q) => q.category === category);
      setQuestions(shuffle(filtered));
      setCurrentIndex(0);
      setSelectedOption(null);
      setAnswerState("unanswered");
      setScore({ correct: 0, total: 0 });
      setSessionStartTime(Date.now());
      setQuizStarted(true);
      setSessionSaved(false);
      setSelectedCategory(category);
      questionResults.current = [];
    },
    []
  );

  // Auto-start from URL param (?category=Regulations)
  useEffect(() => {
    if (autoStarted.current) return;
    const cat = searchParams.get("category");
    if (cat) {
      autoStarted.current = true;
      // Match case-insensitively against available categories
      const match = CATEGORIES.find(
        (c) => c.toLowerCase() === cat.toLowerCase()
      );
      if (match) {
        startQuiz(match);
      } else {
        // If the category doesn't have questions yet, still start with "All"
        startQuiz("All");
      }
    }
  }, [searchParams, startQuiz]);

  const currentQuestion = questions[currentIndex] ?? null;

  // Auto-save session when quiz is complete
  useEffect(() => {
    if (
      quizStarted &&
      !sessionSaved &&
      questions.length > 0 &&
      currentIndex >= questions.length &&
      questionResults.current.length > 0
    ) {
      saveSession({
        mode: "study",
        category: selectedCategory,
        score: score.correct,
        total: score.total,
        timeSpentMs: Date.now() - sessionStartTime,
        questions: questionResults.current,
      });
      setSessionSaved(true);
    }
  }, [currentIndex, questions.length, quizStarted, sessionSaved, saveSession, selectedCategory, score, sessionStartTime]);

  // Handle answer selection
  const handleAnswer = (optionId: "A" | "B" | "C" | "D") => {
    if (answerState !== "unanswered") return; // already answered
    setSelectedOption(optionId);
    const isCorrect = optionId === currentQuestion?.correct_option_id;
    setAnswerState(isCorrect ? "correct" : "incorrect");
    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
    // Track for progress
    if (currentQuestion) {
      questionResults.current.push({
        questionId: currentQuestion.id,
        userAnswer: optionId,
        correctAnswer: currentQuestion.correct_option_id,
        isCorrect: isCorrect,
        category: currentQuestion.category,
      });
    }
  };

  // Next question
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setAnswerState("unanswered");
    }
  };

  // Get option styling based on state
  const getOptionStyle = (optionId: "A" | "B" | "C" | "D") => {
    const base =
      "answer-option w-full rounded-xl border p-4 text-left transition-all cursor-pointer";
    if (answerState === "unanswered") {
      return `${base} border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/50 hover:bg-brand-500/5`;
    }
    if (optionId === currentQuestion?.correct_option_id) {
      return `${base} border-correct bg-correct/10 flash-correct`;
    }
    if (optionId === selectedOption && answerState === "incorrect") {
      return `${base} border-incorrect bg-incorrect/10 flash-incorrect`;
    }
    return `${base} border-[var(--card-border)] bg-[var(--card)] opacity-50`;
  };

  // -----------------------------------------------------------
  // Category Selection Screen
  // -----------------------------------------------------------
  if (!quizStarted) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">📖 Study Mode</h1>
          <p className="mt-2 text-[var(--muted)]">
            Choose a topic to drill down on, or study all categories. You&apos;ll
            get instant feedback after each answer.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {CATEGORIES.map((cat) => {
            const count =
              cat === "All"
                ? ALL_QUESTIONS.length
                : ALL_QUESTIONS.filter((q) => q.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => startQuiz(cat)}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-left transition-all hover:border-brand-500/50 hover:scale-[1.02]"
              >
                <div className="text-lg font-semibold text-white">{cat}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  {count} questions available
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------
  // Quiz Complete Screen
  // -----------------------------------------------------------
  if (currentIndex >= questions.length || !currentQuestion) {
    const pct =
      score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    const passed = pct >= 70;
    return (
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <div className="text-6xl">{passed ? "🎉" : "📚"}</div>
        <h1 className="text-3xl font-bold">
          {passed ? "Great Job!" : "Keep Studying!"}
        </h1>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
          <div className={`text-5xl font-bold ${passed ? "text-correct" : "text-incorrect"}`}>
            {pct}%
          </div>
          <div className="mt-2 text-[var(--muted)]">
            {score.correct} of {score.total} correct
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            Passing score: 70% (42 of 60 on the real exam)
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => startQuiz(selectedCategory)}
            className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Try Again
          </button>
          <button
            onClick={() => setQuizStarted(false)}
            className="flex-1 rounded-xl border border-[var(--card-border)] py-3 font-semibold text-[var(--muted)] hover:text-white"
          >
            Change Topic
          </button>
        </div>
        <Link
          href="/progress"
          className="block text-center text-sm text-brand-400 hover:text-brand-300 transition-colors"
        >
          📊 View Progress Dashboard →
        </Link>
      </div>
    );
  }

  // -----------------------------------------------------------
  // Question Screen (Main Quiz UI)
  // -----------------------------------------------------------
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Progress Bar + Score */}
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <span>
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span>
          Score: {score.correct}/{score.total}{" "}
          {score.total > 0 && (
            <span className="text-xs">
              ({Math.round((score.correct / score.total) * 100)}%)
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--card)]">
        <div
          className="progress-fill h-full rounded-full bg-brand-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Category Badge */}
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">
          {currentQuestion.category}
        </span>
        <span className="rounded-full bg-[var(--card)] px-3 py-1 text-xs text-[var(--muted)]">
          {currentQuestion.subcategory}
        </span>
        <span className="rounded-full bg-[var(--card)] px-3 py-1 text-xs text-[var(--muted)]">
          {"⭐".repeat(currentQuestion.difficulty_level)}
        </span>
      </div>

      {/* Question Text */}
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
                  ? currentQuestion.figure_reference.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())
                  : "Figure",
                type: "image",
                url: currentQuestion.image_ref!,
                description: `AKTS Supplement — ${currentQuestion.figure_reference ?? "Figure"}`,
              })
            }
          >
            <p className="mb-2 text-xs font-medium text-[var(--muted)] text-center uppercase tracking-wide">
              📊 {currentQuestion.figure_reference?.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())} <span className="text-brand-400 ml-1">(tap to enlarge)</span>
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
              📊 {currentQuestion.figure_reference?.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </p>
            <pre className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto">
              {currentQuestion.figure_text}
            </pre>
          </div>
        )}
        {/* Fallback: figure referenced but no image or text yet */}
        {currentQuestion.figure_reference && !currentQuestion.image_ref && !currentQuestion.figure_text && (
          <div className="mt-4 rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--background)] p-4 text-center text-sm text-[var(--muted)]">
            📊 Refer to {currentQuestion.figure_reference.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </div>
        )}
      </div>

      {/* Answer Options */}
      <div className="space-y-3">
        {currentQuestion.options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleAnswer(option.id)}
            disabled={answerState !== "unanswered"}
            className={getOptionStyle(option.id)}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  answerState !== "unanswered" &&
                  option.id === currentQuestion.correct_option_id
                    ? "bg-correct text-white"
                    : answerState === "incorrect" && option.id === selectedOption
                    ? "bg-incorrect text-white"
                    : "bg-[var(--background)] text-[var(--muted)]"
                }`}
              >
                {answerState !== "unanswered" &&
                option.id === currentQuestion.correct_option_id
                  ? "✓"
                  : answerState === "incorrect" && option.id === selectedOption
                  ? "✗"
                  : option.id}
              </span>
              <span className="pt-0.5">{option.text}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Feedback Panel (Study Mode — shown immediately after answering) */}
      {answerState !== "unanswered" && (
        <div
          className={`rounded-xl border p-6 ${
            answerState === "correct"
              ? "border-correct/30 bg-correct/5"
              : "border-incorrect/30 bg-incorrect/5"
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl">
              {answerState === "correct" ? "✅" : "❌"}
            </span>
            <span className="font-semibold text-white">
              {answerState === "correct" ? "Correct!" : "Incorrect"}
            </span>
          </div>

          {/* Why the correct answer is right */}
          <p className="text-sm leading-relaxed text-gray-300">
            {currentQuestion.explanation_correct}
          </p>

          {/* Why YOUR wrong answer was wrong (the distractor explanation) */}
          {answerState === "incorrect" && selectedOption && (
            <div className="mt-4 rounded-lg border border-incorrect/20 bg-incorrect/5 p-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-incorrect">
                Why &quot;{selectedOption}&quot; is wrong:
              </div>
              <p className="text-sm text-gray-400">
                {currentQuestion.explanation_distractors[selectedOption] ??
                  "This answer does not match the correct regulation."}
              </p>
            </div>
          )}

          {/* Citation — clickable reference links */}
          <CitationLinks citation={currentQuestion.citation} />

          {/* Next Button */}
          <button
            onClick={handleNext}
            className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white transition-all hover:bg-brand-700"
          >
            {currentIndex < questions.length - 1
              ? "Next Question →"
              : "See Results"}
          </button>
        </div>
      )}

      {/* Figure image modal (opens when user taps an image) */}
      {figureRef && (
        <ReferenceModal ref_={figureRef} onClose={() => setFigureRef(null)} />
      )}
    </div>
  );
}
