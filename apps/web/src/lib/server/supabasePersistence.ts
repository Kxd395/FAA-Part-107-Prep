import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverLogger } from "./logger";

export interface SupabaseTablesConfig {
  userState: string;
  learningEvents: string;
  questionIssues: string;
}

export interface SupabasePersistenceConfig {
  url: string;
  key: string;
  keyKind: "service_role" | "publishable";
  tables: SupabaseTablesConfig;
}

export interface SupabasePersistenceContext {
  client: SupabaseClient;
  config: SupabasePersistenceConfig;
}

declare global {
  var __part107SupabaseClient__: SupabaseClient | null | undefined;
  var __part107SupabaseConfig__: SupabasePersistenceConfig | null | undefined;
  var __part107SupabaseWarnedMissing__: boolean | undefined;
  var __part107SupabaseWarnedPublishableFallback__: boolean | undefined;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function shouldDisablePersistence(): boolean {
  if (process.env.NODE_ENV === "test") return true;
  const enabled = readEnv("SUPABASE_PERSISTENCE_ENABLED");
  if (enabled === "0" || enabled?.toLowerCase() === "false") return true;
  return false;
}

function allowPublishableFallback(): boolean {
  const value = readEnv("SUPABASE_ALLOW_PUBLISHABLE_FALLBACK");
  return value?.toLowerCase() === "true" || value === "1";
}

function hasAnySupabaseEnvHint(): boolean {
  const hints = [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
  ];
  return hints.some((name) => readEnv(name));
}

function resolveConfig(): SupabasePersistenceConfig | null {
  if (shouldDisablePersistence()) return null;

  const url = readEnv("SUPABASE_URL") ?? readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey =
    readEnv("SUPABASE_ANON_KEY") ??
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY");
  const allowPublishable = allowPublishableFallback();
  const key = serviceRoleKey ?? (allowPublishable ? publishableKey : undefined);

  if (!url || !key) {
    if (!globalThis.__part107SupabaseWarnedMissing__ && hasAnySupabaseEnvHint()) {
      serverLogger.warn("Supabase persistence disabled due to missing URL or key", {
        hasUrl: Boolean(url),
        hasServiceRoleKey: Boolean(serviceRoleKey),
        hasPublishableKey: Boolean(publishableKey),
        allowPublishableFallback: allowPublishable,
      });
      globalThis.__part107SupabaseWarnedMissing__ = true;
    }
    return null;
  }

  return {
    url,
    key,
    keyKind: serviceRoleKey ? "service_role" : "publishable",
    tables: {
      userState: readEnv("SUPABASE_TABLE_USER_STATE") ?? "part107_user_state",
      learningEvents:
        readEnv("SUPABASE_TABLE_LEARNING_EVENTS") ?? "part107_learning_events",
      questionIssues:
        readEnv("SUPABASE_TABLE_QUESTION_ISSUES") ?? "part107_question_issues",
    },
  };
}

function getConfig(): SupabasePersistenceConfig | null {
  if (globalThis.__part107SupabaseConfig__ !== undefined) {
    return globalThis.__part107SupabaseConfig__;
  }
  const config = resolveConfig();
  globalThis.__part107SupabaseConfig__ = config;
  return config;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

export function getSupabasePersistenceContext(): SupabasePersistenceContext | null {
  const config = getConfig();
  if (!config) return null;

  if (
    config.keyKind === "publishable" &&
    !globalThis.__part107SupabaseWarnedPublishableFallback__
  ) {
    serverLogger.warn(
      "Using publishable Supabase key for server persistence; prefer SUPABASE_SERVICE_ROLE_KEY.",
      { urlHost: safeHost(config.url) }
    );
    globalThis.__part107SupabaseWarnedPublishableFallback__ = true;
  }

  if (!globalThis.__part107SupabaseClient__) {
    const storageKey = `part107-server-${process.pid}-${Date.now().toString(36)}`;
    globalThis.__part107SupabaseClient__ = createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey,
      },
    });
  }

  return {
    client: globalThis.__part107SupabaseClient__,
    config,
  };
}

export function resetSupabasePersistenceCacheForTests(): void {
  globalThis.__part107SupabaseConfig__ = undefined;
  globalThis.__part107SupabaseClient__ = undefined;
  globalThis.__part107SupabaseWarnedMissing__ = undefined;
  globalThis.__part107SupabaseWarnedPublishableFallback__ = undefined;
}
