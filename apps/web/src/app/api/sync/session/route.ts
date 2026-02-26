import { NextRequest, NextResponse } from "next/server";
import { startApiRequest } from "../../../../lib/server/apiRequest";
import { getAuthenticatedUserId } from "../../../../lib/server/appAuth";
import { issueSyncSessionToken } from "../../../../lib/server/syncToken";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tracker = startApiRequest(request, "/api/sync/session");
  const rl = consumeRateLimit(request, {
    key: "api:sync:session",
    capacity: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return tracker.json(
      { error: "Too many sync session requests", requestId: tracker.requestId },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const authenticatedUserId = getAuthenticatedUserId(request);
  if (!authenticatedUserId) {
    return tracker.json(
      { error: "Unauthorized", requestId: tracker.requestId },
      { status: 401, headers: rateLimitHeaders(rl) }
    );
  }

  const secret = process.env.SYNC_SIGNING_SECRET?.trim();
  if (!secret) {
    return tracker.json(
      { token: null, mode: "header-user-id", userId: authenticatedUserId },
      { headers: rateLimitHeaders(rl) }
    );
  }

  const token = issueSyncSessionToken(authenticatedUserId, secret);
  return tracker.json(
    {
      token,
      mode: "signed-token",
      userId: authenticatedUserId,
      expiresInSeconds: 3600,
    },
    { headers: rateLimitHeaders(rl) }
  );
}
