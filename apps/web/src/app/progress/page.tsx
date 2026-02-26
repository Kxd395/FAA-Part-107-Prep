"use client";

import Link from "next/link";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useProgress, SessionRecord } from "../../hooks/useProgress";
import { useLearningEventLogger } from "../../hooks/useLearningEventLogger";
import IssueTriagePanel, {
  type QuestionIssueTriageSummary,
} from "../../components/progress/IssueTriagePanel";
import { defaultAdaptiveStatsStore } from "../../lib/adaptiveStatsStore";
import { computeAdaptiveInsights } from "../../lib/adaptiveInsights";
import { defaultAttemptEventStore } from "../../lib/attemptEventStore";
import { defaultLearningEventStore, type LearningEvent } from "../../lib/learningEventStore";
import { clearLearnDraft } from "../../lib/learnDraftStore";
import {
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_MODES,
  LOCAL_USER_ID,
  type LearningEventMode,
  type LearningEventType,
} from "../../lib/analyticsTaxonomy";
import {
  computeImportPreview,
  resolveImportedData,
  type ImportMergeMode,
} from "../../lib/progressImportMerge";
import { buildTelemetrySupportBundle, downloadJsonFile } from "../../lib/telemetrySupportBundle";
import { readPortableStateForUser, writePortableStateForUser } from "../../lib/portableStateStorage";
import { FLASHCARD_SR_STORAGE_KEY, userScopedStorageKey } from "../../lib/progressStorage";
import {
  clearAnalyticsDeadLetterQueue,
  getAnalyticsDeadLetterSummary,
  retryAnalyticsDeadLetterQueue,
} from "../../lib/analyticsSink";
import { computeResponseTimeTelemetry } from "../../lib/responseTimeTelemetry";
import { addQuestionsToCollection } from "../../lib/questionCollectionStore";

const PORTABLE_EXPORT_KEYS = [
  "part107_progress",
  "part107_adaptive_stats_v2",
  "part107_attempt_events_v1",
  "part107_learning_events_v1",
  "part107_flashcard_sr",
  "part107_learn_draft_v1",
  "part107_question_collections_v1",
] as const;
const SYNC_DEFAULT_USER_ID = LOCAL_USER_ID;

interface PortableProgressSnapshot {
  version: 1;
  exportedAt: string;
  data: Record<string, string | null>;
}

interface LearningEventInsights {
  events: LearningEvent[];
  total: number;
  byMode: Record<string, number>;
  byType: Record<string, number>;
  recent: LearningEvent[];
}

type TelemetryTimeWindow = "24h" | "7d" | "30d" | "all";
type TelemetryFilterMode = LearningEventMode | "all";
type TelemetryFilterType = LearningEventType | "all";

interface LearnCompletionPoint {
  timestamp: string;
  round: number;
  uniqueQuestions: number;
  firstPassCorrect: number;
  masteredCount: number;
  firstPassPercent: number;
  masteryPercent: number;
}

interface PreviewKeyConflict {
  key: string;
  incomingState: "missing" | "present";
  currentState: "missing" | "present";
  willChange: boolean;
  sessionDelta?: string;
}

type KeyConflictResolution = "remote" | "local";

type ResetScope = "all" | "progress" | "adaptive" | "telemetry";

const RESET_SCOPES: Array<{ id: ResetScope; label: string; description: string }> = [
  { id: "all", label: "All Data", description: "Progress, adaptive stats, telemetry, and learn draft." },
  { id: "progress", label: "Progress Only", description: "Session history and dashboard metrics only." },
  { id: "adaptive", label: "Adaptive Only", description: "Adaptive stats + flashcard schedule only." },
  { id: "telemetry", label: "Telemetry Only", description: "Learning and attempt event streams only." },
];

const HISTORY_PAGE_SIZE = 15;
const HISTORY_VIRTUALIZE_THRESHOLD = 250;
const HISTORY_VIRTUAL_WINDOW_SIZE = 80;
const HISTORY_ROW_ESTIMATE_PX = 108;
const DAILY_ACTIVITY_WINDOW_DAYS = 30;
const WEEKLY_ACTIVITY_WINDOW_WEEKS = 8;

interface SessionActivityDailyPoint {
  dateKey: string;
  label: string;
  count: number;
  passCount: number;
}

interface SessionActivityWeeklyPoint {
  weekKey: string;
  label: string;
  count: number;
  passRatePercent: number | null;
}

interface SessionActivityInsights {
  dailyPoints: SessionActivityDailyPoint[];
  weeklyPoints: SessionActivityWeeklyPoint[];
  currentDailyStreak: number;
  longestDailyStreak: number;
  activeDays: number;
}

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

function computeLearningEventInsights(events: LearningEvent[]): LearningEventInsights {
  const byMode: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const event of events) {
    byMode[event.mode] = (byMode[event.mode] ?? 0) + 1;
    byType[event.type] = (byType[event.type] ?? 0) + 1;
  }

  return {
    events,
    total: events.length,
    byMode,
    byType,
    recent: [...events].slice(-12).reverse(),
  };
}

function isLearningEventMode(value: string): value is LearningEventMode {
  return (ANALYTICS_MODES as readonly string[]).includes(value);
}

function isLearningEventType(value: string): value is LearningEventType {
  return (ANALYTICS_EVENT_TYPES as readonly string[]).includes(value);
}

function getMetadataNumber(
  metadata: LearningEvent["metadata"],
  key: string
): number | null {
  const value = metadata?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function computeWindowCutoff(window: TelemetryTimeWindow): number | null {
  const now = Date.now();
  if (window === "24h") return now - 24 * 60 * 60 * 1000;
  if (window === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  if (window === "30d") return now - 30 * 24 * 60 * 60 * 1000;
  return null;
}

function computeLearnCompletionTrend(events: LearningEvent[]): LearnCompletionPoint[] {
  const trend: LearnCompletionPoint[] = [];

  for (const event of events) {
    if (event.mode !== "learn" || event.type !== "session_completed") continue;

    const uniqueQuestions = getMetadataNumber(event.metadata, "uniqueQuestions");
    const firstPassCorrect = getMetadataNumber(event.metadata, "firstPassCorrect");
    const masteredCount = getMetadataNumber(event.metadata, "masteredCount");
    const round = getMetadataNumber(event.metadata, "round") ?? trend.length + 1;

    if (!uniqueQuestions || uniqueQuestions <= 0 || firstPassCorrect === null || masteredCount === null) {
      continue;
    }

    trend.push({
      timestamp: event.timestamp,
      round: Math.max(1, Math.round(round)),
      uniqueQuestions: Math.round(uniqueQuestions),
      firstPassCorrect: Math.round(firstPassCorrect),
      masteredCount: Math.round(masteredCount),
      firstPassPercent: Math.round((firstPassCorrect / uniqueQuestions) * 100),
      masteryPercent: Math.round((masteredCount / uniqueQuestions) * 100),
    });
  }

  return trend
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .slice(Math.max(0, trend.length - 8));
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addLocalDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function toLocalDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const next = new Date(year, month, day);
  if (
    next.getFullYear() !== year ||
    next.getMonth() !== month ||
    next.getDate() !== day
  ) {
    return null;
  }
  return next;
}

function startOfLocalWeek(value: Date): Date {
  const dayStart = startOfLocalDay(value);
  return addLocalDays(dayStart, -dayStart.getDay());
}

function diffLocalDays(left: Date, right: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((startOfLocalDay(left).getTime() - startOfLocalDay(right).getTime()) / MS_PER_DAY);
}

function computeSessionActivityInsights(sessions: SessionRecord[]): SessionActivityInsights {
  const dayMap = new Map<
    string,
    {
      count: number;
      passCount: number;
    }
  >();

  const validSessions = sessions
    .map((session) => {
      const parsed = Date.parse(session.timestamp);
      if (Number.isNaN(parsed)) return null;
      return { session, date: new Date(parsed) };
    })
    .filter((entry): entry is { session: SessionRecord; date: Date } => !!entry);

  for (const { session, date } of validSessions) {
    const dateKey = toLocalDateKey(date);
    const existing = dayMap.get(dateKey) ?? { count: 0, passCount: 0 };
    existing.count += 1;
    if (session.passed) existing.passCount += 1;
    dayMap.set(dateKey, existing);
  }

  const today = startOfLocalDay(new Date());
  const dailyPoints: SessionActivityDailyPoint[] = [];
  for (let offset = DAILY_ACTIVITY_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const date = addLocalDays(today, -offset);
    const dateKey = toLocalDateKey(date);
    const value = dayMap.get(dateKey);
    dailyPoints.push({
      dateKey,
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: value?.count ?? 0,
      passCount: value?.passCount ?? 0,
    });
  }

  let currentDailyStreak = 0;
  let cursor = today;
  while (dayMap.has(toLocalDateKey(cursor))) {
    currentDailyStreak += 1;
    cursor = addLocalDays(cursor, -1);
  }

  const sortedActiveDates = Array.from(dayMap.keys())
    .map((key) => parseLocalDateKey(key))
    .filter((date): date is Date => !!date)
    .sort((a, b) => a.getTime() - b.getTime());

  let longestDailyStreak = 0;
  let runningStreak = 0;
  let previousDate: Date | null = null;
  for (const date of sortedActiveDates) {
    if (previousDate && diffLocalDays(date, previousDate) === 1) {
      runningStreak += 1;
    } else {
      runningStreak = 1;
    }
    if (runningStreak > longestDailyStreak) {
      longestDailyStreak = runningStreak;
    }
    previousDate = date;
  }

  const weeklyPoints: SessionActivityWeeklyPoint[] = [];
  const currentWeekStart = startOfLocalWeek(today);
  for (let offset = WEEKLY_ACTIVITY_WINDOW_WEEKS - 1; offset >= 0; offset -= 1) {
    const weekStart = addLocalDays(currentWeekStart, -7 * offset);
    const weekEndExclusive = addLocalDays(weekStart, 7);
    let count = 0;
    let passCount = 0;
    for (const { session, date } of validSessions) {
      if (date >= weekStart && date < weekEndExclusive) {
        count += 1;
        if (session.passed) passCount += 1;
      }
    }
    weeklyPoints.push({
      weekKey: toLocalDateKey(weekStart),
      label: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
      passRatePercent: count > 0 ? Math.round((passCount / count) * 100) : null,
    });
  }

  return {
    dailyPoints,
    weeklyPoints,
    currentDailyStreak,
    longestDailyStreak,
    activeDays: dayMap.size,
  };
}

function tryParseSessionCount(raw: string | null): number | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : null;
  } catch {
    return null;
  }
}

function buildPreviewKeyConflicts(
  snapshotData: Record<string, string | null>,
  currentData: Record<string, string | null>,
  resolvedData: Record<string, string | null>,
  keys: readonly string[]
): PreviewKeyConflict[] {
  return keys.map((key) => {
    const incoming = snapshotData[key] ?? null;
    const current = currentData[key] ?? null;
    const resolved = resolvedData[key] ?? null;
    const incomingSessions = key === "part107_progress" ? tryParseSessionCount(incoming) : null;
    const currentSessions = key === "part107_progress" ? tryParseSessionCount(current) : null;
    const resolvedSessions = key === "part107_progress" ? tryParseSessionCount(resolved) : null;
    const sessionDelta =
      key === "part107_progress" &&
        incomingSessions !== null &&
        currentSessions !== null &&
        resolvedSessions !== null
        ? `${currentSessions} -> ${resolvedSessions} (incoming ${incomingSessions})`
        : undefined;
    return {
      key,
      incomingState: incoming === null ? "missing" : "present",
      currentState: current === null ? "missing" : "present",
      willChange: resolved !== current,
      sessionDelta,
    };
  });
}

// ─────────────────────────────────────────────
// Progress Page
// ─────────────────────────────────────────────

export default function ProgressPage() {
  const { user } = useAuth();
  const authenticatedUserId = user?.userId ?? null;
  const activeUserId = authenticatedUserId ?? LOCAL_USER_ID;
  const { logEvent } = useLearningEventLogger(activeUserId);
  const { sessions, loaded, getStats, clearAll } = useProgress(activeUserId);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [resetScope, setResetScope] = useState<ResetScope>("all");
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "categories">("overview");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [pendingImportSnapshot, setPendingImportSnapshot] = useState<PortableProgressSnapshot | null>(null);
  const [pendingImportFileName, setPendingImportFileName] = useState<string | null>(null);
  const [importMergeMode, setImportMergeMode] = useState<ImportMergeMode>("merge");
  const [syncUserId, setSyncUserId] = useState(activeUserId);
  const [syncToken, setSyncToken] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncUpdatedAt, setSyncUpdatedAt] = useState<string | null>(null);
  const [syncPending, setSyncPending] = useState(false);
  const [cloudPending, setCloudPending] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [deadLetterSummary, setDeadLetterSummary] = useState(() => getAnalyticsDeadLetterSummary());
  const [issueTriageSummary, setIssueTriageSummary] = useState<QuestionIssueTriageSummary | null>(null);
  const [issueTriagePending, setIssueTriagePending] = useState(false);
  const [issueTriageError, setIssueTriageError] = useState<string | null>(null);
  const [issueTriageQueueStatus, setIssueTriageQueueStatus] = useState<string | null>(null);
  const [conflictResolutionByKey, setConflictResolutionByKey] = useState<
    Record<string, KeyConflictResolution>
  >({});
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const autoLoadedAccountStateForUserRef = useRef<string | null>(null);
  const syncUserOverriddenRef = useRef(false);
  const attemptEvents = useMemo(
    () => (loaded ? defaultAttemptEventStore.load(activeUserId) : []),
    [activeUserId, loaded]
  );
  const adaptiveInsights = useMemo(() => {
    if (!loaded) {
      return computeAdaptiveInsights({ statsByKey: {}, attempts: [] });
    }
    const statsByKey = defaultAdaptiveStatsStore.load(activeUserId);
    return computeAdaptiveInsights({ statsByKey, attempts: attemptEvents });
  }, [activeUserId, attemptEvents, loaded]);
  const responseTimeTelemetry = useMemo(
    () => computeResponseTimeTelemetry(attemptEvents),
    [attemptEvents]
  );
  const learningEventInsights = loaded
    ? computeLearningEventInsights(defaultLearningEventStore.load(activeUserId))
    : computeLearningEventInsights([]);

  const loadIssueTriageSummary = useCallback(async () => {
    if (!authenticatedUserId) {
      setIssueTriageSummary(null);
      setIssueTriageError(null);
      setIssueTriagePending(false);
      return;
    }
    setIssueTriagePending(true);
    setIssueTriageError(null);
    try {
      const response = await fetch("/api/user/question-issues/summary?limit=8");
      const body = (await response.json()) as { summary?: QuestionIssueTriageSummary; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load issue triage");
      }
      if (!body.summary) {
        throw new Error("Issue triage summary missing from response");
      }
      setIssueTriageSummary(body.summary);
    } catch (error) {
      setIssueTriageError(error instanceof Error ? error.message : "Failed to load issue triage");
      setIssueTriageSummary(null);
    } finally {
      setIssueTriagePending(false);
    }
  }, [authenticatedUserId]);

  const queueIssueQuestionForReview = useCallback(
    (questionId: string) => {
      const normalizedQuestionId = questionId.trim();
      if (!normalizedQuestionId) return;
      const added = addQuestionsToCollection(activeUserId, "bookmarks", [normalizedQuestionId]);
      const message =
        added > 0
          ? `${normalizedQuestionId} queued in bookmarks.`
          : `${normalizedQuestionId} already in bookmarks.`;
      setIssueTriageQueueStatus(message);
      logEvent({
        type: "control_clicked",
        mode: "progress",
        metadata: {
          action: "issue_triage_queue_bookmark",
          questionId: normalizedQuestionId,
          added,
        },
      });
    },
    [activeUserId, logEvent]
  );
  const handleOpenIssueBookmarkQueue = useCallback(() => {
    logEvent({
      type: "link_opened",
      mode: "progress",
      metadata: {
        target: "issue_triage_open_bookmark_queue",
        href: "/study?collection=bookmarks&type=confirmed_test",
      },
    });
  }, [logEvent]);

  useEffect(() => {
    logEvent({
      type: "page_view",
      mode: "progress",
      metadata: { route: "/progress" },
    });
  }, [logEvent]);

  useEffect(() => {
    setDeadLetterSummary(getAnalyticsDeadLetterSummary());
  }, [loaded]);

  useEffect(() => {
    setSyncToken(null);
  }, [syncUserId]);

  useEffect(() => {
    if (syncUserOverriddenRef.current) return;
    setSyncUserId(activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    void loadIssueTriageSummary();
  }, [loadIssueTriageSummary]);



  useEffect(() => {
    if (!authenticatedUserId) return;
    if (autoLoadedAccountStateForUserRef.current === authenticatedUserId) return;
    autoLoadedAccountStateForUserRef.current = authenticatedUserId;

    let cancelled = false;
    const autoLoad = async () => {
      setCloudPending(true);
      setCloudStatus(null);
      try {
        const response = await fetch("/api/user/state");
        const body = await response.json();
        if (cancelled) return;
        if (response.status === 404) {
          setCloudStatus("No account state found yet. Save once to create it.");
          return;
        }
        if (!response.ok) {
          throw new Error(String(body?.error ?? "Failed to load account state"));
        }
        const snapshot: PortableProgressSnapshot = {
          version: 1,
          exportedAt: body.updatedAt ?? new Date().toISOString(),
          data: body.data ?? {},
        };
        setPendingImportSnapshot(snapshot);
        setPendingImportFileName(`account:${body.userId ?? authenticatedUserId ?? "user"}`);
        setConflictResolutionByKey({});
        setCloudUpdatedAt(body.updatedAt ?? null);
        setCloudStatus("Loaded account state. Review import preview before applying.");
        logEvent({
          type: "control_clicked",
          mode: "progress",
          metadata: { action: "user_state_download", selectedMergeMode: importMergeMode },
        });
      } catch (error) {
        if (!cancelled) {
          setCloudStatus(error instanceof Error ? error.message : "Failed to load account state");
        }
      } finally {
        if (!cancelled) {
          setCloudPending(false);
        }
      }
    };

    void autoLoad();
    return () => {
      cancelled = true;
    };
  }, [authenticatedUserId, importMergeMode, logEvent]);

  const stats = getStats();
  const sessionActivityInsights = useMemo(
    () => computeSessionActivityInsights(sessions),
    [sessions]
  );

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-[var(--muted)]">Loading progress…</div>
      </div>
    );
  }

  const applyResetScope = (scope: ResetScope) => {
    if (scope === "all" || scope === "progress") {
      clearAll();
    }
    if (scope === "all" || scope === "adaptive") {
      defaultAdaptiveStatsStore.clear(activeUserId);
      if (typeof window !== "undefined") {
        localStorage.removeItem(userScopedStorageKey(FLASHCARD_SR_STORAGE_KEY, activeUserId));
      }
    }
    if (scope === "all" || scope === "telemetry") {
      defaultAttemptEventStore.clear(activeUserId);
      defaultLearningEventStore.clear(activeUserId);
    }
    if (scope === "all") {
      clearLearnDraft(activeUserId);
    }
  };

  const handleExportData = () => {
    if (typeof window === "undefined") return;

    const data = readPortableStateForUser(PORTABLE_EXPORT_KEYS, activeUserId);

    const payload: PortableProgressSnapshot = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };

    downloadJsonFile(
      `part107-progress-export-${new Date().toISOString().slice(0, 10)}.json`,
      payload
    );
    setTransferError(null);
    logEvent({
      type: "control_clicked",
      mode: "progress",
      metadata: { action: "export_data", download: true },
    });
  };

  const handleExportTelemetryBundle = () => {
    const payload = buildTelemetrySupportBundle(activeUserId);
    downloadJsonFile(
      `part107-telemetry-support-${new Date().toISOString().slice(0, 10)}.json`,
      payload
    );
    logEvent({
      type: "control_clicked",
      mode: "progress",
      metadata: {
        action: "export_support_telemetry",
        learningEvents: payload.learningEvents.total,
        attemptEvents: payload.attemptEvents.total,
      },
    });
  };

  const handleImportData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || typeof window === "undefined") return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as PortableProgressSnapshot;
      if (!parsed || parsed.version !== 1 || typeof parsed.data !== "object" || !parsed.data) {
        throw new Error("Unsupported import format.");
      }
      setPendingImportSnapshot(parsed);
      setPendingImportFileName(file.name);
      setConflictResolutionByKey({});
      setTransferError(null);
      logEvent({
        type: "import_previewed",
        mode: "progress",
        metadata: {
          selectedMergeMode: importMergeMode,
          previewKeys: PORTABLE_EXPORT_KEYS.filter((key) => parsed.data[key] !== undefined).length,
        },
      });
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Failed to import progress data.");
      setPendingImportSnapshot(null);
      setPendingImportFileName(null);
    } finally {
      if (event.target) event.target.value = "";
    }
  };

  const applyPendingImport = () => {
    if (!pendingImportSnapshot || typeof window === "undefined") return;
    const currentData = readPortableStateForUser(PORTABLE_EXPORT_KEYS, activeUserId);
    const effectiveSnapshotData = { ...pendingImportSnapshot.data };
    for (const key of PORTABLE_EXPORT_KEYS) {
      if (conflictResolutionByKey[key] === "local") {
        effectiveSnapshotData[key] = currentData[key] ?? null;
      }
    }
    const { resolvedData, changedKeys } = resolveImportedData(
      effectiveSnapshotData,
      currentData,
      PORTABLE_EXPORT_KEYS,
      importMergeMode
    );

    writePortableStateForUser(PORTABLE_EXPORT_KEYS, activeUserId, resolvedData);

    logEvent({
      type: "import_applied",
      mode: "progress",
      metadata: {
        selectedMergeMode: importMergeMode,
        changedKeys: changedKeys.length,
      },
    });
    setPendingImportSnapshot(null);
    setPendingImportFileName(null);
    setConflictResolutionByKey({});
    setTransferError(null);
    if (process.env.NODE_ENV !== "test") {
      window.location.reload();
    }
  };

  const cancelPendingImport = () => {
    setPendingImportSnapshot(null);
    setPendingImportFileName(null);
    setConflictResolutionByKey({});
    setTransferError(null);
  };

  const ensureSyncToken = async (forceRefresh = false): Promise<string | null> => {
    if (!forceRefresh && syncToken) return syncToken;
    const response = await fetch("/api/sync/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: syncUserId }),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(String(body?.error ?? "Failed to create sync session"));
    }
    const token = typeof body?.token === "string" ? body.token : null;
    setSyncToken(token);
    return token;
  };

  const withSyncAuthRetry = async (
    run: (token: string | null) => Promise<Response>
  ): Promise<Response> => {
    let token = await ensureSyncToken(false);
    let response = await run(token);
    if (response.status !== 401) return response;

    // Session token can expire; refresh once and retry.
    setSyncToken(null);
    token = await ensureSyncToken(true);
    response = await run(token);
    return response;
  };

  const uploadSyncSnapshot = async () => {
    if (typeof window === "undefined") return;
    setSyncPending(true);
    setSyncStatus(null);
    try {
      const data = readPortableStateForUser(PORTABLE_EXPORT_KEYS, syncUserId);
      const response = await withSyncAuthRetry(async (token) =>
        fetch("/api/sync/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sync-user-id": syncUserId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            userId: syncUserId,
            mode: importMergeMode,
            snapshot: {
              version: 1,
              exportedAt: new Date().toISOString(),
              data,
            },
          }),
        })
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(String(body?.error ?? "Sync upload failed"));
      }
      setSyncUpdatedAt(body.updatedAt ?? new Date().toISOString());
      setSyncStatus(`Uploaded successfully (${body.mergedSummary?.changedKeys?.length ?? 0} changed keys).`);
      logEvent({
        type: "control_clicked",
        mode: "progress",
        metadata: { action: "sync_upload", selectedMergeMode: importMergeMode },
      });
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : "Sync upload failed");
    } finally {
      setSyncPending(false);
    }
  };



  const uploadUserState = async () => {
    setCloudPending(true);
    setCloudStatus(null);
    try {
      const response = await fetch("/api/user/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: importMergeMode,
          data: readPortableStateForUser(PORTABLE_EXPORT_KEYS, activeUserId),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(String(body?.error ?? "Failed to save account state"));
      }
      setCloudUpdatedAt(body.updatedAt ?? new Date().toISOString());
      setCloudStatus(`Saved account state (${body.changedKeys?.length ?? 0} changed keys).`);
      logEvent({
        type: "control_clicked",
        mode: "progress",
        metadata: { action: "user_state_upload", selectedMergeMode: importMergeMode },
      });
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : "Failed to save account state");
    } finally {
      setCloudPending(false);
    }
  };

  const downloadUserState = async () => {
    setCloudPending(true);
    setCloudStatus(null);
    try {
      const response = await fetch("/api/user/state");
      const body = await response.json();
      if (response.status === 404) {
        setCloudStatus("No account state found yet. Save once to create it.");
        return;
      }
      if (!response.ok) {
        throw new Error(String(body?.error ?? "Failed to load account state"));
      }
      const snapshot: PortableProgressSnapshot = {
        version: 1,
        exportedAt: body.updatedAt ?? new Date().toISOString(),
        data: body.data ?? {},
      };
      setPendingImportSnapshot(snapshot);
      setPendingImportFileName(`account:${body.userId ?? authenticatedUserId ?? "user"}`);
      setConflictResolutionByKey({});
      setCloudUpdatedAt(body.updatedAt ?? null);
      setCloudStatus("Loaded account state. Review import preview before applying.");
      logEvent({
        type: "control_clicked",
        mode: "progress",
        metadata: { action: "user_state_download", selectedMergeMode: importMergeMode },
      });
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : "Failed to load account state");
    } finally {
      setCloudPending(false);
    }
  };

  const downloadSyncSnapshot = async () => {
    if (typeof window === "undefined") return;
    setSyncPending(true);
    setSyncStatus(null);
    try {
      const response = await withSyncAuthRetry(async (token) =>
        fetch(`/api/sync/download?userId=${encodeURIComponent(syncUserId)}`, {
          headers: {
            "x-sync-user-id": syncUserId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
      );
      const body = await response.json();
      if (response.status === 404) {
        setSyncStatus("No remote snapshot found for this sync user.");
        return;
      }
      if (!response.ok) {
        throw new Error(String(body?.error ?? "Sync download failed"));
      }
      const snapshot = body.snapshot as PortableProgressSnapshot;
      setPendingImportSnapshot(snapshot);
      setPendingImportFileName(`sync:${syncUserId}`);
      setConflictResolutionByKey({});
      setSyncUpdatedAt(body.updatedAt ?? null);
      setSyncStatus("Downloaded remote snapshot. Review conflict preview below before applying.");
      logEvent({
        type: "control_clicked",
        mode: "progress",
        metadata: { action: "sync_download", selectedMergeMode: importMergeMode },
      });
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : "Sync download failed");
    } finally {
      setSyncPending(false);
    }
  };

  const retryDeadLetters = async () => {
    await retryAnalyticsDeadLetterQueue();
    setDeadLetterSummary(getAnalyticsDeadLetterSummary());
  };

  const clearDeadLetters = () => {
    clearAnalyticsDeadLetterQueue();
    setDeadLetterSummary(getAnalyticsDeadLetterSummary());
  };

  const nextRetryAtMs = deadLetterSummary.nextRetryAt
    ? Date.parse(deadLetterSummary.nextRetryAt)
    : null;
  const deadLetterRetryBlocked =
    deadLetterSummary.count === 0 ||
    (typeof nextRetryAtMs === "number" && Number.isFinite(nextRetryAtMs) && nextRetryAtMs > Date.now());

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
            onClick={() =>
              logEvent({
                type: "link_opened",
                mode: "progress",
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
                mode: "progress",
                metadata: { target: "empty_take_exam", href: "/exam" },
              })
            }
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
            <div className="w-full max-w-md space-y-2 rounded-xl border border-incorrect/30 bg-incorrect/10 p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-incorrect">Danger Zone</div>
              <div className="text-xs text-[var(--muted)]">Choose exactly what to reset. This cannot be undone.</div>
              <div className="grid grid-cols-2 gap-2">
                {RESET_SCOPES.map((scope) => (
                  <button
                    key={scope.id}
                    onClick={() => {
                      setResetScope(scope.id);
                      logEvent({
                        type: "filter_changed",
                        mode: "progress",
                        metadata: {
                          filter: "reset_scope",
                          value: scope.id,
                        },
                      });
                    }}
                    className={`rounded-lg border px-2 py-1.5 text-left text-xs ${resetScope === scope.id
                      ? "border-incorrect/60 bg-incorrect/20 text-white"
                      : "border-[var(--card-border)] text-[var(--muted)] hover:text-white"
                      }`}
                  >
                    <div className="font-medium">{scope.label}</div>
                    <div className="mt-0.5 text-[10px] opacity-80">{scope.description}</div>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    logEvent({
                      type: "control_clicked",
                      mode: "progress",
                      metadata: { action: "confirm_reset_data", scope: resetScope },
                    });
                    applyResetScope(resetScope);
                    setShowConfirmClear(false);
                  }}
                  className="rounded-lg bg-incorrect/30 px-3 py-1.5 text-xs font-semibold text-incorrect hover:bg-incorrect/40"
                >
                  Yes, Reset {RESET_SCOPES.find((scope) => scope.id === resetScope)?.label ?? "Data"}
                </button>
                <button
                  onClick={() => {
                    logEvent({
                      type: "control_clicked",
                      mode: "progress",
                      metadata: { action: "cancel_reset_data" },
                    });
                    setShowConfirmClear(false);
                  }}
                  className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportData}
                className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white"
              >
                Export Data
              </button>
              <button
                onClick={() => {
                  logEvent({
                    type: "control_clicked",
                    mode: "progress",
                    metadata: { action: "open_import_picker" },
                  });
                  importInputRef.current?.click();
                }}
                className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white"
              >
                Import Data
              </button>
              <button
                onClick={handleExportTelemetryBundle}
                className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white"
              >
                Export Telemetry
              </button>
              <button
                onClick={() => {
                  logEvent({
                    type: "control_clicked",
                    mode: "progress",
                    metadata: { action: "start_reset_data" },
                  });
                  setResetScope("all");
                  setShowConfirmClear(true);
                }}
                className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white"
              >
                Reset Data
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportData}
                className="hidden"
              />
            </div>
          )}
        </div>
      </div>

      {transferError && (
        <div className="rounded-lg border border-incorrect/30 bg-incorrect/10 px-4 py-2 text-sm text-incorrect">
          Import failed: {transferError}
        </div>
      )}

      {authenticatedUserId && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 mb-4">
          <div className="text-sm font-semibold text-white mb-3">Account Data Sync</div>
          <div className="flex flex-wrap items-end gap-3">
            <button
              onClick={() => void uploadUserState()}
              disabled={cloudPending}
              className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white disabled:opacity-50"
            >
              Save Account State
            </button>
            <button
              onClick={() => void downloadUserState()}
              disabled={cloudPending}
              className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white disabled:opacity-50"
            >
              Load Account State
            </button>
          </div>
          {(cloudStatus || cloudUpdatedAt) && (
            <div className="mt-2 text-xs text-[var(--muted)]">
              {cloudStatus && <div>{cloudStatus}</div>}
              {cloudUpdatedAt && <div>Last account update: {new Date(cloudUpdatedAt).toLocaleString()}</div>}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Sync User</div>
            <input
              value={syncUserId}
              onChange={(event) => {
                syncUserOverriddenRef.current = true;
                setSyncUserId(event.target.value.trim() || SYNC_DEFAULT_USER_ID);
              }}
              className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            onClick={() => void uploadSyncSnapshot()}
            disabled={syncPending}
            className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white disabled:opacity-50"
          >
            Upload to Sync
          </button>
          <button
            onClick={() => void downloadSyncSnapshot()}
            disabled={syncPending}
            className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white disabled:opacity-50"
          >
            Download from Sync
          </button>
        </div>
        {(syncStatus || syncUpdatedAt) && (
          <div className="mt-2 text-xs text-[var(--muted)]">
            {syncStatus && <div>{syncStatus}</div>}
            {syncUpdatedAt && <div>Last sync update: {new Date(syncUpdatedAt).toLocaleString()}</div>}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
        <div className="text-sm font-semibold text-white">Analytics Sink Dead-Letter Queue</div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          Pending: {deadLetterSummary.count}
          {deadLetterSummary.latestQueuedAt && (
            <span> • Last queued {new Date(deadLetterSummary.latestQueuedAt).toLocaleString()}</span>
          )}
          {deadLetterSummary.nextRetryAt && (
            <span> • Next retry {new Date(deadLetterSummary.nextRetryAt).toLocaleString()}</span>
          )}
        </div>
        {deadLetterSummary.latestError && (
          <div className="mt-1 text-xs text-amber-300">{deadLetterSummary.latestError}</div>
        )}
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => void retryDeadLetters()}
            disabled={deadLetterRetryBlocked}
            className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Retry Queue
          </button>
          <button
            onClick={clearDeadLetters}
            className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white"
          >
            Clear Queue
          </button>
        </div>
      </div>

      {authenticatedUserId && (
        <IssueTriagePanel
          summary={issueTriageSummary}
          pending={issueTriagePending}
          error={issueTriageError}
          queueStatus={issueTriageQueueStatus}
          onRefresh={() => void loadIssueTriageSummary()}
          onQueueQuestion={queueIssueQuestionForReview}
          onOpenBookmarkQueue={handleOpenIssueBookmarkQueue}
        />
      )}

      {pendingImportSnapshot && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-4 text-sm">
          <div className="font-semibold text-white">Import Preview</div>
          <p className="mt-1 text-[var(--muted)]">
            File: {pendingImportFileName ?? "snapshot.json"} • Exported{" "}
            {new Date(pendingImportSnapshot.exportedAt).toLocaleString()}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-[var(--muted)]">Merge Mode</div>
              <div className="flex gap-2">
                {(["merge", "overwrite"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setImportMergeMode(mode);
                      logEvent({
                        type: "filter_changed",
                        mode: "progress",
                        metadata: { filter: "import_mode", value: mode },
                      });
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${importMergeMode === mode
                      ? "bg-brand-500 text-white"
                      : "border border-[var(--card-border)] text-[var(--muted)] hover:text-white"
                      }`}
                  >
                    {mode === "merge" ? "Merge (Recommended)" : "Overwrite"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-[var(--muted)]">Preview</div>
              {(() => {
                const currentData = readPortableStateForUser(PORTABLE_EXPORT_KEYS, activeUserId);
                const preview = computeImportPreview(
                  pendingImportSnapshot.data,
                  currentData,
                  PORTABLE_EXPORT_KEYS,
                  importMergeMode
                );
                const resolution = resolveImportedData(
                  pendingImportSnapshot.data,
                  currentData,
                  PORTABLE_EXPORT_KEYS,
                  importMergeMode
                );
                const conflicts = buildPreviewKeyConflicts(
                  pendingImportSnapshot.data,
                  currentData,
                  resolution.resolvedData,
                  PORTABLE_EXPORT_KEYS
                );
                const resolvingLocalCount = conflicts.filter(
                  (conflict) => conflict.willChange && conflictResolutionByKey[conflict.key] === "local"
                ).length;
                const resolvingRemoteCount = conflicts.filter(
                  (conflict) => conflict.willChange && (conflictResolutionByKey[conflict.key] ?? "remote") === "remote"
                ).length;
                return (
                  <div className="space-y-2 text-xs text-[var(--muted)]">
                    <div>
                      Keys included: <span className="text-white">{preview.includedKeys.length}</span> •
                      Keys changed: <span className="text-white">{preview.changedKeys.length}</span>
                    </div>
                    <div className="rounded border border-[var(--card-border)] bg-[var(--background)] px-2 py-1">
                      Conflict winners:{" "}
                      <span className="text-white">Local {resolvingLocalCount}</span> •{" "}
                      <span className="text-white">Remote {resolvingRemoteCount}</span>
                    </div>
                    <div className="space-y-1">
                      {conflicts.map((conflict) => (
                        <div key={conflict.key} className="rounded border border-[var(--card-border)] px-2 py-1">
                          <div className="text-white">{conflict.key}</div>
                          <div>
                            current: {conflict.currentState} • incoming: {conflict.incomingState} •
                            {conflict.willChange ? " will change" : " unchanged"}
                          </div>
                          {conflict.sessionDelta && <div>sessions: {conflict.sessionDelta}</div>}
                          {conflict.willChange && (
                            <div className="mt-1 flex gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setConflictResolutionByKey((prev) => ({
                                    ...prev,
                                    [conflict.key]: "remote",
                                  }))
                                }
                                className={`rounded px-2 py-0.5 ${(conflictResolutionByKey[conflict.key] ?? "remote") === "remote"
                                  ? "bg-brand-500 text-white"
                                  : "border border-[var(--card-border)] text-[var(--muted)]"
                                  }`}
                              >
                                Keep Remote
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConflictResolutionByKey((prev) => ({
                                    ...prev,
                                    [conflict.key]: "local",
                                  }))
                                }
                                className={`rounded px-2 py-0.5 ${conflictResolutionByKey[conflict.key] === "local"
                                  ? "bg-brand-500 text-white"
                                  : "border border-[var(--card-border)] text-[var(--muted)]"
                                  }`}
                              >
                                Keep Local
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={applyPendingImport}
              className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Apply Import
            </button>
            <button
              onClick={cancelPendingImport}
              className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-xs text-[var(--muted)] hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
            onClick={() => {
              setActiveTab(tab);
              logEvent({
                type: "tab_changed",
                mode: "progress",
                metadata: { tab },
              });
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${activeTab === tab
              ? "bg-brand-500/20 text-brand-400"
              : "text-[var(--muted)] hover:text-white"
              }`}
          >
            {tab === "overview" ? "📈 Overview" : tab === "history" ? "📋 History" : "📂 Categories"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab
          stats={stats}
          sessionActivityInsights={sessionActivityInsights}
          adaptiveInsights={adaptiveInsights}
          responseTimeTelemetry={responseTimeTelemetry}
          learningEventInsights={learningEventInsights}
          onTelemetryFilterChange={(metadata) =>
            logEvent({
              type: "filter_changed",
              mode: "progress",
              metadata,
            })
          }
        />
      )}
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
  sessionActivityInsights,
  adaptiveInsights,
  responseTimeTelemetry,
  learningEventInsights,
  onTelemetryFilterChange,
}: {
  stats: ReturnType<ReturnType<typeof useProgress>["getStats"]>;
  sessionActivityInsights: SessionActivityInsights;
  adaptiveInsights: ReturnType<typeof computeAdaptiveInsights>;
  responseTimeTelemetry: ReturnType<typeof computeResponseTimeTelemetry>;
  learningEventInsights: LearningEventInsights;
  onTelemetryFilterChange: (metadata: Record<string, string | number | boolean | null>) => void;
}) {
  const [selectedMode, setSelectedMode] = useState<TelemetryFilterMode>("all");
  const [selectedType, setSelectedType] = useState<TelemetryFilterType>("all");
  const [timeWindow, setTimeWindow] = useState<TelemetryTimeWindow>("7d");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEvents = useMemo(() => {
    const cutoffMs = computeWindowCutoff(timeWindow);
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return learningEventInsights.events.filter((event) => {
      if (selectedMode !== "all" && event.mode !== selectedMode) return false;
      if (selectedType !== "all" && event.type !== selectedType) return false;

      if (cutoffMs !== null && Date.parse(event.timestamp) < cutoffMs) return false;

      if (!normalizedQuery) return true;

      const searchable = [
        event.type,
        event.mode,
        event.questionId ?? "",
        event.category ?? "",
        event.subcategory ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [learningEventInsights.events, searchQuery, selectedMode, selectedType, timeWindow]);

  const filteredInsights = useMemo(
    () => computeLearningEventInsights(filteredEvents),
    [filteredEvents]
  );
  const modeEntries = Object.entries(filteredInsights.byMode).sort((a, b) => b[1] - a[1]);
  const typeEntries = Object.entries(filteredInsights.byType).sort((a, b) => b[1] - a[1]);
  const recentFilteredEvents = useMemo(() => [...filteredEvents].slice(-12).reverse(), [filteredEvents]);
  const learnCompletionTrend = useMemo(
    () => computeLearnCompletionTrend(learningEventInsights.events),
    [learningEventInsights.events]
  );

  return (
    <div className="space-y-6">
      {sessionActivityInsights.activeDays > 0 && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
          <h3 className="mb-4 font-semibold text-white">🔥 Session Momentum</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Current Daily Streak</div>
              <div className="mt-1 text-2xl font-bold text-white">
                {sessionActivityInsights.currentDailyStreak} day
                {sessionActivityInsights.currentDailyStreak === 1 ? "" : "s"}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Longest: {sessionActivityInsights.longestDailyStreak} day
                {sessionActivityInsights.longestDailyStreak === 1 ? "" : "s"}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Active Days</div>
              <div className="mt-1 text-2xl font-bold text-white">{sessionActivityInsights.activeDays}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">Days with at least one recorded session</div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Sessions (30d)</div>
              <div className="mt-1 text-2xl font-bold text-white">
                {sessionActivityInsights.dailyPoints.reduce((sum, point) => sum + point.count, 0)}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">Rolling 30-day completion volume</div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Daily Trend (30 days)
            </div>
            <div className="flex items-end gap-1" style={{ height: 88 }}>
              {sessionActivityInsights.dailyPoints.map((point) => {
                const heightPx = point.count > 0 ? Math.min(84, 10 + point.count * 8) : 4;
                return (
                  <div key={point.dateKey} className="group relative flex flex-1 flex-col items-center">
                    <div
                      className={`w-full max-w-[12px] rounded-t transition-all ${
                        point.count > 0 ? "bg-brand-500/70 group-hover:bg-brand-400" : "bg-[var(--card-border)]"
                      }`}
                      style={{ height: `${heightPx}px` }}
                    />
                    {point.count > 0 && (
                      <div className="absolute -top-7 hidden rounded bg-[var(--background)] px-1.5 py-0.5 text-[10px] text-white shadow group-hover:block">
                        {point.count}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-[var(--muted)]">
              <span>{sessionActivityInsights.dailyPoints[0]?.label}</span>
              <span>{sessionActivityInsights.dailyPoints[sessionActivityInsights.dailyPoints.length - 1]?.label}</span>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Weekly Trend (8 weeks)
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {sessionActivityInsights.weeklyPoints.map((point) => (
                <div
                  key={point.weekKey}
                  className="flex items-center justify-between rounded border border-[var(--card-border)] px-2 py-1.5 text-xs"
                >
                  <span className="text-white">Week of {point.label}</span>
                  <span className="text-[var(--muted)]">
                    {point.count} session{point.count === 1 ? "" : "s"}
                    {point.passRatePercent !== null ? ` • ${point.passRatePercent}% pass` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
                className={`mt-1 text-2xl font-bold ${adaptiveInsights.momentumPercent === null
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
                className={`font-medium ${adaptiveInsights.averageRollingMomentumPercent === null
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
            <div>
              Avg confidence (quiz/exam):{" "}
              <span className="font-medium text-white">
                {adaptiveInsights.averageConfidencePercent !== null
                  ? `${adaptiveInsights.averageConfidencePercent}%`
                  : "—"}
              </span>
            </div>
            <div>
              Calibration score:{" "}
              <span className="font-medium text-white">
                {adaptiveInsights.calibrationScorePercent !== null
                  ? `${adaptiveInsights.calibrationScorePercent}%`
                  : "—"}
              </span>
            </div>
            <div>
              Overconfidence rate:{" "}
              <span className="font-medium text-amber-300">
                {adaptiveInsights.overconfidenceRatePercent !== null
                  ? `${adaptiveInsights.overconfidenceRatePercent}%`
                  : "—"}
              </span>
            </div>
            <div>
              Confidence samples:{" "}
              <span className="font-medium text-white">{adaptiveInsights.confidenceAttemptCount}</span>
            </div>
          </div>
        </div>
      )}

      {responseTimeTelemetry.attempts > 0 && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
          <h3 className="mb-4 font-semibold text-white">⏱️ Response-Time Telemetry QA</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Samples</div>
              <div className="mt-1 text-2xl font-bold text-white">
                {responseTimeTelemetry.sampled}/{responseTimeTelemetry.attempts}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                with non-null response time
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">P50 / P95</div>
              <div className="mt-1 text-2xl font-bold text-white">
                {responseTimeTelemetry.p50Ms !== null ? `${responseTimeTelemetry.p50Ms}ms` : "—"}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {responseTimeTelemetry.p95Ms !== null
                  ? `P95 ${responseTimeTelemetry.p95Ms}ms`
                  : "No percentile baseline yet"}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Null Rate</div>
              <div
                className={`mt-1 text-2xl font-bold ${
                  responseTimeTelemetry.hasNullAnomaly ? "text-incorrect" : "text-white"
                }`}
              >
                {responseTimeTelemetry.nullRatePercent}%
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {responseTimeTelemetry.nullCount} null values
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Zero Rate</div>
              <div
                className={`mt-1 text-2xl font-bold ${
                  responseTimeTelemetry.hasZeroAnomaly ? "text-incorrect" : "text-white"
                }`}
              >
                {responseTimeTelemetry.zeroRatePercent}%
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {responseTimeTelemetry.zeroCount} zero/negative values
              </div>
            </div>
          </div>
          {(responseTimeTelemetry.hasNullAnomaly || responseTimeTelemetry.hasZeroAnomaly) && (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Telemetry anomaly detected. Review mode-level instrumentation for missing or zero
              response times.
            </div>
          )}
          <div className="mt-4 rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Mode Breakdown
            </div>
            <div className="space-y-1 text-xs text-[var(--muted)]">
              {responseTimeTelemetry.modes.map((modeSummary) => (
                <div key={modeSummary.mode} className="flex items-center justify-between gap-3">
                  <span className="text-white">
                    {modeSummary.mode} ({modeSummary.sampled}/{modeSummary.attempts})
                  </span>
                  <span>
                    null {modeSummary.nullRatePercent}% / zero {modeSummary.zeroRatePercent}% / p95{" "}
                    {modeSummary.p95Ms !== null ? `${modeSummary.p95Ms}ms` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {learningEventInsights.total > 0 && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
          <h3 className="mb-4 font-semibold text-white">🛰️ Learning Event Activity</h3>
          <div className="mb-4 grid gap-2 md:grid-cols-4">
            <label className="space-y-1 text-xs text-[var(--muted)]">
              <span className="block uppercase tracking-wider">Mode</span>
              <select
                value={selectedMode}
                onChange={(event) => {
                  const next = event.target.value;
                  const safeMode: TelemetryFilterMode = isLearningEventMode(next) ? next : "all";
                  setSelectedMode(safeMode);
                  onTelemetryFilterChange({
                    filter: "event_mode",
                    selectedMode: safeMode,
                  });
                }}
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-2 py-1.5 text-xs text-white"
              >
                <option value="all">All modes</option>
                {ANALYTICS_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-[var(--muted)]">
              <span className="block uppercase tracking-wider">Type</span>
              <select
                value={selectedType}
                onChange={(event) => {
                  const next = event.target.value;
                  const safeType: TelemetryFilterType = isLearningEventType(next) ? next : "all";
                  setSelectedType(safeType);
                  onTelemetryFilterChange({
                    filter: "event_type",
                    selectedType: safeType,
                  });
                }}
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-2 py-1.5 text-xs text-white"
              >
                <option value="all">All types</option>
                {ANALYTICS_EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-[var(--muted)]">
              <span className="block uppercase tracking-wider">Window</span>
              <select
                value={timeWindow}
                onChange={(event) => {
                  const next = event.target.value as TelemetryTimeWindow;
                  setTimeWindow(next);
                  onTelemetryFilterChange({
                    filter: "time_window",
                    timeWindow: next,
                  });
                }}
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-2 py-1.5 text-xs text-white"
              >
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
                <option value="30d">Last 30d</option>
                <option value="all">All time</option>
              </select>
            </label>
            <label className="space-y-1 text-xs text-[var(--muted)]">
              <span className="block uppercase tracking-wider">Search</span>
              <input
                value={searchQuery}
                onChange={(event) => {
                  const next = event.target.value;
                  setSearchQuery(next);
                  onTelemetryFilterChange({
                    filter: "search_query",
                    searchLength: next.trim().length,
                    hasQuery: next.trim().length > 0,
                  });
                }}
                placeholder="question id, category, type"
                className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-2 py-1.5 text-xs text-white placeholder:text-[var(--muted)]"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Total Events</div>
              <div className="mt-1 text-2xl font-bold text-white">{filteredInsights.total}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Filtered from {learningEventInsights.total} retained events
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">By Mode</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {modeEntries.slice(0, 4).map(([mode, count]) => (
                  <span
                    key={mode}
                    className="rounded-full border border-[var(--card-border)] px-2 py-0.5 text-xs text-white"
                  >
                    {mode}: {count}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Top Event Types</div>
              <div className="mt-1 space-y-1 text-xs text-[var(--muted)]">
                {typeEntries.slice(0, 4).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-white">{type}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Recent Events
            </div>
            {recentFilteredEvents.length === 0 ? (
              <div className="rounded border border-dashed border-[var(--card-border)] px-3 py-2 text-xs text-[var(--muted)]">
                No events matched the selected filters.
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentFilteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 rounded border border-[var(--card-border)] px-2 py-1 text-xs"
                  >
                    <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-brand-300">
                      {event.mode}
                    </span>
                    <span className="text-white">{event.type}</span>
                    {event.questionId && (
                      <span className="truncate text-[var(--muted)]">• {event.questionId}</span>
                    )}
                    <span className="ml-auto text-[var(--muted)]">{timeAgo(event.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {learnCompletionTrend.length > 0 && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
          <h3 className="mb-3 font-semibold text-white">🎯 Learn First-Pass vs Mastery</h3>
          <p className="mb-4 text-xs text-[var(--muted)]">
            First-pass captures how often you were right immediately. Mastery captures eventual correctness after re-review.
          </p>
          <div className="space-y-3">
            {learnCompletionTrend.map((point) => (
              <div key={`${point.timestamp}-${point.round}`} className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]">
                  <span>
                    {new Date(point.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    • Round {point.round}
                  </span>
                  <span>{point.uniqueQuestions} questions</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-[var(--muted)]">First-pass</span>
                      <span className="text-white">
                        {point.firstPassCorrect}/{point.uniqueQuestions} ({point.firstPassPercent}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--card)]">
                      <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${point.firstPassPercent}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-[var(--muted)]">Mastery</span>
                      <span className="text-white">
                        {point.masteredCount}/{point.uniqueQuestions} ({point.masteryPercent}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--card)]">
                      <div className="h-full rounded-full bg-correct/70" style={{ width: `${point.masteryPercent}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
                  className={`w-full max-w-[32px] rounded-t transition-all ${point.percentage >= 70
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
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const [virtualStartIndex, setVirtualStartIndex] = useState(0);
  const visibleSessions = sessions.slice(0, visibleCount);
  const shouldVirtualize = sessions.length > HISTORY_VIRTUALIZE_THRESHOLD && expandedId === null;
  const virtualEndIndex = Math.min(sessions.length, virtualStartIndex + HISTORY_VIRTUAL_WINDOW_SIZE);
  const renderedSessions = shouldVirtualize
    ? sessions.slice(virtualStartIndex, virtualEndIndex)
    : visibleSessions;
  const virtualTopSpacerPx = shouldVirtualize ? virtualStartIndex * HISTORY_ROW_ESTIMATE_PX : 0;
  const virtualBottomSpacerPx = shouldVirtualize
    ? Math.max(0, (sessions.length - virtualEndIndex) * HISTORY_ROW_ESTIMATE_PX)
    : 0;

  useEffect(() => {
    setVisibleCount(HISTORY_PAGE_SIZE);
    setExpandedId(null);
    setVirtualStartIndex(0);
  }, [sessions.length]);

  return (
    <div className="space-y-3">
      {shouldVirtualize && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-[11px] text-[var(--muted)]">
          Virtualized history view active for large dataset ({sessions.length} sessions). Expand any row to switch to full detail mode.
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
              sessions.length - HISTORY_VIRTUAL_WINDOW_SIZE,
              Math.floor(target.scrollTop / HISTORY_ROW_ESTIMATE_PX)
            )
          );
          if (nextStart !== virtualStartIndex) {
            setVirtualStartIndex(nextStart);
          }
        }}
      >
        {shouldVirtualize && <div style={{ height: virtualTopSpacerPx }} />}
        {renderedSessions.map((session, renderIndex) => {
          const sessionIndex = shouldVirtualize ? virtualStartIndex + renderIndex : renderIndex;
          const isExpanded = expandedId === session.id;
          const detailsId = `history-session-details-${session.id}`;
          return (
            <div
              key={session.id}
              className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] overflow-hidden"
            >
              {/* Session Row */}
              <button
                onClick={() => {
                  if (shouldVirtualize) {
                    setVisibleCount(Math.max(visibleCount, sessionIndex + 1));
                  }
                  setExpandedId(isExpanded ? null : session.id);
                }}
                aria-expanded={isExpanded}
                aria-controls={detailsId}
                className="w-full p-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Mode Badge */}
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase ${session.mode === "exam"
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
                    className={`text-lg font-bold ${session.passed ? "text-correct" : "text-incorrect"
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
                <div
                  id={detailsId}
                  className="border-t border-[var(--card-border)] bg-[var(--background)]/50 p-4"
                >
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Question Breakdown
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {session.questions.map((q, i) => (
                      <div
                        key={q.questionId}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${q.isCorrect
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
                              className={`h-full rounded-full ${(c / t) * 100 >= 70 ? "bg-correct/60" : "bg-incorrect/60"
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
        {shouldVirtualize && <div style={{ height: virtualBottomSpacerPx }} />}
      </div>
      {!shouldVirtualize && sessions.length > visibleSessions.length && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-xs">
          <span className="text-[var(--muted)]">
            Showing {visibleSessions.length} of {sessions.length} sessions
          </span>
          <button
            onClick={() => setVisibleCount((prev) => Math.min(prev + HISTORY_PAGE_SIZE, sessions.length))}
            className="rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-[var(--muted)] hover:text-white"
          >
            Load More
          </button>
        </div>
      )}
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
          className={`rounded-xl border p-4 ${cat.percentage >= 70
            ? "border-[var(--card-border)] bg-[var(--card)]"
            : "border-incorrect/20 bg-incorrect/5"
            }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-white">{cat.category}</span>
            <span
              className={`text-lg font-bold ${cat.percentage >= 70 ? "text-correct" : "text-incorrect"
                }`}
            >
              {cat.percentage}%
            </span>
          </div>
          <div className="overflow-hidden rounded-full bg-[var(--background)] h-3">
            <div
              className={`h-full rounded-full transition-all ${cat.percentage >= 70 ? "bg-correct/60" : "bg-incorrect/60"
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
