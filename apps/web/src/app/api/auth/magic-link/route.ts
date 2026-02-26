import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";
import { isValidEmail, sendMagicLink } from "../../../../lib/server/passwordAuth";
import { resolveMagicLinkBaseUrl } from "../../../../lib/server/appOrigin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    const rl = consumeRateLimit(request, {
        key: "api:auth:magic-link",
        capacity: 30,
        windowMs: 60_000,
    });
    if (!rl.ok) {
        return NextResponse.json(
            { error: "Too many magic link requests" },
            { status: 429, headers: rateLimitHeaders(rl) }
        );
    }

    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = body.email?.toLowerCase().trim() ?? "";

    if (!isValidEmail(email)) {
        return NextResponse.json(
            { error: "A valid email address is required" },
            { status: 400, headers: rateLimitHeaders(rl) }
        );
    }

    try {
        const baseUrl = resolveMagicLinkBaseUrl(request);
        if (!baseUrl) {
            return NextResponse.json(
                { error: "Magic link origin is not configured" },
                { status: 500, headers: rateLimitHeaders(rl) }
            );
        }

        const result = await sendMagicLink(email, baseUrl);

        return NextResponse.json(
            {
                sent: true,
                ...(result.devUrl && process.env.NODE_ENV !== "production"
                    ? { devUrl: result.devUrl }
                    : {}),
            },
            { headers: rateLimitHeaders(rl) }
        );
    } catch (error) {
        console.error("Magic link send error:", error);
        return NextResponse.json(
            { error: "Failed to send magic link. Please try again." },
            { status: 500, headers: rateLimitHeaders(rl) }
        );
    }
}
