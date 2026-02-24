import { NextRequest, NextResponse } from "next/server";
import {
    getAuthCookieName,
    getAuthTtlSeconds,
    issueAppSessionToken,
} from "../../../../lib/server/appAuth";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";
import { verifyMagicLinkToken } from "../../../../lib/server/passwordAuth";
import { findOrCreateUserByEmail } from "../../../../lib/server/userProfileStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    const rl = consumeRateLimit(request, {
        key: "api:auth:verify",
        capacity: 30,
        windowMs: 60_000,
    });
    if (!rl.ok) {
        return NextResponse.json(
            { error: "Too many verification requests" },
            { status: 429, headers: rateLimitHeaders(rl) }
        );
    }

    const body = (await request.json().catch(() => ({}))) as { token?: string };
    const token = body.token?.trim() ?? "";

    if (!token) {
        return NextResponse.json(
            { error: "Token is required" },
            { status: 400, headers: rateLimitHeaders(rl) }
        );
    }

    const result = verifyMagicLinkToken(token);
    if (!result) {
        return NextResponse.json(
            { error: "Invalid or expired magic link. Please request a new one." },
            { status: 401, headers: rateLimitHeaders(rl) }
        );
    }

    const { profile } = await findOrCreateUserByEmail(result.email);
    const sessionToken = issueAppSessionToken(profile.id, {
        email: profile.email,
        displayName: profile.displayName,
    });

    const response = NextResponse.json(
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
}
