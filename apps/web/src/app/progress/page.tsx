"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useProgress, SessionRecord } from "../../hooks/useProgress";
import { defaultAdaptiveStatsStore } from "../../lib/adaptiveStatsStore";
import { computeAdaptiveInsights } from "../../lib/adaptiveInsights";
import { defaultAttemptEventStore } from "../../lib/attemptEventStore";
import { defaultLearningEventStore } from "../../lib/learningEventStore";

const LOCAL_USER_ID = "local-user";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─────────────────────────────────────────────
// Progress Page
// ─────────────────────────────────────────────

export default function ProgressPage() {
  const { sessions, loaded, getStats, clearAll } = useProgress();
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "categories">("overview");
  const adaptiveInsights = useMemo(() => {
    if (!loaded) {
      return computeAdaptiveInsights({ statsByKey: {}, attempts: [] });
    }
    const statsByKey = defaultAdaptiveStatsStore.load(LOCAL_USER_ID);
    const attempts = defaultAttemptEventStore.load(LOCAL_USER_ID);
    return computeAdaptiveInsights({ statsByKey, attempts });
  }, [loaded]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-[var(--muted)]">Loading progress…</div>
      </div>
    );
  }

  const stats = getStats();

  // ─── Empty State ───
  if (sessions.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-6 pt-12 text-center">
        <div className="text-6xl">📊</div>
        <h1 className="text-3xl font-bold">No Progress Yet</h1>
        <p className="text-[var(--muted)]">
          Complete a study session or practice exam and your results will appear
          here. Every question you answer is tracked so you can see exactly where
          to focus.
        </p>
        <div className="flex justify-center gap-3">
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
            Take an Exam
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">📊 Your Progress</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {stats.totalSessions} sessions • {stats.totalQuestions} questions answered
          </p>
        </div>
        <div>
          {showConfirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--muted)]">Are you sure?</span>
              <button
                onClick={() => {
                  clearAll();
                  defaultAdaptiveStatsStore.clear(LOCAL_USER_ID);
                  defaultAttemptEventStore.clear(LOCAL_USER_ID);
                  defaultLearningEventStore.clear(LOCAL_USER_ID);
                  setShowConfirmClear(false);
                }}
                className="rounded-lg bg-incorrect/20 px-3 py-1.5 text-xs font-semibold text-incorrect hover:bg-incorrect/30"
              >
                Yes, Clear All
              </button>
              <button
                onClick={() => setShowConfirmClear(false)}
                className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirmClear(true)}
              className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white"
            >
              Reset Data
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overall Accuracy"
          value={`${stats.overallAccuracy}%`}
          sub={`${stats.totalCorrect} of ${stats.totalQuestions} correct`}
          accent={stats.overallAccuracy >= 70 ? "correct" : "incorrect"}
        />
        <StatCard
          label="Exam Pass Rate"
          value={stats.examSessions > 0 ? `${stats.examPassRate}%` : "—"}
          sub={
            stats.examSessions > 0
              ? `${stats.examSessions} exam${stats.examSessions !== 1 ? "s" : ""} taken`
              : "No exams yet"
          }
          accent={stats.examPassRate >= 70 ? "correct" : "incorrect"}
        />
        <StatCard
          label="Best Exam Score"
          value={stats.bestExamScore > 0 ? `${stats.bestExamScore}%` : "—"}
          sub={stats.bestExamScore >= 70 ? "Passing ✓" : "Keep practicing"}
          accent={stats.bestExamScore >= 70 ? "correct" : "muted"}
        />
        <StatCard
          label="Pass Streak"
          value={`${stats.currentStreak}`}
          sub={`Longest: ${stats.longestStreak}`}
          accent={stats.currentStreak >= 3 ? "correct" : "muted"}
        />
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-1">
        {(["overview", "history", "categories"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-brand-500/20 text-brand-400"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            {tab === "overview" ? "📈 Overview" : tab === "history" ? "📋 History" : "📂 Categories"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab stats={stats} adaptiveInsights={adaptiveInsights} />}
      {activeTab === "history" && <HistoryTab sessions={sessions} />}
      {activeTab === "categories" && <CategoriesTab stats={stats} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// Stat Card Component
// ─────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "correct" | "incorrect" | "muted";
}) {
  const color =
    accent === "correct"
      ? "text-correct"
      : accent === "incorrect"
      ? "text-incorrect"
      : "text-[var(--muted)]";
  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-sm text-[var(--muted)]">{sub}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────
function OverviewTab({
  stats,
  adaptiveInsights,
}: {
  stats: ReturnType<ReturnType<typeof useProgress>["getStats"]>;
  adaptiveInsights: ReturnType<typeof computeAdaptiveInsights>;
}) {
  return (
    <div className="space-y-6">
      {adaptiveInsights.trackedQuestions > 0 && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
          <h3 className="mb-4 font-semibold text-white">🧠 Adaptive Insights</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Last 10 Attempts</div>
              <div className="mt-1 text-2xl font-bold text-white">
                {adaptiveInsights.last10AccuracyPercent !== null
                  ? `${adaptiveInsights.last10AccuracyPercent}%`
                  : "—"}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {adaptiveInsights.last10CorrectCount}/{adaptiveInsights.last10AttemptCount} correct
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Momentum</div>
              <div
                className={`mt-1 text-2xl font-bold ${
                  adaptiveInsights.momentumPercent === null
                    ? "text-[var(--muted)]"
                    : adaptiveInsights.momentumPercent >= 0
                      ? "text-correct"
                      : "text-incorrect"
                }`}
              >
                {adaptiveInsights.momentumPercent === null
                  ? "—"
                  : `${adaptiveInsights.momentumPercent >= 0 ? "+" : ""}${adaptiveInsights.momentumPercent}`}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">vs previous 10 attempts</div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Due Now</div>
              <div className="mt-1 text-2xl font-bold text-amber-300">{adaptiveInsights.dueNowCount}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {adaptiveInsights.dueWithin24hCount} more due within 24h
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
            <div>
              Tracked questions:{" "}
              <span className="font-medium text-white">{adaptiveInsights.trackedQuestions}</span>
            </div>
            <div>
              At-risk questions:{" "}
              <span className="font-medium text-incorrect">{adaptiveInsights.atRiskCount}</span>
            </div>
            <div>
              Avg rolling last10:{" "}
              <span className="font-medium text-white">
                {adaptiveInsights.averageRollingLast10Percent !== null
                  ? `${adaptiveInsights.averageRollingLast10Percent}%`
                  : "—"}
              </span>
            </div>
            <div>
              Avg rolling momentum:{" "}
              <span
                className={`font-medium ${
                  adaptiveInsights.averageRollingMomentumPercent === null
                    ? "text-white"
                    : adaptiveInsights.averageRollingMomentumPercent >= 0
                      ? "text-correct"
                      : "text-incorrect"
                }`}
              >
                {adaptiveInsights.averageRollingMomentumPercent === null
                  ? "—"
                  : `${adaptiveInsights.averageRollingMomentumPercent >= 0 ? "+" : ""}${adaptiveInsights.averageRollingMomentumPercent}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Accuracy Trend (Text-based chart) */}
      {stats.recentTrend.length > 1 && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
          <h3 className="mb-4 font-semibold text-white">📈 Accuracy Trend</h3>
          <div className="flex items-end gap-1" style={{ height: 120 }}>
            {stats.recentTrend.map((point, i) => (
              <div key={i} className="group relative flex flex-1 flex-col items-center">
                <div
                  className={`w-full max-w-[32px] rounded-t transition-all ${
                    point.percentage >= 70
                      ? "bg-correct/60 group-hover:bg-correct"
                      : "bg-incorrect/60 group-hover:bg-incorrect"
                  }`}
                  style={{ height: `${Math.max(4, point.percentage)}%` }}
                />
                {/* Tooltip */}
                <div className="absolute -top-8 hidden rounded bg-[var(--background)] px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                  {point.percentage}%
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-[var(--muted)]">
            <span>{stats.recentTrend[0]?.date}</span>
            <span className="border-t border-dashed border-[var(--card-border)] flex-1 mx-2 self-center" />
            <span>{stats.recentTrend[stats.recentTrend.length - 1]?.date}</span>
          </div>
          <div className="mt-1 text-center text-xs text-[var(--muted)]">
            Last {stats.recentTrend.length} sessions — 70% passing line
          </div>
        </div>
      )}

      {/* Weak Spots */}
      {stats.weakSpots.length > 0 && (
        <div className="rounded-xl border border-incorrect/20 bg-incorrect/5 p-6">
          <h3 className="mb-3 font-semibold text-incorrect">
            ⚠️ Weak Spots — Focus Here
          </h3>
          <p className="mb-4 text-sm text-[var(--muted)]">
            These categories are below the 70% passing threshold. Study these
            topics to boost your overall score.
          </p>
          <div className="space-y-3">
            {stats.weakSpots.map((cat) => (
              <div key={cat.category} className="flex items-center gap-3">
                <span className="w-28 text-sm font-medium text-white truncate">
                  {cat.category}
                </span>
                <div className="flex-1 overflow-hidden rounded-full bg-[var(--background)] h-3">
                  <div
                    className="h-full rounded-full bg-incorrect/60 transition-all"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
                <span className="w-14 text-right text-sm font-bold text-incorrect">
                  {cat.percentage}%
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/study"
            className="mt-4 inline-block rounded-lg bg-incorrect/20 px-4 py-2 text-sm font-semibold text-incorrect hover:bg-incorrect/30"
          >
            Drill Weak Spots →
          </Link>
        </div>
      )}

      {/* Quick Summary */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
          <div className="text-sm text-[var(--muted)]">Study Sessions</div>
          <div className="mt-1 text-2xl font-bold text-white">
            {stats.studySessions}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
          <div className="text-sm text-[var(--muted)]">Practice Exams</div>
          <div className="mt-1 text-2xl font-bold text-white">
            {stats.examSessions}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// History Tab
// ─────────────────────────────────────────────
function HistoryTab({ sessions }: { sessions: SessionRecord[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const isExpanded = expandedId === session.id;
        return (
          <div
            key={session.id}
            className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] overflow-hidden"
          >
            {/* Session Row */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : session.id)}
              className="w-full p-4 text-left hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Mode Badge */}
                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase ${
                    session.mode === "exam"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-brand-500/10 text-brand-400"
                  }`}
                >
                  {session.mode}
                </span>

                {session.mode === "exam" && session.questionTypeProfile && (
                  <span className="rounded-lg border border-[var(--card-border)] px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    {session.questionTypeProfile.replaceAll("_", " ")}
                  </span>
                )}

                {/* Category (study only) */}
                {session.mode === "study" && (
                  <span className="text-sm text-[var(--muted)]">
                    {session.category}
                  </span>
                )}

                <div className="flex-1" />

                {/* Score */}
                <span
                  className={`text-lg font-bold ${
                    session.passed ? "text-correct" : "text-incorrect"
                  }`}
                >
                  {session.percentage}%
                </span>

                {/* Pass/Fail */}
                <span className="text-sm">
                  {session.passed ? "✅" : "❌"}
                </span>

                {/* Time */}
                <span className="text-xs text-[var(--muted)] w-20 text-right">
                  {timeAgo(session.timestamp)}
                </span>

                {/* Expand */}
                <span className="text-[var(--muted)] text-sm">
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>
              <div className="mt-1 flex gap-4 text-xs text-[var(--muted)]">
                <span>
                  {session.score}/{session.total} correct
                </span>
                <span>⏱ {formatDuration(session.timeSpentMs)}</span>
                <span>
                  {new Date(session.timestamp).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </button>

            {/* Expanded Detail */}
            {isExpanded && (
              <div className="border-t border-[var(--card-border)] bg-[var(--background)]/50 p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Question Breakdown
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {session.questions.map((q, i) => (
                    <div
                      key={q.questionId}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                        q.isCorrect
                          ? "bg-correct/5 text-correct"
                          : "bg-incorrect/5 text-incorrect"
                      }`}
                    >
                      <span className="font-mono text-xs">Q{i + 1}</span>
                      <span className="flex-1 truncate text-xs text-[var(--muted)]">
                        {q.category}
                      </span>
                      <span>{q.isCorrect ? "✓" : "✗"}</span>
                    </div>
                  ))}
                </div>

                {/* Per-category mini breakdown */}
                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Category Summary
                  </div>
                  {(() => {
                    const catMap = new Map<string, { c: number; t: number }>();
                    for (const q of session.questions) {
                      const e = catMap.get(q.category) ?? { c: 0, t: 0 };
                      e.t++;
                      if (q.isCorrect) e.c++;
                      catMap.set(q.category, e);
                    }
                    return Array.from(catMap.entries()).map(([cat, { c, t }]) => (
                      <div
                        key={cat}
                        className="flex items-center gap-2 text-sm py-0.5"
                      >
                        <span className="w-24 truncate text-xs text-[var(--muted)]">
                          {cat}
                        </span>
                        <div className="flex-1 overflow-hidden rounded-full bg-[var(--card)] h-2">
                          <div
                            className={`h-full rounded-full ${
                              (c / t) * 100 >= 70 ? "bg-correct/60" : "bg-incorrect/60"
                            }`}
                            style={{ width: `${Math.round((c / t) * 100)}%` }}
                          />
                        </div>
                        <span className="w-16 text-right text-xs text-[var(--muted)]">
                          {c}/{t} ({Math.round((c / t) * 100)}%)
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Categories Tab
// ─────────────────────────────────────────────
function CategoriesTab({
  stats,
}: {
  stats: ReturnType<ReturnType<typeof useProgress>["getStats"]>;
}) {
  if (stats.categoryBreakdown.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--muted)]">
        Answer some questions first to see category data.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Accuracy per topic across all sessions. Categories below 70% need extra
        review.
      </p>
      {stats.categoryBreakdown.map((cat) => (
        <div
          key={cat.category}
          className={`rounded-xl border p-4 ${
            cat.percentage >= 70
              ? "border-[var(--card-border)] bg-[var(--card)]"
              : "border-incorrect/20 bg-incorrect/5"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-white">{cat.category}</span>
            <span
              className={`text-lg font-bold ${
                cat.percentage >= 70 ? "text-correct" : "text-incorrect"
              }`}
            >
              {cat.percentage}%
            </span>
          </div>
          <div className="overflow-hidden rounded-full bg-[var(--background)] h-3">
            <div
              className={`h-full rounded-full transition-all ${
                cat.percentage >= 70 ? "bg-correct/60" : "bg-incorrect/60"
              }`}
              style={{ width: `${cat.percentage}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-[var(--muted)]">
            <span>
              {cat.correct} of {cat.total} correct
            </span>
            <span>{cat.percentage >= 70 ? "✅ Passing" : "⚠️ Needs work"}</span>
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-center">
        <span className="text-sm text-[var(--muted)]">
          {stats.categoryBreakdown.filter((c) => c.percentage >= 70).length} of{" "}
          {stats.categoryBreakdown.length} categories at passing level
        </span>
      </div>
    </div>
  );
}
