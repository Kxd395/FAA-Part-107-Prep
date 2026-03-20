import { NextRequest, NextResponse } from "next/server";
import { startApiRequest } from "../../../../lib/server/apiRequest";
import {
  getAuthCookieName,
  getAuthTtlSeconds,
  getAuthenticatedSession,
  isValidUserId,
  issueAppSessionToken,
} from "../../../../lib/server/appAuth";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tracker = startApiRequest(request, "/api/auth/session");
  const session = getAuthenticatedSession(request);
  return tracker.json(
    {
      authenticated: !!session,
      userId: session?.uid ?? null,
      email: session?.email ?? null,
      displayName: session?.displayName ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const tracker = startApiRequest(request, "/api/auth/session");
  // Dev-only backdoor: allows direct username sign-in for testing.
  // In production, use /api/auth/magic-link + /api/auth/verify instead.
  if (String(process.env.NODE_ENV) === "production") {
    return tracker.json(
      { error: "Direct sign-in is disabled. Use magic link authentication.", requestId: tracker.requestId },
      { status: 403 }
    );
  }

  const rl = consumeRateLimit(request, {
    key: "api:auth:session",
    capacity: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return tracker.json(
      { error: "Too many auth session requests", requestId: tracker.requestId },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { userId?: string };
  const userId = body.userId?.trim() ?? "";
  if (!isValidUserId(userId)) {
    return tracker.json(
      {
        error:
          "userId must be 3-64 chars using letters, numbers, dot, underscore, or hyphen",
        requestId: tracker.requestId,
      },
      { status: 400, headers: rateLimitHeaders(rl) }
    );
  }

  const token = issueAppSessionToken(userId);
  const response = tracker.json(
    { authenticated: true, userId, expiresInSeconds: getAuthTtlSeconds() },
    { headers: rateLimitHeaders(rl) }
  );
  response.cookies.set({
    name: getAuthCookieName(),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getAuthTtlSeconds(),
  });
  return response;
}

export async function DELETE(request?: NextRequest) {
  const response = request
    ? startApiRequest(request, "/api/auth/session").json({ authenticated: false, userId: null })
    : NextResponse.json({ authenticated: false, userId: null });
  response.cookies.set({
    name: getAuthCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
