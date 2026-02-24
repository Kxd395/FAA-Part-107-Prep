import { NextRequest, NextResponse } from "next/server";
import {
    getAuthenticatedUserId,
} from "../../../../lib/server/appAuth";
import { consumeRateLimit, rateLimitHeaders } from "../../../../lib/server/rateLimit";
import { getUserProfileById, updateUserProfile } from "../../../../lib/server/userProfileStore";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function unauthorizedResponse(headers?: Record<string, string>) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
}

export async function GET(request: NextRequest) {
    const rl = consumeRateLimit(request, {
        key: "api:user:profile:get",
        capacity: 120,
        windowMs: 60_000,
    });
    if (!rl.ok) {
        return NextResponse.json(
            { error: "Too many profile requests" },
            { status: 429, headers: rateLimitHeaders(rl) }
        );
    }

    const userId = getAuthenticatedUserId(request);
    if (!userId) {
        return unauthorizedResponse(rateLimitHeaders(rl));
    }

    const profile = await getUserProfileById(userId);
    if (!profile) {
        return NextResponse.json(
            { userId, profile: null },
            { status: 404, headers: rateLimitHeaders(rl) }
        );
    }

    return NextResponse.json(
        {
            userId: profile.id,
            email: profile.email,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
        },
        { headers: rateLimitHeaders(rl) }
    );
}

export async function PATCH(request: NextRequest) {
    const rl = consumeRateLimit(request, {
        key: "api:user:profile:patch",
        capacity: 30,
        windowMs: 60_000,
    });
    if (!rl.ok) {
        return NextResponse.json(
            { error: "Too many profile update requests" },
            { status: 429, headers: rateLimitHeaders(rl) }
        );
    }

    const userId = getAuthenticatedUserId(request);
    if (!userId) {
        return unauthorizedResponse(rateLimitHeaders(rl));
    }

    const body = (await request.json().catch(() => ({}))) as {
        displayName?: string;
        avatarUrl?: string | null;
    };

    const updated = await updateUserProfile(userId, {
        displayName: typeof body.displayName === "string" ? body.displayName : undefined,
        avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : undefined,
    });

    if (!updated) {
        return NextResponse.json(
            { error: "Profile not found" },
            { status: 404, headers: rateLimitHeaders(rl) }
        );
    }

    return NextResponse.json(
        {
            userId: updated.id,
            email: updated.email,
            displayName: updated.displayName,
            avatarUrl: updated.avatarUrl,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
        },
        { headers: rateLimitHeaders(rl) }
    );
}
