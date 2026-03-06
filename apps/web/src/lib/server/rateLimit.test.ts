import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  clearRateLimitStoreForTests,
  consumeRateLimit,
  getRateLimitStoreSizeForTests,
} from "./rateLimit";

function makeRequest(ip: string): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    headers: {
      "x-forwarded-for": ip,
    },
  });
}

describe("rateLimit", () => {
  afterEach(() => {
    clearRateLimitStoreForTests();
    vi.restoreAllMocks();
  });

  it("blocks after configured capacity for an identity", () => {
    const request = makeRequest("1.2.3.4");
    const config = { key: "api:test", capacity: 2, windowMs: 60_000 };

    const first = consumeRateLimit(request, config);
    const second = consumeRateLimit(request, config);
    const third = consumeRateLimit(request, config);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("prunes expired buckets on subsequent requests", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(0);

    consumeRateLimit(makeRequest("1.1.1.1"), {
      key: "api:test",
      capacity: 1,
      windowMs: 1_000,
    });
    consumeRateLimit(makeRequest("2.2.2.2"), {
      key: "api:test",
      capacity: 1,
      windowMs: 1_000,
    });

    expect(getRateLimitStoreSizeForTests()).toBe(2);

    nowSpy.mockReturnValue(61_000);
    consumeRateLimit(makeRequest("3.3.3.3"), {
      key: "api:test",
      capacity: 1,
      windowMs: 1_000,
    });

    expect(getRateLimitStoreSizeForTests()).toBe(1);
  });

  it("caps bucket growth under high unique-IP cardinality", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(0);
    for (let index = 0; index < 5_500; index += 1) {
      consumeRateLimit(makeRequest(`10.0.0.${index}`), {
        key: "api:test",
        capacity: 1,
        windowMs: 60_000,
      });
    }
    expect(getRateLimitStoreSizeForTests()).toBeLessThanOrEqual(5_000);
    nowSpy.mockRestore();
  });
});
