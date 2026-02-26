import type { NextRequest } from "next/server";

const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function configuredAppOrigins(): string[] {
  const origins: string[] = [];
  const baseUrl = process.env.APP_BASE_URL?.trim();
  if (baseUrl) {
    const normalized = normalizeOrigin(baseUrl);
    if (normalized) origins.push(normalized);
  }

  const allowlist = process.env.APP_ALLOWED_ORIGINS?.trim();
  if (allowlist) {
    for (const candidate of allowlist.split(",")) {
      const normalized = normalizeOrigin(candidate.trim());
      if (normalized && !origins.includes(normalized)) {
        origins.push(normalized);
      }
    }
  }

  return origins;
}

function resolveLocalDevOrigin(request: NextRequest): string | null {
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || "localhost:3000";
  const origin = normalizeOrigin(`${protocol}://${host}`);
  if (!origin) return null;

  const hostname = new URL(origin).hostname;
  if (!LOCAL_DEV_HOSTS.has(hostname)) return null;
  return origin;
}

export function resolveMagicLinkBaseUrl(request: NextRequest): string | null {
  const configured = configuredAppOrigins();
  if (configured.length > 0) {
    return configured[0];
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return resolveLocalDevOrigin(request);
}
