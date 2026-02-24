import { NextRequest, NextResponse } from "next/server";
import { authenticateSyncRequest } from "../../../../lib/server/syncAuth";
import { getSyncedSnapshot } from "../../../../lib/server/syncStore";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rl = consumeRateLimit(request, {
    key: "api:sync:download",
    capacity: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many sync download requests" }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  const auth = authenticateSyncRequest(request);
  if (!auth.ok || !auth.userId) {
    return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: auth.status, headers: rateLimitHeaders(rl) });
  }

  const userIdParam = request.nextUrl.searchParams.get("userId")?.trim() ?? "";
  const userId = userIdParam || auth.userId;
  if (userId !== auth.userId) {
    return NextResponse.json({ error: "Requested userId does not match authenticated user" }, { status: 403, headers: rateLimitHeaders(rl) });
  }

  const snapshot = await getSyncedSnapshot(userId);
  if (!snapshot) {
    return NextResponse.json(
      {
        userId,
        snapshot: null,
        updatedAt: null,
      },
      { status: 404, headers: rateLimitHeaders(rl) }
    );
  }

  return NextResponse.json(
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
