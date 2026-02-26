import { describe, expect, it } from "vitest";
import { clearRouteMetricsForTests, getRouteMetrics, recordRouteMetric } from "./routeMetrics";

describe("routeMetrics", () => {
  it("tracks counts and duration by route/method", () => {
    clearRouteMetricsForTests();

    recordRouteMetric({
      route: "/api/questions",
      method: "GET",
      status: 200,
      durationMs: 30,
    });
    recordRouteMetric({
      route: "/api/questions",
      method: "GET",
      status: 500,
      durationMs: 70,
    });

    const metrics = getRouteMetrics();
    expect(metrics["GET /api/questions"]).toEqual({
      requests: 2,
      status2xx: 1,
      status3xx: 0,
      status4xx: 0,
      status5xx: 1,
      totalDurationMs: 100,
      averageDurationMs: 50,
      maxDurationMs: 70,
    });
  });
});
