export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;

function createFallbackRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeRequestId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!REQUEST_ID_PATTERN.test(normalized)) return null;
  return normalized;
}

export function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return createFallbackRequestId();
}

export function getOrCreateRequestId(headersLike: { get(name: string): string | null }): string {
  const existing =
    normalizeRequestId(headersLike.get(REQUEST_ID_HEADER)) ??
    normalizeRequestId(headersLike.get("x-correlation-id"));
  if (existing) return existing;
  return generateRequestId();
}
