#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function checkAuthConfig(env, options) {
  const checks = [];
  const strict = options.strict;
  const production = options.production;

  const appAuthSecret = env.APP_AUTH_SECRET?.trim();
  const magicLinkSecret = env.MAGIC_LINK_SECRET?.trim();
  const appBaseUrl = env.APP_BASE_URL?.trim();
  const appAllowedOrigins = env.APP_ALLOWED_ORIGINS?.trim();
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim();
  const publicGoogleClientId = env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const resendApiKey = env.RESEND_API_KEY?.trim();

  if (!hasValue(appAuthSecret)) {
    checks.push({
      code: "APP_AUTH_SECRET_MISSING",
      severity: "error",
      message: "APP_AUTH_SECRET is required for session signing.",
    });
  }

  if (!hasValue(magicLinkSecret)) {
    checks.push({
      code: "MAGIC_LINK_SECRET_MISSING",
      severity: "error",
      message: "MAGIC_LINK_SECRET is required for magic-link token signing.",
    });
  }

  if ((hasValue(googleClientId) || hasValue(publicGoogleClientId)) && googleClientId !== publicGoogleClientId) {
    checks.push({
      code: "GOOGLE_CLIENT_ID_MISMATCH",
      severity: "error",
      message: "GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_CLIENT_ID must match exactly.",
    });
  }

  if (production && !hasValue(appBaseUrl) && !hasValue(appAllowedOrigins)) {
    checks.push({
      code: "APP_ORIGIN_MISSING",
      severity: strict ? "error" : "warn",
      message: "APP_BASE_URL or APP_ALLOWED_ORIGINS is required in production.",
    });
  }

  if (production && !hasValue(googleClientId) && !hasValue(publicGoogleClientId) && !hasValue(resendApiKey)) {
    checks.push({
      code: "AUTH_PROVIDER_NOT_CONFIGURED",
      severity: "warn",
      message:
        "No production auth delivery configured. Set Google client IDs and/or RESEND_API_KEY.",
    });
  }

  const hasErrors = checks.some((check) => check.severity === "error");
  const hasStrictWarnings = strict && checks.some((check) => check.severity === "warn");

  return {
    ok: !hasErrors && !hasStrictWarnings,
    checks,
  };
}

function parseArgFlag(name) {
  return process.argv.includes(name);
}

function parseEnvFile(filePath) {
  const result = {};
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) continue;
    const key = trimmed.slice(0, equalIndex).trim();
    if (!key) continue;
    let value = trimmed.slice(equalIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function loadLocalEnvFallbacks() {
  const cwd = process.cwd();
  const candidates = [".env.local", ".env"].map((name) => path.join(cwd, name));
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const parsed = parseEnvFile(candidate);
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

loadLocalEnvFallbacks();

const strictFromEnv = String(process.env.AUTH_CHECK_STRICT ?? "").toLowerCase();
const strict = parseArgFlag("--strict") || strictFromEnv === "1" || strictFromEnv === "true";
const production =
  parseArgFlag("--production") || String(process.env.NODE_ENV).toLowerCase() === "production";

const report = checkAuthConfig(process.env, { strict, production });

if (report.checks.length === 0) {
  console.log("Auth config check passed: no issues detected.");
} else {
  for (const check of report.checks) {
    const prefix = check.severity === "error" ? "ERROR" : "WARN";
    console.log(`${prefix} [${check.code}] ${check.message}`);
  }
}

if (!report.ok) {
  console.error("Auth config check failed.");
  process.exit(1);
}

console.log("Auth config check passed.");
