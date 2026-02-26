import { NextRequest, NextResponse } from "next/server";
import { startApiRequest } from "../../../../lib/server/apiRequest";
import {
    getAuthCookieName,
    getAuthTtlSeconds,
    issueAppSessionToken,
} from "../../../../lib/server/appAuth";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";
import { consumeMagicLinkToken } from "../../../../lib/server/passwordAuth";
import { findOrCreateUserByEmail } from "../../../../lib/server/userProfileStore";
import { serverLogger } from "../../../../lib/server/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    const tracker = startApiRequest(request, "/api/auth/verify");
    const rl = consumeRateLimit(request, {
        key: "api:auth:verify",
        capacity: 30,
        windowMs: 60_000,
    });
    if (!rl.ok) {
        return tracker.json(
            { error: "Too many verification requests", requestId: tracker.requestId },
            { status: 429, headers: rateLimitHeaders(rl) }
        );
    }

    const body = (await request.json().catch(() => ({}))) as { token?: string };
    const token = body.token?.trim() ?? "";

    if (!token) {
        return tracker.json(
            { error: "Token is required", requestId: tracker.requestId },
            { status: 400, headers: rateLimitHeaders(rl) }
        );
    }

    try {
        const result = await consumeMagicLinkToken(token);
        if (!result) {
            return tracker.json(
                { error: "Invalid or expired magic link. Please request a new one.", requestId: tracker.requestId },
                { status: 401, headers: rateLimitHeaders(rl) }
            );
        }

        const { profile } = await findOrCreateUserByEmail(result.email);
        const sessionToken = issueAppSessionToken(profile.id, {
            email: profile.email,
            displayName: profile.displayName,
        });

        const response = tracker.json(
            {
                authenticated: true,
                userId: profile.id,
                email: profile.email,
                displayName: profile.displayName,
                expiresInSeconds: getAuthTtlSeconds(),
            },
            { headers: rateLimitHeaders(rl) }
        );

        response.cookies.set({
            name: getAuthCookieName(),
            value: sessionToken,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: getAuthTtlSeconds(),
        });

        return response;
    } catch (error) {
        serverLogger.error("Magic link verification failure", {
            requestId: tracker.requestId,
            route: "/api/auth/verify",
            method: request.method,
            error,
        });
        return tracker.json(
            { error: "Failed to verify magic link.", requestId: tracker.requestId },
            { status: 500, headers: rateLimitHeaders(rl) }
        );
    }
}
