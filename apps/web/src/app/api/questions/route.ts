import { NextRequest, NextResponse } from "next/server";
import {
  filterQuestionsByCategory,
  normalizeCategory,
  shuffleQuestions,
} from "../../../../../../packages/core/src/quiz";
import type { Question } from "../../../../../../packages/core/src/types";

import regulationsData from "../../../../../../packages/content/questions/regulations.json";
import airspaceData from "../../../../../../packages/content/questions/airspace.json";
import weatherData from "../../../../../../packages/content/questions/weather.json";
import operationsData from "../../../../../../packages/content/questions/operations.json";
import loadingPerformanceData from "../../../../../../packages/content/questions/loading_performance.json";

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

const LOCAL_QUESTIONS: Question[] = [
  ...(regulationsData as Question[]),
  ...(airspaceData as Question[]),
  ...(weatherData as Question[]),
  ...(operationsData as Question[]),
  ...(loadingPerformanceData as Question[]),
];

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

  const payload = await response.json();
  if (Array.isArray(payload)) return payload as Question[];
  if (payload && Array.isArray(payload.questions)) return payload.questions as Question[];

  throw new Error("Remote question source must be an array or an object with questions[]");
}

export async function GET(request: NextRequest) {
  try {
    const categoryRaw = request.nextUrl.searchParams.get("category");
    const normalizedCategory = normalizeCategory(categoryRaw) ?? "All";
    const shouldShuffle = parseBoolean(request.nextUrl.searchParams.get("shuffle"));
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

    const remoteSourceUrl = process.env.QUESTION_SOURCE_URL?.trim();
    const baseQuestions = remoteSourceUrl
      ? await loadRemoteQuestions(remoteSourceUrl)
      : LOCAL_QUESTIONS;

    let questions = filterQuestionsByCategory(baseQuestions, normalizedCategory);
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
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load questions",
      },
      { status: 500 }
    );
  }
}
