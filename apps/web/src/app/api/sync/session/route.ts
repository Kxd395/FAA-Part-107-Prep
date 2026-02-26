import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "../../../../lib/server/appAuth";
import { issueSyncSessionToken } from "../../../../lib/server/syncToken";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rl = consumeRateLimit(request, {
    key: "api:sync:session",
    capacity: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many sync session requests" }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const authenticatedUserId = getAuthenticatedUserId(request);
  if (!authenticatedUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: rateLimitHeaders(rl) });
  }

  const secret = process.env.SYNC_SIGNING_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { token: null, mode: "header-user-id", userId: authenticatedUserId },
      { headers: rateLimitHeaders(rl) }
    );
  }

  const token = issueSyncSessionToken(authenticatedUserId, secret);
  return NextResponse.json(
    {
      token,
      mode: "signed-token",
      userId: authenticatedUserId,
      expiresInSeconds: 3600,
    },
    { headers: rateLimitHeaders(rl) }
  );
}
