"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { type Question } from "@part107/core";
import { ReferenceModal, type ResolvedReference } from "../../components/ReferenceModal";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { useProgress } from "../../hooks/useProgress";
import { STUDY_CATEGORIES } from "../../lib/questionBank";

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

export default function MissedPage() {
  const { questions: allQuestions, loaded, loading, error, reload } = useQuestionBank();
  const { sessions, loaded: progressLoaded } = useProgress();

  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [figureRef, setFigureRef] = useState<ResolvedReference | null>(null);
  const [sortBy, setSortBy] = useState<"count" | "recent">("count");

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
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-[var(--muted)]">Loading…</div>
      </div>
    );
  }

  if (error && !loaded) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-incorrect/30 bg-incorrect/10 p-6 text-center">
        <h1 className="text-xl font-bold text-incorrect">Couldn&apos;t load questions</h1>
        <p className="text-sm text-[var(--muted)]">{error}</p>
        <button onClick={() => void reload()} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Retry
        </button>
      </div>
    );
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
            className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Start Studying
          </Link>
          <Link
            href="/exam"
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
            onClick={() => setSortBy("count")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              sortBy === "count" ? "bg-brand-500 text-white" : "bg-[var(--card)] text-[var(--muted)] hover:text-white"
            }`}
          >
            Most Missed
          </button>
          <button
            onClick={() => setSortBy("recent")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              sortBy === "recent" ? "bg-brand-500 text-white" : "bg-[var(--card)] text-[var(--muted)] hover:text-white"
            }`}
          >
            Most Recent
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory("All")}
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
              onClick={() => setSelectedCategory(cat)}
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
      <div className="space-y-3">
        {filteredEntries.map((entry) => {
          const q = entry.question;
          const isExpanded = expandedId === q.id;
          const correctOpt = q.options.find((o) => o.id === q.correct_option_id);
          const yourOpt = entry.yourAnswer
            ? q.options.find((o) => o.id === entry.yourAnswer)
            : null;

          return (
            <div
              key={q.id}
              className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] transition-all"
            >
              {/* Collapsed header — always visible */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : q.id)}
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
                <div className="border-t border-[var(--card-border)] p-5 space-y-4">
                  {/* Your wrong answer */}
                  {yourOpt && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                      <div className="text-xs font-semibold text-red-400 mb-1">Your Answer</div>
                      <div className="text-sm text-red-300">
                        {entry.yourAnswer}. {yourOpt.text}
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
                      {q.correct_option_id}. {correctOpt?.text}
                    </div>
                  </div>

                  {/* All options */}
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const isCorrect = opt.id === q.correct_option_id;
                      const wasYours = opt.id === entry.yourAnswer;
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
                          <span className="font-semibold">{opt.id}.</span> {opt.text}
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
                  {q.figure_reference && (
                    <button
                      onClick={() =>
                        setFigureRef({
                          url: q.figure_reference!,
                          label: q.figure_reference!,
                          type: "image",
                          description: q.figure_reference!,
                        })
                      }
                      className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/20"
                    >
                      📊 View {q.figure_reference}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredEntries.length === 0 && (
        <div className="text-center py-12 text-[var(--muted)]">
          No missed questions in this category.
        </div>
      )}

      {figureRef && <ReferenceModal ref_={figureRef} onClose={() => setFigureRef(null)} />}
    </div>
  );
}
