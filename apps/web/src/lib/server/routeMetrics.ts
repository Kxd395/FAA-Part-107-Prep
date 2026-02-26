export interface RouteMetric {
  requests: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  totalDurationMs: number;
  averageDurationMs: number;
  maxDurationMs: number;
}

type MutableRouteMetric = Omit<RouteMetric, "averageDurationMs">;

declare global {
  var __part107RouteMetrics__: Map<string, MutableRouteMetric> | undefined;
}

function getMetricStore(): Map<string, MutableRouteMetric> {
  if (!globalThis.__part107RouteMetrics__) {
    globalThis.__part107RouteMetrics__ = new Map();
  }
  return globalThis.__part107RouteMetrics__;
}

function statusField(status: number): keyof Pick<
  MutableRouteMetric,
  "status2xx" | "status3xx" | "status4xx" | "status5xx"
> {
  if (status >= 500) return "status5xx";
  if (status >= 400) return "status4xx";
  if (status >= 300) return "status3xx";
  return "status2xx";
}

export function recordRouteMetric(input: {
  route: string;
  method: string;
  status: number;
  durationMs: number;
}): void {
  const key = `${input.method.toUpperCase()} ${input.route}`;
  const store = getMetricStore();
  const existing = store.get(key) ?? {
    requests: 0,
    status2xx: 0,
    status3xx: 0,
    status4xx: 0,
    status5xx: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
  };

  existing.requests += 1;
  existing.totalDurationMs += Math.max(0, Math.round(input.durationMs));
  existing.maxDurationMs = Math.max(existing.maxDurationMs, Math.max(0, Math.round(input.durationMs)));
  existing[statusField(input.status)] += 1;
  store.set(key, existing);
}

export function getRouteMetrics(): Record<string, RouteMetric> {
  const entries = Array.from(getMetricStore().entries()).map(([key, metric]) => [
    key,
    {
      ...metric,
      averageDurationMs:
        metric.requests > 0 ? Number((metric.totalDurationMs / metric.requests).toFixed(2)) : 0,
    },
  ]);
  return Object.fromEntries(entries);
}

export function clearRouteMetricsForTests(): void {
  getMetricStore().clear();
}
