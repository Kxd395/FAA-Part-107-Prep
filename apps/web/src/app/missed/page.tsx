"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type OptionId, type Question } from "@part107/core";
import { ReferenceModal, type ResolvedReference } from "../../components/ReferenceModal";
import {
  QuestionBankError,
  QuestionBankLoading,
  QuestionBankWarning,
} from "../../components/QuestionBankState";
import QuestionIssueReporter from "../../components/quiz/QuestionIssueReporter";
import { useActiveUserId } from "../../hooks/useActiveUserId";
import { useLearningEventLogger } from "../../hooks/useLearningEventLogger";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { useProgress } from "../../hooks/useProgress";
import { resolveFigureImageUrl } from "../../lib/figureImage";
import {
  buildOptionPresentation,
  getDisplayLabelForOption,
} from "../../lib/optionPresentation";
import { STUDY_CATEGORIES } from "../../lib/questionBank";
import {
  addQuestionsToCollection,
  createQuestionCollection,
  listQuestionCollections,
  removeQuestionsFromCollection,
  type QuestionCollectionFilter,
} from "../../lib/questionCollectionStore";

/**
 * Missed Questions Review — browse every question you've gotten wrong,
 * grouped by category, with full explanations. No scoring pressure,
 * just learning.
 */

interface MissedEntry {
  question: Question;
  missCount: number;
  lastMissed: string; // ISO timestamp
  yourAnswer: string | null;
}

const MISSED_PAGE_SIZE = 20;
const MISSED_VIRTUALIZE_THRESHOLD = 300;
const MISSED_VIRTUAL_WINDOW_SIZE = 90;
const MISSED_ROW_ESTIMATE_PX = 124;

export default function MissedPage() {
  const activeUserId = useActiveUserId();
  const { logEvent } = useLearningEventLogger(activeUserId);
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
  const { sessions, loaded: progressLoaded } = useProgress(activeUserId);

  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [figureRef, setFigureRef] = useState<ResolvedReference | null>(null);
  const [sortBy, setSortBy] = useState<"count" | "recent">("count");
  const [visibleCount, setVisibleCount] = useState(MISSED_PAGE_SIZE);
  const [virtualStartIndex, setVirtualStartIndex] = useState(0);
  const [availableCollections, setAvailableCollections] = useState<
    Array<{ id: string; name: string; questionCount: number; system: boolean }>
  >([]);
  const [selectedCollectionId, setSelectedCollectionId] =
    useState<QuestionCollectionFilter>("bookmarks");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [collectionNotice, setCollectionNotice] = useState<string | null>(null);
  const [reviewShuffleSeed] = useState(() => Date.now());

  useEffect(() => {
    logEvent({
      type: "page_view",
      mode: "missed",
      metadata: { route: "/missed" },
    });
  }, [logEvent]);

  useEffect(() => {
    setAvailableCollections(listQuestionCollections(activeUserId));
  }, [activeUserId]);

  // Build a map of missed questions from all session history
  const missedEntries = useMemo(() => {
    if (!loaded || !progressLoaded) return [];

    const questionMap = new Map(allQuestions.map((q) => [q.id, q]));

    // Aggregate misses
    const missMap = new Map<
      string,
      { count: number; lastTimestamp: string; lastAnswer: string | null }
    >();

    for (const session of sessions) {
      for (const result of session.questions) {
        if (result.isCorrect) continue;
        const prev = missMap.get(result.questionId);
        if (!prev || session.timestamp > prev.lastTimestamp) {
          missMap.set(result.questionId, {
            count: (prev?.count ?? 0) + 1,
            lastTimestamp: session.timestamp,
            lastAnswer: result.userAnswer,
          });
        } else {
          missMap.set(result.questionId, {
            ...prev,
            count: prev.count + 1,
          });
        }
      }
    }

    const entries: MissedEntry[] = [];
    for (const [qId, data] of missMap) {
      const question = questionMap.get(qId);
      if (!question) continue;
      entries.push({
        question,
        missCount: data.count,
        lastMissed: data.lastTimestamp,
        yourAnswer: data.lastAnswer,
      });
    }

    return entries;
  }, [allQuestions, loaded, progressLoaded, sessions]);

  const filteredEntries = useMemo(() => {
    let entries =
      selectedCategory === "All"
        ? missedEntries
        : missedEntries.filter((e) => e.question.category === selectedCategory);

    if (sortBy === "count") {
      entries = [...entries].sort((a, b) => b.missCount - a.missCount);
    } else {
      entries = [...entries].sort(
        (a, b) => new Date(b.lastMissed).getTime() - new Date(a.lastMissed).getTime()
      );
    }
    return entries;
  }, [missedEntries, selectedCategory, sortBy]);
  const visibleEntries = filteredEntries.slice(0, visibleCount);
  const shouldVirtualize = filteredEntries.length > MISSED_VIRTUALIZE_THRESHOLD && expandedId === null;
  const virtualEndIndex = Math.min(filteredEntries.length, virtualStartIndex + MISSED_VIRTUAL_WINDOW_SIZE);
  const renderedEntries = shouldVirtualize
    ? filteredEntries.slice(virtualStartIndex, virtualEndIndex)
    : visibleEntries;
  const virtualTopSpacerPx = shouldVirtualize ? virtualStartIndex * MISSED_ROW_ESTIMATE_PX : 0;
  const virtualBottomSpacerPx = shouldVirtualize
    ? Math.max(0, (filteredEntries.length - virtualEndIndex) * MISSED_ROW_ESTIMATE_PX)
    : 0;

  useEffect(() => {
    setVisibleCount(MISSED_PAGE_SIZE);
    setExpandedId(null);
    setVirtualStartIndex(0);
  }, [selectedCategory, sortBy, missedEntries.length]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of missedEntries) {
      const cat = entry.question.category;
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [missedEntries]);

  // ─── Loading ───
  if ((loading && !loaded) || !progressLoaded) {
    return <QuestionBankLoading label="Loading question bank..." />;
  }

  if (error && !loaded) {
    return <QuestionBankError error={error} onRetry={() => void reload()} />;
  }

  // ─── Empty state ───
  if (missedEntries.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-6 pt-12 text-center">
        <div className="text-6xl">🎯</div>
        <h1 className="text-3xl font-bold">No Missed Questions Yet!</h1>
        <p className="text-[var(--muted)]">
          Take a practice exam or study quiz first. Any questions you get wrong will appear here for review.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/study"
            onClick={() =>
              logEvent({
                type: "link_opened",
                mode: "missed",
                metadata: { target: "empty_start_studying", href: "/study" },
              })
            }
            className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Start Studying
          </Link>
          <Link
            href="/exam"
            onClick={() =>
              logEvent({
                type: "link_opened",
                mode: "missed",
                metadata: { target: "empty_take_exam", href: "/exam" },
              })
            }
            className="rounded-xl border border-[var(--card-border)] px-6 py-3 font-semibold text-[var(--muted)] hover:text-white"
          >
            Take Exam
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {warning && (
        <QuestionBankWarning
          warning={warning}
          snapshotInfo={snapshotInfo}
          onTryLive={() => void reload({ preferLive: true })}
          onClearSnapshot={clearSnapshot}
        />
      )}
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">❌ Missed Questions Review</h1>
        <p className="mt-2 text-[var(--muted)]">
          {missedEntries.length} unique questions you&apos;ve gotten wrong. Browse them with full explanations — no pressure, just learning.
        </p>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--muted)]">Sort:</span>
          <button
            onClick={() => {
              setSortBy("count");
              logEvent({
                type: "filter_changed",
                mode: "missed",
                metadata: { filter: "sort", value: "count" },
              });
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              sortBy === "count" ? "bg-brand-500 text-white" : "bg-[var(--card)] text-[var(--muted)] hover:text-white"
            }`}
          >
            Most Missed
          </button>
          <button
            onClick={() => {
              setSortBy("recent");
              logEvent({
                type: "filter_changed",
                mode: "missed",
                metadata: { filter: "sort", value: "recent" },
              });
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              sortBy === "recent" ? "bg-brand-500 text-white" : "bg-[var(--card)] text-[var(--muted)] hover:text-white"
            }`}
          >
            Most Recent
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCollectionId}
            onChange={(event) => setSelectedCollectionId(event.target.value as QuestionCollectionFilter)}
            className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5 text-xs text-white"
          >
            {availableCollections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name} ({collection.questionCount})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const questionIds = filteredEntries.map((entry) => entry.question.id);
              const added = addQuestionsToCollection(activeUserId, selectedCollectionId, questionIds);
              setAvailableCollections(listQuestionCollections(activeUserId));
              setCollectionNotice(
                added > 0
                  ? `Added ${added} question${added === 1 ? "" : "s"} to collection.`
                  : "No new questions were added."
              );
              logEvent({
                type: "control_clicked",
                mode: "missed",
                metadata: {
                  action: "bulk_add_collection",
                  collectionId: selectedCollectionId,
                  size: questionIds.length,
                  added,
                },
              });
            }}
            className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-300 hover:bg-brand-500/20"
          >
            Add Visible
          </button>
          <button
            type="button"
            onClick={() => {
              const questionIds = filteredEntries.map((entry) => entry.question.id);
              const removed = removeQuestionsFromCollection(
                activeUserId,
                selectedCollectionId,
                questionIds
              );
              setAvailableCollections(listQuestionCollections(activeUserId));
              setCollectionNotice(
                removed > 0
                  ? `Removed ${removed} question${removed === 1 ? "" : "s"} from collection.`
                  : "No matching questions to remove."
              );
              logEvent({
                type: "control_clicked",
                mode: "missed",
                metadata: {
                  action: "bulk_remove_collection",
                  collectionId: selectedCollectionId,
                  size: questionIds.length,
                  removed,
                },
              });
            }}
            className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-white"
          >
            Remove Visible
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={newCollectionName}
          onChange={(event) => setNewCollectionName(event.target.value)}
          placeholder="Create collection"
          className="min-w-[220px] flex-1 rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-xs text-white placeholder:text-[var(--muted)]"
        />
        <button
          type="button"
          onClick={() => {
            const created = createQuestionCollection(activeUserId, newCollectionName);
            if (!created) {
              setCollectionNotice("Collection name is required.");
              return;
            }
            setNewCollectionName("");
            setAvailableCollections(listQuestionCollections(activeUserId));
            setSelectedCollectionId(created.id);
            setCollectionNotice(`Created collection "${created.name}".`);
          }}
          className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-xs font-medium text-brand-300 hover:bg-brand-500/20"
        >
          Create Collection
        </button>
      </div>
      {collectionNotice && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted)]">
          {collectionNotice}
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setSelectedCategory("All");
            logEvent({
              type: "filter_changed",
              mode: "missed",
              metadata: { filter: "category", value: "All" },
            });
          }}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            selectedCategory === "All"
              ? "bg-brand-500 text-white"
              : "bg-[var(--card)] text-[var(--muted)] hover:text-white"
          }`}
        >
          All ({missedEntries.length})
        </button>
        {STUDY_CATEGORIES.filter((c) => c !== "All").map((cat) => {
          const count = categoryCounts[cat] ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                logEvent({
                  type: "filter_changed",
                  mode: "missed",
                  category: cat,
                  metadata: { filter: "category", value: cat },
                });
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-brand-500 text-white"
                  : "bg-[var(--card)] text-[var(--muted)] hover:text-white"
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Question list */}
      {shouldVirtualize && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-[11px] text-[var(--muted)]">
          Virtualized missed view active for large dataset ({filteredEntries.length} entries). Expand a row to switch to full detail mode.
        </div>
      )}
      <div
        className={shouldVirtualize ? "space-y-3 max-h-[720px] overflow-y-auto pr-1" : "space-y-3"}
        onScroll={(event) => {
          if (!shouldVirtualize) return;
          const target = event.currentTarget;
          const nextStart = Math.max(
            0,
            Math.min(
              filteredEntries.length - MISSED_VIRTUAL_WINDOW_SIZE,
              Math.floor(target.scrollTop / MISSED_ROW_ESTIMATE_PX)
            )
          );
          if (nextStart !== virtualStartIndex) {
            setVirtualStartIndex(nextStart);
          }
        }}
      >
        {shouldVirtualize && <div style={{ height: virtualTopSpacerPx }} />}
        {renderedEntries.map((entry, renderIndex) => {
          const q = entry.question;
          const entryIndex = shouldVirtualize ? virtualStartIndex + renderIndex : renderIndex;
          const isExpanded = expandedId === q.id;
          const detailsId = `missed-details-${q.id}`;
          const optionPresentation = buildOptionPresentation(
            q,
            `missed:review:${reviewShuffleSeed}`
          );
          const correctOpt = q.options.find((o) => o.id === q.correct_option_id);
          const yourOpt = entry.yourAnswer
            ? q.options.find((o) => o.id === entry.yourAnswer)
            : null;
          const yourAnswerDisplayLabel = getDisplayLabelForOption(
            optionPresentation.displayLabelByOptionId,
            entry.yourAnswer as OptionId | null
          );

          return (
            <div
              key={q.id}
              className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] transition-all"
            >
              {/* Collapsed header — always visible */}
              <button
                onClick={() => {
                  if (shouldVirtualize) {
                    setVisibleCount(Math.max(visibleCount, entryIndex + 1));
                  }
                  setExpandedId(isExpanded ? null : q.id);
                  logEvent({
                    type: "control_clicked",
                    mode: "missed",
                    questionId: q.id,
                    category: q.category,
                    subcategory: q.subcategory,
                    metadata: {
                      action: isExpanded ? "collapse_question" : "expand_question",
                    },
                  });
                }}
                aria-expanded={isExpanded}
                aria-controls={detailsId}
                className="flex w-full items-start gap-4 p-5 text-left"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-400 font-medium">
                      Missed {entry.missCount}×
                    </span>
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-brand-500">
                      {q.category}
                    </span>
                    {q.acs_code && (
                      <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-cyan-400">
                        {q.acs_code}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-white leading-relaxed">{q.question_text}</div>
                </div>
                <div className="mt-1 text-[var(--muted)]">{isExpanded ? "▲" : "▼"}</div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div id={detailsId} className="border-t border-[var(--card-border)] p-5 space-y-4">
                  {/* Your wrong answer */}
                  {yourOpt && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                      <div className="text-xs font-semibold text-red-400 mb-1">Your Answer</div>
                      <div className="text-sm text-red-300">
                        {yourAnswerDisplayLabel}. {yourOpt.text}
                      </div>
                      {entry.yourAnswer &&
                        q.explanation_distractors[entry.yourAnswer as keyof typeof q.explanation_distractors] && (
                          <div className="mt-2 text-xs text-red-300/80">
                            {q.explanation_distractors[entry.yourAnswer as keyof typeof q.explanation_distractors]}
                          </div>
                        )}
                    </div>
                  )}

                  {/* Correct answer */}
                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3">
                    <div className="text-xs font-semibold text-green-400 mb-1">Correct Answer</div>
                    <div className="text-sm text-green-300">
                      {optionPresentation.correctDisplayLabel}. {correctOpt?.text}
                    </div>
                  </div>

                  {/* All options */}
                  <div className="space-y-2">
                    {optionPresentation.options.map((opt) => {
                      const isCorrect = opt.id === q.correct_option_id;
                      const wasYours = opt.id === entry.yourAnswer;
                      const displayLabel = optionPresentation.displayLabelByOptionId[opt.id] ?? opt.id;
                      return (
                        <div
                          key={opt.id}
                          className={`rounded-lg border px-3 py-2 text-sm ${
                            isCorrect
                              ? "border-green-500/40 bg-green-500/5 text-green-300"
                              : wasYours
                              ? "border-red-500/40 bg-red-500/5 text-red-300"
                              : "border-[var(--card-border)] text-[var(--muted)]"
                          }`}
                        >
                          <span className="font-semibold">{displayLabel}.</span> {opt.text}
                          {isCorrect && " ✅"}
                          {wasYours && !isCorrect && " ❌"}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-2">
                      Explanation
                    </div>
                    <div className="text-sm leading-relaxed text-[var(--foreground)]/90">
                      {q.explanation_correct}
                    </div>
                  </div>

                  {/* Citation */}
                  {q.citation && (
                    <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-xs text-[var(--muted)]">
                      📖 {q.citation}
                    </div>
                  )}

                  {/* Figure reference */}
                  {(q.figure_reference || q.image_ref) && (
                    <button
                      onClick={() => {
                        const imageUrl = resolveFigureImageUrl(q);
                        if (!imageUrl) return;
                        logEvent({
                          type: "citation_clicked",
                          mode: "missed",
                          questionId: q.id,
                          category: q.category,
                          subcategory: q.subcategory,
                          citationLabel: q.figure_reference ?? "Figure",
                          citationUrl: imageUrl,
                        });
                        setFigureRef({
                          url: imageUrl,
                          label: q.figure_reference ?? "Figure",
                          type: "image",
                          description: q.figure_reference ?? "Question figure",
                        });
                      }}
                      className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/20"
                    >
                      📊 View {q.figure_reference ?? "Figure"}
                    </button>
                  )}

                  <QuestionIssueReporter
                    mode="missed"
                    question={q}
                    selectedOptionId={(entry.yourAnswer as OptionId | null) ?? null}
                    confidence={null}
                  />
                </div>
              )}
            </div>
          );
        })}
        {shouldVirtualize && <div style={{ height: virtualBottomSpacerPx }} />}
      </div>

      {!shouldVirtualize && filteredEntries.length > visibleEntries.length && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-xs">
          <span className="text-[var(--muted)]">
            Showing {visibleEntries.length} of {filteredEntries.length} missed questions
          </span>
          <button
            onClick={() =>
              setVisibleCount((prev) => Math.min(prev + MISSED_PAGE_SIZE, filteredEntries.length))
            }
            className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-[var(--muted)] hover:text-white"
          >
            Load More
          </button>
        </div>
      )}

      {filteredEntries.length === 0 && (
        <div className="text-center py-12 text-[var(--muted)]">
          No missed questions in this category.
        </div>
      )}

      {figureRef && <ReferenceModal ref_={figureRef} onClose={() => setFigureRef(null)} />}
    </div>
  );
}
