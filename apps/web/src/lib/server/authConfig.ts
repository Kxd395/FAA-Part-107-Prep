export interface AuthConfigIssue {
  code: string;
  severity: "error" | "warn";
  message: string;
  fields: string[];
}

export interface AuthConfigReport {
  ok: boolean;
  strict: boolean;
  checks: AuthConfigIssue[];
}

export interface AuthConfigCheckOptions {
  strict?: boolean;
  assumeProduction?: boolean;
}

type EnvShape = Record<string, string | undefined>;

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isProduction(env: EnvShape, assumeProduction = false): boolean {
  if (assumeProduction) return true;
  return (env.NODE_ENV ?? "").trim() === "production";
}

export function inspectAuthConfig(
  env: EnvShape = process.env,
  options: AuthConfigCheckOptions = {}
): AuthConfigReport {
  const strict = options.strict ?? true;
  const checks: AuthConfigIssue[] = [];
  const prod = isProduction(env, options.assumeProduction);

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
      fields: ["APP_AUTH_SECRET"],
    });
  }

  if (!hasValue(magicLinkSecret)) {
    checks.push({
      code: "MAGIC_LINK_SECRET_MISSING",
      severity: "error",
      message: "MAGIC_LINK_SECRET is required for magic-link token signing.",
      fields: ["MAGIC_LINK_SECRET"],
    });
  }

  if ((hasValue(googleClientId) || hasValue(publicGoogleClientId)) && googleClientId !== publicGoogleClientId) {
    checks.push({
      code: "GOOGLE_CLIENT_ID_MISMATCH",
      severity: "error",
      message: "GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_CLIENT_ID must match exactly.",
      fields: ["GOOGLE_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_CLIENT_ID"],
    });
  }

  if (prod && !hasValue(appBaseUrl) && !hasValue(appAllowedOrigins)) {
    checks.push({
      code: "APP_ORIGIN_MISSING",
      severity: strict ? "error" : "warn",
      message: "APP_BASE_URL or APP_ALLOWED_ORIGINS is required in production.",
      fields: ["APP_BASE_URL", "APP_ALLOWED_ORIGINS"],
    });
  }

  if (prod && !hasValue(googleClientId) && !hasValue(publicGoogleClientId) && !hasValue(resendApiKey)) {
    checks.push({
      code: "AUTH_PROVIDER_NOT_CONFIGURED",
      severity: "warn",
      message:
        "No production auth delivery configured. Set Google client IDs and/or RESEND_API_KEY for magic-link email delivery.",
      fields: ["GOOGLE_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_CLIENT_ID", "RESEND_API_KEY"],
    });
  }

  const hasErrors = checks.some((check) => check.severity === "error");
  const hasStrictWarnings = strict && checks.some((check) => check.severity === "warn");
  return {
    ok: !hasErrors && !hasStrictWarnings,
    strict,
    checks,
  };
}
