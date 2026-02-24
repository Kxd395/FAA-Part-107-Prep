import type { NextRequest } from "next/server";
import { verifySyncSessionToken } from "./syncToken";

export interface SyncAuthResult {
  ok: boolean;
  status: number;
  error?: string;
  userId?: string;
}

function parseBearerToken(header: string | null): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function authenticateSyncRequest(request: NextRequest): SyncAuthResult {
  const signingSecret = process.env.SYNC_SIGNING_SECRET?.trim();
  if (signingSecret) {
    const bearer = parseBearerToken(request.headers.get("authorization"));
    if (!bearer) {
      return { ok: false, status: 401, error: "Missing signed sync session token" };
    }
    const payload = verifySyncSessionToken(bearer, signingSecret);
    if (!payload) {
      return { ok: false, status: 401, error: "Invalid or expired sync session token" };
    }
    return { ok: true, status: 200, userId: payload.userId };
  }

  const userId = request.headers.get("x-sync-user-id")?.trim() ?? "";
  if (!userId) {
    return { ok: false, status: 401, error: "Missing x-sync-user-id" };
  }

  const requiredToken = process.env.SYNC_API_TOKEN?.trim();
  if (requiredToken) {
    const actualToken = parseBearerToken(request.headers.get("authorization"));
    if (!actualToken || actualToken !== requiredToken) {
      return { ok: false, status: 401, error: "Invalid sync token" };
    }
  }

  return { ok: true, status: 200, userId };
}
