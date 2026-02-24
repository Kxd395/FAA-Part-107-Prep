import type { LearningEvent } from "./learningEventStore";

const SINK_RETRY_DELAYS_MS = [250, 500] as const;
const DEAD_LETTER_KEY = "part107_analytics_sink_deadletter_v1";
const DEAD_LETTER_MAX = 200;
const DEAD_LETTER_BACKOFF_BASE_MS = 5_000;
const DEAD_LETTER_BACKOFF_MAX_MS = 10 * 60 * 1000;

const ALLOWED_METADATA_KEYS = new Set([
  "phase",
  "round",
  "batchSize",
  "deckSize",
  "totalPool",
  "dueNowCount",
  "usingUpcomingFallback",
  "quizQueueSize",
  "responseTimeMs",
  "rating",
  "teachIndex",
  "attempts",
  "firstPassCorrect",
  "masteredCount",
  "uniqueQuestions",
  "availableQuestionCount",
  "roundQuestionCount",
  "initialDeckSize",
  "known",
  "learning",
  "reviews",
  "action",
  "tab",
  "filter",
  "value",
  "timeWindow",
  "searchLength",
  "selectedMode",
  "selectedType",
  "selectedMergeMode",
  "previewKeys",
  "changedKeys",
  "download",
  "target",
  "href",
  "figure",
  "hasQuery",
]);

export interface SinkEventPayload {
  event: {
    id: string;
    userId: string;
    timestamp: string;
    type: LearningEvent["type"];
    mode: LearningEvent["mode"];
    questionId?: string;
    category?: string;
    subcategory?: string;
    isCorrect?: boolean;
    questionTypeProfile?: string;
    metadata?: Record<string, string | number | boolean | null>;
  };
}

interface DeadLetterEvent {
  payload: SinkEventPayload;
  queuedAt: string;
  retryCount: number;
  lastError: string;
  nextRetryAt?: string;
}

export interface AnalyticsDeadLetterSummary {
  count: number;
  latestQueuedAt: string | null;
  latestError: string | null;
  nextRetryAt: string | null;
}

function sinkEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_SINK_ENABLED === "true";
}

function sinkUrl(): string {
  return process.env.NEXT_PUBLIC_ANALYTICS_SINK_URL?.trim() ?? "";
}

function sinkToken(): string {
  return process.env.NEXT_PUBLIC_ANALYTICS_SINK_TOKEN ?? "";
}

function sanitizeMetadata(
  metadata: LearningEvent["metadata"]
): Record<string, string | number | boolean | null> | undefined {
  if (!metadata) return undefined;
  const filtered: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    filtered[key] = value;
  }
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

export function sanitizeLearningEventForSink(event: LearningEvent): SinkEventPayload {
  return {
    event: {
      id: event.id,
      userId: event.userId,
      timestamp: event.timestamp,
      type: event.type,
      mode: event.mode,
      questionId: event.questionId,
      category: event.category,
      subcategory: event.subcategory,
      isCorrect: event.isCorrect,
      questionTypeProfile: event.questionTypeProfile,
      metadata: sanitizeMetadata(event.metadata),
    },
  };
}

export function isAnalyticsSinkEnabled(): boolean {
  return sinkEnabled() && sinkUrl().length > 0;
}

function loadDeadLetterQueue(): DeadLetterEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEAD_LETTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeadLetterEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDeadLetterQueue(queue: DeadLetterEvent[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    DEAD_LETTER_KEY,
    JSON.stringify(queue.slice(Math.max(0, queue.length - DEAD_LETTER_MAX)))
  );
}

function computeDeadLetterBackoffMs(retryCount: number): number {
  const exponent = Math.max(0, Math.min(10, retryCount));
  return Math.min(DEAD_LETTER_BACKOFF_MAX_MS, DEAD_LETTER_BACKOFF_BASE_MS * 2 ** exponent);
}

function enqueueDeadLetter(payload: SinkEventPayload, error: unknown, retryCount: number): void {
  const queue = loadDeadLetterQueue();
  const nextRetryAt = new Date(Date.now() + computeDeadLetterBackoffMs(retryCount)).toISOString();
  queue.push({
    payload,
    queuedAt: new Date().toISOString(),
    retryCount,
    lastError: error instanceof Error ? error.message : "sink request failed",
    nextRetryAt,
  });
  saveDeadLetterQueue(queue);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function postToSink(payload: SinkEventPayload): Promise<void> {
  const url = sinkUrl();
  if (!url) return;
  const token = sinkToken();
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    keepalive: true,
  });
}

async function sendWithRetry(payload: SinkEventPayload): Promise<{ ok: true } | { ok: false; error: unknown; retries: number }> {
  let retryCount = 0;
  for (let attempt = 0; attempt <= SINK_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await postToSink(payload);
      return { ok: true };
    } catch (error) {
      retryCount = attempt;
      if (attempt < SINK_RETRY_DELAYS_MS.length) {
        await sleep(SINK_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      return { ok: false, error, retries: retryCount + 1 };
    }
  }
  return { ok: false, error: new Error("sink retries exhausted"), retries: retryCount + 1 };
}

async function flushDeadLetterQueue(): Promise<void> {
  const queue = loadDeadLetterQueue();
  if (queue.length === 0) return;

  const remaining: DeadLetterEvent[] = [];
  const now = Date.now();
  for (const entry of queue) {
    if (entry.nextRetryAt) {
      const retryAt = Date.parse(entry.nextRetryAt);
      if (Number.isFinite(retryAt) && retryAt > now) {
        remaining.push(entry);
        continue;
      }
    }
    const result = await sendWithRetry(entry.payload);
    if (!result.ok) {
      const nextRetryCount = entry.retryCount + result.retries;
      remaining.push({
        ...entry,
        retryCount: nextRetryCount,
        lastError: result.error instanceof Error ? result.error.message : entry.lastError,
        nextRetryAt: new Date(Date.now() + computeDeadLetterBackoffMs(nextRetryCount)).toISOString(),
      });
    }
  }
  saveDeadLetterQueue(remaining);
}

export function getAnalyticsDeadLetterSummary(): AnalyticsDeadLetterSummary {
  const queue = loadDeadLetterQueue();
  const latest = queue[queue.length - 1];
  return {
    count: queue.length,
    latestQueuedAt: latest?.queuedAt ?? null,
    latestError: latest?.lastError ?? null,
    nextRetryAt: latest?.nextRetryAt ?? null,
  };
}

export async function retryAnalyticsDeadLetterQueue(): Promise<void> {
  if (!isAnalyticsSinkEnabled()) return;
  await flushDeadLetterQueue();
}

export function clearAnalyticsDeadLetterQueue(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEAD_LETTER_KEY);
}

export function getDeadLetterEventsForTests(): DeadLetterEvent[] {
  return loadDeadLetterQueue();
}

export function clearDeadLetterEventsForTests(): void {
  clearAnalyticsDeadLetterQueue();
}

export async function sendLearningEventToSink(event: LearningEvent): Promise<void> {
  if (!isAnalyticsSinkEnabled()) return;

  const payload = sanitizeLearningEventForSink(event);

  // Drain previously-failed events first so queue doesn't grow without bound.
  await flushDeadLetterQueue();
  const result = await sendWithRetry(payload);
  if (!result.ok) {
    enqueueDeadLetter(payload, result.error, result.retries);
  }
}
