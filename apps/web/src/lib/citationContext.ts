const CITATION_PATTERNS = [
  /ACS\s+UA\.[A-Z0-9.]+/gi,
  /FAA-CT-8080-2H,?\s*Figure\s*\d+/gi,
  /FAA-H-8083-25[A-Z]?,\s*Ch(?:apter)?\s*\d+/gi,
  /AIM\s+\d+-\d+-\d+/gi,
  /AC\s*107-2A?/gi,
  /FAA-G-8082-22/gi,
  /14\s*CFR\s*§\s*\d+\.\d+(?:-\d+)?/gi,
];

function normalizeCitationPart(part: string): string {
  return part.replace(/\s+/g, " ").trim();
}

export function mergeCitations(...citationBlocks: Array<string | null | undefined>): string {
  const deduped = new Set<string>();

  for (const block of citationBlocks) {
    if (!block) continue;
    for (const piece of block.split(";")) {
      const normalized = normalizeCitationPart(piece);
      if (normalized) deduped.add(normalized);
    }
  }

  return Array.from(deduped).join("; ");
}

export function extractCitationText(text: string | null | undefined): string {
  if (!text) return "";
  const found = new Set<string>();

  for (const pattern of CITATION_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const normalized = normalizeCitationPart(match[0]);
      if (normalized) found.add(normalized);
    }
  }

  return Array.from(found).join("; ");
}
