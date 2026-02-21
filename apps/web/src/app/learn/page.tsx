"use client";

import { useCallback, useMemo, useState } from "react";
import {
  filterQuestionsByType,
  type Question,
  type QuestionTypeProfile,
} from "@part107/core";
import { useAdaptiveQuestionStats } from "../../hooks/useAdaptiveQuestionStats";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import { STUDY_CATEGORIES, countQuestionsByCategory } from "../../lib/questionBank";

// ─── Question type options (shared pattern) ───
const QUESTION_TYPE_OPTIONS: Array<{
  value: QuestionTypeProfile;
  title: string;
  description: string;
}> = [
  { value: "confirmed_test", title: "✅ Confirmed Test Questions", description: "Only real-exam questions (70)." },
  { value: "all_random", title: "🎲 All Questions", description: "Full 362-question pool." },
  { value: "acs_practice", title: "📚 ACS Practice Only", description: "292 ACS mastery drills." },
  { value: "real_exam", title: "Real Exam MCQ", description: "Excludes ACS drill format." },
  { value: "weak_spots", title: "🔥 Weak Spots", description: "Questions you still struggle with." },
];

type LearnPhase = "setup" | "teach" | "quiz" | "result";

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function LearnPage() {
  const { questions: allQuestions, loaded, loading, error, reload } = useQuestionBank();
  const adaptive = useAdaptiveQuestionStats();

  // Setup state
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionTypeProfile>("confirmed_test");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [batchSize, setBatchSize] = useState(5);

  // Session state
  const [phase, setPhase] = useState<LearnPhase>("setup");
  const [batch, setBatch] = useState<Question[]>([]);
  const [teachIndex, setTeachIndex] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizOrder, setQuizOrder] = useState<Question[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [quizResults, setQuizResults] = useState<{ questionId: string; correct: boolean }[]>([]);
  const [round, setRound] = useState(1);

  // Filtering
  const filteredQuestions = useMemo(
    () =>
      filterQuestionsByType(allQuestions, selectedQuestionType, {
        userStatsByKey: adaptive.statsByKey,
        adaptiveConfig: adaptive.config,
      }),
    [adaptive.config, adaptive.statsByKey, allQuestions, selectedQuestionType]
  );

  const categoryQuestions = useMemo(() => {
    return selectedCategory === "All"
      ? filteredQuestions
      : filteredQuestions.filter((q) => q.category === selectedCategory);
  }, [filteredQuestions, selectedCategory]);

  const visibleCounts = useMemo(() => countQuestionsByCategory(filteredQuestions), [filteredQuestions]);

  // Start a new learn round
  const startRound = useCallback(
    (roundNum: number) => {
      const offset = (roundNum - 1) * batchSize;
      const nextBatch = shuffleArray(categoryQuestions).slice(offset, offset + batchSize);
      if (nextBatch.length === 0) return;
      setBatch(nextBatch);
      setTeachIndex(0);
      setPhase("teach");
      setRound(roundNum);
    },
    [batchSize, categoryQuestions]
  );

  const startQuizPhase = useCallback(() => {
    setQuizOrder(shuffleArray(batch));
    setQuizIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setQuizResults([]);
    setPhase("quiz");
  }, [batch]);

  const handleQuizAnswer = useCallback(
    (optionId: string) => {
      if (showResult) return;
      setSelectedAnswer(optionId);
      setShowResult(true);
      const q = quizOrder[quizIndex];
      setQuizResults((prev) => [
        ...prev,
        { questionId: q.id, correct: optionId === q.correct_option_id },
      ]);
    },
    [quizIndex, quizOrder, showResult]
  );

  const nextQuizQuestion = useCallback(() => {
    if (quizIndex + 1 >= quizOrder.length) {
      setPhase("result");
    } else {
      setQuizIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  }, [quizIndex, quizOrder.length]);

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
        <button onClick={() => void reload()} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Retry
        </button>
      </div>
    );
  }

  // ─── Setup ───
  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-lg space-y-8 pt-8">
        <div className="text-center">
          <div className="text-5xl">🧠</div>
          <h1 className="mt-4 text-3xl font-bold">Learn Mode</h1>
          <p className="mt-2 text-[var(--muted)]">
            <strong>Read first, then test.</strong> You&apos;ll see each question with its correct answer
            and full explanation. Then you&apos;ll be quizzed on the same batch to lock it in.
          </p>
        </div>

        {/* Batch size */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-white">Questions per Round</div>
          <div className="flex gap-2">
            {[3, 5, 10, 15, 20].map((n) => (
              <button
                key={n}
                onClick={() => setBatchSize(n)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  batchSize === n
                    ? "bg-brand-500 text-white"
                    : "bg-[var(--card)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Question type */}
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

        {/* Category */}
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
              <div className="mt-1 text-xs text-[var(--muted)]">{filteredQuestions.length} questions</div>
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
                <div className="mt-1 text-xs text-[var(--muted)]">{visibleCounts[cat] ?? 0} questions</div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => startRound(1)}
          disabled={categoryQuestions.length === 0}
          className="w-full rounded-xl bg-brand-600 py-4 text-lg font-semibold text-white transition-all hover:bg-brand-700 hover:scale-[1.02] disabled:opacity-60"
        >
          Start Learning ({Math.min(batchSize, categoryQuestions.length)} questions) →
        </button>
      </div>
    );
  }

  // ─── Teach Phase ───
  if (phase === "teach") {
    const q = batch[teachIndex];
    const progress = ((teachIndex + 1) / batch.length) * 100;

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between text-sm text-[var(--muted)]">
          <span>
            📖 Learning {teachIndex + 1} of {batch.length}
          </span>
          <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">
            Round {round}
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--card-border)]">
          <div className="h-2 rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Question + Answer */}
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">
                {q.category}
              </span>
              {q.acs_code && (
                <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
                  {q.acs_code}
                </span>
              )}
            </div>
            <div className="text-lg leading-relaxed text-white">{q.question_text}</div>
          </div>

          {/* All options with correct highlighted */}
          <div className="space-y-2">
            {q.options.map((opt) => {
              const isCorrect = opt.id === q.correct_option_id;
              return (
                <div
                  key={opt.id}
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    isCorrect
                      ? "border-green-500/50 bg-green-500/10 text-green-300"
                      : "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)]"
                  }`}
                >
                  <span className="font-semibold">{opt.id}.</span> {opt.text}
                  {isCorrect && <span className="ml-2">✅</span>}
                </div>
              );
            })}
          </div>

          {/* Explanation */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Why this is correct
            </div>
            <div className="text-sm leading-relaxed text-[var(--foreground)]/90">
              {q.explanation_correct}
            </div>
          </div>

          {/* Why distractors are wrong */}
          {Object.entries(q.explanation_distractors).length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                Why other answers are wrong
              </div>
              {Object.entries(q.explanation_distractors).map(([id, text]) =>
                text ? (
                  <div key={id} className="text-sm text-[var(--muted)]">
                    <span className="font-semibold text-amber-300">{id}.</span> {text}
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* Citation */}
          {q.citation && (
            <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-xs text-[var(--muted)]">
              📖 {q.citation}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {teachIndex > 0 && (
            <button
              onClick={() => setTeachIndex((i) => i - 1)}
              className="flex-1 rounded-xl border border-[var(--card-border)] py-3 font-semibold text-[var(--muted)] hover:text-white"
            >
              ← Previous
            </button>
          )}
          {teachIndex < batch.length - 1 ? (
            <button
              onClick={() => setTeachIndex((i) => i + 1)}
              className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={startQuizPhase}
              className="flex-1 rounded-xl bg-purple-600 py-3 font-semibold text-white hover:bg-purple-700"
            >
              🧪 Now Quiz Me on These →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Quiz Phase ───
  if (phase === "quiz") {
    const q = quizOrder[quizIndex];
    const progress = ((quizIndex + 1) / quizOrder.length) * 100;

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between text-sm text-[var(--muted)]">
          <span>
            🧪 Quiz {quizIndex + 1} of {quizOrder.length}
          </span>
          <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-400">
            Round {round} — Quiz
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--card-border)]">
          <div className="h-2 rounded-full bg-purple-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-500">
              {q.category}
            </span>
          </div>
          <div className="text-lg leading-relaxed text-white">{q.question_text}</div>

          <div className="space-y-2">
            {q.options.map((opt) => {
              const isCorrect = opt.id === q.correct_option_id;
              const isSelected = opt.id === selectedAnswer;
              let className =
                "rounded-xl border px-4 py-3 text-sm text-left w-full transition-all ";

              if (showResult) {
                if (isCorrect) {
                  className += "border-green-500/50 bg-green-500/10 text-green-300";
                } else if (isSelected && !isCorrect) {
                  className += "border-red-500/50 bg-red-500/10 text-red-300";
                } else {
                  className += "border-[var(--card-border)] bg-[var(--card)] text-[var(--muted)] opacity-50";
                }
              } else {
                className +=
                  "border-[var(--card-border)] bg-[var(--card)] text-white hover:border-brand-500/40 cursor-pointer";
              }

              return (
                <button key={opt.id} onClick={() => handleQuizAnswer(opt.id)} className={className} disabled={showResult}>
                  <span className="font-semibold">{opt.id}.</span> {opt.text}
                  {showResult && isCorrect && <span className="ml-2">✅</span>}
                  {showResult && isSelected && !isCorrect && <span className="ml-2">❌</span>}
                </button>
              );
            })}
          </div>

          {/* Feedback after answering */}
          {showResult && (
            <div
              className={`rounded-xl border p-4 text-sm ${
                selectedAnswer === q.correct_option_id
                  ? "border-green-500/30 bg-green-500/10 text-green-300"
                  : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              {selectedAnswer === q.correct_option_id ? (
                <div>
                  <strong>Correct!</strong> {q.explanation_correct}
                </div>
              ) : (
                <div>
                  <strong>Incorrect.</strong>{" "}
                  {q.explanation_distractors[selectedAnswer as keyof typeof q.explanation_distractors] ??
                    "That's not the right answer."}{" "}
                  The correct answer is <strong>{q.correct_option_id}</strong>: {q.explanation_correct}
                </div>
              )}
            </div>
          )}
        </div>

        {showResult && (
          <button
            onClick={nextQuizQuestion}
            className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700"
          >
            {quizIndex + 1 >= quizOrder.length ? "See Results →" : "Next Question →"}
          </button>
        )}
      </div>
    );
  }

  // ─── Result Phase ───
  const correctCount = quizResults.filter((r) => r.correct).length;
  const totalCount = quizResults.length;
  const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const allCorrect = correctCount === totalCount;

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-8 text-center">
      <div className="text-6xl">{allCorrect ? "🎉" : pct >= 70 ? "👍" : "📚"}</div>
      <h1 className="text-3xl font-bold">
        {allCorrect ? "Perfect Round!" : pct >= 70 ? "Good Job!" : "Keep Practicing!"}
      </h1>
      <p className="text-[var(--muted)]">
        Round {round}: You got <strong>{correctCount}</strong> of <strong>{totalCount}</strong> correct (
        {pct}%)
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <div className="text-2xl font-bold text-green-400">{correctCount}</div>
          <div className="text-sm text-[var(--muted)]">Correct</div>
        </div>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="text-2xl font-bold text-red-400">{totalCount - correctCount}</div>
          <div className="text-sm text-[var(--muted)]">Missed</div>
        </div>
      </div>

      <div className="flex gap-3">
        {!allCorrect && (
          <button
            onClick={() => {
              // Re-teach just the missed ones
              const missedIds = new Set(quizResults.filter((r) => !r.correct).map((r) => r.questionId));
              const missedBatch = batch.filter((q) => missedIds.has(q.id));
              setBatch(missedBatch);
              setTeachIndex(0);
              setPhase("teach");
            }}
            className="flex-1 rounded-xl bg-amber-600 py-3 font-semibold text-white hover:bg-amber-700"
          >
            📖 Re-learn Missed ({totalCount - correctCount})
          </button>
        )}
        <button
          onClick={() => startRound(round + 1)}
          disabled={round * batchSize >= categoryQuestions.length}
          className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Next Round →
        </button>
      </div>

      <button
        onClick={() => setPhase("setup")}
        className="block w-full text-sm text-[var(--muted)] hover:text-white transition-colors"
      >
        ← Back to Setup
      </button>
    </div>
  );
}
