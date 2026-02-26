import { NextRequest, NextResponse } from "next/server";
import { startApiRequest } from "../../../../lib/server/apiRequest";
import { serverLogger } from "../../../../lib/server/logger";
import { authenticateSyncRequest } from "../../../../lib/server/syncAuth";
import { mergeAndSaveSnapshot, type SyncSnapshotEnvelope } from "../../../../lib/server/syncStore";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";
import { verifySyncSnapshotSignature } from "../../../../lib/server/snapshotSignature";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSnapshotDataMap(value: unknown): value is Record<string, string | null> {
  if (!isPlainObject(value)) return false;
  return Object.values(value).every((entry) => entry === null || typeof entry === "string");
}

function isSnapshotEnvelope(value: unknown): value is SyncSnapshotEnvelope {
  if (!isPlainObject(value)) return false;
  const candidate = value as Record<string, unknown>;
  const data = candidate.data;
  const signature = candidate.signature;
  return (
    candidate.version === 1 &&
    typeof candidate.exportedAt === "string" &&
    isSnapshotDataMap(data) &&
    (signature === undefined || typeof signature === "string")
  );
}

export async function POST(request: NextRequest) {
  const tracker = startApiRequest(request, "/api/sync/upload");
  const rl = consumeRateLimit(request, {
    key: "api:sync:upload",
    capacity: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return tracker.json(
      { error: "Too many sync upload requests", requestId: tracker.requestId },
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

  try {
    const payload = (await request.json()) as {
      userId?: string;
      mode?: "merge" | "overwrite";
      snapshot?: unknown;
    };

    if (payload.userId !== auth.userId) {
      return tracker.json(
        { error: "Payload userId does not match authenticated user", requestId: tracker.requestId },
        { status: 403, headers: rateLimitHeaders(rl) }
      );
    }
    if (payload.mode !== "merge" && payload.mode !== "overwrite") {
      return tracker.json(
        { error: "mode must be merge or overwrite", requestId: tracker.requestId },
        { status: 400, headers: rateLimitHeaders(rl) }
      );
    }
    if (!isSnapshotEnvelope(payload.snapshot)) {
      return tracker.json(
        { error: "snapshot payload is invalid", requestId: tracker.requestId },
        { status: 400, headers: rateLimitHeaders(rl) }
      );
    }
    if (payload.snapshot.signature && !verifySyncSnapshotSignature(payload.snapshot)) {
      return tracker.json(
        { error: "snapshot signature is invalid", requestId: tracker.requestId },
        { status: 400, headers: rateLimitHeaders(rl) }
      );
    }

    const result = await mergeAndSaveSnapshot({
      userId: auth.userId,
      mode: payload.mode,
      snapshot: payload.snapshot,
    });

    return tracker.json(
      {
        accepted: result.accepted,
        mergedSummary: result.mergedSummary,
        updatedAt: result.record.updatedAt,
      },
      { headers: rateLimitHeaders(rl) }
    );
  } catch (error) {
    serverLogger.error("Sync upload request failed", {
      requestId: tracker.requestId,
      route: "/api/sync/upload",
      method: request.method,
      error,
    });
    return tracker.json(
      { error: error instanceof Error ? error.message : "sync upload failed", requestId: tracker.requestId },
      { status: 500, headers: rateLimitHeaders(rl) }
    );
  }
}
