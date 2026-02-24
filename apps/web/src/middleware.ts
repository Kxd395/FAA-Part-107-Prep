import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The routes that require authentication
const PROTECTED_ROUTES = [
    "/study",
    "/exam",
    "/flashcards",
    "/learn",
    "/missed",
    "/progress",
    "/charts",
    "/profile",
];

// The API routes that require authentication
const PROTECTED_API_ROUTES = [
    "/api/user/",
    "/api/sync/",
];

export function middleware(request: NextRequest) {
    const { pathname, search } = request.nextUrl;

    const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
    const isProtectedApiRoute = PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route));

    if (!isProtectedRoute && !isProtectedApiRoute) {
        return NextResponse.next();
    }

    // Next.js middleware runs on Edge Runtime. node:crypto is not available.
    // We do a simple existence check here. Full verification happens via the AuthProvider
    // on the client and strictly inside the Node-based App Router API routes.
    const token = request.cookies.get("part107_auth")?.value;

    // Not authenticated
    if (!token) {
        if (isProtectedApiRoute) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Redirect to login with returnUrl
        const returnUrl = encodeURIComponent(`${pathname}${search}`);
        const loginUrl = new URL(`/login?returnUrl=${returnUrl}`, request.url);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        // Ignore static files, images, next internals
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
