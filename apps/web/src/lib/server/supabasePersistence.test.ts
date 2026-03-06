import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getSupabasePersistenceContext,
  resetSupabasePersistenceCacheForTests,
} from "./supabasePersistence";

const ORIGINAL_ENV = { ...process.env };

function clearSupabaseEnv(): void {
  delete process.env.SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  delete process.env.SUPABASE_PERSISTENCE_ENABLED;
  delete process.env.SUPABASE_ALLOW_PUBLISHABLE_FALLBACK;
  delete process.env.SUPABASE_TABLE_MAGIC_LINK_NONCES;
}

describe("supabasePersistence", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    clearSupabaseEnv();
    resetSupabasePersistenceCacheForTests();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    resetSupabasePersistenceCacheForTests();
  });

  it("stays disabled in test mode", () => {
    Object.assign(process.env, {
      NODE_ENV: "test",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    });
    const context = getSupabasePersistenceContext();
    expect(context).toBeNull();
  });

  it("resolves context with service role key outside test mode", () => {
    Object.assign(process.env, {
      NODE_ENV: "development",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    });

    const context = getSupabasePersistenceContext();
    expect(context).not.toBeNull();
    expect(context?.config.keyKind).toBe("service_role");
    expect(context?.config.tables.userState).toBe("part107_user_state");
    expect(context?.config.tables.magicLinkNonces).toBe("part107_magic_link_nonces");
  });

  it("respects the explicit disable flag", () => {
    Object.assign(process.env, {
      NODE_ENV: "development",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      SUPABASE_PERSISTENCE_ENABLED: "false",
    });

    const context = getSupabasePersistenceContext();
    expect(context).toBeNull();
  });

  it("does not use publishable key unless fallback is explicitly enabled", () => {
    Object.assign(process.env, {
      NODE_ENV: "development",
      SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: "publishable-key",
    });

    const context = getSupabasePersistenceContext();
    expect(context).toBeNull();
  });

  it("can use publishable key when fallback is explicitly enabled", () => {
    Object.assign(process.env, {
      NODE_ENV: "development",
      SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: "publishable-key",
      SUPABASE_ALLOW_PUBLISHABLE_FALLBACK: "true",
    });

    const context = getSupabasePersistenceContext();
    expect(context).not.toBeNull();
    expect(context?.config.keyKind).toBe("publishable");
  });
});
