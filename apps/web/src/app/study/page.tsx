"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { normalizeCategory, type OptionId } from "@part107/core";
import CitationLinks, { ReferenceModal, type ResolvedReference } from "../../components/ReferenceModal";
import ProgressHeader from "../../components/quiz/ProgressHeader";
import QuestionCard from "../../components/quiz/QuestionCard";
import SessionSummaryCard from "../../components/quiz/SessionSummaryCard";
import { useProgress, type QuestionResult } from "../../hooks/useProgress";
import {
  ALL_QUESTIONS,
  STUDY_CATEGORIES,
  buildStudyQuestionSet,
  getQuestionsForCategory,
  type AppQuestion,
  type StudyCategory,
} from "../../lib/questionBank";

type AnswerState = "unanswered" | "correct" | "incorrect";

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
  const searchParams = useSearchParams();
  const { saveSession } = useProgress();
  const questionResults = useRef<QuestionResult[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<StudyCategory>("All");
  const [questions, setQuestions] = useState<AppQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<OptionId | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("unanswered");
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [quizStarted, setQuizStarted] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const autoStarted = useRef(false);

  const [figureRef, setFigureRef] = useState<ResolvedReference | null>(null);

  const startQuiz = useCallback((category: StudyCategory) => {
    setQuestions(buildStudyQuestionSet(category));
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswerState("unanswered");
    setScore({ correct: 0, total: 0 });
    setSessionStartTime(Date.now());
    setQuizStarted(true);
    setSessionSaved(false);
    setSelectedCategory(category);
    questionResults.current = [];
  }, []);

  useEffect(() => {
    if (autoStarted.current) return;
    const categoryParam = searchParams.get("category");
    if (!categoryParam) return;

    autoStarted.current = true;
    const matched = normalizeCategory(categoryParam);
    startQuiz(matched ?? "All");
  }, [searchParams, startQuiz]);

  const currentQuestion = questions[currentIndex] ?? null;

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
  }, [
    currentIndex,
    questions.length,
    quizStarted,
    saveSession,
    score,
    selectedCategory,
    sessionSaved,
    sessionStartTime,
  ]);

  const handleAnswer = (optionId: OptionId) => {
    if (answerState !== "unanswered" || !currentQuestion) return;

    const isCorrect = optionId === currentQuestion.correct_option_id;
    setSelectedOption(optionId);
    setAnswerState(isCorrect ? "correct" : "incorrect");
    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));

    questionResults.current.push({
      questionId: currentQuestion.id,
      userAnswer: optionId,
      correctAnswer: currentQuestion.correct_option_id,
      isCorrect,
      category: currentQuestion.category,
    });
  };

  const handleNext = () => {
    if (currentIndex >= questions.length - 1) return;
    setCurrentIndex((prev) => prev + 1);
    setSelectedOption(null);
    setAnswerState("unanswered");
  };

  const getOptionStyle = (optionId: OptionId) => {
    const base = "answer-option w-full rounded-xl border p-4 text-left transition-all cursor-pointer";

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

  if (!quizStarted) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">📖 Study Mode</h1>
          <p className="mt-2 text-[var(--muted)]">
            Choose a topic to drill down on, or study all categories. You&apos;ll get instant feedback after each answer.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {STUDY_CATEGORIES.map((category) => {
            const count =
              category === "All" ? ALL_QUESTIONS.length : getQuestionsForCategory(category).length;

            return (
              <button
                key={category}
                onClick={() => startQuiz(category)}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-left transition-all hover:border-brand-500/50 hover:scale-[1.02]"
              >
                <div className="text-lg font-semibold text-white">{category}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{count} questions available</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (currentIndex >= questions.length || !currentQuestion) {
    const percentage = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    const passed = percentage >= 70;

    return (
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <div className="text-6xl">{passed ? "🎉" : "📚"}</div>
        <h1 className="text-3xl font-bold">{passed ? "Great Job!" : "Keep Studying!"}</h1>

        <SessionSummaryCard
          passed={passed}
          percentage={percentage}
          correct={score.correct}
          total={score.total}
          subtitle="Passing score: 70% (42 of 60 on the real exam)"
        />

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

  const progress = ((currentIndex + 1) / questions.length) * 100;
  const rightLabel =
    score.total > 0
      ? `Score: ${score.correct}/${score.total} (${Math.round((score.correct / score.total) * 100)}%)`
      : `Score: ${score.correct}/${score.total}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ProgressHeader
        left={`Question ${currentIndex + 1} of ${questions.length}`}
        right={rightLabel}
        progress={progress}
        progressClassName="progress-fill bg-brand-500"
      />

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

      <QuestionCard question={currentQuestion} onOpenFigure={setFigureRef} />

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
                  answerState !== "unanswered" && option.id === currentQuestion.correct_option_id
                    ? "bg-correct text-white"
                    : answerState === "incorrect" && option.id === selectedOption
                      ? "bg-incorrect text-white"
                      : "bg-[var(--background)] text-[var(--muted)]"
                }`}
              >
                {answerState !== "unanswered" && option.id === currentQuestion.correct_option_id
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

      {answerState !== "unanswered" && (
        <div
          className={`rounded-xl border p-6 ${
            answerState === "correct" ? "border-correct/30 bg-correct/5" : "border-incorrect/30 bg-incorrect/5"
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl">{answerState === "correct" ? "✅" : "❌"}</span>
            <span className="font-semibold text-white">{answerState === "correct" ? "Correct!" : "Incorrect"}</span>
          </div>

          <p className="text-sm leading-relaxed text-gray-300">{currentQuestion.explanation_correct}</p>

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

          <CitationLinks citation={currentQuestion.citation} />

          <button
            onClick={handleNext}
            className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white transition-all hover:bg-brand-700"
          >
            {currentIndex < questions.length - 1 ? "Next Question →" : "See Results"}
          </button>
        </div>
      )}

      {figureRef && <ReferenceModal ref_={figureRef} onClose={() => setFigureRef(null)} />}
    </div>
  );
}
