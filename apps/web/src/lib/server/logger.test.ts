import { describe, expect, it, vi } from "vitest";
import { createServerLogger, formatLogEntry } from "./logger";

describe("server logger", () => {
  it("redacts sensitive metadata fields", () => {
    const rendered = formatLogEntry("info", "test", {
      authorization: "Bearer abc",
      password: "pw",
      nested: {
        apiKey: "123",
      },
      safe: "value",
    });

    const parsed = JSON.parse(rendered) as Record<string, unknown>;
    expect(parsed.authorization).toBe("[REDACTED]");
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.safe).toBe("value");

    const nested = parsed.nested as Record<string, unknown>;
    expect(nested.apiKey).toBe("[REDACTED]");
  });

  it("serializes errors into structured fields", () => {
    const rendered = formatLogEntry("error", "failed", {
      error: new Error("boom"),
    });

    const parsed = JSON.parse(rendered) as Record<string, unknown>;
    const error = parsed.error as Record<string, unknown>;
    expect(error.name).toBe("Error");
    expect(error.message).toBe("boom");
    expect(typeof error.stack).toBe("string");
  });

  it("honors minimum log level", () => {
    const sink = vi.fn();
    const logger = createServerLogger({ sink, minLevel: "warn" });

    logger.info("info-message", { id: 1 });
    logger.warn("warn-message", { id: 2 });

    expect(sink).toHaveBeenCalledTimes(1);
    const [level, rendered] = sink.mock.calls[0] as [string, string];
    expect(level).toBe("warn");
    expect(rendered).toContain("warn-message");
  });
});
