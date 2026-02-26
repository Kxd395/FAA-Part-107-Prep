import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OptionId } from "@part107/core";
import { serverLogger } from "./logger";
import { getSupabasePersistenceContext } from "./supabasePersistence";

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "question-issues-v1.json");
const MAX_REPORTS_PER_USER = 5_000;

type IssueMetadataValue = string | number | boolean | null;

export interface QuestionIssueOptionSnapshot {
  id: OptionId;
  text: string;
}

export interface QuestionIssueReport {
  id: string;
  userId: string;
  createdAt: string;
  mode: "study" | "exam" | "learn" | "flashcards" | "missed" | "unknown";
  questionId: string;
  questionText: string;
  category: string;
  subcategory: string;
  options: QuestionIssueOptionSnapshot[];
  correctOptionId: OptionId;
  selectedOptionId?: OptionId | null;
  note: string;
  questionTypeProfile?: string | null;
  source?: string | null;
  sourceType?: string | null;
  confidence?: 1 | 2 | 3 | 4 | 5 | null;
  metadata?: Record<string, IssueMetadataValue>;
}

export interface QuestionIssueTriageRow {
  questionId: string;
  questionText: string;
  category: string;
  subcategory: string;
  reportCount: number;
  latestReportAt: string;
  latestNote: string;
  byMode: Record<QuestionIssueReport["mode"], number>;
}

export interface QuestionIssueTriageSummary {
  totalReports: number;
  uniqueQuestionCount: number;
  latestReportAt: string | null;
  byMode: Record<QuestionIssueReport["mode"], number>;
  byCategory: Record<string, number>;
  topQuestions: QuestionIssueTriageRow[];
}

interface PersistedQuestionIssueState {
  version: 1;
  users: Record<string, QuestionIssueReport[]>;
}

interface SupabaseQuestionIssueRow {
  user_id: string;
  report_id: string;
  created_at: string;
  mode: QuestionIssueReport["mode"];
  question_id: string;
  question_text: string;
  category: string;
  subcategory: string;
  options: QuestionIssueOptionSnapshot[];
  correct_option_id: OptionId;
  selected_option_id: OptionId | null;
  note: string;
  question_type_profile: string | null;
  source: string | null;
  source_type: string | null;
  confidence: 1 | 2 | 3 | 4 | 5 | null;
  metadata: Record<string, IssueMetadataValue> | null;
}

declare global {
  var __part107QuestionIssueStoreCache__: PersistedQuestionIssueState | undefined;
}

function parseTimestampMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeMetadataRecord(
  value: Record<string, unknown> | null | undefined
): Record<string, IssueMetadataValue> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value).filter(([, raw]) => {
    return (
      raw === null ||
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean"
    );
  });
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as Record<string, IssueMetadataValue>;
}

function toSupabaseQuestionIssueRow(report: QuestionIssueReport): SupabaseQuestionIssueRow {
  return {
    user_id: report.userId,
    report_id: report.id,
    created_at: report.createdAt,
    mode: report.mode,
    question_id: report.questionId,
    question_text: report.questionText,
    category: report.category,
    subcategory: report.subcategory,
    options: report.options,
    correct_option_id: report.correctOptionId,
    selected_option_id: report.selectedOptionId ?? null,
    note: report.note,
    question_type_profile: report.questionTypeProfile ?? null,
    source: report.source ?? null,
    source_type: report.sourceType ?? null,
    confidence: report.confidence ?? null,
    metadata: report.metadata ?? null,
  };
}

function fromSupabaseQuestionIssueRow(row: SupabaseQuestionIssueRow): QuestionIssueReport {
  return {
    id: row.report_id,
    userId: row.user_id,
    createdAt: row.created_at,
    mode: row.mode,
    questionId: row.question_id,
    questionText: row.question_text,
    category: row.category,
    subcategory: row.subcategory,
    options: row.options,
    correctOptionId: row.correct_option_id,
    selectedOptionId: row.selected_option_id,
    note: row.note,
    questionTypeProfile: row.question_type_profile,
    source: row.source,
    sourceType: row.source_type,
    confidence: row.confidence,
    metadata: sanitizeMetadataRecord(row.metadata) ?? undefined,
  };
}

async function loadLocalState(): Promise<PersistedQuestionIssueState> {
  if (globalThis.__part107QuestionIssueStoreCache__) {
    return globalThis.__part107QuestionIssueStoreCache__;
  }

  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedQuestionIssueState;
    if (parsed?.version === 1 && parsed.users && typeof parsed.users === "object") {
      globalThis.__part107QuestionIssueStoreCache__ = parsed;
      return parsed;
    }
  } catch {
    // fall through to empty state
  }

  const empty: PersistedQuestionIssueState = { version: 1, users: {} };
  globalThis.__part107QuestionIssueStoreCache__ = empty;
  return empty;
}

async function saveLocalState(state: PersistedQuestionIssueState): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(state), "utf8");
  globalThis.__part107QuestionIssueStoreCache__ = state;
}

async function appendQuestionIssueReportLocal(report: QuestionIssueReport): Promise<void> {
  const state = await loadLocalState();
  const existing = state.users[report.userId] ?? [];
  const deduped = existing.filter((candidate) => candidate.id !== report.id);
  const next = [...deduped, report]
    .sort((a, b) => parseTimestampMs(a.createdAt) - parseTimestampMs(b.createdAt))
    .slice(Math.max(0, deduped.length + 1 - MAX_REPORTS_PER_USER));
  state.users[report.userId] = next;
  await saveLocalState(state);
}

async function getQuestionIssueReportsLocal(userId: string): Promise<QuestionIssueReport[]> {
  const state = await loadLocalState();
  return state.users[userId] ?? [];
}

async function trimQuestionIssuesRemote(userId: string): Promise<void> {
  const context = getSupabasePersistenceContext();
  if (!context) return;

  const { client, config } = context;
  const { data, error } = await client
    .from(config.tables.questionIssues)
    .select("report_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(MAX_REPORTS_PER_USER, MAX_REPORTS_PER_USER + 500);
  if (error) throw error;
  const overflowIds = (data ?? [])
    .map((row) => (row as { report_id?: unknown }).report_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (overflowIds.length === 0) return;
  const { error: deleteError } = await client
    .from(config.tables.questionIssues)
    .delete()
    .eq("user_id", userId)
    .in("report_id", overflowIds);
  if (deleteError) throw deleteError;
}

async function appendQuestionIssueReportRemote(report: QuestionIssueReport): Promise<void> {
  const context = getSupabasePersistenceContext();
  if (!context) {
    throw new Error("Supabase persistence is not configured");
  }

  const { client, config } = context;
  const { error } = await client
    .from(config.tables.questionIssues)
    .upsert(toSupabaseQuestionIssueRow(report), { onConflict: "user_id,report_id" });
  if (error) throw error;
  await trimQuestionIssuesRemote(report.userId);
}

async function getQuestionIssueReportsRemote(
  userId: string
): Promise<QuestionIssueReport[]> {
  const context = getSupabasePersistenceContext();
  if (!context) {
    throw new Error("Supabase persistence is not configured");
  }

  const { client, config } = context;
  const { data, error } = await client
    .from(config.tables.questionIssues)
    .select(
      "user_id,report_id,created_at,mode,question_id,question_text,category,subcategory,options,correct_option_id,selected_option_id,note,question_type_profile,source,source_type,confidence,metadata"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) =>
    fromSupabaseQuestionIssueRow(row as SupabaseQuestionIssueRow)
  );
}

export async function clearQuestionIssueStoreForTests(): Promise<void> {
  const state = await loadLocalState();
  state.users = {};
  await saveLocalState(state);
}

export async function appendQuestionIssueReport(report: QuestionIssueReport): Promise<void> {
  const context = getSupabasePersistenceContext();
  if (context) {
    try {
      await appendQuestionIssueReportRemote(report);
      return;
    } catch (error) {
      serverLogger.warn("Falling back to local question issue write", {
        userId: report.userId,
        reportId: report.id,
        error,
      });
    }
  }

  await appendQuestionIssueReportLocal(report);
}

export async function getQuestionIssueReports(
  userId: string
): Promise<QuestionIssueReport[]> {
  const context = getSupabasePersistenceContext();
  if (context) {
    try {
      return await getQuestionIssueReportsRemote(userId);
    } catch (error) {
      serverLogger.warn("Falling back to local question issue read", {
        userId,
        error,
      });
    }
  }

  return getQuestionIssueReportsLocal(userId);
}

function parsePositiveLimit(input: number | undefined, fallback: number): number {
  if (!input || !Number.isFinite(input) || input <= 0) return fallback;
  return Math.min(100, Math.floor(input));
}

function emptyModeCounts(): Record<QuestionIssueReport["mode"], number> {
  return {
    study: 0,
    exam: 0,
    learn: 0,
    flashcards: 0,
    missed: 0,
    unknown: 0,
  };
}

export async function getQuestionIssueTriageSummary(
  userId: string,
  options?: { limit?: number }
): Promise<QuestionIssueTriageSummary> {
  const limit = parsePositiveLimit(options?.limit, 25);
  const reports = await getQuestionIssueReports(userId);
  const byMode = emptyModeCounts();
  const byCategory: Record<string, number> = {};
  const byQuestion = new Map<string, QuestionIssueTriageRow>();

  let latestReportAt: string | null = null;

  for (const report of reports) {
    byMode[report.mode] += 1;
    byCategory[report.category] = (byCategory[report.category] ?? 0) + 1;
    if (!latestReportAt || parseTimestampMs(report.createdAt) > parseTimestampMs(latestReportAt)) {
      latestReportAt = report.createdAt;
    }

    const existing = byQuestion.get(report.questionId);
    if (!existing) {
      const row: QuestionIssueTriageRow = {
        questionId: report.questionId,
        questionText: report.questionText,
        category: report.category,
        subcategory: report.subcategory,
        reportCount: 1,
        latestReportAt: report.createdAt,
        latestNote: report.note,
        byMode: {
          study: report.mode === "study" ? 1 : 0,
          exam: report.mode === "exam" ? 1 : 0,
          learn: report.mode === "learn" ? 1 : 0,
          flashcards: report.mode === "flashcards" ? 1 : 0,
          missed: report.mode === "missed" ? 1 : 0,
          unknown: report.mode === "unknown" ? 1 : 0,
        },
      };
      byQuestion.set(report.questionId, row);
      continue;
    }

    existing.reportCount += 1;
    existing.byMode[report.mode] += 1;
    if (parseTimestampMs(report.createdAt) >= parseTimestampMs(existing.latestReportAt)) {
      existing.latestReportAt = report.createdAt;
      existing.latestNote = report.note;
      existing.questionText = report.questionText;
      existing.category = report.category;
      existing.subcategory = report.subcategory;
    }
  }

  const topQuestions = Array.from(byQuestion.values())
    .sort((a, b) => {
      if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
      return parseTimestampMs(b.latestReportAt) - parseTimestampMs(a.latestReportAt);
    })
    .slice(0, limit);

  return {
    totalReports: reports.length,
    uniqueQuestionCount: byQuestion.size,
    latestReportAt,
    byMode,
    byCategory,
    topQuestions,
  };
}
