import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { serverLogger } from "./logger";
import { getSupabasePersistenceContext } from "./supabasePersistence";

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "learning-analytics-v1.json");
const MAX_EVENTS_PER_USER = 20_000;

type SinkPrimitive = string | number | boolean | null;

export interface LearningAnalyticsEvent {
  id: string;
  userId: string;
  timestamp: string;
  type: string;
  mode: string;
  questionId?: string;
  category?: string;
  subcategory?: string;
  isCorrect?: boolean;
  questionTypeProfile?: string;
  metadata?: Record<string, SinkPrimitive>;
}

interface PersistedLearningAnalyticsState {
  version: 1;
  users: Record<string, LearningAnalyticsEvent[]>;
}

interface SupabaseLearningEventRow {
  user_id: string;
  event_id: string;
  timestamp: string;
  type: string;
  mode: string;
  question_id: string | null;
  category: string | null;
  subcategory: string | null;
  is_correct: boolean | null;
  question_type_profile: string | null;
  metadata: Record<string, SinkPrimitive> | null;
}

export interface LearningScoringSummary {
  answerCount: number;
  correctCount: number;
  accuracyPercent: number | null;
  uniqueQuestionCount: number;
  firstAnswerAccuracyPercent: number | null;
  finalAnswerAccuracyPercent: number | null;
  answerChangeRatePercent: number | null;
  confidenceCount: number;
  calibrationScorePercent: number | null;
  overconfidenceRatePercent: number | null;
  byMode: Record<string, number>;
}

declare global {
  var __part107LearningAnalyticsCache__: PersistedLearningAnalyticsState | undefined;
}

function roundPercent(value: number): number {
  return Math.round(value * 100);
}

function parseTimestampMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function confidenceToProbability(confidence: 1 | 2 | 3 | 4 | 5): number {
  if (confidence === 1) return 0.2;
  if (confidence === 2) return 0.4;
  if (confidence === 3) return 0.6;
  if (confidence === 4) return 0.8;
  return 0.95;
}

function extractConfidence(metadata: Record<string, SinkPrimitive> | undefined): 1 | 2 | 3 | 4 | 5 | null {
  const raw = metadata?.confidence;
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 5) {
    return raw as 1 | 2 | 3 | 4 | 5;
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 5) {
      return parsed as 1 | 2 | 3 | 4 | 5;
    }
  }
  return null;
}

function sanitizeMetadataRecord(
  value: Record<string, unknown> | null | undefined
): Record<string, SinkPrimitive> | undefined {
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
  return Object.fromEntries(entries) as Record<string, SinkPrimitive>;
}

function toSupabaseLearningEventRow(event: LearningAnalyticsEvent): SupabaseLearningEventRow {
  return {
    user_id: event.userId,
    event_id: event.id,
    timestamp: event.timestamp,
    type: event.type,
    mode: event.mode,
    question_id: event.questionId ?? null,
    category: event.category ?? null,
    subcategory: event.subcategory ?? null,
    is_correct: typeof event.isCorrect === "boolean" ? event.isCorrect : null,
    question_type_profile: event.questionTypeProfile ?? null,
    metadata: event.metadata ?? null,
  };
}

function fromSupabaseLearningEventRow(row: SupabaseLearningEventRow): LearningAnalyticsEvent {
  return {
    id: row.event_id,
    userId: row.user_id,
    timestamp: row.timestamp,
    type: row.type,
    mode: row.mode,
    questionId: row.question_id ?? undefined,
    category: row.category ?? undefined,
    subcategory: row.subcategory ?? undefined,
    isCorrect: row.is_correct === null ? undefined : row.is_correct,
    questionTypeProfile: row.question_type_profile ?? undefined,
    metadata: sanitizeMetadataRecord(row.metadata) ?? undefined,
  };
}

async function loadLocalState(): Promise<PersistedLearningAnalyticsState> {
  if (globalThis.__part107LearningAnalyticsCache__) {
    return globalThis.__part107LearningAnalyticsCache__;
  }

  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedLearningAnalyticsState;
    if (parsed?.version === 1 && parsed.users && typeof parsed.users === "object") {
      globalThis.__part107LearningAnalyticsCache__ = parsed;
      return parsed;
    }
  } catch {
    // fall through
  }

  const empty: PersistedLearningAnalyticsState = { version: 1, users: {} };
  globalThis.__part107LearningAnalyticsCache__ = empty;
  return empty;
}

async function saveLocalState(state: PersistedLearningAnalyticsState): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_FILE, JSON.stringify(state), "utf8");
  globalThis.__part107LearningAnalyticsCache__ = state;
}

async function appendLearningAnalyticsEventLocal(
  event: LearningAnalyticsEvent
): Promise<void> {
  const state = await loadLocalState();
  const existing = state.users[event.userId] ?? [];
  const deduped = existing.filter((candidate) => candidate.id !== event.id);
  const next = [...deduped, event]
    .sort((a, b) => parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp))
    .slice(Math.max(0, deduped.length + 1 - MAX_EVENTS_PER_USER));
  state.users[event.userId] = next;
  await saveLocalState(state);
}

async function getLearningAnalyticsEventsLocal(
  userId: string,
  options?: { sinceMs?: number }
): Promise<LearningAnalyticsEvent[]> {
  const state = await loadLocalState();
  const events = state.users[userId] ?? [];
  if (!options?.sinceMs) return events;
  return events.filter((event) => parseTimestampMs(event.timestamp) >= options.sinceMs!);
}

async function trimLearningEventsRemote(
  userId: string
): Promise<void> {
  const context = getSupabasePersistenceContext();
  if (!context) return;

  const { client, config } = context;
  const { data, error } = await client
    .from(config.tables.learningEvents)
    .select("event_id")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .range(MAX_EVENTS_PER_USER, MAX_EVENTS_PER_USER + 500);
  if (error) throw error;
  const overflowIds = (data ?? [])
    .map((row) => (row as { event_id?: unknown }).event_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (overflowIds.length === 0) return;
  const { error: deleteError } = await client
    .from(config.tables.learningEvents)
    .delete()
    .eq("user_id", userId)
    .in("event_id", overflowIds);
  if (deleteError) throw deleteError;
}

async function appendLearningAnalyticsEventRemote(
  event: LearningAnalyticsEvent
): Promise<void> {
  const context = getSupabasePersistenceContext();
  if (!context) {
    throw new Error("Supabase persistence is not configured");
  }

  const { client, config } = context;
  const { error } = await client
    .from(config.tables.learningEvents)
    .upsert(toSupabaseLearningEventRow(event), { onConflict: "user_id,event_id" });
  if (error) throw error;
  await trimLearningEventsRemote(event.userId);
}

async function getLearningAnalyticsEventsRemote(
  userId: string,
  options?: { sinceMs?: number }
): Promise<LearningAnalyticsEvent[]> {
  const context = getSupabasePersistenceContext();
  if (!context) {
    throw new Error("Supabase persistence is not configured");
  }

  const { client, config } = context;
  let query = client
    .from(config.tables.learningEvents)
    .select(
      "user_id,event_id,timestamp,type,mode,question_id,category,subcategory,is_correct,question_type_profile,metadata"
    )
    .eq("user_id", userId)
    .order("timestamp", { ascending: true });
  if (options?.sinceMs) {
    query = query.gte("timestamp", new Date(options.sinceMs).toISOString());
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) =>
    fromSupabaseLearningEventRow(row as SupabaseLearningEventRow)
  );
}

export async function clearLearningAnalyticsStoreForTests(): Promise<void> {
  const state = await loadLocalState();
  state.users = {};
  await saveLocalState(state);
}

export async function appendLearningAnalyticsEvent(event: LearningAnalyticsEvent): Promise<void> {
  const context = getSupabasePersistenceContext();
  if (context) {
    try {
      await appendLearningAnalyticsEventRemote(event);
      return;
    } catch (error) {
      serverLogger.warn("Falling back to local learning analytics write", {
        userId: event.userId,
        eventId: event.id,
        error,
      });
    }
  }

  await appendLearningAnalyticsEventLocal(event);
}

export async function getLearningAnalyticsEvents(
  userId: string,
  options?: { sinceMs?: number }
): Promise<LearningAnalyticsEvent[]> {
  const context = getSupabasePersistenceContext();
  if (context) {
    try {
      return await getLearningAnalyticsEventsRemote(userId, options);
    } catch (error) {
      serverLogger.warn("Falling back to local learning analytics read", {
        userId,
        sinceMs: options?.sinceMs ?? null,
        error,
      });
    }
  }

  return getLearningAnalyticsEventsLocal(userId, options);
}

export function computeLearningScoringSummaryFromEvents(
  events: LearningAnalyticsEvent[]
): LearningScoringSummary {
  const answers = events.filter(
    (event) => event.type === "answer_submitted" && typeof event.isCorrect === "boolean"
  );
  const answerCount = answers.length;
  const correctCount = answers.filter((event) => event.isCorrect === true).length;
  const accuracyPercent = answerCount > 0 ? roundPercent(correctCount / answerCount) : null;

  const byMode: Record<string, number> = {};
  for (const event of answers) {
    byMode[event.mode] = (byMode[event.mode] ?? 0) + 1;
  }

  const byQuestion = new Map<string, LearningAnalyticsEvent[]>();
  for (const event of answers) {
    if (!event.questionId) continue;
    if (!byQuestion.has(event.questionId)) {
      byQuestion.set(event.questionId, []);
    }
    byQuestion.get(event.questionId)!.push(event);
  }

  let firstCorrect = 0;
  let finalCorrect = 0;
  let changedQuestions = 0;
  for (const questionEvents of byQuestion.values()) {
    const sorted = [...questionEvents].sort(
      (a, b) => parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp)
    );
    if (sorted[0]?.isCorrect) firstCorrect += 1;
    if (sorted[sorted.length - 1]?.isCorrect) finalCorrect += 1;
    if (sorted.length > 1) changedQuestions += 1;
  }

  const uniqueQuestionCount = byQuestion.size;
  const firstAnswerAccuracyPercent =
    uniqueQuestionCount > 0 ? roundPercent(firstCorrect / uniqueQuestionCount) : null;
  const finalAnswerAccuracyPercent =
    uniqueQuestionCount > 0 ? roundPercent(finalCorrect / uniqueQuestionCount) : null;
  const answerChangeRatePercent =
    uniqueQuestionCount > 0 ? roundPercent(changedQuestions / uniqueQuestionCount) : null;

  const withConfidence = answers
    .map((event) => ({ event, confidence: extractConfidence(event.metadata) }))
    .filter((candidate): candidate is { event: LearningAnalyticsEvent; confidence: 1 | 2 | 3 | 4 | 5 } => {
      return candidate.confidence !== null;
    });
  const confidenceCount = withConfidence.length;
  const calibrationScorePercent =
    confidenceCount > 0
      ? (() => {
          const brier =
            withConfidence.reduce((sum, candidate) => {
              const probability = confidenceToProbability(candidate.confidence);
              const outcome = candidate.event.isCorrect ? 1 : 0;
              return sum + (probability - outcome) ** 2;
            }, 0) / confidenceCount;
          return roundPercent(Math.max(0, 1 - brier));
        })()
      : null;

  const incorrectWithConfidence = withConfidence.filter((candidate) => !candidate.event.isCorrect);
  const overconfidentIncorrect = incorrectWithConfidence.filter(
    (candidate) => candidate.confidence >= 4
  );
  const overconfidenceRatePercent =
    incorrectWithConfidence.length > 0
      ? roundPercent(overconfidentIncorrect.length / incorrectWithConfidence.length)
      : null;

  return {
    answerCount,
    correctCount,
    accuracyPercent,
    uniqueQuestionCount,
    firstAnswerAccuracyPercent,
    finalAnswerAccuracyPercent,
    answerChangeRatePercent,
    confidenceCount,
    calibrationScorePercent,
    overconfidenceRatePercent,
    byMode,
  };
}

export async function getLearningScoringSummary(
  userId: string,
  options?: { sinceMs?: number }
): Promise<LearningScoringSummary> {
  const events = await getLearningAnalyticsEvents(userId, options);
  return computeLearningScoringSummaryFromEvents(events);
}
