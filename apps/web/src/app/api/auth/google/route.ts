import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { startApiRequest } from "../../../../lib/server/apiRequest";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";
import { findOrCreateUserByEmail, updateUserProfile } from "../../../../lib/server/userProfileStore";
import {
    getAuthCookieName,
    getAuthTtlSeconds,
    issueAppSessionToken,
} from "../../../../lib/server/appAuth";
import { serverLogger } from "../../../../lib/server/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tracker = startApiRequest(request, "/api/auth/google");
  const rl = consumeRateLimit(request, {
    key: "api:auth:google",
    capacity: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return tracker.json(
      { error: "Too many sign-in requests", requestId: tracker.requestId },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const configuredAudiences = Array.from(
    new Set(
      [process.env.GOOGLE_CLIENT_ID?.trim(), process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()]
        .filter((value): value is string => Boolean(value))
    )
  );
  if (configuredAudiences.length === 0) {
    return tracker.json(
      { error: "Google sign-in is not configured on this server.", requestId: tracker.requestId },
      { status: 501, headers: rateLimitHeaders(rl) }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { credential?: string };
  const credential = body.credential?.trim() ?? "";

  if (!credential) {
    return tracker.json(
      { error: "Google credential token is required", requestId: tracker.requestId },
      { status: 400, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const googleClient = new OAuth2Client(configuredAudiences[0]);
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: configuredAudiences,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.email_verified) {
      return tracker.json(
        { error: "Invalid Google token or email not verified", requestId: tracker.requestId },
        { status: 401, headers: rateLimitHeaders(rl) }
      );
    }

    const email = payload.email.toLowerCase().trim();
    const name = payload.name;
    const picture = payload.picture;

    const { profile, created } = await findOrCreateUserByEmail(email);

    let displayNameToUse = profile.displayName;
    if (name && (created || profile.displayName === email.split("@")[0])) {
      await updateUserProfile(profile.id, { displayName: name, avatarUrl: picture });
      displayNameToUse = name;
    }

    const sessionToken = issueAppSessionToken(profile.id, {
      email: profile.email,
      displayName: displayNameToUse,
    });

    const response = tracker.json(
      {
        authenticated: true,
        userId: profile.id,
        email: profile.email,
        displayName: displayNameToUse,
        expiresInSeconds: getAuthTtlSeconds(),
      },
      { headers: rateLimitHeaders(rl) }
    );
    return setSessionCookie(response, sessionToken);
  } catch (error) {
    serverLogger.error("Google authentication failure", {
      requestId: tracker.requestId,
      route: "/api/auth/google",
      method: request.method,
      error,
    });
    const rawMessage = error instanceof Error ? error.message : "";
    const audienceMismatch =
      /audience|recipient|wrong recipient|token used too late/i.test(rawMessage);
    const missingAuthSecret = /APP_AUTH_SECRET must be configured/i.test(rawMessage);
    const missingGoogleClientId = /No \"client_id\" configured|client[_ ]?id/i.test(rawMessage);
    const statusCode = missingAuthSecret ? 500 : 401;
    const code = missingAuthSecret
      ? "APP_AUTH_SECRET_MISSING"
      : audienceMismatch
        ? "GOOGLE_AUDIENCE_MISMATCH"
        : missingGoogleClientId
          ? "GOOGLE_CLIENT_ID_MISSING"
          : "GOOGLE_AUTH_FAILED";
    const errorMessage =
      missingAuthSecret
        ? "Server authentication is not configured."
        : process.env.NODE_ENV === "production"
          ? audienceMismatch
            ? "Google sign-in configuration mismatch."
            : "Failed to authenticate with Google"
          : audienceMismatch
          ? "Google token audience mismatch. Ensure NEXT_PUBLIC_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID match, and add this origin to Google OAuth Authorized JavaScript origins."
          : missingGoogleClientId
            ? "Google client ID is missing. Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID."
            : rawMessage
              ? `Failed to authenticate with Google: ${rawMessage}`
              : "Failed to authenticate with Google";

    return tracker.json(
      { error: errorMessage, code, requestId: tracker.requestId },
      { status: statusCode, headers: rateLimitHeaders(rl) }
    );
  }
}

function setSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set({
      name: getAuthCookieName(),
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getAuthTtlSeconds(),
    });
  return response;
}
