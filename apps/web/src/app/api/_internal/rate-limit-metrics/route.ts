import { NextRequest, NextResponse } from "next/server";
import { getRateLimitMetrics } from "../../../../lib/server/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requiredToken = process.env.INTERNAL_METRICS_TOKEN?.trim();
  if (requiredToken) {
    const authorization = request.headers.get("authorization");
    const bearer =
      typeof authorization === "string" && authorization.toLowerCase().startsWith("bearer ")
        ? authorization.slice(7).trim()
        : "";
    if (!bearer || bearer !== requiredToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    metrics: getRateLimitMetrics(),
  });
}
