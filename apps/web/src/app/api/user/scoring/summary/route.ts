import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "../../../../../lib/server/appAuth";
import { consumeRateLimit, rateLimitHeaders } from "../../../../../lib/server/rateLimit";
import { getLearningScoringSummary } from "../../../../../lib/server/learningAnalyticsStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type TimeWindow = "24h" | "7d" | "30d" | "all";

function unauthorizedResponse(headers?: Record<string, string>) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
}

function parseTimeWindow(value: string | null): TimeWindow {
  if (value === "24h" || value === "7d" || value === "30d" || value === "all") return value;
  return "30d";
}

function toWindowSinceMs(window: TimeWindow): number | undefined {
  const now = Date.now();
  if (window === "24h") return now - 24 * 60 * 60 * 1000;
  if (window === "7d") return now - 7 * 24 * 60 * 60 * 1000;
  if (window === "30d") return now - 30 * 24 * 60 * 60 * 1000;
  return undefined;
}

export async function GET(request: NextRequest) {
  const rl = consumeRateLimit(request, {
    key: "api:user:scoring:summary:get",
    capacity: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many scoring summary requests" },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return unauthorizedResponse(rateLimitHeaders(rl));
  }

  const window = parseTimeWindow(request.nextUrl.searchParams.get("window"));
  const summary = await getLearningScoringSummary(userId, {
    sinceMs: toWindowSinceMs(window),
  });
  return NextResponse.json(
    {
      userId,
      window,
      generatedAt: new Date().toISOString(),
      summary,
    },
    { headers: rateLimitHeaders(rl) }
  );
}
