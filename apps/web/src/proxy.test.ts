import { describe, it, expect } from "vitest";
import { proxy } from "./proxy";
import { NextRequest } from "next/server";

describe("proxy.ts", () => {
    it("should pass through public routes", () => {
        const req = new NextRequest("http://localhost:3000/");
        const res = proxy(req);
        // Should return a response that doesn't redirect
        expect(res.headers.get("location")).toBeNull();
    });

    it("should redirect protected routes if no cookie is present", () => {
        const req = new NextRequest("http://localhost:3000/study");
        const res = proxy(req);
        expect(res.headers.get("location")).toContain("/login?returnUrl");
    });

    it("should pass through protected routes if part107_auth cookie is present", () => {
        const req = new NextRequest("http://localhost:3000/study");
        req.cookies.set("part107_auth", "fake-token");
        const res = proxy(req);
        expect(res.headers.get("location")).toBeNull();
    });

    it("should return 401 for protected API routes if no cookie is present", () => {
        const req = new NextRequest("http://localhost:3000/api/user/profile");
        const res = proxy(req);
        expect(res.status).toBe(401);
    });
});
