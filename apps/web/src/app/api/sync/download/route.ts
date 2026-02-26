import { NextRequest, NextResponse } from "next/server";
import { startApiRequest } from "../../../../lib/server/apiRequest";
import { authenticateSyncRequest } from "../../../../lib/server/syncAuth";
import { getSyncedSnapshot } from "../../../../lib/server/syncStore";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tracker = startApiRequest(request, "/api/sync/download");
  const rl = consumeRateLimit(request, {
    key: "api:sync:download",
    capacity: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return tracker.json(
      { error: "Too many sync download requests", requestId: tracker.requestId },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const auth = authenticateSyncRequest(request);
  if (!auth.ok || !auth.userId) {
    return tracker.json(
      { error: auth.error ?? "Unauthorized", requestId: tracker.requestId },
      { status: auth.status, headers: rateLimitHeaders(rl) }
    );
  }

  const userIdParam = request.nextUrl.searchParams.get("userId")?.trim() ?? "";
  const userId = userIdParam || auth.userId;
  if (userId !== auth.userId) {
    return tracker.json(
      { error: "Requested userId does not match authenticated user", requestId: tracker.requestId },
      { status: 403, headers: rateLimitHeaders(rl) }
    );
  }

  const snapshot = await getSyncedSnapshot(userId);
  if (!snapshot) {
    return tracker.json(
      {
        userId,
        snapshot: null,
        updatedAt: null,
      },
      { status: 404, headers: rateLimitHeaders(rl) }
    );
  }

  return tracker.json(
    {
      userId,
      snapshot: snapshot.snapshot,
      updatedAt: snapshot.updatedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        ...rateLimitHeaders(rl),
      },
    }
  );
}
