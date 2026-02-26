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
  normalizeCategory,
  type StudyCategory,
  type QuestionTypeProfile,
  useExamSession,
} from "@part107/core";
import CitationLinks, { ReferenceModal, type ResolvedReference } from "../../components/ReferenceModal";
import {
  QuestionBankError,
  QuestionBankLoading,
  QuestionBankWarning,
} from "../../components/QuestionBankState";
import QuestionTypeOptionsGrid from "../../components/QuestionTypeOptionsGrid";
import { QuestionSelectionEmptyState } from "../../components/QuestionSelectionEmptyState";
import ActionBar from "../../components/quiz/ActionBar";
import AnswerOptions from "../../components/quiz/AnswerOptions";
import ConfidencePanel from "../../components/quiz/ConfidencePanel";
import ProgressHeader from "../../components/quiz/ProgressHeader";
import QuestionCard from "../../components/quiz/QuestionCard";
import SessionButton from "../../components/quiz/SessionButton";
import SessionSummaryCard from "../../components/quiz/SessionSummaryCard";
import { useAdaptiveQuestionStats } from "../../hooks/useAdaptiveQuestionStats";
import { useActiveUserId } from "../../hooks/useActiveUserId";
import { useLearningEventLogger } from "../../hooks/useLearningEventLogger";
import { useProgress, type QuestionResult } from "../../hooks/useProgress";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { extractCitationText, mergeCitations } from "../../lib/citationContext";
import {
  buildOptionPresentation,
  getDisplayLabelForOption,
  getOptionTextById,
} from "../../lib/optionPresentation";
import { recordLearningAttempt } from "../../lib/learningAttemptPipeline";
import {
  QUESTION_TYPE_OPTION_LABELS,
  SELECTABLE_QUESTION_TYPE_OPTIONS as QUESTION_TYPE_OPTIONS,
  normalizeSelectableQuestionTypeProfile,
} from "../../lib/questionTypeOptions";
import {
  readExamStrictConfirmedOnly,
  writeExamStrictConfirmedOnly,
} from "../../lib/examGuardrailStore";
import {
  readPreferredQuestionType,
  writePreferredQuestionType,
} from "../../lib/questionTypePreferenceStore";
import {
  normalizeQuestionCollectionFilter,
  createQuestionCollection,
  hasQuestionCollection,
  listQuestionCollections,
  readQuestionCollectionQuestionIds,
  toggleQuestionInCollection,
  type QuestionCollectionFilter,
  readBookmarkedQuestionIds,
} from "../../lib/questionCollectionStore";
import {
  applySessionPresetTemplate,
  createSessionPresetTemplate,
  deleteSessionPresetTemplate,
  duplicateSessionPresetTemplate,
  renameSessionPresetTemplate,
  readDefaultSessionPresetTemplateId,
  readSessionPresetTemplates,
  readStudySetupPresetSelection,
  readExamSetupPresetSelection,
  writeDefaultSessionPresetTemplateId,
  writeExamSetupPresetSelection,
} from "../../lib/sessionPresetStore";
import { computeWeakDomainInsights } from "../../lib/weakDomainInsights";
import { readLearningPreferences, writeLearningPreferences } from "../../lib/learningPreferencesStore";

const PASSING_PERCENT = 70;
const EXAM_DEFAULT_CONFIDENCE: AttemptConfidence = 3;
const EXAM_CONFIDENT_CONFIDENCE: AttemptConfidence = 5;
const EXAM_LENGTH_PRESETS = [
  { id: "full", label: "Full (up to 60)", questionLimit: null as number | null },
  { id: "half", label: "Half (30)", questionLimit: 30 },
  { id: "quick", label: "Quick (20)", questionLimit: 20 },
] as const;
const EXAM_TIMER_PRESETS = [
  { id: "auto", label: "Auto", timeLimitMs: null as number | null },
  { id: "60m", label: "60 min", timeLimitMs: 60 * 60 * 1000 },
  { id: "30m", label: "30 min", timeLimitMs: 30 * 60 * 1000 },
  { id: "15m", label: "15 min", timeLimitMs: 15 * 60 * 1000 },
] as const;
const WEAK_DOMAIN_MOCK_SETTINGS = {
  questionLimit: 20,
  timeLimitMs: 30 * 60 * 1000,
} as const;
const WEAK_DOMAIN_MOCK_TIME_MINUTES = Math.round(WEAK_DOMAIN_MOCK_SETTINGS.timeLimitMs / 60000);

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
  const normalizedCategoryParam = normalizeCategory(categoryParam);
  const invalidCategoryParam = !!categoryParam && !normalizedCategoryParam;
  const questionTypeParam = searchParams.get("type");
  const collectionParam = searchParams.get("collection");
  const invalidQuestionTypeParam =
    !!questionTypeParam && !normalizeSelectableQuestionTypeProfile(questionTypeParam);
  const parsedQuestionType = normalizeSelectableQuestionTypeProfile(questionTypeParam) ?? "confirmed_test";
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionTypeProfile>(
    parsedQuestionType
  );
  const [setupCategory, setSetupCategory] = useState<StudyCategory>(normalizedCategoryParam ?? "All");

  const activeUserId = useActiveUserId();
  const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState<Set<string>>(new Set());
  const [availableCollections, setAvailableCollections] = useState<
    Array<{ id: string; name: string; questionCount: number; system: boolean }>
  >([]);
  const [selectedCollectionFilter, setSelectedCollectionFilter] =
    useState<QuestionCollectionFilter>(() => normalizeQuestionCollectionFilter(collectionParam));
  const [collectionsHydrated, setCollectionsHydrated] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [collectionNotice, setCollectionNotice] = useState<string | null>(null);
  const { saveSession } = useProgress(activeUserId);
  const adaptive = useAdaptiveQuestionStats(activeUserId);
  const events = useLearningEventLogger(adaptive.userId);
  const weakDomainInsights = computeWeakDomainInsights(adaptive.getAttemptEvents(), {
    minAttempts: 2,
    maxDomains: 5,
  });
  const collectionFilterExists =
    selectedCollectionFilter === "all" ||
    hasQuestionCollection(activeUserId, selectedCollectionFilter);
  const effectiveCollectionFilter = collectionFilterExists ? selectedCollectionFilter : "all";
  const invalidCollectionParam =
    collectionsHydrated && !!collectionParam && !collectionFilterExists;
  const activeCollectionSummary =
    effectiveCollectionFilter === "all"
      ? null
      : availableCollections.find((collection) => collection.id === effectiveCollectionFilter) ??
      null;
  const selectedCollectionQuestionIds = useMemo(() => {
    if (effectiveCollectionFilter === "all") return null;
    return readQuestionCollectionQuestionIds(activeUserId, effectiveCollectionFilter);
  }, [activeUserId, effectiveCollectionFilter]);
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
  const collectionFilteredQuestions = useMemo(() => {
    if (!selectedCollectionQuestionIds) return allQuestions;
    return allQuestions.filter((question) => selectedCollectionQuestionIds.has(question.id));
  }, [allQuestions, selectedCollectionQuestionIds]);
  const exam = useExamSession({
    allQuestions: collectionFilteredQuestions,
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
  const [answerConfidence, setAnswerConfidence] = useState<AttemptConfidence>(EXAM_DEFAULT_CONFIDENCE);
  const [answerConfidenceByQuestionId, setAnswerConfidenceByQuestionId] = useState<
    Map<string, AttemptConfidence>
  >(new Map());
  const [selectedLengthPresetId, setSelectedLengthPresetId] = useState<
    (typeof EXAM_LENGTH_PRESETS)[number]["id"]
  >("full");
  const [selectedTimerPresetId, setSelectedTimerPresetId] = useState<
    (typeof EXAM_TIMER_PRESETS)[number]["id"]
  >("auto");
  const [presetHydratedForUserId, setPresetHydratedForUserId] = useState<string | null>(null);
  const [sessionTemplates, setSessionTemplates] = useState<
    Array<{ id: string; name: string; exam: { lengthPresetId: string; timerPresetId: string } }>
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);
  const [strictConfirmedOnly, setStrictConfirmedOnly] = useState(false);
  const [strictGuardrailHydratedForUserId, setStrictGuardrailHydratedForUserId] = useState<
    string | null
  >(null);
  const [flaggedReviewPassActive, setFlaggedReviewPassActive] = useState(false);
  const lastReviewLoggedStartRef = useRef<number | null>(null);
  const questionShownAtRef = useRef(Date.now());
  const selectedLengthPreset =
    EXAM_LENGTH_PRESETS.find((preset) => preset.id === selectedLengthPresetId) ??
    EXAM_LENGTH_PRESETS[0];
  const selectedTimerPreset =
    EXAM_TIMER_PRESETS.find((preset) => preset.id === selectedTimerPresetId) ??
    EXAM_TIMER_PRESETS[0];
  const defaultTemplateName =
    (defaultTemplateId
      ? sessionTemplates.find((template) => template.id === defaultTemplateId)?.name
      : null) ?? null;
  const runSettings = {
    questionLimit: selectedLengthPreset.questionLimit,
    timeLimitMs: selectedTimerPreset.timeLimitMs,
  };

  useEffect(() => {
    setSelectedCollectionFilter(normalizeQuestionCollectionFilter(collectionParam));
  }, [collectionParam]);

  useEffect(() => {
    setSetupCategory(normalizeCategory(categoryParam) ?? "All");
  }, [categoryParam]);

  useEffect(() => {
    setBookmarkedQuestionIds(readBookmarkedQuestionIds(activeUserId));
    setAvailableCollections(listQuestionCollections(activeUserId));
    setCollectionsHydrated(true);
  }, [activeUserId]);

  useEffect(() => {
    const nextType = normalizeSelectableQuestionTypeProfile(questionTypeParam);
    if (!nextType) return;
    setSelectedQuestionType(nextType);
  }, [questionTypeParam]);

  useEffect(() => {
    if (questionTypeParam) return;
    const preferred = readPreferredQuestionType(activeUserId);
    if (preferred) {
      setSelectedQuestionType(preferred);
    }
  }, [activeUserId, questionTypeParam]);

  useEffect(() => {
    writePreferredQuestionType(activeUserId, selectedQuestionType);
  }, [activeUserId, selectedQuestionType]);

  useEffect(() => {
    let stored = readExamSetupPresetSelection(activeUserId);
    if (!stored) {
      const defaultTemplate = readDefaultSessionPresetTemplateId(activeUserId);
      if (defaultTemplate) {
        applySessionPresetTemplate(activeUserId, defaultTemplate);
        stored = readExamSetupPresetSelection(activeUserId);
      }
    }
    if (stored) {
      if (EXAM_LENGTH_PRESETS.some((preset) => preset.id === stored.lengthPresetId)) {
        setSelectedLengthPresetId(
          stored.lengthPresetId as (typeof EXAM_LENGTH_PRESETS)[number]["id"]
        );
      }
      if (EXAM_TIMER_PRESETS.some((preset) => preset.id === stored.timerPresetId)) {
        setSelectedTimerPresetId(
          stored.timerPresetId as (typeof EXAM_TIMER_PRESETS)[number]["id"]
        );
      }
    }
    const templates = readSessionPresetTemplates(activeUserId);
    setSessionTemplates(templates);
    const storedDefaultTemplate = readDefaultSessionPresetTemplateId(activeUserId);
    setDefaultTemplateId(storedDefaultTemplate);
    if (storedDefaultTemplate) {
      setSelectedTemplateId(storedDefaultTemplate);
    }
    const preferences = readLearningPreferences(activeUserId);
    if (!normalizedCategoryParam) {
      setSetupCategory(preferences.defaultExamCategory);
    }
    setPresetHydratedForUserId(activeUserId);
  }, [activeUserId, normalizedCategoryParam]);

  useEffect(() => {
    if (presetHydratedForUserId !== activeUserId) return;
    writeExamSetupPresetSelection(activeUserId, {
      lengthPresetId: selectedLengthPresetId,
      timerPresetId: selectedTimerPresetId,
    });
  }, [
    activeUserId,
    presetHydratedForUserId,
    selectedLengthPresetId,
    selectedTimerPresetId,
  ]);

  useEffect(() => {
    if (presetHydratedForUserId !== activeUserId) return;
    const current = readLearningPreferences(activeUserId);
    if (current.defaultExamCategory === setupCategory) return;
    writeLearningPreferences(activeUserId, {
      ...current,
      defaultExamCategory: setupCategory,
    });
  }, [activeUserId, presetHydratedForUserId, setupCategory]);

  useEffect(() => {
    setStrictConfirmedOnly(readExamStrictConfirmedOnly(activeUserId));
    setStrictGuardrailHydratedForUserId(activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    if (strictGuardrailHydratedForUserId !== activeUserId) return;
    writeExamStrictConfirmedOnly(activeUserId, strictConfirmedOnly);
  }, [activeUserId, strictConfirmedOnly, strictGuardrailHydratedForUserId]);

  useEffect(() => {
    setConfirmDeleteTemplateId(null);
  }, [selectedTemplateId]);

  useEffect(() => {
    if (exam.phase === "in-progress") {
      setSessionSaved(false);
      setAnswerConfidence(EXAM_DEFAULT_CONFIDENCE);
      setAnswerConfidenceByQuestionId(new Map());
      setFlaggedReviewPassActive(false);
    }
  }, [exam.phase, exam.startTime]);

  useEffect(() => {
    if (exam.phase !== "in-progress") {
      setFlaggedReviewPassActive(false);
      return;
    }
    if (flaggedReviewPassActive && exam.flagged.size === 0) {
      setFlaggedReviewPassActive(false);
    }
  }, [exam.flagged.size, exam.phase, flaggedReviewPassActive]);

  useEffect(() => {
    if (exam.phase !== "in-progress" || !exam.currentQuestion) return;
    questionShownAtRef.current = Date.now();
    events.logEvent({
      type: "question_shown",
      mode: "exam",
      questionId: exam.currentQuestion.id,
      category: exam.currentQuestion.category,
      subcategory: exam.currentQuestion.subcategory,
      questionTypeProfile: exam.questionTypeProfile,
    });
  }, [events, exam.phase, exam.currentQuestion, exam.questionTypeProfile]);

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

  const handleAnswerSelect = useCallback(
    (optionId: "A" | "B" | "C" | "D", confidence: AttemptConfidence = EXAM_DEFAULT_CONFIDENCE) => {
      if (!exam.currentQuestion) return;
      const responseTimeMs = Math.max(0, Date.now() - questionShownAtRef.current);
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
        responseTimeMs,
        confidence,
        questionTypeProfile: exam.questionTypeProfile,
        persistAdaptive: false,
      });
      exam.selectAnswer(optionId);
    },
    [adaptive, events, exam]
  );

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
      { mode: "mock", quizId: String(exam.startTime) }
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

  const flaggedIndexes = useMemo(
    () =>
      exam.questions
        .map((question, index) => (exam.flagged.has(question.id) ? index : -1))
        .filter((index) => index >= 0),
    [exam.flagged, exam.questions]
  );
  const nextFlaggedIndex =
    flaggedIndexes.find((index) => index > exam.currentIndex) ?? null;
  const firstFlaggedIndex = flaggedIndexes[0] ?? null;

  const handleContinueFlaggedReviewPass = useCallback(() => {
    if (!flaggedReviewPassActive || exam.phase !== "in-progress") return;
    if (nextFlaggedIndex != null) {
      exam.goToQuestion(nextFlaggedIndex);
      return;
    }
    setFlaggedReviewPassActive(false);
    exam.submitExam();
  }, [exam, flaggedReviewPassActive, nextFlaggedIndex]);

  const handleSubmitClick = useCallback(() => {
    if (exam.phase !== "in-progress") return;
    if (flaggedReviewPassActive) {
      handleContinueFlaggedReviewPass();
      return;
    }
    if (firstFlaggedIndex != null) {
      setFlaggedReviewPassActive(true);
      exam.goToQuestion(firstFlaggedIndex);
      setShowNavigator(false);
      return;
    }
    exam.submitExam();
  }, [exam, firstFlaggedIndex, flaggedReviewPassActive, handleContinueFlaggedReviewPass]);
  const toggleCurrentBookmark = useCallback(() => {
    if (!exam.currentQuestion) return;
    toggleQuestionInCollection(activeUserId, "bookmarks", exam.currentQuestion.id);
    setBookmarkedQuestionIds(readBookmarkedQuestionIds(activeUserId));
    setAvailableCollections(listQuestionCollections(activeUserId));
  }, [activeUserId, exam.currentQuestion]);

  if (loading && !loaded) {
    return <QuestionBankLoading label="Loading question bank..." />;
  }

  if (error && !loaded) {
    return <QuestionBankError error={error} onRetry={() => void reload()} />;
  }

  if (exam.phase === "setup") {
    const preview = exam.getSetupPreview(setupCategory, selectedQuestionType, runSettings);
    const strictGuardrailBlocked =
      strictConfirmedOnly && selectedQuestionType !== "confirmed_test";
    const timeDisplay =
      preview.timeLimitMs >= 60 * 60 * 1000
        ? `${Math.round(preview.timeLimitMs / (60 * 60 * 1000))} Hours`
        : `${Math.round(preview.timeLimitMs / 60000)} min`;
    const fullRealExamShortfall =
      preview.category === "All" &&
      preview.questionTypeProfile === "real_exam" &&
      runSettings.questionLimit == null
        ? Math.max(0, FULL_EXAM_QUESTION_COUNT - preview.questionCount)
        : 0;

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

        {invalidCategoryParam && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Unknown category &quot;{categoryParam}&quot;. Falling back to full practice exam.
          </div>
        )}

        {invalidQuestionTypeParam && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Question type &quot;{questionTypeParam}&quot; is not available in realistic mode. Falling
            back to {QUESTION_TYPE_OPTION_LABELS.confirmed_test}.
          </div>
        )}
        {invalidCollectionParam && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Collection &quot;{collectionParam}&quot; is not available. Using all questions.
          </div>
        )}
        {activeCollectionSummary && (
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-300">
            Collection filter active: {activeCollectionSummary.name} ({activeCollectionSummary.questionCount} saved).
          </div>
        )}

        {preview.category !== "All" && (
          <div className="flex justify-center">
            <span className="rounded-full bg-brand-500/10 px-4 py-1.5 text-sm font-medium text-brand-500">
              📂 Topic: {preview.category}
            </span>
          </div>
        )}

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 space-y-3">
          <div className="text-sm font-semibold text-white">Collections</div>
          <label className="space-y-1 text-xs text-[var(--muted)]">
            <span className="block uppercase tracking-wider">Active Filter</span>
            <select
              value={effectiveCollectionFilter}
              onChange={(event) =>
                setSelectedCollectionFilter(normalizeQuestionCollectionFilter(event.target.value))
              }
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm text-white"
            >
              <option value="all">All questions</option>
              {availableCollections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name} ({collection.questionCount})
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newCollectionName}
              onChange={(event) => setNewCollectionName(event.target.value)}
              placeholder="Create collection name"
              className="min-w-[220px] flex-1 rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm text-white placeholder:text-[var(--muted)]"
            />
            <button
              type="button"
              onClick={() => {
                const created = createQuestionCollection(activeUserId, newCollectionName);
                if (!created) {
                  setCollectionNotice(
                    "Collection name is required. Names are trimmed to 40 characters."
                  );
                  return;
                }
                setNewCollectionName("");
                setBookmarkedQuestionIds(readBookmarkedQuestionIds(activeUserId));
                setAvailableCollections(listQuestionCollections(activeUserId));
                setSelectedCollectionFilter(created.id);
                setCollectionNotice(`Created collection "${created.name}".`);
              }}
              className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-sm font-medium text-brand-300 hover:bg-brand-500/20"
            >
              Create Collection
            </button>
          </div>
          {collectionNotice && <div className="text-xs text-[var(--muted)]">{collectionNotice}</div>}
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 space-y-3">
          <div className="text-sm font-semibold text-white">Session Templates</div>
          <label className="space-y-1 text-xs text-[var(--muted)]">
            <span className="block uppercase tracking-wider">Template</span>
            <select
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm text-white"
            >
              <option value="">None</option>
              {sessionTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {defaultTemplateId === template.id ? " (default)" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!selectedTemplateId}
              onClick={() => {
                if (!selectedTemplateId) return;
                const applied = applySessionPresetTemplate(activeUserId, selectedTemplateId);
                if (!applied) return;
                const refreshed = readExamSetupPresetSelection(activeUserId);
                if (refreshed) {
                  setSelectedLengthPresetId(
                    refreshed.lengthPresetId as (typeof EXAM_LENGTH_PRESETS)[number]["id"]
                  );
                  setSelectedTimerPresetId(
                    refreshed.timerPresetId as (typeof EXAM_TIMER_PRESETS)[number]["id"]
                  );
                }
                setConfirmDeleteTemplateId(null);
                setTemplateNotice(`Applied template "${applied.name}".`);
              }}
              className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-xs font-medium text-brand-300 hover:bg-brand-500/20 disabled:opacity-50"
            >
              Apply Template
            </button>
            <button
              type="button"
              disabled={!selectedTemplateId}
              onClick={() => {
                if (!selectedTemplateId) return;
                const duplicated = duplicateSessionPresetTemplate(activeUserId, selectedTemplateId);
                if (!duplicated) return;
                const templates = readSessionPresetTemplates(activeUserId);
                setSessionTemplates(templates);
                setSelectedTemplateId(duplicated.id);
                setConfirmDeleteTemplateId(null);
                setTemplateNotice(`Duplicated template "${duplicated.name}".`);
              }}
              className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white disabled:opacity-50"
            >
              Duplicate
            </button>
            <button
              type="button"
              disabled={!selectedTemplateId}
              onClick={() => {
                if (!selectedTemplateId) return;
                writeDefaultSessionPresetTemplateId(activeUserId, selectedTemplateId);
                setDefaultTemplateId(selectedTemplateId);
                setConfirmDeleteTemplateId(null);
                setTemplateNotice("Default template updated.");
              }}
              className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white disabled:opacity-50"
            >
              Set as Default
            </button>
            <button
              type="button"
              disabled={!selectedTemplateId}
              onClick={() => {
                if (!selectedTemplateId) return;
                if (confirmDeleteTemplateId !== selectedTemplateId) {
                  setConfirmDeleteTemplateId(selectedTemplateId);
                  setTemplateNotice('Click "Confirm Delete" to remove this template.');
                  return;
                }
                const deleted = deleteSessionPresetTemplate(activeUserId, selectedTemplateId);
                if (!deleted) return;
                const templates = readSessionPresetTemplates(activeUserId);
                setSessionTemplates(templates);
                setSelectedTemplateId("");
                setConfirmDeleteTemplateId(null);
                const nextDefault = readDefaultSessionPresetTemplateId(activeUserId);
                setDefaultTemplateId(nextDefault);
                setTemplateNotice("Template deleted.");
              }}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
            >
              {confirmDeleteTemplateId === selectedTemplateId && selectedTemplateId
                ? "Confirm Delete"
                : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                writeDefaultSessionPresetTemplateId(activeUserId, null);
                setDefaultTemplateId(null);
                setConfirmDeleteTemplateId(null);
                setTemplateNotice("Default template cleared.");
              }}
              className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white"
            >
              Clear Default
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newTemplateName}
              onChange={(event) => setNewTemplateName(event.target.value)}
              placeholder="Save current setup as template"
              className="min-w-[220px] flex-1 rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm text-white placeholder:text-[var(--muted)]"
            />
            <button
              type="button"
              disabled={!selectedTemplateId || newTemplateName.trim().length === 0}
              onClick={() => {
                if (!selectedTemplateId) return;
                const renamed = renameSessionPresetTemplate(
                  activeUserId,
                  selectedTemplateId,
                  newTemplateName
                );
                if (!renamed) {
                  setTemplateNotice("Template name is required.");
                  return;
                }
                setNewTemplateName("");
                setSessionTemplates(readSessionPresetTemplates(activeUserId));
                setConfirmDeleteTemplateId(null);
                setTemplateNotice(`Renamed template to "${renamed.name}".`);
              }}
              className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--muted)] hover:text-white disabled:opacity-50"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                const created = createSessionPresetTemplate(activeUserId, newTemplateName, {
                  study:
                    readStudySetupPresetSelection(activeUserId) ?? {
                      lengthPresetId: "full",
                      timerPresetId: "off",
                    },
                  exam: {
                    lengthPresetId: selectedLengthPresetId,
                    timerPresetId: selectedTimerPresetId,
                  },
                });
                if (!created) {
                  setTemplateNotice("Template name is required.");
                  return;
                }
                setNewTemplateName("");
                const templates = readSessionPresetTemplates(activeUserId);
                setSessionTemplates(templates);
                setSelectedTemplateId(created.id);
                setConfirmDeleteTemplateId(null);
                setTemplateNotice(`Saved template "${created.name}".`);
              }}
              className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-sm font-medium text-brand-300 hover:bg-brand-500/20"
            >
              Save Template
            </button>
          </div>
          {(templateNotice || defaultTemplateId) && (
            <div className="text-xs text-[var(--muted)]">
              {templateNotice}
              {defaultTemplateName ? ` Default: ${defaultTemplateName}.` : ""}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Topic Scope</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              "All",
              "Regulations",
              "Airspace",
              "Weather",
              "Loading & Performance",
              "Operations",
            ].map(
              (category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSetupCategory(normalizeCategory(category) ?? "All")}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    setupCategory === category
                      ? "border-brand-400 bg-brand-500/20 text-white"
                      : "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
                  }`}
                >
                  {category}
                </button>
              )
            )}
          </div>
        </div>

        <QuestionTypeOptionsGrid
          options={QUESTION_TYPE_OPTIONS}
          selectedQuestionType={selectedQuestionType}
          onSelectQuestionType={setSelectedQuestionType}
          note={
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-xs text-[var(--muted)]">
              Real UAG format is multiple-choice only. ACS/learning codes are shown on your AKTR after testing for remediation, not as a live question format.
            </div>
          }
        />

        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Session Length</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {EXAM_LENGTH_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedLengthPresetId(preset.id)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  selectedLengthPresetId === preset.id
                    ? "border-brand-400 bg-brand-500/20 text-white"
                    : "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Timer Preset</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EXAM_TIMER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedTimerPresetId(preset.id)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  selectedTimerPresetId === preset.id
                    ? "border-brand-400 bg-brand-500/20 text-white"
                    : "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3">
          <div className="text-sm font-semibold text-white">Weak-Domain Mock</div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            Generates a {WEAK_DOMAIN_MOCK_SETTINGS.questionLimit}-question / {WEAK_DOMAIN_MOCK_TIME_MINUTES}-minute run from weak spots based on your adaptive history.
          </div>
          {weakDomainInsights.length > 0 ? (
            <div className="mt-3 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">
                Weak domains (lowest accuracy)
              </div>
              <div className="flex flex-wrap gap-2">
                {weakDomainInsights.map((domain) => (
                  <button
                    key={domain.category}
                    type="button"
                    onClick={() => {
                      setSelectedQuestionType("weak_spots");
                      setSelectedLengthPresetId("quick");
                      setSelectedTimerPresetId("30m");
                      setSetupCategory(normalizeCategory(domain.category) ?? "All");
                    }}
                    className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/20"
                  >
                    {domain.category} - {domain.accuracyPercent}% ({domain.attempts})
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-xs text-[var(--muted)]">
              Complete at least two quiz/exam attempts in a topic to unlock domain targeting.
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedQuestionType("weak_spots");
              setSelectedLengthPresetId("quick");
              setSelectedTimerPresetId("30m");
              setSetupCategory("All");
            }}
            className="mt-3 rounded-lg border border-brand-500/50 bg-brand-500/10 px-3 py-2 text-sm font-medium text-brand-300 hover:bg-brand-500/20"
          >
            Generate Weak-Domain Mock ({WEAK_DOMAIN_MOCK_SETTINGS.questionLimit}Q / {WEAK_DOMAIN_MOCK_TIME_MINUTES}m)
          </button>
        </div>

        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3">
          <label className="flex items-center gap-3 text-sm text-white">
            <input
              type="checkbox"
              checked={strictConfirmedOnly}
              onChange={(event) => setStrictConfirmedOnly(event.target.checked)}
              className="h-4 w-4 accent-brand-500"
            />
            Strict confirmed-only mode
          </label>
          <div className="mt-2 text-xs text-[var(--muted)]">
            When enabled, exam runs are restricted to {QUESTION_TYPE_OPTION_LABELS.confirmed_test}.
          </div>
        </div>

        {strictGuardrailBlocked && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Strict confirmed-only mode is enabled. Switch question type before starting.
            <button
              type="button"
              onClick={() => setSelectedQuestionType("confirmed_test")}
              className="ml-2 underline underline-offset-2 hover:text-amber-100"
            >
              Switch to Confirmed Test Questions
            </button>
          </div>
        )}

        {fullRealExamShortfall > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Real UAG target is {FULL_EXAM_QUESTION_COUNT} questions in 2.0 hours (70% pass). This
            current Real Exam MCQ pool has {preview.questionCount} questions, so this run is short by{" "}
            {fullRealExamShortfall}.
          </div>
        )}

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

        {preview.category === "All" && preview.questionTypeProfile === "real_exam" && (
          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-xs text-[var(--muted)]">
            <div className="font-semibold text-white">Real Exam Blueprint (60Q target)</div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Regulations (15-25%)</span>
              <span className="text-right">{REAL_EXAM_BLUEPRINT_TARGETS.Regulations}</span>
              <span>Airspace (15-25%)</span>
              <span className="text-right">{REAL_EXAM_BLUEPRINT_TARGETS.Airspace}</span>
              <span>Weather (10-20%)</span>
              <span className="text-right">{REAL_EXAM_BLUEPRINT_TARGETS.Weather}</span>
              <span>Loading &amp; Performance (~10%)</span>
              <span className="text-right">{REAL_EXAM_BLUEPRINT_TARGETS["Loading & Performance"]}</span>
              <span>Operations (35-45%)</span>
              <span className="text-right">{REAL_EXAM_BLUEPRINT_TARGETS.Operations}</span>
            </div>
          </div>
        )}

        <button
          onClick={() => exam.startExam(preview.category, selectedQuestionType, runSettings)}
          disabled={preview.questionCount === 0 || strictGuardrailBlocked}
          className="w-full rounded-xl bg-brand-600 py-4 text-lg font-semibold text-white transition-all hover:bg-brand-700 hover:scale-[1.02] disabled:opacity-60"
        >
          {preview.category === "All" ? "Begin Exam →" : `Begin ${preview.category} Test →`}
        </button>

        {preview.questionCount === 0 && <QuestionSelectionEmptyState context="exam" />}

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
            <SessionButton
              variant="brand-solid"
              onClick={() => exam.startExam(exam.examCategory, exam.questionTypeProfile, runSettings)}
              className="flex-1 py-3"
            >
              Retake Exam
            </SessionButton>
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
              (() => {
                const reviewOptionPresentation = buildOptionPresentation(
                  result.question,
                  `exam:${exam.startTime}`
                );
                const userAnswerDisplayLabel = getDisplayLabelForOption(
                  reviewOptionPresentation.displayLabelByOptionId,
                  result.userAnswer
                );
                const correctDisplayLabel = reviewOptionPresentation.correctDisplayLabel;
                const userAnswerText = getOptionTextById(result.question.options, result.userAnswer);
                const correctAnswerText = getOptionTextById(
                  result.question.options,
                  result.question.correct_option_id
                );

                return (
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
                        <div className="text-incorrect">
                          Your answer: {userAnswerDisplayLabel}
                          {userAnswerText ? ` — ${userAnswerText}` : ""}
                        </div>
                        <div className="text-correct">
                          Correct: {correctDisplayLabel}
                          {correctAnswerText ? ` — ${correctAnswerText}` : ""}
                        </div>
                        <p className="text-gray-400">{result.question.explanation_correct}</p>
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
                                : undefined
                            )
                          )}
                          label={`📖 Why "${userAnswerDisplayLabel}" reference:`}
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
              })()
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

  const currentOptionPresentation = buildOptionPresentation(
    exam.currentQuestion,
    `exam:${exam.startTime}`
  );
  const isTimeLow = exam.remainingMs < 10 * 60 * 1000;

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
        left={`Q ${exam.currentIndex + 1} / ${exam.questions.length} (${exam.answeredCount} answered)`}
        right={`⏱ ${formatClockTime(exam.remainingMs)}`}
        progress={exam.progressPercent}
        progressClassName={isTimeLow ? "bg-incorrect animate-pulse" : "bg-brand-500"}
      />
      {isTimeLow && (
        <p className="text-sm text-incorrect" role="alert" aria-live="assertive">
          Time is low. Less than 10 minutes remain.
        </p>
      )}
      {flaggedReviewPassActive && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Flagged review pass active. Review your flagged questions before final submission.
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-400">
          {QUESTION_TYPE_PROFILE_LABELS[exam.questionTypeProfile]}
        </span>
        <button
          type="button"
          onClick={toggleCurrentBookmark}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            exam.currentQuestion && bookmarkedQuestionIds.has(exam.currentQuestion.id)
              ? "border-amber-400 bg-amber-500/15 text-amber-300"
              : "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
          }`}
        >
          {exam.currentQuestion && bookmarkedQuestionIds.has(exam.currentQuestion.id)
            ? "★ Bookmarked"
            : "☆ Bookmark"}
        </button>
      </div>

      <QuestionCard question={exam.currentQuestion} onOpenFigure={setFigureRef} />

      <ConfidencePanel
        title={
          <>
            Confidence for next answer: <code>{answerConfidence}/5</code>
          </>
        }
        value={answerConfidence}
        onChange={setAnswerConfidence}
      />

      <AnswerOptions
        options={currentOptionPresentation.options}
        mode="exam"
        selectedOption={exam.currentAnswer}
        displayLabelByOptionId={currentOptionPresentation.displayLabelByOptionId}
        onSelect={(optionId) => handleAnswerSelect(optionId, answerConfidence)}
        onSelectWithConfidence={handleAnswerSelect}
        showConfidenceSplit
        defaultConfidence={EXAM_DEFAULT_CONFIDENCE}
        confidentConfidence={EXAM_CONFIDENT_CONFIDENCE}
      />

      {currentOptionPresentation.options.length < exam.currentQuestion.options.length && (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted)]">
          Practice mode is showing 3 options for this question to reduce memorization.
        </div>
      )}

      <ActionBar layout="cluster">
        <SessionButton
          variant="muted-outline"
          onClick={exam.previousQuestion}
          disabled={exam.currentIndex === 0}
        >
          ← Prev
        </SessionButton>
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
        <SessionButton
          variant="muted-outline"
          onClick={() => setShowNavigator((prev) => !prev)}
        >
          📋 Navigator
        </SessionButton>
        <div className="flex-1" />
        {exam.currentIndex < exam.questions.length - 1 ? (
          <SessionButton
            variant="brand-solid"
            onClick={
              flaggedReviewPassActive ? handleContinueFlaggedReviewPass : exam.nextQuestion
            }
          >
            {flaggedReviewPassActive
              ? nextFlaggedIndex != null
                ? "Next Flagged →"
                : "Submit Exam ✓"
              : "Next →"}
          </SessionButton>
        ) : (
          <SessionButton
            variant="success-solid"
            onClick={handleSubmitClick}
          >
            {flaggedReviewPassActive || firstFlaggedIndex == null
              ? "Submit Exam ✓"
              : "Review Flagged Before Submit ✓"}
          </SessionButton>
        )}
      </ActionBar>

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
