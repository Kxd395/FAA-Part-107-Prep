import {
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_MODES,
  type LearningEventMode,
  type LearningEventType,
} from "./analyticsTaxonomy";
import type { LearningEvent } from "./learningEventStore";

const EVENT_TYPE_SET = new Set<string>(ANALYTICS_EVENT_TYPES);
const EVENT_MODE_SET = new Set<string>(ANALYTICS_MODES);

function isScalarValue(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function isSupportedLearningEventType(value: unknown): value is LearningEventType {
  return typeof value === "string" && EVENT_TYPE_SET.has(value);
}

export function isSupportedLearningEventMode(value: unknown): value is LearningEventMode {
  return typeof value === "string" && EVENT_MODE_SET.has(value);
}

export function validateLearningEventInput(
  event: Omit<LearningEvent, "id" | "userId" | "timestamp">
): string | null {
  if (!isSupportedLearningEventType(event.type)) {
    return `Unsupported learning event type: ${String(event.type)}`;
  }
  if (!isSupportedLearningEventMode(event.mode)) {
    return `Unsupported learning event mode: ${String(event.mode)}`;
  }

  if (event.metadata) {
    for (const [key, value] of Object.entries(event.metadata)) {
      if (!isScalarValue(value)) {
        return `Invalid metadata value for key '${key}'`;
      }
    }
  }

  return null;
}
