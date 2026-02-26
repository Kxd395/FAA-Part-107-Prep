import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveMagicLinkBaseUrl } from "./appOrigin";

const originalBaseUrl = process.env.APP_BASE_URL;
const originalAllowedOrigins = process.env.APP_ALLOWED_ORIGINS;
const originalNodeEnv = process.env.NODE_ENV;
const mutableEnv = process.env as Record<string, string | undefined>;

function makeRequest(headers: Record<string, string>) {
  return new NextRequest("http://localhost/api/auth/magic-link", { headers });
}

describe("resolveMagicLinkBaseUrl", () => {
  beforeEach(() => {
    delete mutableEnv.APP_BASE_URL;
    delete mutableEnv.APP_ALLOWED_ORIGINS;
    mutableEnv.NODE_ENV = "test";
  });

  afterEach(() => {
    mutableEnv.APP_BASE_URL = originalBaseUrl;
    mutableEnv.APP_ALLOWED_ORIGINS = originalAllowedOrigins;
    mutableEnv.NODE_ENV = originalNodeEnv;
  });

  it("prefers APP_BASE_URL when configured", () => {
    mutableEnv.APP_BASE_URL = "https://app.example.com/path";
    const origin = resolveMagicLinkBaseUrl(makeRequest({ host: "localhost:3000" }));
    expect(origin).toBe("https://app.example.com");
  });

  it("uses allowlist first entry when APP_BASE_URL is missing", () => {
    mutableEnv.APP_ALLOWED_ORIGINS = "https://first.example.com,https://second.example.com";
    const origin = resolveMagicLinkBaseUrl(makeRequest({ host: "localhost:3000" }));
    expect(origin).toBe("https://first.example.com");
  });

  it("allows localhost fallback outside production when no config exists", () => {
    const origin = resolveMagicLinkBaseUrl(
      makeRequest({ host: "localhost:3000", "x-forwarded-proto": "http" })
    );
    expect(origin).toBe("http://localhost:3000");
  });

  it("rejects non-local header-derived hosts when no config exists", () => {
    const origin = resolveMagicLinkBaseUrl(
      makeRequest({ host: "evil.example.com", "x-forwarded-proto": "https" })
    );
    expect(origin).toBeNull();
  });
});
