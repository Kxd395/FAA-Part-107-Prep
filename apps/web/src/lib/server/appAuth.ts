import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { requireSecret } from "./requiredSecret";

const AUTH_COOKIE_NAME = "part107_auth";
const AUTH_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface AuthPayload {
  uid: string;
  exp: number;
  email?: string;
  displayName?: string;
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

export function isValidUserId(value: string): boolean {
  return /^[a-zA-Z0-9._-]{3,64}$/.test(value);
}

export function issueAppSessionToken(
  userId: string,
  options?: { ttlSeconds?: number; email?: string; displayName?: string }
): string {
  const ttl = options?.ttlSeconds ?? AUTH_TTL_SECONDS;
  const payload: AuthPayload = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + ttl,
    ...(options?.email ? { email: options.email } : {}),
    ...(options?.displayName ? { displayName: options.displayName } : {}),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(
    encodedPayload,
    requireSecret("APP_AUTH_SECRET", "part107-test-auth-secret")
  );
  return `app.${encodedPayload}.${signature}`;
}

export function verifyAppSessionToken(token: string): AuthPayload | null {
  if (!token.startsWith("app.")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const encodedPayload = parts[1];
  const actualSignature = parts[2];
  const expectedSignature = sign(
    encodedPayload,
    requireSecret("APP_AUTH_SECRET", "part107-test-auth-secret")
  );
  if (
    expectedSignature.length !== actualSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(actualSignature))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AuthPayload;
    if (!payload?.uid || !isValidUserId(payload.uid)) return null;
    if (!payload.exp || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAuthCookieName(): string {
  return AUTH_COOKIE_NAME;
}

export function getAuthTtlSeconds(): number {
  return AUTH_TTL_SECONDS;
}

export function getAuthenticatedUserId(request: NextRequest): string | null {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";
  if (!token) return null;
  const payload = verifyAppSessionToken(token);
  return payload?.uid ?? null;
}

export function getAuthenticatedSession(request: NextRequest): AuthPayload | null {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";
  if (!token) return null;
  return verifyAppSessionToken(token);
}
