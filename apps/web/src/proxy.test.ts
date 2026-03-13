import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { proxy } from "./proxy";
import { NextRequest } from "next/server";

const originalBaseUrl = process.env.APP_BASE_URL;
const originalNodeEnv = process.env.NODE_ENV;
const mutableEnv = process.env as Record<string, string | undefined>;

function makeRequest(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
    return new NextRequest(url, init);
}

describe("proxy.ts", () => {
    beforeEach(() => {
        delete mutableEnv.APP_BASE_URL;
        mutableEnv.NODE_ENV = "test";
    });

    afterEach(() => {
        mutableEnv.APP_BASE_URL = originalBaseUrl;
        mutableEnv.NODE_ENV = originalNodeEnv;
    });

    it("should pass through public routes", () => {
        const req = makeRequest("http://localhost:3000/");
        const res = proxy(req);
        // Should return a response that doesn't redirect
        expect(res.headers.get("location")).toBeNull();
    });

    it("should redirect protected routes if no cookie is present", () => {
        const req = makeRequest("http://localhost:3000/study");
        const res = proxy(req);
        expect(res.headers.get("location")).toContain("/login?returnUrl");
    });

    it("should pass through protected routes if part107_auth cookie is present", () => {
        const req = makeRequest("http://localhost:3000/study");
        req.cookies.set("part107_auth", "fake-token");
        const res = proxy(req);
        expect(res.headers.get("location")).toBeNull();
    });

    it("should return 401 for protected API routes if no cookie is present", () => {
        const req = makeRequest("http://localhost:3000/api/user/profile");
        const res = proxy(req);
        expect(res.status).toBe(401);
    });

    it("redirects non-canonical production hosts to APP_BASE_URL before auth flow", () => {
        mutableEnv.NODE_ENV = "production";
        mutableEnv.APP_BASE_URL = "https://faa-part-107-prep.vercel.app";

        const req = makeRequest("https://faa-part-107-prep-git-main-kxd395s-projects.vercel.app/login?returnUrl=%2Fstudy", {
            headers: {
                host: "faa-part-107-prep-git-main-kxd395s-projects.vercel.app",
                "x-forwarded-host": "faa-part-107-prep-git-main-kxd395s-projects.vercel.app",
                "x-forwarded-proto": "https",
            },
        });

        const res = proxy(req);
        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe("https://faa-part-107-prep.vercel.app/login?returnUrl=%2Fstudy");
    });

    it("does not redirect post requests across origins", () => {
        mutableEnv.NODE_ENV = "production";
        mutableEnv.APP_BASE_URL = "https://faa-part-107-prep.vercel.app";

        const req = makeRequest("https://faa-part-107-prep-git-main-kxd395s-projects.vercel.app/api/auth/google", {
            method: "POST",
            headers: {
                host: "faa-part-107-prep-git-main-kxd395s-projects.vercel.app",
                "x-forwarded-host": "faa-part-107-prep-git-main-kxd395s-projects.vercel.app",
                "x-forwarded-proto": "https",
            },
        });

        const res = proxy(req);
        expect(res.headers.get("location")).toBeNull();
    });
});
