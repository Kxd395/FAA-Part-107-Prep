import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLearningEventLogger } from "./useLearningEventLogger";

const sendLearningEventToSinkMock = vi.fn();

vi.mock("../lib/analyticsSink", () => ({
  sendLearningEventToSink: (event: unknown) => {
    sendLearningEventToSinkMock(event);
    return Promise.resolve();
  },
}));

describe("useLearningEventLogger", () => {
  afterEach(() => {
    sendLearningEventToSinkMock.mockReset();
  });

  it("appends valid events with generated metadata", () => {
    const store = {
      append: vi.fn(),
      load: vi.fn(() => []),
      clear: vi.fn(),
    };
    const { result } = renderHook(() => useLearningEventLogger("pilot-user", store));

    result.current.logEvent({
      type: "link_opened",
      mode: "study",
      metadata: { target: "header_nav_study" },
    });

    expect(store.append).toHaveBeenCalledTimes(1);
    const [userId, event] = store.append.mock.calls[0];
    expect(userId).toBe("pilot-user");
    expect(event).toEqual(
      expect.objectContaining({
        userId: "pilot-user",
        type: "link_opened",
        mode: "study",
      })
    );
    expect(typeof event.id).toBe("string");
    expect(typeof event.timestamp).toBe("string");
    expect(sendLearningEventToSinkMock).toHaveBeenCalledTimes(1);
  });

  it("drops invalid events", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = {
      append: vi.fn(),
      load: vi.fn(() => []),
      clear: vi.fn(),
    };
    const { result } = renderHook(() => useLearningEventLogger("pilot-user", store));

    result.current.logEvent({
      type: "not-real-event" as never,
      mode: "study",
    });

    expect(store.append).not.toHaveBeenCalled();
    expect(sendLearningEventToSinkMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
