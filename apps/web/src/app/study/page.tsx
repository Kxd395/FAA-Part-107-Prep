"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  QUESTION_TYPE_PROFILE_LABELS,
  filterQuestionsByType,
  normalizeCategory,
  normalizeQuestionTypeProfile,
  type OptionId,
  type AttemptConfidence,
  type QuestionTypeProfile,
  useStudySession,
} from "@part107/core";
import CitationLinks, { ReferenceModal, type ResolvedReference } from "../../components/ReferenceModal";
import {
  QuestionBankError,
  QuestionBankLoading,
  QuestionBankWarning,
} from "../../components/QuestionBankState";
import { QuestionSelectionEmptyState } from "../../components/QuestionSelectionEmptyState";
import AnswerOptions from "../../components/quiz/AnswerOptions";
import ProgressHeader from "../../components/quiz/ProgressHeader";
import QuestionCard from "../../components/quiz/QuestionCard";
import SessionSummaryCard from "../../components/quiz/SessionSummaryCard";
import { useAdaptiveQuestionStats } from "../../hooks/useAdaptiveQuestionStats";
import { useLearningEventLogger } from "../../hooks/useLearningEventLogger";
import { useProgress } from "../../hooks/useProgress";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { extractCitationText, mergeCitations } from "../../lib/citationContext";
import {
  buildOptionPresentation,
  getDisplayLabelForOption,
} from "../../lib/optionPresentation";
import { STUDY_CATEGORIES, countQuestionsByCategory } from "../../lib/questionBank";
import { recordLearningAttempt } from "../../lib/learningAttemptPipeline";

const SUPPORTED_QUESTION_TYPES: readonly QuestionTypeProfile[] = [
  "confirmed_test",
  "all_random",
  "acs_practice",
  "real_exam",
  "weak_spots",
];

function normalizeSelectableQuestionTypeProfile(
  input: string | null | undefined
): QuestionTypeProfile | null {
  const normalized = normalizeQuestionTypeProfile(input);
  if (!normalized) return null;
  return SUPPORTED_QUESTION_TYPES.includes(normalized) ? normalized : null;
}

const QUESTION_TYPE_OPTIONS: Array<{
  value: QuestionTypeProfile;
  title: string;
  description: string;
}> = [
  {
    value: "confirmed_test",
    title: "✅ Confirmed Test Questions",
    description:
      "Only questions verified from the real FAA exam — Review.md, UAG, and SPA banks (70 questions).",
  },
  {
    value: "all_random",
    title: "🎲 All Questions (Random)",
    description:
      "Study from all 362 questions — confirmed test material plus ACS practice drills.",
  },
  {
    value: "acs_practice",
    title: "📚 ACS Practice Only",
    description:
      "Only ACS-generated mastery drills. Excludes confirmed real-test questions.",
  },
  {
    value: "real_exam",
    title: "Real Exam MCQ (Legacy)",
    description: "Shows FAA-style MCQs and excludes ACS code-mapping drill format questions.",
  },
  {
    value: "weak_spots",
    title: "🔥 Weak Spots Only",
    description: "Prioritizes realistic MCQs you still struggle with.",
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
  const focusParam = searchParams.get("focus");
  const invalidQuestionTypeParam =
    !!questionTypeParam && !normalizeSelectableQuestionTypeProfile(questionTypeParam);
  const weakFocusRequested = focusParam?.trim().toLowerCase() === "weak";
  const parsedQuestionType =
    normalizeSelectableQuestionTypeProfile(questionTypeParam) ??
    (weakFocusRequested ? "weak_spots" : "confirmed_test");
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionTypeProfile>(
    parsedQuestionType
  );
  const { saveSession } = useProgress();
  const { questions: allQuestions, loaded, loading, error, warning, snapshotInfo, reload, clearSnapshot } = useQuestionBank();
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
      onQuestionEvaluated: ({ question, selectedOption, isCorrect, confidence }) => {
        recordLearningAttempt({
          adaptive,
          events,
          question,
          learningMode: "study",
          attemptMode: "practice",
          isCorrect,
          selectedOptionId: selectedOption,
          responseTimeMs: Math.max(0, Date.now() - questionShownAtRef.current),
          confidence: confidence ?? null,
          questionTypeProfile: selectedQuestionType,
        });
      },
    },
  });
  const [figureRef, setFigureRef] = useState<ResolvedReference | null>(null);
  const autoStarted = useRef(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [pendingStudyAnswer, setPendingStudyAnswer] = useState<OptionId | null>(null);
  const [lastRecordedConfidence, setLastRecordedConfidence] = useState<AttemptConfidence | null>(null);

  const persistSession = useCallback(() => {
    if (sessionSaved || study.questionResults.length === 0) return;

    saveSession({
      mode: "study",
      category: study.selectedCategory,
      questionTypeProfile: selectedQuestionType,
      score: study.score.correct,
      total: study.score.total,
      timeSpentMs: Date.now() - study.sessionStartTime,
      questions: study.questionResults,
    });
    setSessionSaved(true);
  }, [
    saveSession,
    selectedQuestionType,
    sessionSaved,
    study.questionResults,
    study.score.correct,
    study.score.total,
    study.selectedCategory,
    study.sessionStartTime,
  ]);

  const handleSaveAndExit = useCallback(() => {
    persistSession();
    study.resetToSetup();
  }, [persistSession, study]);

  useEffect(() => {
    const nextType = normalizeSelectableQuestionTypeProfile(questionTypeParam);
    if (nextType) {
      setSelectedQuestionType(nextType);
      return;
    }
    if (weakFocusRequested) {
      setSelectedQuestionType("weak_spots");
    }
  }, [questionTypeParam, weakFocusRequested]);

  useEffect(() => {
    if (!loaded || autoStarted.current) return;

    if (!categoryParam && !weakFocusRequested) return;

    autoStarted.current = true;
    const matched = normalizeCategory(categoryParam);
    study.startQuiz(matched ?? "All");
  }, [categoryParam, loaded, study, weakFocusRequested]);

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
    setPendingStudyAnswer(null);
    setLastRecordedConfidence(null);
  }, [study.currentQuestion?.id]);

  useEffect(() => {
    if (!study.isComplete) return;
    persistSession();
  }, [persistSession, study.isComplete]);

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
    return <QuestionBankLoading label="Loading question bank..." />;
  }

  if (error && !loaded) {
    return <QuestionBankError error={error} onRetry={() => void reload()} />;
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

        {invalidQuestionTypeParam && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Question type &quot;{questionTypeParam}&quot; is not available in realistic mode. Falling
            back to Real Exam MCQ.
          </div>
        )}
        {filteredQuestions.length === 0 && <QuestionSelectionEmptyState context="study" />}

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
            <div className="mt-2">
              Real UAG questions are standard MCQs. ACS/learning codes are primarily post-test AKTR
              remediation signals.
            </div>
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
  const optionPresentation = buildOptionPresentation(
    study.currentQuestion,
    `study:${study.sessionStartTime}`
  );
  const selectedOptionDisplayLabel = getDisplayLabelForOption(
    optionPresentation.displayLabelByOptionId,
    study.selectedOption
  );
  const selectedAnswerCitation = mergeCitations(
    study.currentQuestion.citation,
    extractCitationText(selectedDistractorExplanation)
  );

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
        options={optionPresentation.options}
        mode="study"
        selectedOption={study.selectedOption ?? pendingStudyAnswer}
        correctOptionId={study.currentQuestion.correct_option_id}
        displayLabelByOptionId={optionPresentation.displayLabelByOptionId}
        answerState={study.answerState}
        onSelect={(optionId) => {
          if (study.answerState !== "unanswered") return;
          setPendingStudyAnswer(optionId);
        }}
        onSelectWithConfidence={(optionId, confidence) => {
          if (study.answerState !== "unanswered") return;
          study.answerQuestion(optionId, { confidence });
          setLastRecordedConfidence(confidence);
          setPendingStudyAnswer(null);
        }}
        showConfidenceSplit
        splitConfidenceMode="high_only"
        confidentConfidence={5}
        disabled={study.answerState !== "unanswered"}
      />

      {study.answerState === "unanswered" && pendingStudyAnswer && (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
          <div className="text-sm font-semibold text-white">How confident are you? (before reveal)</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => {
                  const confidence = value as AttemptConfidence;
                  study.answerQuestion(pendingStudyAnswer, { confidence });
                  setLastRecordedConfidence(confidence);
                  setPendingStudyAnswer(null);
                }}
                className="rounded-lg border border-brand-400/40 bg-brand-500/10 px-3 py-1.5 text-sm text-brand-200 hover:bg-brand-500/20"
              >
                {value}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-[var(--muted)]">
            Tip: click the <code>☑</code> on any answer for a one-click high-confidence submit.
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={study.skipQuestion}
          disabled={study.answerState !== "unanswered" || !!pendingStudyAnswer}
          className="rounded-xl border border-[var(--card-border)] px-4 py-2.5 text-sm text-[var(--muted)] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Skip for now →
        </button>
        <button
          onClick={handleSaveAndExit}
          className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-2.5 text-sm font-medium text-brand-300 transition-colors hover:bg-brand-500/20"
        >
          {study.questionResults.length > 0 ? "Save & Exit" : "Exit"}
        </button>
      </div>

      {study.answerState !== "unanswered" && (
        <div
          role="status"
          aria-live="polite"
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
                Why &quot;{selectedOptionDisplayLabel}&quot; is wrong:
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
              label={`📖 Why "${selectedOptionDisplayLabel}" reference:`}
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
          {lastRecordedConfidence && (
            <div className="mt-2 text-center text-xs text-[var(--muted)]">
              Confidence recorded: {lastRecordedConfidence}/5
            </div>
          )}
        </div>
      )}

      {figureRef && <ReferenceModal ref_={figureRef} onClose={() => setFigureRef(null)} />}
    </div>
  );
}
