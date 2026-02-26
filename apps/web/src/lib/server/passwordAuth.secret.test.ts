import { afterEach, describe, expect, it, vi } from "vitest";

const originalNodeEnv = process.env.NODE_ENV;
const originalMagicSecret = process.env.MAGIC_LINK_SECRET;

async function importFreshPasswordAuth() {
  vi.resetModules();
  return import("./passwordAuth");
}

describe("passwordAuth secret requirements", () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.MAGIC_LINK_SECRET = originalMagicSecret;
  });

  it("throws in non-test env when MAGIC_LINK_SECRET is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.MAGIC_LINK_SECRET;
    const mod = await importFreshPasswordAuth();
    expect(() => mod.createMagicLinkToken("pilot@example.com")).toThrow(/MAGIC_LINK_SECRET/);
  });

  it("allows import in test env without MAGIC_LINK_SECRET", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.MAGIC_LINK_SECRET;
    const mod = await importFreshPasswordAuth();
    expect(typeof mod.createMagicLinkToken).toBe("function");
  });

  it("uses configured MAGIC_LINK_SECRET in non-test env", async () => {
    process.env.NODE_ENV = "production";
    process.env.MAGIC_LINK_SECRET = "prod-magic-secret";
    const mod = await importFreshPasswordAuth();
    const token = mod.createMagicLinkToken("pilot@example.com");
    expect(mod.verifyMagicLinkToken(token)?.email).toBe("pilot@example.com");
  });
});
