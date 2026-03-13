import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveCanonicalAppOrigin, resolveRequestOrigin } from "./lib/server/appOrigin";
import { REQUEST_ID_HEADER, getOrCreateRequestId } from "./lib/server/requestId";

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

export function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    const requestId = getOrCreateRequestId(request.headers);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(REQUEST_ID_HEADER, requestId);

    const canonicalOrigin = resolveCanonicalAppOrigin();
    const requestOrigin = resolveRequestOrigin(request);
    const shouldCanonicalize =
        process.env.NODE_ENV === "production" &&
        canonicalOrigin &&
        requestOrigin &&
        canonicalOrigin !== requestOrigin &&
        (request.method === "GET" || request.method === "HEAD");

    if (shouldCanonicalize) {
        const redirectUrl = new URL(`${pathname}${search}`, canonicalOrigin);
        const response = NextResponse.redirect(redirectUrl, 307);
        response.headers.set(REQUEST_ID_HEADER, requestId);
        return response;
    }

    const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
    const isProtectedApiRoute = PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route));

    if (!isProtectedRoute && !isProtectedApiRoute) {
        const response = NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
        response.headers.set(REQUEST_ID_HEADER, requestId);
        return response;
    }

    // Next.js middleware runs on Edge Runtime. node:crypto is not available.
    // We do a simple existence check here. Full verification happens via the AuthProvider
    // on the client and strictly inside the Node-based App Router API routes.
    const token = request.cookies.get("part107_auth")?.value;

    // Not authenticated
    if (!token) {
        if (isProtectedApiRoute) {
            const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            response.headers.set(REQUEST_ID_HEADER, requestId);
            return response;
        }

        // Redirect to login with returnUrl
        const returnUrl = encodeURIComponent(`${pathname}${search}`);
        const loginUrl = new URL(`/login?returnUrl=${returnUrl}`, request.url);
        const response = NextResponse.redirect(loginUrl);
        response.headers.set(REQUEST_ID_HEADER, requestId);
        return response;
    }

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
}

export const config = {
    matcher: [
        // Ignore static files, images, next internals
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
