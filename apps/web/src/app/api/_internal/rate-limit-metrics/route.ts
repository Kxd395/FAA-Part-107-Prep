import { NextRequest, NextResponse } from "next/server";
import { startApiRequest } from "../../../../lib/server/apiRequest";
import { getRateLimitMetrics } from "../../../../lib/server/rateLimit";
import { getRouteMetrics } from "../../../../lib/server/routeMetrics";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tracker = startApiRequest(request, "/api/_internal/rate-limit-metrics");
  const requiredToken = process.env.INTERNAL_METRICS_TOKEN?.trim();
  if (requiredToken) {
    const authorization = request.headers.get("authorization");
    const bearer =
      typeof authorization === "string" && authorization.toLowerCase().startsWith("bearer ")
        ? authorization.slice(7).trim()
        : "";
    if (!bearer || bearer !== requiredToken) {
      return tracker.json({ error: "Unauthorized", requestId: tracker.requestId }, { status: 401 });
    }
  }
  return tracker.json({
    generatedAt: new Date().toISOString(),
    requestId: tracker.requestId,
    metrics: {
      rateLimit: getRateLimitMetrics(),
      routes: getRouteMetrics(),
    },
  });
}
