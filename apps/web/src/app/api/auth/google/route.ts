import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";
import { findOrCreateUserByEmail, updateUserProfile } from "../../../../lib/server/userProfileStore";
import {
    getAuthCookieName,
    getAuthTtlSeconds,
    issueAppSessionToken,
} from "../../../../lib/server/appAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    const rl = consumeRateLimit(request, {
        key: "api:auth:google",
        capacity: 30,
        windowMs: 60_000,
    });
    if (!rl.ok) {
        return NextResponse.json(
            { error: "Too many sign-in requests" },
            { status: 429, headers: rateLimitHeaders(rl) }
        );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
        return NextResponse.json(
            { error: "Google sign-in is not configured on this server." },
            { status: 501, headers: rateLimitHeaders(rl) }
        );
    }

    const body = (await request.json().catch(() => ({}))) as { credential?: string };
    const credential = body.credential?.trim() ?? "";

    if (!credential) {
        return NextResponse.json(
            { error: "Google credential token is required" },
            { status: 400, headers: rateLimitHeaders(rl) }
        );
    }

    try {
        const googleClient = new OAuth2Client(clientId);
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: clientId,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email || !payload.email_verified) {
            return NextResponse.json(
                { error: "Invalid Google token or email not verified" },
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

        const response = NextResponse.json(
            {
                authenticated: true,
                userId: profile.id,
                email: profile.email,
                displayName: displayNameToUse,
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
        console.error("Google Auth Error:", error);
        return NextResponse.json(
            { error: "Failed to authenticate with Google" },
            { status: 401, headers: rateLimitHeaders(rl) }
        );
    }
}
