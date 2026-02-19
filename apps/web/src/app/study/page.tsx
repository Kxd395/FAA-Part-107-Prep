"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  QUESTION_TYPE_PROFILE_LABELS,
  filterQuestionsByType,
  normalizeCategory,
  normalizeQuestionTypeProfile,
  type QuestionTypeProfile,
  useStudySession,
} from "@part107/core";
import CitationLinks, { ReferenceModal, type ResolvedReference } from "../../components/ReferenceModal";
import AnswerOptions from "../../components/quiz/AnswerOptions";
import ProgressHeader from "../../components/quiz/ProgressHeader";
import QuestionCard from "../../components/quiz/QuestionCard";
import SessionSummaryCard from "../../components/quiz/SessionSummaryCard";
import { useAdaptiveQuestionStats } from "../../hooks/useAdaptiveQuestionStats";
import { useLearningEventLogger } from "../../hooks/useLearningEventLogger";
import { useProgress } from "../../hooks/useProgress";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { extractCitationText, mergeCitations } from "../../lib/citationContext";
import { STUDY_CATEGORIES, countQuestionsByCategory } from "../../lib/questionBank";

const QUESTION_TYPE_OPTIONS: Array<{
  value: QuestionTypeProfile;
  title: string;
  description: string;
}> = [
  {
    value: "real_exam",
    title: "Exclude ACS Code-Matching (Recommended)",
    description: "Shows realistic FAA-style prompts and excludes ACS code-recall questions.",
  },
  {
    value: "acs_mastery",
    title: "ACS Mastery",
    description: "Focuses on ACS code mapping and memorization.",
  },
  {
    value: "mixed",
    title: "Mixed",
    description: "Includes both exam-style and ACS mastery prompts.",
  },
  {
    value: "weak_spots",
    title: "Weak Spots Only",
    description: "Prioritizes questions you still struggle with.",
  },
];

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
  const categoryParam = searchParams.get("category");
  const questionTypeParam = searchParams.get("type");
  const parsedQuestionType = normalizeQuestionTypeProfile(questionTypeParam) ?? "real_exam";
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionTypeProfile>(
    parsedQuestionType
  );
  const { saveSession } = useProgress();
  const { questions: allQuestions, loaded, loading, error, reload } = useQuestionBank();
  const adaptive = useAdaptiveQuestionStats();
  const events = useLearningEventLogger(adaptive.userId);
  const filteredQuestions = useMemo(
    () =>
      filterQuestionsByType(allQuestions, selectedQuestionType, {
        userStatsByKey: adaptive.statsByKey,
        adaptiveConfig: adaptive.config,
      }),
    [adaptive.config, adaptive.statsByKey, allQuestions, selectedQuestionType]
  );
  const visibleCounts = useMemo(() => countQuestionsByCategory(filteredQuestions), [filteredQuestions]);
  const questionShownAtRef = useRef(Date.now());

  const study = useStudySession({
    allQuestions: filteredQuestions,
    adaptive: {
      userId: adaptive.userId,
      userStatsByKey: adaptive.statsByKey,
      config: adaptive.config,
      onQuestionEvaluated: ({ question, selectedOption, isCorrect }) => {
        adaptive.recordAnswer(question, isCorrect, Date.now(), {
          mode: "practice",
          selectedOptionId: selectedOption,
          responseTimeMs: Math.max(0, Date.now() - questionShownAtRef.current),
          quizId: null,
        });
        events.logEvent({
          type: "answer_submitted",
          mode: "study",
          questionId: question.id,
          category: question.category,
          subcategory: question.subcategory,
          selectedOption,
          correctOption: question.correct_option_id,
          isCorrect,
        });
      },
    },
  });
  const [figureRef, setFigureRef] = useState<ResolvedReference | null>(null);
  const autoStarted = useRef(false);
  const [sessionSaved, setSessionSaved] = useState(false);

  useEffect(() => {
    const nextType = normalizeQuestionTypeProfile(questionTypeParam);
    if (!nextType) return;
    setSelectedQuestionType(nextType);
  }, [questionTypeParam]);

  useEffect(() => {
    if (!loaded || autoStarted.current) return;

    if (!categoryParam) return;

    autoStarted.current = true;
    const matched = normalizeCategory(categoryParam);
    study.startQuiz(matched ?? "All");
  }, [categoryParam, loaded, study]);

  useEffect(() => {
    if (!study.quizStarted || study.isComplete || !study.currentQuestion) return;
    questionShownAtRef.current = Date.now();

    events.logEvent({
      type: "question_shown",
      mode: "study",
      questionId: study.currentQuestion.id,
      category: study.currentQuestion.category,
      subcategory: study.currentQuestion.subcategory,
    });
  }, [events, study.currentQuestion, study.isComplete, study.quizStarted]);

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

  useEffect(() => {
    if (study.answerState === "unanswered" || !study.currentQuestion) return;

    events.logEvent({
      type: "review_opened",
      mode: "study",
      questionId: study.currentQuestion.id,
      category: study.currentQuestion.category,
      subcategory: study.currentQuestion.subcategory,
      isCorrect: study.answerState === "correct",
    });
  }, [events, study.answerState, study.currentQuestion]);

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
            Selected:{" "}
            <span className="font-medium text-brand-400">
              {QUESTION_TYPE_PROFILE_LABELS[selectedQuestionType]}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {STUDY_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => study.startQuiz(category)}
              className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 text-left transition-all hover:border-brand-500/50 hover:scale-[1.02]"
            >
              <div className="text-lg font-semibold text-white">{category}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">
                {visibleCounts[category] ?? 0} questions available
              </div>
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
  const selectedDistractorExplanation =
    study.selectedOption && study.answerState === "incorrect"
      ? study.currentQuestion.explanation_distractors[study.selectedOption] ??
        "This answer does not match the correct regulation."
      : null;
  const selectedAnswerCitation = mergeCitations(
    study.currentQuestion.citation,
    extractCitationText(selectedDistractorExplanation)
  );

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
          {QUESTION_TYPE_PROFILE_LABELS[selectedQuestionType]}
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
              <p className="text-sm text-gray-400">{selectedDistractorExplanation}</p>
            </div>
          )}

          <CitationLinks
            citation={study.currentQuestion.citation}
            label="📖 Correct answer reference:"
            onReferenceClick={(ref) => {
              events.logEvent({
                type: "citation_clicked",
                mode: "study",
                questionId: study.currentQuestion?.id,
                category: study.currentQuestion?.category,
                subcategory: study.currentQuestion?.subcategory,
                citationLabel: `correct:${ref.label}`,
                citationUrl: ref.url,
              });
            }}
          />

          {study.answerState === "incorrect" && study.selectedOption && (
            <CitationLinks
              citation={selectedAnswerCitation}
              label={`📖 Why "${study.selectedOption}" reference:`}
              onReferenceClick={(ref) => {
                events.logEvent({
                  type: "citation_clicked",
                  mode: "study",
                  questionId: study.currentQuestion?.id,
                  category: study.currentQuestion?.category,
                  subcategory: study.currentQuestion?.subcategory,
                  citationLabel: `selected:${study.selectedOption}:${ref.label}`,
                  citationUrl: ref.url,
                });
              }}
            />
          )}

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
