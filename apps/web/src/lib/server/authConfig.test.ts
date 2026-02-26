import { describe, expect, it } from "vitest";
import { inspectAuthConfig } from "./authConfig";

describe("inspectAuthConfig", () => {
  it("passes with complete production config", () => {
    const report = inspectAuthConfig(
      {
        NODE_ENV: "production",
        APP_AUTH_SECRET: "secret",
        MAGIC_LINK_SECRET: "magic",
        APP_BASE_URL: "https://example.com",
        GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
      },
      { strict: true }
    );

    expect(report.ok).toBe(true);
    expect(report.checks).toHaveLength(0);
  });

  it("fails on missing required secrets", () => {
    const report = inspectAuthConfig(
      {
        NODE_ENV: "production",
      },
      { strict: true }
    );

    expect(report.ok).toBe(false);
    const codes = report.checks.map((check) => check.code);
    expect(codes).toContain("APP_AUTH_SECRET_MISSING");
    expect(codes).toContain("MAGIC_LINK_SECRET_MISSING");
    expect(codes).toContain("APP_ORIGIN_MISSING");
  });

  it("flags mismatched google client IDs", () => {
    const report = inspectAuthConfig(
      {
        NODE_ENV: "production",
        APP_AUTH_SECRET: "secret",
        MAGIC_LINK_SECRET: "magic",
        APP_BASE_URL: "https://example.com",
        GOOGLE_CLIENT_ID: "server.apps.googleusercontent.com",
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: "browser.apps.googleusercontent.com",
      },
      { strict: true }
    );

    expect(report.ok).toBe(false);
    expect(report.checks.some((check) => check.code === "GOOGLE_CLIENT_ID_MISMATCH")).toBe(true);
  });
});
