"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  filterQuestionsByType,
  type Question,
  type QuestionTypeProfile,
} from "@part107/core";
import { ReferenceModal, type ResolvedReference } from "../../components/ReferenceModal";
import { useAdaptiveQuestionStats } from "../../hooks/useAdaptiveQuestionStats";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { STUDY_CATEGORIES, countQuestionsByCategory } from "../../lib/questionBank";

// ─── Supported question‑type profiles ───
const QUESTION_TYPE_OPTIONS: Array<{
  value: QuestionTypeProfile;
  title: string;
  description: string;
}> = [
  {
    value: "confirmed_test",
    title: "✅ Confirmed Test Questions",
    description: "Only real-exam questions (70).",
  },
  {
    value: "all_random",
    title: "🎲 All Questions",
    description: "Full 362-question pool.",
  },
  {
    value: "acs_practice",
    title: "📚 ACS Practice Only",
    description: "292 ACS mastery drills.",
  },
  {
    value: "real_exam",
    title: "Real Exam MCQ",
    description: "Excludes ACS drill format.",
  },
  {
    value: "weak_spots",
    title: "🔥 Weak Spots",
    description: "Questions you still struggle with.",
  },
];

// ─── Spaced-repetition localStorage helpers ───
const SR_KEY = "part107_flashcard_sr";

interface SRRecord {
  /** next review timestamp */
  due: number;
  /** interval in ms */
  interval: number;
  /** 1 = new, increasing with correct reviews */
  ease: number;
}

function loadSR(): Record<string, SRRecord> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SR_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveSR(data: Record<string, SRRecord>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SR_KEY, JSON.stringify(data));
}

function markKnown(questionId: string) {
  const sr = loadSR();
  const prev = sr[questionId] ?? { due: 0, interval: 60_000, ease: 1 };
  const newInterval = Math.min(prev.interval * 2.5, 7 * 24 * 60 * 60 * 1000); // cap at 7 days
  sr[questionId] = {
    due: Date.now() + newInterval,
    interval: newInterval,
    ease: prev.ease + 1,
  };
  saveSR(sr);
}

function markStillLearning(questionId: string) {
  const sr = loadSR();
  sr[questionId] = {
    due: Date.now() + 30_000, // re-show in 30 s
    interval: 60_000,
    ease: 1,
  };
  saveSR(sr);
}

function sortBySpacedRepetition<Q extends Question>(questions: Q[]): Q[] {
  const sr = loadSR();
  const now = Date.now();
  return [...questions].sort((a, b) => {
    const aDue = sr[a.id]?.due ?? 0;
    const bDue = sr[b.id]?.due ?? 0;
    // due/overdue questions first (lowest due-time first)
    if (aDue <= now && bDue <= now) return aDue - bDue;
    if (aDue <= now) return -1;
    if (bDue <= now) return 1;
    return aDue - bDue;
  });
}

// ─── Component ───
export default function FlashcardsPage() {
  const { questions: allQuestions, loaded, loading, error, reload } = useQuestionBank();
  const adaptive = useAdaptiveQuestionStats();

  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionTypeProfile>("confirmed_test");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [started, setStarted] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [learning, setLearning] = useState(0);
  const [figureRef, setFigureRef] = useState<ResolvedReference | null>(null);

  const filteredQuestions = useMemo(
    () =>
      filterQuestionsByType(allQuestions, selectedQuestionType, {
        userStatsByKey: adaptive.statsByKey,
        adaptiveConfig: adaptive.config,
      }),
    [adaptive.config, adaptive.statsByKey, allQuestions, selectedQuestionType]
  );

  const categoryQuestions = useMemo(() => {
    const pool =
      selectedCategory === "All"
        ? filteredQuestions
        : filteredQuestions.filter((q) => q.category === selectedCategory);
    return sortBySpacedRepetition(pool);
  }, [filteredQuestions, selectedCategory]);

  const visibleCounts = useMemo(() => countQuestionsByCategory(filteredQuestions), [filteredQuestions]);

  const currentCard = categoryQuestions[cardIndex] ?? null;
  const total = categoryQuestions.length;

  const handleFlip = useCallback(() => setFlipped((f) => !f), []);

  const handleKnowIt = useCallback(() => {
    if (!currentCard) return;
    markKnown(currentCard.id);
    setKnown((n) => n + 1);
    setFlipped(false);
    setCardIndex((i) => i + 1);
  }, [currentCard]);

  const handleStillLearning = useCallback(() => {
    if (!currentCard) return;
    markStillLearning(currentCard.id);
    setLearning((n) => n + 1);
    setFlipped(false);
    setCardIndex((i) => i + 1);
  }, [currentCard]);

  const restart = useCallback(() => {
    setCardIndex(0);
    setKnown(0);
    setLearning(0);
    setFlipped(false);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!started) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) {
          setFlipped(true);
        }
      }
      if (flipped && (e.key === "ArrowRight" || e.key === "k")) handleKnowIt();
      if (flipped && (e.key === "ArrowLeft" || e.key === "l")) handleStillLearning();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flipped, handleKnowIt, handleStillLearning, started]);

  // ─── Loading / Error ───
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

  // ─── Setup Screen ───
  if (!started) {
    return (
      <div className="mx-auto max-w-lg space-y-8 pt-8">
        <div className="text-center">
          <div className="text-5xl">🃏</div>
          <h1 className="mt-4 text-3xl font-bold">Flashcards</h1>
          <p className="mt-2 text-[var(--muted)]">
            Flip to reveal the answer. Rate yourself <strong>Know It</strong> or{" "}
            <strong>Still Learning</strong>. Spaced repetition resurfaces cards you struggle with.
          </p>
        </div>

        {/* Question type selector */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Question Pool</div>
          <div className="grid gap-2">
            {QUESTION_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedQuestionType(opt.value)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedQuestionType === opt.value
                    ? "border-brand-500/60 bg-brand-500/10"
                    : "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/30"
                }`}
              >
                <div className="text-sm font-semibold text-white">{opt.title}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Category selector */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-white">Category</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => setSelectedCategory("All")}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedCategory === "All"
                  ? "border-brand-500/60 bg-brand-500/10"
                  : "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/30"
              }`}
            >
              <div className="text-sm font-semibold text-white">All Categories</div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {filteredQuestions.length} cards
              </div>
            </button>
            {STUDY_CATEGORIES.filter((c) => c !== "All").map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedCategory === cat
                    ? "border-brand-500/60 bg-brand-500/10"
                    : "border-[var(--card-border)] bg-[var(--card)] hover:border-brand-500/30"
                }`}
              >
                <div className="text-sm font-semibold text-white">{cat}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {visibleCounts[cat] ?? 0} cards
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setStarted(true)}
          disabled={categoryQuestions.length === 0}
          className="w-full rounded-xl bg-brand-600 py-4 text-lg font-semibold text-white transition-all hover:bg-brand-700 hover:scale-[1.02] disabled:opacity-60"
        >
          Start Flashcards ({categoryQuestions.length} cards) →
        </button>
      </div>
    );
  }

  // ─── Complete Screen ───
  if (cardIndex >= total) {
    return (
      <div className="mx-auto max-w-lg space-y-6 pt-12 text-center">
        <div className="text-6xl">🎉</div>
        <h1 className="text-3xl font-bold">Deck Complete!</h1>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
            <div className="text-2xl font-bold text-green-400">{known}</div>
            <div className="text-sm text-[var(--muted)]">Know It</div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="text-2xl font-bold text-amber-400">{learning}</div>
            <div className="text-sm text-[var(--muted)]">Still Learning</div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={restart}
            className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
          >
            Restart Deck
          </button>
          <button
            onClick={() => { setStarted(false); restart(); }}
            className="flex-1 rounded-xl border border-[var(--card-border)] py-3 font-semibold text-[var(--muted)] hover:text-white"
          >
            Change Topic
          </button>
        </div>
        <Link
          href="/study"
          className="block text-sm text-brand-400 hover:text-brand-300 transition-colors"
        >
          Back to Study Mode →
        </Link>
      </div>
    );
  }

  // ─── Card View ───
  const progressPct = total > 0 ? Math.round((cardIndex / total) * 100) : 0;
  const q = currentCard!;

  const correctOption = q.options.find((o) => o.id === q.correct_option_id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <span>
          Card {cardIndex + 1} of {total}
        </span>
        <span>
          ✅ {known} &nbsp; 📖 {learning}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--card-border)]">
        <div
          className="h-2 rounded-full bg-brand-500 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Category badge */}
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">
          {q.category}
        </span>
        {q.acs_code && (
          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
            {q.acs_code}
          </span>
        )}
        <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-400">
          Difficulty {q.difficulty_level}/3
        </span>
      </div>

      {/* Flip card */}
      <div className="perspective-1000 min-h-[340px]" onClick={handleFlip}>
        <div className={`card-inner min-h-[340px] cursor-pointer ${flipped ? "flipped" : ""}`}>
          {/* Front — question */}
          <div className="card-face rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-500">
              Question
            </div>
            <div className="text-lg leading-relaxed text-white">{q.question_text}</div>

            {q.figure_reference && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFigureRef({ url: q.figure_reference!, label: q.figure_reference!, type: "image", description: q.figure_reference! });
                }}
                className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/20"
              >
                📊 View {q.figure_reference}
              </button>
            )}

            <div className="mt-8 text-center text-xs text-[var(--muted)] animate-shimmer">
              Tap or press Space to reveal answer
            </div>
          </div>

          {/* Back — answer */}
          <div className="card-face card-back rounded-2xl border border-green-500/30 bg-green-500/5 p-8 overflow-y-auto">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-green-400">
              Correct Answer
            </div>
            <div className="text-lg font-semibold text-green-400">
              {q.correct_option_id}. {correctOption?.text}
            </div>
            <div className="mt-4 text-sm leading-relaxed text-[var(--foreground)]/90">
              {q.explanation_correct}
            </div>
            {q.citation && (
              <div className="mt-4 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-xs text-[var(--muted)]">
                📖 {q.citation}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons — only visible when flipped */}
      {flipped && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleStillLearning}
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 py-4 text-center font-semibold text-amber-400 transition-all hover:bg-amber-500/20 hover:scale-[1.02]"
          >
            📖 Still Learning
            <span className="mt-1 block text-xs text-[var(--muted)]">← or L key</span>
          </button>
          <button
            onClick={handleKnowIt}
            className="rounded-xl border border-green-500/40 bg-green-500/10 py-4 text-center font-semibold text-green-400 transition-all hover:bg-green-500/20 hover:scale-[1.02]"
          >
            ✅ Know It
            <span className="mt-1 block text-xs text-[var(--muted)]">→ or K key</span>
          </button>
        </div>
      )}

      {/* Back to setup */}
      <div className="flex justify-between text-sm">
        <button
          onClick={() => { setStarted(false); restart(); }}
          className="text-[var(--muted)] hover:text-white transition-colors"
        >
          ← Change Topic
        </button>
        <button
          onClick={() => { setFlipped(false); setCardIndex((i) => i + 1); }}
          className="text-[var(--muted)] hover:text-white transition-colors"
        >
          Skip →
        </button>
      </div>

      {figureRef && (
        <ReferenceModal ref_={figureRef} onClose={() => setFigureRef(null)} />
      )}
    </div>
  );
}
