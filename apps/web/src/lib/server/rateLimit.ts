import type { NextRequest } from "next/server";
import { serverLogger } from "./logger";

interface Bucket {
  tokens: number;
  refillAt: number;
  touchedAt: number;
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
  var __part107RateLimitStore__: Map<string, Bucket> | undefined;
  var __part107RateLimitMetrics__: Map<string, RateMetric> | undefined;
  var __part107RateLimitLastPruneAt__: number | undefined;
}

const MAX_RATE_LIMIT_BUCKETS = 5_000;
const PRUNE_INTERVAL_MS = 60_000;

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
  globalThis.__part107RateLimitLastPruneAt__ = undefined;
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function pruneStore(now: number): void {
  const store = getStore();

  for (const [key, bucket] of store.entries()) {
    if (now >= bucket.refillAt) {
      store.delete(key);
    }
  }

  if (store.size <= MAX_RATE_LIMIT_BUCKETS) return;

  const overflow = store.size - MAX_RATE_LIMIT_BUCKETS;
  const oldestFirst = Array.from(store.entries())
    .sort((left, right) => {
      if (left[1].touchedAt !== right[1].touchedAt) {
        return left[1].touchedAt - right[1].touchedAt;
      }
      return left[1].refillAt - right[1].refillAt;
    })
    .slice(0, overflow);

  for (const [key] of oldestFirst) {
    store.delete(key);
  }
}

function maybePruneStore(now: number): void {
  const lastPruneAt = globalThis.__part107RateLimitLastPruneAt__ ?? 0;
  const shouldPrune =
    now - lastPruneAt >= PRUNE_INTERVAL_MS || getStore().size > MAX_RATE_LIMIT_BUCKETS;
  if (!shouldPrune) return;
  pruneStore(now);
  globalThis.__part107RateLimitLastPruneAt__ = now;
}

export function consumeRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  maybePruneStore(now);
  const store = getStore();
  const identity = `${config.key}:${getClientIp(request)}`;
  const bucket = store.get(identity);

  const metric = getMetricStore().get(config.key) ?? { allowed: 0, blocked: 0 };
  if (!bucket || now >= bucket.refillAt) {
    store.set(identity, {
      tokens: config.capacity - 1,
      refillAt: now + config.windowMs,
      touchedAt: now,
    });
    if (store.size > MAX_RATE_LIMIT_BUCKETS) {
      pruneStore(now);
    }
    metric.allowed += 1;
    getMetricStore().set(config.key, metric);
    return {
      ok: true,
      retryAfterSeconds: Math.ceil(config.windowMs / 1000),
      remaining: Math.max(0, config.capacity - 1),
    };
  }

  if (bucket.tokens <= 0) {
    bucket.touchedAt = now;
    store.set(identity, bucket);
    if (store.size > MAX_RATE_LIMIT_BUCKETS) {
      pruneStore(now);
    }
    metric.blocked += 1;
    getMetricStore().set(config.key, metric);
    if (metric.blocked % 25 === 0) {
      serverLogger.warn("Rate limit threshold reached", {
        key: config.key,
        blocked: metric.blocked,
      });
    }
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.refillAt - now) / 1000)),
      remaining: 0,
    };
  }

  bucket.tokens -= 1;
  bucket.touchedAt = now;
  store.set(identity, bucket);
  if (store.size > MAX_RATE_LIMIT_BUCKETS) {
    pruneStore(now);
  }
  metric.allowed += 1;
  getMetricStore().set(config.key, metric);
  return {
    ok: true,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.refillAt - now) / 1000)),
    remaining: bucket.tokens,
  };
}

export function getRateLimitStoreSizeForTests(): number {
  return getStore().size;
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
