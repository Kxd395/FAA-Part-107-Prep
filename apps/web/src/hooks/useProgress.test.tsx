import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProgress } from "./useProgress";

describe("useProgress", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses legacy storage key for local-user", async () => {
    const { result } = renderHook(() => useProgress());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      result.current.saveSession({
        mode: "study",
        category: "All",
        questionTypeProfile: "confirmed_test",
        score: 4,
        total: 5,
        timeSpentMs: 60_000,
        questions: [],
      });
    });

    const raw = localStorage.getItem("part107_progress");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? "[]") as Array<{ mode: string; category: string }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.mode).toBe("study");
  });

  it("isolates progress records by user-scoped storage key", async () => {
    localStorage.setItem(
      "part107_progress:pilot-a",
      JSON.stringify([{ id: "a1", mode: "study", category: "All", questions: [] }])
    );
    localStorage.setItem(
      "part107_progress:pilot-b",
      JSON.stringify([{ id: "b1", mode: "exam", category: "All", questions: [] }])
    );

    const { result, rerender } = renderHook(
      ({ userId }) => useProgress(userId),
      { initialProps: { userId: "pilot-a" } }
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
      expect(result.current.sessions[0]?.id).toBe("a1");
    });

    rerender({ userId: "pilot-b" });
    await waitFor(() => {
      expect(result.current.sessions[0]?.id).toBe("b1");
    });
  });
});
