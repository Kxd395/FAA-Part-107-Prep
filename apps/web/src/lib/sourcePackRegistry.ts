import type { QuestionTypeProfile } from "@part107/core";

export interface SourcePackRegistryEntry {
  id: string;
  profile: QuestionTypeProfile;
  name: string;
  description: string;
  version: string;
  count: number | null;
  provenance: string;
  lastAuditDate: string;
}

export const SOURCE_PACK_REGISTRY: ReadonlyArray<SourcePackRegistryEntry> = [
  {
    id: "part107",
    profile: "part107_bank",
    name: "Part107 Question Bank",
    description: "Use only questions from your custom Part107 bank JSON resources.",
    version: "v1",
    count: null,
    provenance: "Local source-pack JSON resources",
    lastAuditDate: "2026-02-25",
  },
  {
    id: "carrington_strict",
    profile: "carrington_strict",
    name: "Carrington Bank (Strict)",
    description: "Use only the stricter curated Carrington subset.",
    version: "v1",
    count: null,
    provenance: "Carrington strict trim pipeline",
    lastAuditDate: "2026-02-25",
  },
];

export function getSourcePackByProfile(
  profile: QuestionTypeProfile
): SourcePackRegistryEntry | null {
  return SOURCE_PACK_REGISTRY.find((entry) => entry.profile === profile) ?? null;
}
