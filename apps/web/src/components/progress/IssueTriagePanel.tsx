"use client";

import Link from "next/link";

export type QuestionIssueMode = "study" | "exam" | "learn" | "flashcards" | "missed" | "unknown";

interface QuestionIssueTriageRow {
  questionId: string;
  questionText: string;
  category: string;
  subcategory: string;
  reportCount: number;
  latestReportAt: string;
  latestNote: string;
  byMode: Record<QuestionIssueMode, number>;
}

export interface QuestionIssueTriageSummary {
  totalReports: number;
  uniqueQuestionCount: number;
  latestReportAt: string | null;
  byMode: Record<QuestionIssueMode, number>;
  byCategory: Record<string, number>;
  topQuestions: QuestionIssueTriageRow[];
}

interface IssueTriagePanelProps {
  summary: QuestionIssueTriageSummary | null;
  pending: boolean;
  error: string | null;
  queueStatus: string | null;
  onRefresh: () => void;
  onQueueQuestion: (questionId: string) => void;
  onOpenBookmarkQueue: () => void;
}

const ISSUE_TRIAGE_MODE_ORDER: QuestionIssueMode[] = [
  "study",
  "exam",
  "learn",
  "flashcards",
  "missed",
  "unknown",
];

function formatIssueMode(mode: QuestionIssueMode): string {
  if (mode === "flashcards") return "Flashcards";
  if (mode === "unknown") return "Unknown";
  return mode.charAt(0).toUpperCase() + mode.slice(1);
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

export default function IssueTriagePanel({
  summary,
  pending,
  error,
  queueStatus,
  onRefresh,
  onQueueQuestion,
  onOpenBookmarkQueue,
}: IssueTriagePanelProps) {
  const modeBreakdown = summary
    ? ISSUE_TRIAGE_MODE_ORDER.map((mode) => ({
        mode,
        count: summary.byMode[mode] ?? 0,
      })).filter((entry) => entry.count > 0)
    : [];
  const categoryBreakdown = summary
    ? Object.entries(summary.byCategory)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6)
    : [];

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Issue Triage</div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            Prioritize question fixes based on submitted in-question issue reports.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/study?collection=bookmarks&type=confirmed_test"
            onClick={onOpenBookmarkQueue}
            className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white"
          >
            Open Bookmark Queue
          </Link>
          <button
            type="button"
            onClick={onRefresh}
            disabled={pending}
            className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh Issues
          </button>
        </div>
      </div>
      {queueStatus && (
        <div className="mt-2 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-200">
          {queueStatus}
        </div>
      )}
      {pending && <div className="mt-3 text-xs text-[var(--muted)]">Loading issue triage…</div>}
      {!pending && error && (
        <div className="mt-3 rounded-lg border border-incorrect/30 bg-incorrect/10 px-3 py-2 text-xs text-incorrect">
          Issue triage unavailable: {error}
        </div>
      )}
      {!pending && !error && summary && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Total Reports</div>
              <div className="text-lg font-semibold text-white">{summary.totalReports}</div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Questions Flagged</div>
              <div className="text-lg font-semibold text-white">{summary.uniqueQuestionCount}</div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Last Report</div>
              <div className="text-lg font-semibold text-white">
                {summary.latestReportAt ? timeAgo(summary.latestReportAt) : "none"}
              </div>
            </div>
          </div>
          {modeBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {modeBreakdown.map((entry) => (
                <span
                  key={entry.mode}
                  className="rounded-full border border-[var(--card-border)] px-2 py-0.5 text-[11px] text-[var(--muted)]"
                >
                  {formatIssueMode(entry.mode)}: {entry.count}
                </span>
              ))}
            </div>
          )}
          {categoryBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {categoryBreakdown.map(([category, count]) => (
                <span
                  key={category}
                  className="rounded-full border border-brand-500/25 bg-brand-500/10 px-2 py-0.5 text-[11px] text-brand-200"
                >
                  {category}: {count}
                </span>
              ))}
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-white">Top Reported Questions</div>
            {summary.topQuestions.length === 0 ? (
              <div className="mt-1 text-xs text-[var(--muted)]">No issue reports submitted yet.</div>
            ) : (
              <ul className="mt-2 space-y-2">
                {summary.topQuestions.map((row) => (
                  <li
                    key={row.questionId}
                    className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-[11px] text-[var(--muted)]">
                          {row.questionId} • {row.category}
                        </div>
                        <div className="text-sm text-white">{row.questionText}</div>
                        <div className="truncate text-xs text-[var(--muted)]">Latest note: {row.latestNote}</div>
                      </div>
                      <div className="shrink-0 text-right text-xs">
                        <div className="font-semibold text-white">{row.reportCount} reports</div>
                        <div className="text-[var(--muted)]">{timeAgo(row.latestReportAt)}</div>
                        <button
                          type="button"
                          onClick={() => onQueueQuestion(row.questionId)}
                          className="mt-1 rounded border border-[var(--card-border)] px-2 py-1 text-[11px] text-[var(--muted)] hover:text-white"
                        >
                          Queue for Review
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
