import { NextRequest, NextResponse } from "next/server";
import { startApiRequest } from "../../../../lib/server/apiRequest";
import { getAuthenticatedUserId } from "../../../../lib/server/appAuth";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";
import { getUserState, saveUserState } from "../../../../lib/server/userStateStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function unauthorizedResponse(headers?: Record<string, string>) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
}

export async function GET(request: NextRequest) {
  const tracker = startApiRequest(request, "/api/user/state");
  const rl = consumeRateLimit(request, {
    key: "api:user:state:get",
    capacity: 120,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return tracker.json(
      { error: "Too many user state requests", requestId: tracker.requestId },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return tracker.respond(unauthorizedResponse(rateLimitHeaders(rl)));
  }

  const record = await getUserState(userId);
  if (!record) {
    return tracker.json(
      { userId, data: null, updatedAt: null },
      { status: 404, headers: rateLimitHeaders(rl) }
    );
  }

  return tracker.json(
    { userId, data: record.data, updatedAt: record.updatedAt },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        ...rateLimitHeaders(rl),
      },
    }
  );
}

export async function PUT(request: NextRequest) {
  const tracker = startApiRequest(request, "/api/user/state");
  const rl = consumeRateLimit(request, {
    key: "api:user:state:put",
    capacity: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return tracker.json(
      { error: "Too many user state updates", requestId: tracker.requestId },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return tracker.respond(unauthorizedResponse(rateLimitHeaders(rl)));
  }

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "merge" | "overwrite";
    data?: Record<string, unknown>;
  };

  if (body.mode !== "merge" && body.mode !== "overwrite") {
    return tracker.json(
      { error: "mode must be merge or overwrite", requestId: tracker.requestId },
      { status: 400, headers: rateLimitHeaders(rl) }
    );
  }
  if (!body.data || typeof body.data !== "object") {
    return tracker.json(
      { error: "data must be an object", requestId: tracker.requestId },
      { status: 400, headers: rateLimitHeaders(rl) }
    );
  }

  const saved = await saveUserState(userId, body.data, body.mode);
  return tracker.json(
    {
      userId,
      updatedAt: saved.record.updatedAt,
      changedKeys: saved.changedKeys,
    },
    { headers: rateLimitHeaders(rl) }
  );
}
