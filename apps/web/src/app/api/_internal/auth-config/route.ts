import { NextRequest } from "next/server";
import { startApiRequest } from "../../../../lib/server/apiRequest";
import { inspectAuthConfig } from "../../../../lib/server/authConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function parseBoolean(value: string | null): boolean {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true";
}

export async function GET(request: NextRequest) {
  const tracker = startApiRequest(request, "/api/_internal/auth-config");
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

  const strict = parseBoolean(request.nextUrl.searchParams.get("strict"));
  const assumeProduction = parseBoolean(request.nextUrl.searchParams.get("production"));
  const report = inspectAuthConfig(process.env, { strict, assumeProduction });

  return tracker.json(
    {
      requestId: tracker.requestId,
      generatedAt: new Date().toISOString(),
      ...report,
    },
    { status: report.ok ? 200 : 500 }
  );
}
