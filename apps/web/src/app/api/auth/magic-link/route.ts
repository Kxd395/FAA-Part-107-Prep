import { NextRequest, NextResponse } from "next/server";
import { startApiRequest } from "../../../../lib/server/apiRequest";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";
import { isValidEmail, sendMagicLink } from "../../../../lib/server/passwordAuth";
import { resolveMagicLinkBaseUrl } from "../../../../lib/server/appOrigin";
import { serverLogger } from "../../../../lib/server/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tracker = startApiRequest(request, "/api/auth/magic-link");
  const rl = consumeRateLimit(request, {
    key: "api:auth:magic-link",
    capacity: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return tracker.json(
      { error: "Too many magic link requests", requestId: tracker.requestId },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.toLowerCase().trim() ?? "";

  if (!isValidEmail(email)) {
    return tracker.json(
      { error: "A valid email address is required", requestId: tracker.requestId },
      { status: 400, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const baseUrl = resolveMagicLinkBaseUrl(request);
    if (!baseUrl) {
      return tracker.json(
        { error: "Magic link origin is not configured", requestId: tracker.requestId },
        { status: 500, headers: rateLimitHeaders(rl) }
      );
    }

    const result = await sendMagicLink(email, baseUrl);

    return tracker.json(
      {
        sent: true,
        ...(result.devUrl && process.env.NODE_ENV !== "production"
          ? { devUrl: result.devUrl }
          : {}),
      },
      { headers: rateLimitHeaders(rl) }
    );
  } catch (error) {
    serverLogger.error("Magic link send failure", {
      requestId: tracker.requestId,
      route: "/api/auth/magic-link",
      method: request.method,
      error,
    });
    return tracker.json(
      { error: "Failed to send magic link. Please try again.", requestId: tracker.requestId },
      { status: 500, headers: rateLimitHeaders(rl) }
    );
  }
}
