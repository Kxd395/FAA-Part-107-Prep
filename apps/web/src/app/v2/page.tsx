"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { STUDY_CATEGORIES } from "@part107/core";
import {
  QuestionBankError,
  QuestionBankLoading,
} from "../../components/QuestionBankState";
import { useActiveUserId } from "../../hooks/useActiveUserId";
import { useProgress } from "../../hooks/useProgress";
import { useQuestionBank } from "../../hooks/useQuestionBank";
import {
  IconArrowRight,
  IconBarChart,
  IconStudy,
  IconCheckCircle,
  IconExam,
  IconFlame,
  IconLearn,
  IconFlashcards,
  IconCharts,
  IconPhonetic,
  IconMissed,
  IconAcronyms,
  IconTarget,
  IconTrendUp,
  IconTrophy,
  IconSmartReview,
  IconLayers,
  IconGradCap,
  IconProgress,
} from "./icons";

/* ================================================================== */
/*  V2 Dashboard — real data from useProgress & useQuestionBank       */
/* ================================================================== */

function DashboardContent() {
  const userId = useActiveUserId();
  const { sessions, loaded: progressLoaded, getStats } = useProgress(userId);
  const {
    questions,
    loaded: bankLoaded,
    loading,
    error,
    counts,
    reload,
  } = useQuestionBank();

  const stats = useMemo(() => getStats(), [getStats]);

  /* ---- derived ---- */
  const totalQuestions = questions.length;
  const passProb = useMemo(() => {
    if (stats.totalQuestions === 0) return 0;
    // simple heuristic: accuracy weighted by coverage
    const coverage = Math.min(stats.totalQuestions / Math.max(totalQuestions, 1), 1);
    return Math.round(stats.overallAccuracy * coverage);
  }, [stats, totalQuestions]);

  const weakSpots = useMemo(
    () => stats.categoryBreakdown
      .filter((c) => c.total > 0 && c.percentage < 70)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 4),
    [stats.categoryBreakdown],
  );

  const recentSessions = useMemo(() => sessions.slice(0, 5), [sessions]);

  /* ---- loading / error gates ---- */
  if (loading && !bankLoaded) return <QuestionBankLoading />;
  if (error && !bankLoaded)
    return <QuestionBankError error={error} onRetry={() => void reload()} />;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      {/* ---- Hero banner ---- */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--card-border)] bg-gradient-to-br from-brand-600/20 via-[var(--card)] to-[var(--card)] p-8 md:p-10">
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--foreground)] md:text-4xl">
            Welcome back, Pilot.
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            {stats.totalQuestions === 0
              ? "Start studying to build your pass probability. Your FAA Part 107 is within reach."
              : `You've answered ${stats.totalQuestions.toLocaleString()} questions with ${stats.overallAccuracy}% accuracy across ${stats.totalSessions} sessions.`}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/v2/study"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
            >
              <IconStudy className="h-4 w-4" /> Study Now
            </Link>
            <Link
              href="/v2/exam"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white/5"
            >
              <IconExam className="h-4 w-4" /> Take Exam
            </Link>
          </div>
        </div>
        {/* decorative glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
      </section>

      {/* ---- Radial progress + stat cards ---- */}
      <section className="grid gap-6 md:grid-cols-3">
        {/* Pass Probability Ring */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8">
          <svg width="140" height="140" viewBox="0 0 140 140" className="drop-shadow-lg">
            <circle cx="70" cy="70" r="58" fill="none" stroke="var(--card-border)" strokeWidth="10" />
            <circle
              cx="70"
              cy="70"
              r="58"
              fill="none"
              stroke={passProb >= 70 ? "#22c55e" : passProb >= 40 ? "#eab308" : "#ef4444"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(passProb / 100) * 2 * Math.PI * 58} ${2 * Math.PI * 58}`}
              transform="rotate(-90 70 70)"
              className="transition-all duration-700"
            />
            <text
              x="70"
              y="64"
              textAnchor="middle"
              className="fill-[var(--foreground)] text-3xl font-extrabold"
              style={{ fontSize: 32 }}
            >
              {passProb}%
            </text>
            <text
              x="70"
              y="86"
              textAnchor="middle"
              className="fill-[var(--muted)] text-xs"
              style={{ fontSize: 11 }}
            >
              Pass Probability
            </text>
          </svg>
          {passProb >= 70 && (
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-correct/15 px-3 py-1 text-xs font-semibold text-correct">
              <IconCheckCircle className="h-3.5 w-3.5" /> Ready to test
            </span>
          )}
        </div>

        {/* Stat cards grid */}
        <div className="col-span-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            icon={<IconTarget className="h-5 w-5 text-brand-400" />}
            label="Questions Answered"
            value={stats.totalQuestions.toLocaleString()}
          />
          <StatCard
            icon={<IconTrendUp className="h-5 w-5 text-emerald-400" />}
            label="Accuracy"
            value={`${stats.overallAccuracy}%`}
          />
          <StatCard
            icon={<IconBarChart className="h-5 w-5 text-purple-400" />}
            label="Study Sessions"
            value={String(stats.studySessions)}
          />
          <StatCard
            icon={<IconTrophy className="h-5 w-5 text-amber-400" />}
            label="Best Exam"
            value={stats.examSessions > 0 ? `${stats.bestExamScore}%` : "—"}
          />
          <StatCard
            icon={<IconFlame className="h-5 w-5 text-orange-400" />}
            label="Current Streak"
            value={String(stats.currentStreak)}
          />
          <StatCard
            icon={<IconCheckCircle className="h-5 w-5 text-teal-400" />}
            label="Exam Pass Rate"
            value={stats.examSessions > 0 ? `${stats.examPassRate}%` : "—"}
          />
          <StatCard
            icon={<IconLayers className="h-5 w-5 text-sky-400" />}
            label="Questions Available"
            value={totalQuestions.toLocaleString()}
          />
          <StatCard
            icon={<IconGradCap className="h-5 w-5 text-pink-400" />}
            label="Categories"
            value={String(STUDY_CATEGORIES.length - 1)}
          />
        </div>
      </section>

      {/* ---- Quick-start study paths ---- */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">Quick Start</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PathCard
            href="/v2/study"
            icon={<IconStudy className="h-6 w-6" />}
            title="Study All Topics"
            desc={`${totalQuestions} questions across ${STUDY_CATEGORIES.length - 1} categories`}
            color="from-brand-500/20 to-brand-600/5"
          />
          <PathCard
            href="/v2/exam"
            icon={<IconExam className="h-6 w-6" />}
            title="Full Exam Sim"
            desc="60 questions, 2-hour timer, real exam blueprint"
            color="from-purple-500/20 to-purple-600/5"
          />
          <PathCard
            href="/v2/study"
            icon={<IconSmartReview className="h-6 w-6" />}
            title="Smart Review"
            desc="AI targets your weakest areas for focused drills"
            color="from-amber-500/20 to-amber-600/5"
          />
        </div>
      </section>

      {/* ---- Practice ---- */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">Practice</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PathCard
            href="/v2/flashcards"
            icon={<IconFlashcards className="h-6 w-6" />}
            title="Flashcards"
            desc="Spaced-repetition flip & drill cards"
            color="from-sky-500/20 to-sky-600/5"
          />
          <PathCard
            href="/v2/learn"
            icon={<IconLearn className="h-6 w-6" />}
            title="Learn Mode"
            desc="Read the material first, then test yourself"
            color="from-emerald-500/20 to-emerald-600/5"
          />
          <PathCard
            href="/v2/missed"
            icon={<IconMissed className="h-6 w-6" />}
            title="Missed Questions"
            desc="Review and retry questions you got wrong"
            color="from-red-500/20 to-red-600/5"
          />
          <PathCard
            href="/v2/progress"
            icon={<IconProgress className="h-6 w-6" />}
            title="Progress"
            desc="Detailed stats and session history"
            color="from-violet-500/20 to-violet-600/5"
          />
        </div>
      </section>

      {/* ---- Tools ---- */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">Reference Tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PathCard
            href="/v2/charts"
            icon={<IconCharts className="h-6 w-6" />}
            title="Sectional Charts"
            desc="Hi-res FAA sectional chart references"
            color="from-teal-500/20 to-teal-600/5"
          />
          <PathCard
            href="/v2/acronyms"
            icon={<IconAcronyms className="h-6 w-6" />}
            title="FAA Acronyms"
            desc="RPIC, LAANC, NOTAM, and more"
            color="from-orange-500/20 to-orange-600/5"
          />
          <PathCard
            href="/v2/phonetic"
            icon={<IconPhonetic className="h-6 w-6" />}
            title="Phonetic Alphabet"
            desc="NATO A–Z phonetic drill & reference"
            color="from-pink-500/20 to-pink-600/5"
          />
        </div>
      </section>

      {/* ---- Weak areas ---- */}
      {weakSpots.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">
            Areas to Improve
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {weakSpots.map((spot) => (
              <div
                key={spot.category}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {spot.category}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      spot.percentage < 50 ? "text-incorrect" : "text-amber-400"
                    }`}
                  >
                    {spot.percentage}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      spot.percentage < 50 ? "bg-incorrect" : "bg-amber-400"
                    }`}
                    style={{ width: `${spot.percentage}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  {spot.correct}/{spot.total} correct
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Category breakdown ---- */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">
          Questions by Category
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STUDY_CATEGORIES.filter((c) => c !== "All").map((cat) => {
            const count = counts[cat] ?? 0;
            const catStat = stats.categoryBreakdown.find((b) => b.category === cat);
            return (
              <div
                key={cat}
                className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{cat}</p>
                  <p className="text-xs text-[var(--muted)]">{count} questions</p>
                </div>
                {catStat && catStat.total > 0 ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      catStat.percentage >= 70
                        ? "bg-correct/15 text-correct"
                        : catStat.percentage >= 50
                          ? "bg-amber-400/15 text-amber-400"
                          : "bg-incorrect/15 text-incorrect"
                    }`}
                  >
                    {catStat.percentage}%
                  </span>
                ) : (
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-[var(--muted)]">
                    Not started
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Recent sessions ---- */}
      {recentSessions.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold text-[var(--foreground)]">
            Recent Sessions
          </h2>
          <div className="space-y-2">
            {recentSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                      s.mode === "exam"
                        ? "bg-purple-500/15 text-purple-400"
                        : "bg-brand-500/15 text-brand-400"
                    }`}
                  >
                    {s.mode === "exam" ? "E" : "S"}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {s.mode === "exam" ? "Exam" : "Study"} — {s.category}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {new Date(s.timestamp).toLocaleDateString()} ·{" "}
                      {s.score}/{s.total} correct
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-bold ${
                    s.passed ? "text-correct" : "text-incorrect"
                  }`}
                >
                  {s.percentage}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
      {icon}
      <span className="mt-1 text-xl font-extrabold text-[var(--foreground)]">{value}</span>
      <span className="text-xs text-[var(--muted)]">{label}</span>
    </div>
  );
}

function PathCard({
  href,
  icon,
  title,
  desc,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 rounded-2xl border border-[var(--card-border)] bg-gradient-to-br ${color} p-5 transition hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-600/10`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-brand-400 transition group-hover:bg-brand-600/20">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--foreground)]">{title}</p>
        <p className="text-sm text-[var(--muted)]">{desc}</p>
      </div>
      <IconArrowRight className="h-5 w-5 shrink-0 text-[var(--muted)] transition group-hover:text-brand-400" />
    </Link>
  );
}

/* ---- Page wrapper with Suspense ---- */

export default function V2DashboardPage() {
  return (
    <Suspense fallback={<QuestionBankLoading label="Loading dashboard…" />}>
      <DashboardContent />
    </Suspense>
  );
}
