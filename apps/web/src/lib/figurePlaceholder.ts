export function isUnresolvedFigurePlaceholderText(
  value: string | null | undefined
): boolean {
  if (!value) return false;

  const normalized = value.replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) return false;

  const withoutLabel = normalized.replace(/^(?:📊\s*)?(?:figure|fig\.?)\s*:?\s*/, "");
  return /^insert\b/.test(withoutLabel);
}
