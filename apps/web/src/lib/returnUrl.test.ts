import { describe, expect, it } from "vitest";
import { sanitizeReturnUrl } from "./returnUrl";

describe("sanitizeReturnUrl", () => {
  it("accepts same-origin relative paths", () => {
    expect(sanitizeReturnUrl("/progress")).toBe("/progress");
    expect(sanitizeReturnUrl("/exam?mode=mock")).toBe("/exam?mode=mock");
    expect(sanitizeReturnUrl("/study#focus")).toBe("/study#focus");
  });

  it("falls back to root for absolute or protocol-relative URLs", () => {
    expect(sanitizeReturnUrl("https://evil.example/phish")).toBe("/");
    expect(sanitizeReturnUrl("//evil.example/phish")).toBe("/");
  });

  it("falls back to root for empty or invalid values", () => {
    expect(sanitizeReturnUrl(null)).toBe("/");
    expect(sanitizeReturnUrl("")).toBe("/");
    expect(sanitizeReturnUrl("javascript:alert(1)")).toBe("/");
  });
});
