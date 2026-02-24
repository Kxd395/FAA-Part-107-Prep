import { describe, expect, it } from "vitest";
import { validateLearningEventInput } from "./learningEventSchema";

describe("learningEventSchema", () => {
  it("accepts supported event taxonomy and scalar metadata", () => {
    const error = validateLearningEventInput({
      type: "answer_submitted",
      mode: "study",
      metadata: {
        confidence: 5,
        label: "primary",
        offline: false,
        note: null,
      },
    });

    expect(error).toBeNull();
  });

  it("rejects unsupported event types", () => {
    const error = validateLearningEventInput({
      // @ts-expect-error intentional invalid type for validation
      type: "custom_event",
      mode: "study",
    });

    expect(error).toMatch(/unsupported learning event type/i);
  });

  it("rejects non-scalar metadata", () => {
    const error = validateLearningEventInput({
      type: "session_started",
      mode: "learn",
      metadata: {
        // @ts-expect-error intentional invalid metadata value for validation
        nested: { a: 1 },
      },
    });

    expect(error).toMatch(/invalid metadata value/i);
  });
});
