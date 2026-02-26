"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatClockTime,
  QUESTION_TYPE_PROFILE_LABELS,
  filterQuestionsByType,
  normalizeCategory,
  type QuestionTypeProfile,
  useStudySession,
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
import ProgressHeader from "../../components/quiz/ProgressHeader";
import QuestionCard from "../../components/quiz/QuestionCard";
import QuestionIssueReporter from "../../components/quiz/QuestionIssueReporter";
import SessionButton from "../../components/quiz/SessionButton";
import SessionSummaryCard from "../../components/quiz/SessionSummaryCard";
import { useAdaptiveQuestionStats } from "../../hooks/useAdaptiveQuestionStats";
import { useActiveUserId } from "../../hooks/useActiveUserId";
import { useLearningEventLogger } from "../../hooks/useLearningEventLogger";
import { useProgress } from "../../hooks/useProgress";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { extractCitationText, mergeCitations } from "../../lib/citationContext";
import {
  buildOptionPresentation,
  getDisplayLabelForOption,
} from "../../lib/optionPresentation";
import {
  clearStudyDraft,
  loadStudyDraft,
  saveStudyDraft,
  type StudyDraft,
} from "../../lib/studyDraftStore";
import { STUDY_CATEGORIES, countQuestionsByCategory, type StudyCategory } from "../../lib/questionBank";
import { recordLearningAttempt } from "../../lib/learningAttemptPipeline";
import {
  QUESTION_TYPE_OPTION_LABELS,
  SELECTABLE_QUESTION_TYPE_OPTIONS as QUESTION_TYPE_OPTIONS,
  normalizeSelectableQuestionTypeProfile,
} from "../../lib/questionTypeOptions";
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
  type QuestionCollectionFilter,
  readBookmarkedQuestionIds,
  toggleQuestionInCollection,
} from "../../lib/questionCollectionStore";
import {
  readStudySetupPresetSelection,
  readExamSetupPresetSelection,
  createSessionPresetTemplate,
  deleteSessionPresetTemplate,
  duplicateSessionPresetTemplate,
  renameSessionPresetTemplate,
  readSessionPresetTemplates,
  applySessionPresetTemplate,
  readDefaultSessionPresetTemplateId,
  writeDefaultSessionPresetTemplateId,
  writeStudySetupPresetSelection,
} from "../../lib/sessionPresetStore";
import { readLearningPreferences, writeLearningPreferences } from "../../lib/learningPreferencesStore";

const STUDY_LENGTH_PRESETS = [
  { id: "full", label: "All Available", questionLimit: null as number | null },
  { id: "intense_60", label: "60", questionLimit: 60 },
  { id: "deep_40", label: "40", questionLimit: 40 },
  { id: "focus_20", label: "Focus 20", questionLimit: 20 },
  { id: "quick_10", label: "Quick 10", questionLimit: 10 },
  { id: "sprint_5", label: "Sprint 5", questionLimit: 5 },
] as const;

const STUDY_TIMER_PRESETS = [
  { id: "off", label: "Untimed", timeLimitMs: null as number | null },
  { id: "5m", label: "5 min", timeLimitMs: 5 * 60 * 1000 },
  { id: "10m", label: "10 min", timeLimitMs: 10 * 60 * 1000 },
  { id: "15m", label: "15 min", timeLimitMs: 15 * 60 * 1000 },
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
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const questionTypeParam = searchParams.get("type");
  const collectionParam = searchParams.get("collection");
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
  const { questions: allQuestions, loaded, loading, error, warning, snapshotInfo, reload, clearSnapshot } = useQuestionBank();
  const adaptive = useAdaptiveQuestionStats(activeUserId);
  const events = useLearningEventLogger(adaptive.userId);
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
  const questionTypeFilteredQuestions = useMemo(
    () =>
      filterQuestionsByType(allQuestions, selectedQuestionType, {
        userStatsByKey: adaptive.statsByKey,
        adaptiveConfig: adaptive.config,
      }),
    [adaptive.config, adaptive.statsByKey, allQuestions, selectedQuestionType]
  );
  const filteredQuestions = useMemo(() => {
    if (!selectedCollectionQuestionIds) return questionTypeFilteredQuestions;
    return questionTypeFilteredQuestions.filter((question) => selectedCollectionQuestionIds.has(question.id));
  }, [questionTypeFilteredQuestions, selectedCollectionQuestionIds]);
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
  const [draftSession, setDraftSession] = useState<StudyDraft | null>(null);
  const [lastRecordedConfidence, setLastRecordedConfidence] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [selectedLengthPresetId, setSelectedLengthPresetId] = useState<(typeof STUDY_LENGTH_PRESETS)[number]["id"]>("full");
  const [selectedTimerPresetId, setSelectedTimerPresetId] = useState<(typeof STUDY_TIMER_PRESETS)[number]["id"]>("off");
  const [presetHydratedForUserId, setPresetHydratedForUserId] = useState<string | null>(null);
  const [sessionTemplates, setSessionTemplates] = useState<
    Array<{ id: string; name: string; study: { lengthPresetId: string; timerPresetId: string } }>
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);
  const [preferredSetupCategory, setPreferredSetupCategory] = useState<StudyCategory>("All");
  const selectedLengthPreset =
    STUDY_LENGTH_PRESETS.find((preset) => preset.id === selectedLengthPresetId) ??
    STUDY_LENGTH_PRESETS[0];
  const selectedTimerPreset =
    STUDY_TIMER_PRESETS.find((preset) => preset.id === selectedTimerPresetId) ??
    STUDY_TIMER_PRESETS[0];
  const defaultTemplateName =
    (defaultTemplateId
      ? sessionTemplates.find((template) => template.id === defaultTemplateId)?.name
      : null) ?? null;

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

  const startStudyQuiz = useCallback(
    (category: StudyCategory) => {
      clearStudyDraft(activeUserId);
      setDraftSession(null);
      study.startQuiz(category, {
        questionLimit: selectedLengthPreset.questionLimit,
        timeLimitMs: selectedTimerPreset.timeLimitMs,
      });
      events.logEvent({
        type: "session_started",
        mode: "study",
        category,
        questionTypeProfile: selectedQuestionType,
        metadata: {
          question_limit: selectedLengthPreset.questionLimit ?? "all",
          timed_drill_ms: selectedTimerPreset.timeLimitMs ?? 0,
          pool_size: filteredQuestions.length,
        },
      });
    },
    [
      activeUserId,
      events,
      filteredQuestions.length,
      selectedLengthPreset.questionLimit,
      selectedQuestionType,
      selectedTimerPreset.timeLimitMs,
      study,
    ]
  );

  const resumeDraftSession = useCallback(() => {
    if (!draftSession) return;
    const remainingMs = Math.max(0, draftSession.session.remainingMs ?? 0);
    const timeLimitMs = Math.max(0, draftSession.session.timeLimitMs ?? 0);
    const resumedStartTime =
      timeLimitMs > 0 ? Date.now() - Math.max(0, timeLimitMs - remainingMs) : Date.now();

    setSelectedQuestionType(draftSession.selectedQuestionType);
    study.restoreQuiz({
      ...draftSession.session,
      sessionStartTime: resumedStartTime,
    });
    clearStudyDraft(activeUserId);
    setDraftSession(null);
    setSessionSaved(false);
    events.logEvent({
      type: "session_resumed",
      mode: "study",
      category: draftSession.session.selectedCategory,
      questionTypeProfile: draftSession.selectedQuestionType,
      metadata: {
        current_index: draftSession.session.currentIndex,
        queue_size: draftSession.session.questions.length,
      },
    });
  }, [activeUserId, draftSession, events, study]);

  const discardDraftSession = useCallback(() => {
    clearStudyDraft(activeUserId);
    setDraftSession(null);
  }, [activeUserId]);

  const handleSaveAndExit = useCallback(() => {
    const draft: StudyDraft = {
      version: 1,
      updatedAt: new Date().toISOString(),
      selectedQuestionType,
      session: {
        selectedCategory: study.selectedCategory,
        questions: study.questions,
        currentIndex: study.currentIndex,
        selectedOption: study.selectedOption,
        answerState: study.answerState,
        score: study.score,
        sessionStartTime: study.sessionStartTime,
        questionResults: study.questionResults,
        timeLimitMs: study.timeLimitMs,
        remainingMs: study.remainingMs,
        timedOut: study.timedOut,
        lastStartOptions: {
          questionLimit: selectedLengthPreset.questionLimit,
          timeLimitMs: selectedTimerPreset.timeLimitMs,
        },
      },
    };
    saveStudyDraft(draft, activeUserId);
    setDraftSession(draft);
    events.logEvent({
      type: "session_saved",
      mode: "study",
      category: study.selectedCategory,
      questionTypeProfile: selectedQuestionType,
      metadata: {
        answered_count: study.questionResults.length,
        current_index: study.currentIndex,
        queue_size: study.questions.length,
        timed_drill_remaining_ms: study.remainingMs,
      },
    });
    persistSession();
    study.resetToSetup();
  }, [
    activeUserId,
    events,
    persistSession,
    selectedLengthPreset.questionLimit,
    selectedQuestionType,
    selectedTimerPreset.timeLimitMs,
    study,
  ]);

  useEffect(() => {
    setSelectedCollectionFilter(normalizeQuestionCollectionFilter(collectionParam));
  }, [collectionParam]);

  useEffect(() => {
    setBookmarkedQuestionIds(readBookmarkedQuestionIds(activeUserId));
    setAvailableCollections(listQuestionCollections(activeUserId));
    setCollectionsHydrated(true);
    setDraftSession(loadStudyDraft(activeUserId));
  }, [activeUserId]);

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
    if (questionTypeParam || weakFocusRequested) return;
    const preferred = readPreferredQuestionType(activeUserId);
    if (preferred) {
      setSelectedQuestionType(preferred);
    }
  }, [activeUserId, questionTypeParam, weakFocusRequested]);

  useEffect(() => {
    writePreferredQuestionType(activeUserId, selectedQuestionType);
  }, [activeUserId, selectedQuestionType]);

  useEffect(() => {
    let stored = readStudySetupPresetSelection(activeUserId);
    if (!stored) {
      const defaultTemplate = readDefaultSessionPresetTemplateId(activeUserId);
      if (defaultTemplate) {
        applySessionPresetTemplate(activeUserId, defaultTemplate);
        stored = readStudySetupPresetSelection(activeUserId);
      }
    }
    if (stored) {
      if (STUDY_LENGTH_PRESETS.some((preset) => preset.id === stored.lengthPresetId)) {
        setSelectedLengthPresetId(
          stored.lengthPresetId as (typeof STUDY_LENGTH_PRESETS)[number]["id"]
        );
      }
      if (STUDY_TIMER_PRESETS.some((preset) => preset.id === stored.timerPresetId)) {
        setSelectedTimerPresetId(
          stored.timerPresetId as (typeof STUDY_TIMER_PRESETS)[number]["id"]
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
    setPreferredSetupCategory(normalizeCategory(preferences.defaultStudyCategory) ?? "All");
    setPresetHydratedForUserId(activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    if (presetHydratedForUserId !== activeUserId) return;
    writeStudySetupPresetSelection(activeUserId, {
      lengthPresetId: selectedLengthPresetId,
      timerPresetId: selectedTimerPresetId,
    });
  }, [activeUserId, presetHydratedForUserId, selectedLengthPresetId, selectedTimerPresetId]);

  useEffect(() => {
    if (presetHydratedForUserId !== activeUserId) return;
    const current = readLearningPreferences(activeUserId);
    if (current.defaultStudyCategory === preferredSetupCategory) return;
    writeLearningPreferences(activeUserId, {
      ...current,
      defaultStudyCategory: preferredSetupCategory,
    });
  }, [activeUserId, preferredSetupCategory, presetHydratedForUserId]);

  useEffect(() => {
    if (presetHydratedForUserId !== activeUserId) return;
    if (!loaded || autoStarted.current) return;

    if (!categoryParam && !weakFocusRequested) return;

    autoStarted.current = true;
    const matched = normalizeCategory(categoryParam);
    startStudyQuiz(matched ?? "All");
  }, [
    categoryParam,
    loaded,
    activeUserId,
    presetHydratedForUserId,
    startStudyQuiz,
    weakFocusRequested,
  ]);

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
    setLastRecordedConfidence(null);
  }, [study.currentQuestion?.id]);

  useEffect(() => {
    if (!study.isComplete) return;
    persistSession();
    clearStudyDraft(activeUserId);
    setDraftSession(null);
  }, [activeUserId, persistSession, study.isComplete]);

  useEffect(() => {
    setConfirmDeleteTemplateId(null);
  }, [selectedTemplateId]);

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
      <div className="mx-auto max-w-5xl space-y-8 pt-8">
        <div className="text-center">
          <div className="text-5xl">📖</div>
          <h1 className="mt-4 text-3xl font-bold">Study Mode</h1>
          <p className="mx-auto mt-2 max-w-2xl text-[var(--muted)]">
            Choose a topic to drill down on, or study all categories. You&apos;ll get instant feedback after each answer.
          </p>
        </div>

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
        {draftSession && (
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3">
            <div className="text-sm font-medium text-brand-300">You have a saved Study session.</div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {draftSession.session.selectedCategory} • Question {Math.min(draftSession.session.currentIndex + 1, draftSession.session.questions.length)} of {draftSession.session.questions.length}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resumeDraftSession}
                className="rounded-lg border border-brand-500/40 bg-brand-500/20 px-3 py-2 text-xs font-medium text-brand-200 hover:bg-brand-500/30"
              >
                Continue Session
              </button>
              <button
                type="button"
                onClick={discardDraftSession}
                className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white"
              >
                Discard Saved Session
              </button>
            </div>
          </div>
        )}
        {activeCollectionSummary && (
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-300">
            Collection filter active: {activeCollectionSummary.name} ({activeCollectionSummary.questionCount} saved).
          </div>
        )}
        {filteredQuestions.length === 0 && <QuestionSelectionEmptyState context="study" />}

        <QuestionTypeOptionsGrid
          options={QUESTION_TYPE_OPTIONS}
          selectedQuestionType={selectedQuestionType}
          onSelectQuestionType={setSelectedQuestionType}
          variant="compact"
          note={
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
          }
        />

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
          {collectionNotice && (
            <div className="text-xs text-[var(--muted)]">{collectionNotice}</div>
          )}
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
                const refreshed = readStudySetupPresetSelection(activeUserId);
                if (refreshed) {
                  setSelectedLengthPresetId(
                    refreshed.lengthPresetId as (typeof STUDY_LENGTH_PRESETS)[number]["id"]
                  );
                  setSelectedTimerPresetId(
                    refreshed.timerPresetId as (typeof STUDY_TIMER_PRESETS)[number]["id"]
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
                  study: {
                    lengthPresetId: selectedLengthPresetId,
                    timerPresetId: selectedTimerPresetId,
                  },
                  exam:
                    readExamSetupPresetSelection(activeUserId) ?? {
                      lengthPresetId: "full",
                      timerPresetId: "auto",
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
          <div className="text-sm font-semibold text-white">Session Length</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STUDY_LENGTH_PRESETS.map((preset) => (
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
          <div className="text-xs text-[var(--muted)]">
            Choose <strong className="text-white">All Available</strong> to run the full pool for the selected topic.
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Timed Drill</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STUDY_TIMER_PRESETS.map((preset) => (
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

        {preferredSetupCategory !== "All" && (
          <button
            type="button"
            onClick={() => startStudyQuiz(preferredSetupCategory)}
            className="w-full rounded-xl border border-brand-500/50 bg-brand-500/10 px-4 py-3 text-left transition-colors hover:bg-brand-500/20"
          >
            <div className="text-sm font-semibold text-white">Start Preferred Category</div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {preferredSetupCategory} ({visibleCounts[preferredSetupCategory]} questions)
            </div>
          </button>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {STUDY_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => {
                setPreferredSetupCategory(category);
                startStudyQuiz(category);
              }}
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
        {study.timedOut && (
          <p className="text-sm text-amber-300">Timed drill ended. Review and try again.</p>
        )}

        <SessionSummaryCard
          passed={passed}
          percentage={percentage}
          correct={study.score.correct}
          total={study.score.total}
          subtitle="Passing score: 70% (42 of 60 on the real exam)"
        />

        <div className="flex gap-3">
          <SessionButton
            variant="brand-solid"
            onClick={study.restartQuiz}
            className="flex-1 py-3"
          >
            Try Again
          </SessionButton>
          <SessionButton
            variant="muted-outline"
            onClick={study.resetToSetup}
            className="flex-1 py-3 font-semibold"
          >
            Change Topic
          </SessionButton>
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
  const rightLabelWithTimer = study.isTimedDrill
    ? `${rightLabel} • ⏱ ${formatClockTime(study.remainingMs)}`
    : rightLabel;
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
  const currentQuestionId = study.currentQuestion.id;
  const isCurrentBookmarked = bookmarkedQuestionIds.has(currentQuestionId);

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
        right={rightLabelWithTimer}
        progress={study.progressPercent}
        progressClassName="progress-fill bg-brand-500"
      />
      {study.isTimedDrill && study.remainingMs <= 60_000 && (
        <p className="text-sm text-incorrect" role="alert" aria-live="assertive">
          Time is low. Less than 1 minute remains.
        </p>
      )}

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
        <button
          type="button"
          onClick={() => {
            toggleQuestionInCollection(activeUserId, "bookmarks", currentQuestionId);
            setBookmarkedQuestionIds(readBookmarkedQuestionIds(activeUserId));
            setAvailableCollections(listQuestionCollections(activeUserId));
          }}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            isCurrentBookmarked
              ? "border-amber-400 bg-amber-500/15 text-amber-300"
              : "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] hover:text-white"
          }`}
        >
          {isCurrentBookmarked ? "★ Bookmarked" : "☆ Bookmark"}
        </button>
      </div>

      <QuestionCard question={study.currentQuestion} onOpenFigure={setFigureRef} />
      <QuestionIssueReporter
        mode="study"
        question={study.currentQuestion}
        selectedOptionId={study.selectedOption}
        questionTypeProfile={selectedQuestionType}
        confidence={lastRecordedConfidence ?? 3}
      />

      <AnswerOptions
        options={optionPresentation.options}
        mode="study"
        selectedOption={study.selectedOption}
        correctOptionId={study.currentQuestion.correct_option_id}
        displayLabelByOptionId={optionPresentation.displayLabelByOptionId}
        answerState={study.answerState}
        onSelect={(optionId) => {
          if (study.answerState !== "unanswered") return;
          study.answerQuestion(optionId, { confidence: 3 });
          setLastRecordedConfidence(3);
        }}
        onSelectWithConfidence={(optionId, confidence) => {
          if (study.answerState !== "unanswered") return;
          study.answerQuestion(optionId, { confidence });
          setLastRecordedConfidence(confidence);
        }}
        showConfidenceSplit
        splitConfidenceMode="full"
        defaultConfidence={3}
        confidentConfidence={5}
        disabled={study.answerState !== "unanswered"}
      />

      {optionPresentation.options.length < study.currentQuestion.options.length && (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted)]">
          Practice mode is showing 3 options for this question to reduce memorization.
        </div>
      )}

      <ActionBar>
        <SessionButton
          variant="muted-outline"
          onClick={study.skipQuestion}
          disabled={study.answerState !== "unanswered"}
        >
          Skip for now →
        </SessionButton>
        <SessionButton
          variant="brand-outline"
          onClick={handleSaveAndExit}
        >
          {study.questionResults.length > 0 ? "Save & Exit" : "Exit"}
        </SessionButton>
      </ActionBar>

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
