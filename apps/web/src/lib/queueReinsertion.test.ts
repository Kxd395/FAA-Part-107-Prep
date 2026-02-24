import { describe, expect, it } from "vitest";
import { reinsertQueueHeadWithGap } from "./queueReinsertion";

describe("reinsertQueueHeadWithGap", () => {
  it("keeps queue unchanged when there is one item", () => {
    expect(reinsertQueueHeadWithGap(["Q1"], 1, 2)).toEqual(["Q1"]);
  });

  it("reinserts head within requested gap range", () => {
    const queue = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"];
    const rng = () => 0.99;
    const next = reinsertQueueHeadWithGap(queue, 2, 4, rng);

    expect(next).toHaveLength(queue.length);
    expect(next[0]).toBe("Q2");

    const newIndex = next.indexOf("Q1");
    expect(newIndex).toBeGreaterThanOrEqual(2);
    expect(newIndex).toBeLessThanOrEqual(4);
  });

  it("bounds insertion when max gap exceeds queue length", () => {
    const queue = ["Q1", "Q2", "Q3"];
    const next = reinsertQueueHeadWithGap(queue, 10, 20, () => 0.5);

    expect(next).toEqual(["Q2", "Q3", "Q1"]);
  });
});
