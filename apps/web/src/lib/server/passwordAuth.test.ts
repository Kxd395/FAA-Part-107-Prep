import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { createMagicLinkToken, verifyMagicLinkToken, sendMagicLink } from "./passwordAuth";
import * as appAuth from "./appAuth";

// Mock the getAuthSecret logic from appAuth to use a test secret
vi.mock("./appAuth", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./appAuth")>();
    return {
        ...actual,
        getAuthSecret: vi.fn(() => "test-super-secret-key-that-is-long-enough"),
    };
});

describe("passwordAuth.ts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should create and verify a valid magic link token", () => {
        const email = "test@example.com";
        const token = createMagicLinkToken(email);

        expect(token).toBeDefined();
        expect(token.startsWith("magic.")).toBe(true);

        const payload = verifyMagicLinkToken(token);
        expect(payload).toBeDefined();
        expect(payload?.email).toBe(email);
    });

    it("should fail verification for a tampered token", () => {
        const email = "test@example.com";
        const token = createMagicLinkToken(email);

        // Tamper with the payload (middle part of the token)
        const parts = token.split(".");
        const tamperedPayload = Buffer.from(JSON.stringify({ email: "hacker@example.com", exp: 9999999999 })).toString("base64url");
        const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

        const result = verifyMagicLinkToken(tamperedToken);
        expect(result).toBeNull();
    });

    it("should fail verification for an expired token", () => {
        // Generate a token that expired 1 hour ago
        const expiredPayload = Buffer.from(JSON.stringify({
            email: "test@example.com",
            exp: Math.floor(Date.now() / 1000) - 3600
        })).toString("base64url");

        // Quick and dirty manual signing for the test
        const secret = appAuth.getAuthSecret();
        const signature = crypto.createHmac("sha256", secret).update(expiredPayload).digest("base64url");
        const expiredToken = `magic.${expiredPayload}.${signature}`;

        const result = verifyMagicLinkToken(expiredToken);
        expect(result).toBeNull();
    });

    it("should fail verification for malformed tokens", () => {
        expect(verifyMagicLinkToken("not-a-token")).toBeNull();
        expect(verifyMagicLinkToken("magic.invalid-payload.signature")).toBeNull();
    });

    it("should log magic link to console when sending in non-production", async () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        // Ensure we are not in prod for this test
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "development";

        const result = await sendMagicLink("dev@example.com", "http://localhost:3000");

        expect(result.sent).toBe(true);
        expect(result.devUrl).toBeDefined();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Magic Link (dev)"));

        consoleSpy.mockRestore();
        process.env.NODE_ENV = origEnv;
    });
});
