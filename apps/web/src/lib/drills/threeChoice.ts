import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ThreeChoiceQuestion<T> {
  item: T;
  prompt: string;
  answer: string;
  options: string[];
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickRandomEntry<T>(items: T[], exclude?: T): T | null {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0] ?? null;

  const candidates = exclude === undefined ? items : items.filter((item) => item !== exclude);
  const pool = candidates.length > 0 ? candidates : items;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export function uniqueOptions(options: string[], targetLength = 3): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const option of options) {
    if (seen.has(option)) continue;
    seen.add(option);
    result.push(option);
    if (result.length === targetLength) break;
  }

  return result;
}

export function useThreeChoiceDrill<T>(
  items: T[],
  buildQuestion: (target: T, pool: T[]) => ThreeChoiceQuestion<T>,
  autoAdvanceMs = 650
) {
  const [current, setCurrent] = useState<T | null>(() => pickRandomEntry(items));
  const [selected, setSelected] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAdvance = useCallback(() => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
  }, []);

  const question = useMemo(
    () => (current ? buildQuestion(current, items) : null),
    [buildQuestion, current, items]
  );

  const next = useCallback(() => {
    clearAdvance();
    setCurrent((existing) => pickRandomEntry(items, existing ?? undefined));
    setSelected(null);
  }, [clearAdvance, items]);

  const select = useCallback(
    (option: string) => {
      if (selected !== null || !question) return;

      setSelected(option);
      const isCorrect = option === question.answer;
      setStreak((value) => (isCorrect ? value + 1 : 0));

      if (isCorrect) {
        advanceTimeoutRef.current = setTimeout(next, autoAdvanceMs);
      }
    },
    [autoAdvanceMs, next, question, selected]
  );

  useEffect(() => {
    clearAdvance();
    setCurrent((existing) => {
      if (existing && items.includes(existing)) {
        return existing;
      }
      return pickRandomEntry(items);
    });
    setSelected(null);
    setStreak(0);
  }, [clearAdvance, items]);

  useEffect(() => clearAdvance, [clearAdvance]);

  return {
    current,
    next,
    question,
    select,
    selected,
    selectedIsCorrect: selected !== null && selected === question?.answer,
    streak,
  };
}
