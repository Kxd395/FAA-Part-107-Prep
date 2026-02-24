import crypto from "node:crypto";

interface SyncTokenPayload {
  userId: string;
  exp: number;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function issueSyncSessionToken(userId: string, secret: string, ttlSeconds = 3600): string {
  const payload: SyncTokenPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload, secret);
  return `sync.${encodedPayload}.${signature}`;
}

export function verifySyncSessionToken(token: string, secret: string): SyncTokenPayload | null {
  if (!token.startsWith("sync.")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const encodedPayload = parts[1];
  const actualSignature = parts[2];
  const expectedSignature = sign(encodedPayload, secret);
  if (
    expectedSignature.length !== actualSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(actualSignature))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SyncTokenPayload;
    if (!payload?.userId || typeof payload.userId !== "string") return null;
    if (!payload.exp || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
