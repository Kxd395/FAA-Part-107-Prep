import { NextRequest, NextResponse } from "next/server";
import type { OptionId } from "@part107/core";
import { getAuthenticatedUserId } from "../../../../lib/server/appAuth";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";
import {
  appendQuestionIssueReport,
  type QuestionIssueOptionSnapshot,
  type QuestionIssueReport,
} from "../../../../lib/server/questionIssueStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type IssueMetadataPrimitive = string | number | boolean | null;

const OPTION_IDS = new Set<OptionId>(["A", "B", "C", "D"]);

function unauthorizedResponse(headers?: Record<string, string>) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseOptionId(value: unknown): OptionId | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim().toUpperCase();
  return OPTION_IDS.has(candidate as OptionId) ? (candidate as OptionId) : null;
}

function sanitizeOneLineNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length > 280) return null;
  return normalized;
}

function sanitizeMetadata(
  value: unknown
): Record<string, IssueMetadataPrimitive> | undefined {
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
  return Object.fromEntries(entries) as Record<string, IssueMetadataPrimitive>;
}

function normalizeMode(value: unknown): QuestionIssueReport["mode"] {
  if (
    value === "study" ||
    value === "exam" ||
    value === "learn" ||
    value === "flashcards" ||
    value === "missed"
  ) {
    return value;
  }
  return "unknown";
}

function normalizeOptions(value: unknown): QuestionIssueOptionSnapshot[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) return null;
  const normalized: QuestionIssueOptionSnapshot[] = [];

  for (const raw of value) {
    if (!isPlainObject(raw)) return null;
    const optionId = parseOptionId(raw.id);
    const optionText = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!optionId || !optionText) return null;
    normalized.push({ id: optionId, text: optionText });
  }

  return normalized;
}

function normalizeIssueReport(
  userId: string,
  value: unknown
): QuestionIssueReport | null {
  if (!isPlainObject(value)) return null;

  const questionId = typeof value.questionId === "string" ? value.questionId.trim() : "";
  const questionText =
    typeof value.questionText === "string" ? value.questionText.trim() : "";
  const category = typeof value.category === "string" ? value.category.trim() : "";
  const subcategory = typeof value.subcategory === "string" ? value.subcategory.trim() : "";
  const options = normalizeOptions(value.options);
  const correctOptionId = parseOptionId(value.correctOptionId);
  const selectedOptionId = value.selectedOptionId == null ? null : parseOptionId(value.selectedOptionId);
  const note = sanitizeOneLineNote(value.note);
  if (
    !questionId ||
    !questionText ||
    !category ||
    !subcategory ||
    !options ||
    !correctOptionId ||
    !note
  ) {
    return null;
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    createdAt: new Date().toISOString(),
    mode: normalizeMode(value.mode),
    questionId,
    questionText,
    category,
    subcategory,
    options,
    correctOptionId,
    selectedOptionId,
    note,
    questionTypeProfile:
      typeof value.questionTypeProfile === "string" && value.questionTypeProfile.trim()
        ? value.questionTypeProfile.trim()
        : null,
    source:
      typeof value.source === "string" && value.source.trim() ? value.source.trim() : null,
    sourceType:
      typeof value.sourceType === "string" && value.sourceType.trim()
        ? value.sourceType.trim()
        : null,
    confidence:
      typeof value.confidence === "number" &&
      Number.isInteger(value.confidence) &&
      value.confidence >= 1 &&
      value.confidence <= 5
        ? (value.confidence as 1 | 2 | 3 | 4 | 5)
        : null,
    metadata: sanitizeMetadata(value.metadata),
  };
}

export async function POST(request: NextRequest) {
  const rl = consumeRateLimit(request, {
    key: "api:user:question-issues:post",
    capacity: 90,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many question issue requests" },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return unauthorizedResponse(rateLimitHeaders(rl));
  }

  const body = (await request.json().catch(() => ({}))) as { report?: unknown };
  const normalized = normalizeIssueReport(userId, body.report);
  if (!normalized) {
    return NextResponse.json(
      { error: "report payload is invalid" },
      { status: 400, headers: rateLimitHeaders(rl) }
    );
  }

  await appendQuestionIssueReport(normalized);
  return NextResponse.json(
    { accepted: true, issueId: normalized.id },
    { status: 202, headers: rateLimitHeaders(rl) }
  );
}
