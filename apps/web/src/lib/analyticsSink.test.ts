import { afterEach, describe, expect, it, vi } from "vitest";
import type { LearningEvent } from "./learningEventStore";
import {
  clearDeadLetterEventsForTests,
  sanitizeLearningEventForSink,
} from "./analyticsSink";

describe("analyticsSink", () => {
  afterEach(() => {
    clearDeadLetterEventsForTests();
    delete process.env.NEXT_PUBLIC_ANALYTICS_SINK_ENABLED;
    delete process.env.NEXT_PUBLIC_ANALYTICS_SINK_URL;
    delete process.env.NEXT_PUBLIC_ANALYTICS_SINK_TOKEN;
    vi.restoreAllMocks();
  });

  it("keeps only allowlisted metadata keys", () => {
    const event: LearningEvent = {
      id: "evt-1",
      userId: "local-user",
      timestamp: new Date().toISOString(),
      type: "answer_submitted",
      mode: "study",
      questionId: "Q1",
      metadata: {
        confidence: 5,
        action: "click",
        arbitrary: "drop-me",
      },
    };

    const payload = sanitizeLearningEventForSink(event);
    expect(payload.event.metadata).toEqual({ action: "click" });
  });

  it("sends event to sink when enabled", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_ANALYTICS_SINK_ENABLED = "true";
    process.env.NEXT_PUBLIC_ANALYTICS_SINK_URL = "https://sink.example/events";
    process.env.NEXT_PUBLIC_ANALYTICS_SINK_TOKEN = "token-123";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("./analyticsSink");
    const event: LearningEvent = {
      id: "evt-2",
      userId: "local-user",
      timestamp: new Date().toISOString(),
      type: "session_started",
      mode: "learn",
      metadata: { action: "start" },
    };

    await mod.sendLearningEventToSink(event);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, req] = fetchMock.mock.calls[0];
    expect(url).toBe("https://sink.example/events");
    expect(req.headers.Authorization).toBe("Bearer token-123");
  });

  it("retries failed sends and stores dead-letter events after exhaustion", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_ANALYTICS_SINK_ENABLED = "true";
    process.env.NEXT_PUBLIC_ANALYTICS_SINK_URL = "https://sink.example/events";

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sink down")));
    const mod = await import("./analyticsSink");
    const event: LearningEvent = {
      id: "evt-3",
      userId: "local-user",
      timestamp: new Date().toISOString(),
      type: "session_started",
      mode: "study",
    };

    await mod.sendLearningEventToSink(event);
    const dead = mod.getDeadLetterEventsForTests();
    expect(dead).toHaveLength(1);
    expect(dead[0].payload.event.id).toBe("evt-3");
    expect(dead[0].retryCount).toBeGreaterThanOrEqual(1);
  });

  it("flushes queued dead-letter events before sending new payload", async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_ANALYTICS_SINK_ENABLED = "true";
    process.env.NEXT_PUBLIC_ANALYTICS_SINK_URL = "https://sink.example/events";

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("first fails"))
      .mockRejectedValueOnce(new Error("retry fails"))
      .mockRejectedValueOnce(new Error("last retry fails"))
      .mockResolvedValue({ ok: true })
      .mockResolvedValue({ ok: true })
      .mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("./analyticsSink");
    const eventA: LearningEvent = {
      id: "evt-4",
      userId: "local-user",
      timestamp: new Date().toISOString(),
      type: "session_started",
      mode: "learn",
    };
    const eventB: LearningEvent = {
      id: "evt-5",
      userId: "local-user",
      timestamp: new Date().toISOString(),
      type: "session_saved",
      mode: "learn",
    };

    await mod.sendLearningEventToSink(eventA);
    expect(mod.getDeadLetterEventsForTests()).toHaveLength(1);
    const queued = mod.getDeadLetterEventsForTests();
    localStorage.setItem(
      "part107_analytics_sink_deadletter_v1",
      JSON.stringify(
        queued.map((entry) => ({
          ...entry,
          nextRetryAt: "2000-01-01T00:00:00.000Z",
        }))
      )
    );

    await mod.sendLearningEventToSink(eventB);
    expect(mod.getDeadLetterEventsForTests()).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalled();
  });
});
