"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { normalizeCategory, useStudySession } from "@part107/core";
import CitationLinks, { ReferenceModal, type ResolvedReference } from "../../components/ReferenceModal";
import AnswerOptions from "../../components/quiz/AnswerOptions";
import ProgressHeader from "../../components/quiz/ProgressHeader";
import QuestionCard from "../../components/quiz/QuestionCard";
import SessionSummaryCard from "../../components/quiz/SessionSummaryCard";
import { useProgress } from "../../hooks/useProgress";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { STUDY_CATEGORIES } from "../../lib/questionBank";

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
  const { questions: allQuestions, loaded, loading, error, counts, reload } = useQuestionBank();

  const study = useStudySession({ allQuestions });
  const [figureRef, setFigureRef] = useState<ResolvedReference | null>(null);
  const autoStarted = useRef(false);
  const [sessionSaved, setSessionSaved] = useState(false);

  useEffect(() => {
    if (!loaded || autoStarted.current) return;

    const categoryParam = searchParams.get("category");
    if (!categoryParam) return;

    autoStarted.current = true;
    const matched = normalizeCategory(categoryParam);
    study.startQuiz(matched ?? "All");
  }, [loaded, searchParams, study]);

  useEffect(() => {
    if (study.quizStarted && !study.isComplete) {
      setSessionSaved(false);
    }
  }, [study.quizStarted, study.isComplete, study.sessionStartTime]);

  useEffect(() => {
    if (!study.isComplete || sessionSaved || study.questionResults.length === 0) return;

    saveSession({
      mode: "study",
      category: study.selectedCategory,
      score: study.score.correct,
      total: study.score.total,
      timeSpentMs: Date.now() - study.sessionStartTime,
      questions: study.questionResults,
    });
    setSessionSaved(true);
  }, [saveSession, sessionSaved, study]);

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

  if (!study.quizStarted) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">📖 Study Mode</h1>
          <p className="mt-2 text-[var(--muted)]">
            Choose a topic to drill down on, or study all categories. You&apos;ll get instant feedback after each answer.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {STUDY_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => study.startQuiz(category)}
              className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-left transition-all hover:border-brand-500/50 hover:scale-[1.02]"
            >
              <div className="text-lg font-semibold text-white">{category}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{counts[category] ?? 0} questions available</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (study.isComplete || !study.currentQuestion) {
    const percentage =
      study.score.total > 0 ? Math.round((study.score.correct / study.score.total) * 100) : 0;
    const passed = percentage >= 70;

    return (
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <div className="text-6xl">{passed ? "🎉" : "📚"}</div>
        <h1 className="text-3xl font-bold">{passed ? "Great Job!" : "Keep Studying!"}</h1>

        <SessionSummaryCard
          passed={passed}
          percentage={percentage}
          correct={study.score.correct}
          total={study.score.total}
          subtitle="Passing score: 70% (42 of 60 on the real exam)"
        />

        <div className="flex gap-3">
          <button
            onClick={study.restartQuiz}
            className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Try Again
          </button>
          <button
            onClick={study.resetToSetup}
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

  const rightLabel =
    study.score.total > 0
      ? `Score: ${study.score.correct}/${study.score.total} (${Math.round((study.score.correct / study.score.total) * 100)}%)`
      : `Score: ${study.score.correct}/${study.score.total}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ProgressHeader
        left={`Question ${study.currentIndex + 1} of ${study.questions.length}`}
        right={rightLabel}
        progress={study.progressPercent}
        progressClassName="progress-fill bg-brand-500"
      />

      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">
          {study.currentQuestion.category}
        </span>
        <span className="rounded-full bg-[var(--card)] px-3 py-1 text-xs text-[var(--muted)]">
          {study.currentQuestion.subcategory}
        </span>
        <span className="rounded-full bg-[var(--card)] px-3 py-1 text-xs text-[var(--muted)]">
          {"⭐".repeat(study.currentQuestion.difficulty_level)}
        </span>
      </div>

      <QuestionCard question={study.currentQuestion} onOpenFigure={setFigureRef} />

      <AnswerOptions
        options={study.currentQuestion.options}
        mode="study"
        selectedOption={study.selectedOption}
        correctOptionId={study.currentQuestion.correct_option_id}
        answerState={study.answerState}
        onSelect={study.answerQuestion}
        disabled={study.answerState !== "unanswered"}
      />

      {study.answerState !== "unanswered" && (
        <div
          className={`rounded-xl border p-6 ${
            study.answerState === "correct"
              ? "border-correct/30 bg-correct/5"
              : "border-incorrect/30 bg-incorrect/5"
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl">{study.answerState === "correct" ? "✅" : "❌"}</span>
            <span className="font-semibold text-white">
              {study.answerState === "correct" ? "Correct!" : "Incorrect"}
            </span>
          </div>

          <p className="text-sm leading-relaxed text-gray-300">{study.currentQuestion.explanation_correct}</p>

          {study.answerState === "incorrect" && study.selectedOption && (
            <div className="mt-4 rounded-lg border border-incorrect/20 bg-incorrect/5 p-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-incorrect">
                Why &quot;{study.selectedOption}&quot; is wrong:
              </div>
              <p className="text-sm text-gray-400">
                {study.currentQuestion.explanation_distractors[study.selectedOption] ??
                  "This answer does not match the correct regulation."}
              </p>
            </div>
          )}

          <CitationLinks citation={study.currentQuestion.citation} />

          <button
            onClick={study.nextQuestion}
            className="mt-4 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white transition-all hover:bg-brand-700"
          >
            {study.currentIndex < study.questions.length - 1 ? "Next Question →" : "See Results"}
          </button>
        </div>
      )}

      {figureRef && <ReferenceModal ref_={figureRef} onClose={() => setFigureRef(null)} />}
    </div>
  );
}
