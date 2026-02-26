import { NextRequest, NextResponse } from "next/server";
import { filterQuestionsByCategory, normalizeCategory, shuffleQuestions } from "@part107/core/quiz";
import type { Question } from "@part107/core/types";

import { normalizeAcsCodeOnlyQuestions } from "../../../lib/acsQuestionNormalizer";
import { parseRemoteQuestionSourcePayload } from "../../../lib/questionContracts";
import { sanitizeQuestion } from "../../../lib/questionSanitizer";
import { loadCarringtonStrictQuestionBank } from "../../../lib/server/carringtonQuestionBank";
import { loadCombinedQuestionBank } from "../../../lib/server/combinedQuestionBank";
import { serverLogger } from "../../../lib/server/logger";
import { loadPart107QuestionBank } from "../../../lib/server/part107QuestionBank";
import { consumeRateLimit, rateLimitHeaders } from "../../../lib/server/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type QuestionApiPayload = {
  questions: Question[];
  meta: {
    total: number;
    category: string;
    shuffled: boolean;
    limit: number | null;
    source: "remote" | "local";
  };
};

const CURATED_COMBINED_QUESTIONS = loadCombinedQuestionBank();

const LOCAL_QUESTIONS: Question[] = [
  ...(CURATED_COMBINED_QUESTIONS.length > 0
    ? CURATED_COMBINED_QUESTIONS
    : [...loadPart107QuestionBank(), ...loadCarringtonStrictQuestionBank()]),
];

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function semanticTokenFingerprint(text: string): string {
  const STOP_WORDS = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "for",
    "in",
    "on",
    "at",
    "with",
    "under",
    "part",
    "what",
    "which",
    "when",
    "where",
    "how",
    "is",
    "are",
    "does",
    "must",
    "may",
    "can",
    "should",
    "would",
    "be",
    "by",
    "from",
    "that",
  ]);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
  const unique = Array.from(new Set(tokens));
  unique.sort((a, b) => a.localeCompare(b));
  return unique.slice(0, 8).join("_");
}

function deriveConceptKey(question: Question): string | null {
  const existingConceptKey = (question as unknown as Record<string, unknown>).concept_key;
  if (typeof existingConceptKey === "string" && existingConceptKey.trim()) {
    return existingConceptKey.trim();
  }

  const topic = slug(question.subcategory || question.category || "general");
  if (question.acs_code && question.acs_code.trim()) {
    return `acs:${question.acs_code.trim().toUpperCase()}|${topic}`;
  }

  const citation = `${question.citation ?? ""} ${question.source ?? ""}`.trim();
  const cfr = citation.match(/14\s*cfr(?:\s*part)?\s*(?:§\s*)?(\d+(?:\.\d+)?)/i);
  if (cfr) {
    return `cfr:${cfr[1]}|${topic}`;
  }

  const fingerprint = semanticTokenFingerprint(question.question_text ?? "");
  if (fingerprint) {
    return `sem:${topic}|${fingerprint}`;
  }

  return `sem:${topic}|${slug(question.id || "unknown")}`;
}

function parseBoolean(input: string | null): boolean {
  if (!input) return false;
  return input === "1" || input.toLowerCase() === "true";
}

function parseLimit(input: string | null): number | null {
  if (!input) return null;
  const n = Number.parseInt(input, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(500, n);
}

async function loadRemoteQuestions(url: string): Promise<Question[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load remote questions: ${response.status} ${response.statusText}`);
  }

  return parseRemoteQuestionSourcePayload(await response.json());
}

export async function GET(request: NextRequest) {
  const rl = consumeRateLimit(request, {
    key: "api:questions",
    capacity: 180,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many question requests" },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const categoryRaw = request.nextUrl.searchParams.get("category");
    const normalizedCategory = normalizeCategory(categoryRaw) ?? "All";
    const shouldShuffle = parseBoolean(request.nextUrl.searchParams.get("shuffle"));
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

    const remoteSourceUrl = process.env.QUESTION_SOURCE_URL?.trim();
    const baseQuestions = remoteSourceUrl
      ? await loadRemoteQuestions(remoteSourceUrl)
      : LOCAL_QUESTIONS;
    const sanitizedQuestions = baseQuestions.map((question) => sanitizeQuestion(question));
    const normalizedQuestions = normalizeAcsCodeOnlyQuestions(sanitizedQuestions);
    const conceptEnrichedQuestions = normalizedQuestions.map((question) => ({
      ...question,
      concept_key: deriveConceptKey(question),
    }));

    let questions = filterQuestionsByCategory(conceptEnrichedQuestions, normalizedCategory);
    if (shouldShuffle) {
      questions = shuffleQuestions(questions);
    }
    if (limit !== null) {
      questions = questions.slice(0, limit);
    }

    const payload: QuestionApiPayload = {
      questions,
      meta: {
        total: questions.length,
        category: normalizedCategory,
        shuffled: shouldShuffle,
        limit,
        source: remoteSourceUrl ? "remote" : "local",
      },
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        ...rateLimitHeaders(rl),
      },
    });
  } catch (error) {
    serverLogger.error("Question API request failed", {
      route: "/api/questions",
      method: request.method,
      error,
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load questions",
      },
      { status: 500, headers: rateLimitHeaders(rl) }
    );
  }
}
