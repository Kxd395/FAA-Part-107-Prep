import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    clearMagicLinkConsumeStoreForTests,
    consumeMagicLinkToken,
    createMagicLinkToken,
    verifyMagicLinkToken,
    sendMagicLink,
} from "./passwordAuth";

describe("passwordAuth.ts", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await clearMagicLinkConsumeStoreForTests();
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
        const baselineMs = Date.parse("2026-02-25T00:00:00.000Z");
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(baselineMs);
        const token = createMagicLinkToken("test@example.com");
        nowSpy.mockReturnValue(baselineMs + 16 * 60 * 1000); // 16 minutes later, beyond 15-minute TTL

        expect(verifyMagicLinkToken(token)).toBeNull();
        nowSpy.mockRestore();
    });

    it("should fail verification for malformed tokens", () => {
        expect(verifyMagicLinkToken("not-a-token")).toBeNull();
        expect(verifyMagicLinkToken("magic.invalid-payload.signature")).toBeNull();
    });

    it("should only allow consuming a magic-link token once", async () => {
        const token = createMagicLinkToken("test@example.com");
        const firstResult = await consumeMagicLinkToken(token);
        const secondResult = await consumeMagicLinkToken(token);
        expect(firstResult?.email).toBe("test@example.com");
        expect(secondResult).toBeNull();
    });

    it("should emit a structured log when sending in non-production", async () => {
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });

        const result = await sendMagicLink("dev@example.com", "http://localhost:3000");

        expect(result.sent).toBe(true);
        expect(result.devUrl).toBeDefined();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("\"message\":\"Magic link generated in development mode\"")
        );

        consoleSpy.mockRestore();
    });
});
