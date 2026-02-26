import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { consumeRateLimit, clearRateLimitStoreForTests } from "../../../../lib/server/rateLimit";
import { clearRouteMetricsForTests, recordRouteMetric } from "../../../../lib/server/routeMetrics";
import { GET } from "./route";

describe("GET /api/_internal/rate-limit-metrics", () => {
  const originalMetricsToken = process.env.INTERNAL_METRICS_TOKEN;
  afterEach(() => {
    process.env.INTERNAL_METRICS_TOKEN = originalMetricsToken;
  });

  it("returns in-memory rate limit counters", async () => {
    clearRateLimitStoreForTests();
    clearRouteMetricsForTests();
    const request = new NextRequest("http://localhost/api/questions", {
      headers: { "x-forwarded-for": "metrics-test-ip" },
    });
    consumeRateLimit(request, {
      key: "api:questions",
      capacity: 1,
      windowMs: 60_000,
    });
    consumeRateLimit(request, {
      key: "api:questions",
      capacity: 1,
      windowMs: 60_000,
    });

    recordRouteMetric({
      route: "/api/questions",
      method: "GET",
      status: 200,
      durationMs: 42,
    });

    const response = await GET(new NextRequest("http://localhost/api/_internal/rate-limit-metrics"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.metrics.rateLimit["api:questions"].allowed).toBe(1);
    expect(body.metrics.rateLimit["api:questions"].blocked).toBe(1);
    expect(body.metrics.routes["GET /api/questions"].requests).toBe(1);
    expect(typeof body.requestId).toBe("string");
  });

  it("requires bearer token when INTERNAL_METRICS_TOKEN is configured", async () => {
    process.env.INTERNAL_METRICS_TOKEN = "internal-secret";
    const unauthorized = await GET(
      new NextRequest("http://localhost/api/_internal/rate-limit-metrics")
    );
    expect(unauthorized.status).toBe(401);

    const authorized = await GET(
      new NextRequest("http://localhost/api/_internal/rate-limit-metrics", {
        headers: {
          authorization: "Bearer internal-secret",
        },
      })
    );
    expect(authorized.status).toBe(200);
  });
});
