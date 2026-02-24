import type { NextRequest } from "next/server";

interface Bucket {
  tokens: number;
  refillAt: number;
}

interface RateMetric {
  allowed: number;
  blocked: number;
}

interface RateLimitConfig {
  key: string;
  capacity: number;
  windowMs: number;
}

interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __part107RateLimitStore__: Map<string, Bucket> | undefined;
  // eslint-disable-next-line no-var
  var __part107RateLimitMetrics__: Map<string, RateMetric> | undefined;
}

function getStore(): Map<string, Bucket> {
  if (!globalThis.__part107RateLimitStore__) {
    globalThis.__part107RateLimitStore__ = new Map();
  }
  return globalThis.__part107RateLimitStore__;
}

function getMetricStore(): Map<string, RateMetric> {
  if (!globalThis.__part107RateLimitMetrics__) {
    globalThis.__part107RateLimitMetrics__ = new Map();
  }
  return globalThis.__part107RateLimitMetrics__;
}

export function clearRateLimitStoreForTests(): void {
  getStore().clear();
  getMetricStore().clear();
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function consumeRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  const identity = `${config.key}:${getClientIp(request)}`;
  const bucket = store.get(identity);

  const metric = getMetricStore().get(config.key) ?? { allowed: 0, blocked: 0 };
  if (!bucket || now >= bucket.refillAt) {
    store.set(identity, {
      tokens: config.capacity - 1,
      refillAt: now + config.windowMs,
    });
    metric.allowed += 1;
    getMetricStore().set(config.key, metric);
    return {
      ok: true,
      retryAfterSeconds: Math.ceil(config.windowMs / 1000),
      remaining: Math.max(0, config.capacity - 1),
    };
  }

  if (bucket.tokens <= 0) {
    metric.blocked += 1;
    getMetricStore().set(config.key, metric);
    if (metric.blocked % 25 === 0) {
      // Alert-like local signal for operational visibility.
      console.warn(`[rate-limit] key=${config.key} blocked=${metric.blocked}`);
    }
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.refillAt - now) / 1000)),
      remaining: 0,
    };
  }

  bucket.tokens -= 1;
  store.set(identity, bucket);
  metric.allowed += 1;
  getMetricStore().set(config.key, metric);
  return {
    ok: true,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.refillAt - now) / 1000)),
    remaining: bucket.tokens,
  };
}

export function getRateLimitMetrics(): Record<string, RateMetric> {
  return Object.fromEntries(getMetricStore().entries());
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "Retry-After": String(Math.max(1, result.retryAfterSeconds)),
  };
}
