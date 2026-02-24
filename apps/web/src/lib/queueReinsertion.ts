export function reinsertQueueHeadWithGap<T>(
  queue: T[],
  minGap: number,
  maxGap: number,
  rng: () => number = Math.random
): T[] {
  if (queue.length <= 1) return queue;

  const [current, ...rest] = queue;
  const boundedMin = Math.min(rest.length, Math.max(0, minGap));
  const boundedMax = Math.min(rest.length, Math.max(boundedMin, maxGap));
  const insertionSpan = boundedMax - boundedMin;
  const jitter = insertionSpan > 0 ? Math.floor(rng() * (insertionSpan + 1)) : 0;
  const insertionIndex = boundedMin + jitter;

  const next = [...rest];
  next.splice(insertionIndex, 0, current);
  return next;
}
