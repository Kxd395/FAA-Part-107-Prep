import type { AttemptEvent } from "./attemptEventStore";

export interface WeakDomainInsight {
  category: string;
  attempts: number;
  incorrect: number;
  accuracyPercent: number;
  lastAttemptAt: string;
}

interface WeakDomainAccumulator {
  attempts: number;
  incorrect: number;
  lastAttemptAt: string;
}

function normalizeCategoryTag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function roundPercent(value: number): number {
  return Math.round(value * 100);
}

export function computeWeakDomainInsights(
  attempts: AttemptEvent[],
  options: { minAttempts?: number; maxDomains?: number } = {}
): WeakDomainInsight[] {
  const minAttempts = Math.max(1, Math.round(options.minAttempts ?? 3));
  const maxDomains = Math.max(1, Math.round(options.maxDomains ?? 5));
  const byCategory = new Map<string, WeakDomainAccumulator>();

  for (const attempt of attempts) {
    if (attempt.mode === "flashcard") continue;
    const category = normalizeCategoryTag(attempt.topicTags[0]);
    if (!category) continue;
    const previous = byCategory.get(category);
    if (!previous) {
      byCategory.set(category, {
        attempts: 1,
        incorrect: attempt.correct ? 0 : 1,
        lastAttemptAt: attempt.timestamp,
      });
      continue;
    }
    byCategory.set(category, {
      attempts: previous.attempts + 1,
      incorrect: previous.incorrect + (attempt.correct ? 0 : 1),
      lastAttemptAt: previous.lastAttemptAt > attempt.timestamp ? previous.lastAttemptAt : attempt.timestamp,
    });
  }

  return Array.from(byCategory.entries())
    .map(([category, data]) => ({
      category,
      attempts: data.attempts,
      incorrect: data.incorrect,
      accuracyPercent: roundPercent((data.attempts - data.incorrect) / data.attempts),
      lastAttemptAt: data.lastAttemptAt,
    }))
    .filter((item) => item.attempts >= minAttempts && item.incorrect > 0)
    .sort((a, b) => {
      if (a.accuracyPercent !== b.accuracyPercent) return a.accuracyPercent - b.accuracyPercent;
      if (a.incorrect !== b.incorrect) return b.incorrect - a.incorrect;
      if (a.attempts !== b.attempts) return b.attempts - a.attempts;
      return a.category.localeCompare(b.category);
    })
    .slice(0, maxDomains);
}
