import { describe, expect, it, beforeEach } from "vitest";
import { createLocalStorageAttemptEventStore, type AttemptEvent } from "./attemptEventStore";

function makeEvent(overrides: Partial<AttemptEvent> = {}): AttemptEvent {
  return {
    attemptId: "a1",
    userId: "u1",
    questionKey: "k1",
    questionId: "q1",
    timestamp: "2026-02-19T00:00:00.000Z",
    mode: "practice",
    correct: true,
    responseTimeMs: 12000,
    selectedOptionId: "A",
    quizId: null,
    topicTags: ["Regulations"],
    difficulty: 2,
    confidence: null,
    ...overrides,
  };
}

describe("attemptEventStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("appends and loads events per user", () => {
    const store = createLocalStorageAttemptEventStore();
    store.append("u1", makeEvent({ attemptId: "a1" }));
    store.append("u1", makeEvent({ attemptId: "a2", questionKey: "k2", questionId: "q2" }));
    store.append("u2", makeEvent({ attemptId: "a3", userId: "u2" }));

    const u1 = store.load("u1");
    const u2 = store.load("u2");

    expect(u1).toHaveLength(2);
    expect(u2).toHaveLength(1);
    expect(u1[0].attemptId).toBe("a1");
    expect(u1[1].attemptId).toBe("a2");
  });
});
