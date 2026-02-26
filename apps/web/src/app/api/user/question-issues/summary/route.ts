import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "../../../../../lib/server/appAuth";
import { consumeRateLimit, rateLimitHeaders } from "../../../../../lib/server/rateLimit";
import { getQuestionIssueTriageSummary } from "../../../../../lib/server/questionIssueStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function unauthorizedResponse(headers?: Record<string, string>) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
}

function parseLimit(value: string | null): number {
  if (!value) return 25;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 25;
  return Math.min(100, parsed);
}

export async function GET(request: NextRequest) {
  const rl = consumeRateLimit(request, {
    key: "api:user:question-issues:summary:get",
    capacity: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many question issue summary requests" },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return unauthorizedResponse(rateLimitHeaders(rl));
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const summary = await getQuestionIssueTriageSummary(userId, { limit });
  return NextResponse.json(
    {
      userId,
      limit,
      generatedAt: new Date().toISOString(),
      summary,
    },
    { headers: rateLimitHeaders(rl) }
  );
}
