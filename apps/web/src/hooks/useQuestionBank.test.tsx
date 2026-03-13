import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useQuestionBank } from "./useQuestionBank";

const { mockFetchQuestions } = vi.hoisted(() => ({
  mockFetchQuestions: vi.fn(),
}));

vi.mock("../lib/questionBank", async () => {
  const actual = await vi.importActual<typeof import("../lib/questionBank")>("../lib/questionBank");
  return {
    ...actual,
    fetchQuestions: mockFetchQuestions,
  };
});

const sampleQuestion = {
  id: "Q-1",
  category: "Airspace",
  subcategory: "Class C",
  question_text: "What is required?",
  figure_reference: null,
  options: [
    { id: "A", text: "Option A" },
    { id: "B", text: "Option B" },
    { id: "C", text: "Option C" },
    { id: "D", text: "Option D" },
  ],
  correct_option_id: "C",
  explanation_correct: "Because of rules.",
  explanation_distractors: {},
  citation: "14 CFR 107.41",
  difficulty_level: 2,
  tags: [],
};

describe("useQuestionBank", () => {
  beforeEach(() => {
    mockFetchQuestions.mockReset();
    localStorage.clear();
  });

  it("retries and then falls back to cached snapshot", async () => {
    const freshSnapshotDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(
      "part107_question_bank_snapshot_v1",
      JSON.stringify({
        version: 1,
        updatedAt: freshSnapshotDate,
        source: "local",
        questions: [sampleQuestion],
      })
    );

    mockFetchQuestions.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useQuestionBank());

    await waitFor(
      () => {
        expect(result.current.loaded).toBe(true);
        expect(result.current.questions).toHaveLength(1);
      },
      { timeout: 4000 }
    );

    expect(result.current.warning).toMatch(/Using cached question snapshot/i);
    expect(result.current.snapshotInfo).not.toBeNull();
    expect((result.current.snapshotInfo?.ageMs ?? 0) >= 0).toBe(true);
    expect(mockFetchQuestions).toHaveBeenCalledTimes(3);
  });

  it("stores fresh snapshot after successful load", async () => {
    mockFetchQuestions.mockResolvedValue({
      questions: [sampleQuestion],
      meta: {
        total: 1,
        category: "All",
        shuffled: false,
        limit: null,
        source: "local",
      },
    });

    const { result } = renderHook(() => useQuestionBank());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
      expect(result.current.warning).toBeNull();
      expect(result.current.snapshotInfo).toBeNull();
    });

    const snapshotRaw = localStorage.getItem("part107_question_bank_snapshot_v1");
    expect(snapshotRaw).toBeTruthy();
    const snapshot = JSON.parse(snapshotRaw!);
    expect(snapshot.questions).toHaveLength(1);
  });

  it("ignores stale snapshots older than hard TTL", async () => {
    const staleDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(
      "part107_question_bank_snapshot_v1",
      JSON.stringify({
        version: 1,
        updatedAt: staleDate,
        source: "local",
        questions: [sampleQuestion],
      })
    );
    mockFetchQuestions.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useQuestionBank());

    await waitFor(() => {
      expect(result.current.loaded).toBe(false);
      expect(result.current.error).toMatch(/network down/i);
    });
    expect(result.current.warning).toMatch(/older than/i);
  });

  it("supports force-live reload without snapshot fallback", async () => {
    localStorage.setItem(
      "part107_question_bank_snapshot_v1",
      JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        source: "local",
        questions: [sampleQuestion],
      })
    );
    mockFetchQuestions.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useQuestionBank());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    await result.current.reload({ preferLive: true });

    await waitFor(() => {
      expect(result.current.loaded).toBe(false);
      expect(result.current.error).toMatch(/network down/i);
    });
  });

  it("clears cached snapshot via clearSnapshot", async () => {
    mockFetchQuestions.mockResolvedValue({
      questions: [sampleQuestion],
      meta: {
        total: 1,
        category: "All",
        shuffled: false,
        limit: null,
        source: "local",
      },
    });

    const { result } = renderHook(() => useQuestionBank());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    expect(localStorage.getItem("part107_question_bank_snapshot_v1")).toBeTruthy();

    result.current.clearSnapshot();
    expect(localStorage.getItem("part107_question_bank_snapshot_v1")).toBeNull();
  });
});
