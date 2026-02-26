import { afterEach, describe, expect, it, vi } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;
const originalAppAuthSecret = process.env.APP_AUTH_SECRET;
const mutableEnv = process.env as Record<string, string | undefined>;

async function importFreshAppAuth() {
  vi.resetModules();
  return import("./appAuth");
}

describe("appAuth secret requirements", () => {
  afterEach(() => {
    mutableEnv.NODE_ENV = originalNodeEnv;
    mutableEnv.APP_AUTH_SECRET = originalAppAuthSecret;
  });

  it("throws in non-test env when APP_AUTH_SECRET is missing", async () => {
    mutableEnv.NODE_ENV = "production";
    delete mutableEnv.APP_AUTH_SECRET;
    const mod = await importFreshAppAuth();
    expect(() => mod.issueAppSessionToken("pilot-01")).toThrow(/APP_AUTH_SECRET/);
  });

  it("allows import in test env without APP_AUTH_SECRET", async () => {
    mutableEnv.NODE_ENV = "test";
    delete mutableEnv.APP_AUTH_SECRET;
    const mod = await importFreshAppAuth();
    expect(typeof mod.issueAppSessionToken).toBe("function");
  });

  it("uses configured APP_AUTH_SECRET in non-test env", async () => {
    mutableEnv.NODE_ENV = "production";
    mutableEnv.APP_AUTH_SECRET = "prod-auth-secret";
    const mod = await importFreshAppAuth();
    const token = mod.issueAppSessionToken("pilot-01");
    expect(mod.verifyAppSessionToken(token)?.uid).toBe("pilot-01");
  });
});
