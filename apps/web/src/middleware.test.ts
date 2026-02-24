import { describe, it, expect } from "vitest";
import { middleware } from "./middleware";
import { NextRequest } from "next/server";

describe("middleware.ts", () => {
    it("should pass through public routes", () => {
        const req = new NextRequest("http://localhost:3000/");
        const res = middleware(req);
        // Should return a response that doesn't redirect
        expect(res.headers.get("location")).toBeNull();
    });

    it("should redirect protected routes if no cookie is present", () => {
        const req = new NextRequest("http://localhost:3000/study");
        const res = middleware(req);
        expect(res.headers.get("location")).toContain("/login?returnUrl");
    });

    it("should pass through protected routes if part107_auth cookie is present", () => {
        const req = new NextRequest("http://localhost:3000/study");
        req.cookies.set("part107_auth", "fake-token");
        const res = middleware(req);
        expect(res.headers.get("location")).toBeNull();
    });

    it("should return 401 for protected API routes if no cookie is present", () => {
        const req = new NextRequest("http://localhost:3000/api/user/profile");
        const res = middleware(req);
        expect(res.status).toBe(401);
    });
});
