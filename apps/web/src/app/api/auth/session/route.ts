import { NextRequest, NextResponse } from "next/server";
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
  const session = getAuthenticatedSession(request);
  return NextResponse.json({
    authenticated: !!session,
    userId: session?.uid ?? null,
    email: session?.email ?? null,
    displayName: session?.displayName ?? null,
  });
}

export async function POST(request: NextRequest) {
  // Dev-only backdoor: allows direct username sign-in for testing.
  // In production, use /api/auth/magic-link + /api/auth/verify instead.
  if (String(process.env.NODE_ENV) === "production") {
    return NextResponse.json(
      { error: "Direct sign-in is disabled. Use magic link authentication." },
      { status: 403 }
    );
  }

  const rl = consumeRateLimit(request, {
    key: "api:auth:session",
    capacity: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many auth session requests" },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { userId?: string };
  const userId = body.userId?.trim() ?? "";
  if (!isValidUserId(userId)) {
    return NextResponse.json(
      {
        error:
          "userId must be 3-64 chars using letters, numbers, dot, underscore, or hyphen",
      },
      { status: 400, headers: rateLimitHeaders(rl) }
    );
  }

  const token = issueAppSessionToken(userId);
  const response = NextResponse.json(
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

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false, userId: null });
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
