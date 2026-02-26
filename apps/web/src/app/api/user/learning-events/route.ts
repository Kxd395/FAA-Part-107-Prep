import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "../../../../lib/server/appAuth";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";
import {
  appendLearningAnalyticsEvent,
  type LearningAnalyticsEvent,
} from "../../../../lib/server/learningAnalyticsStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type SinkPrimitive = string | number | boolean | null;

function unauthorizedResponse(headers?: Record<string, string>) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeMetadata(
  value: unknown
): Record<string, SinkPrimitive> | undefined {
  if (!isPlainObject(value)) return undefined;
  const entries = Object.entries(value).filter(([, field]) => {
    return (
      field === null ||
      typeof field === "string" ||
      typeof field === "number" ||
      typeof field === "boolean"
    );
  });
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as Record<string, SinkPrimitive>;
}

function normalizeLearningEvent(
  userId: string,
  value: unknown
): LearningAnalyticsEvent | null {
  if (!isPlainObject(value)) return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const timestamp = typeof value.timestamp === "string" ? value.timestamp.trim() : "";
  const type = typeof value.type === "string" ? value.type.trim() : "";
  const mode = typeof value.mode === "string" ? value.mode.trim() : "";
  if (!id || !timestamp || !type || !mode) return null;
  const parsedTimestamp = Date.parse(timestamp);
  if (!Number.isFinite(parsedTimestamp)) return null;

  const metadata = sanitizeMetadata(value.metadata);

  return {
    id,
    userId,
    timestamp: new Date(parsedTimestamp).toISOString(),
    type,
    mode,
    questionId:
      typeof value.questionId === "string" && value.questionId.trim().length > 0
        ? value.questionId.trim()
        : undefined,
    category:
      typeof value.category === "string" && value.category.trim().length > 0
        ? value.category.trim()
        : undefined,
    subcategory:
      typeof value.subcategory === "string" && value.subcategory.trim().length > 0
        ? value.subcategory.trim()
        : undefined,
    isCorrect: typeof value.isCorrect === "boolean" ? value.isCorrect : undefined,
    questionTypeProfile:
      typeof value.questionTypeProfile === "string" && value.questionTypeProfile.trim().length > 0
        ? value.questionTypeProfile.trim()
        : undefined,
    metadata,
  };
}

export async function POST(request: NextRequest) {
  const rl = consumeRateLimit(request, {
    key: "api:user:learning-events:post",
    capacity: 600,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many learning event requests" },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return unauthorizedResponse(rateLimitHeaders(rl));
  }

  const body = (await request.json().catch(() => ({}))) as { event?: unknown };
  const normalized = normalizeLearningEvent(userId, body.event);
  if (!normalized) {
    return NextResponse.json(
      { error: "event payload is invalid" },
      { status: 400, headers: rateLimitHeaders(rl) }
    );
  }

  await appendLearningAnalyticsEvent(normalized);
  return NextResponse.json(
    { accepted: true, eventId: normalized.id },
    { status: 202, headers: rateLimitHeaders(rl) }
  );
}
