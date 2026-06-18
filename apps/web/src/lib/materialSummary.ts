import type { StudyCategory } from "@part107/core";

export const MATERIAL_SUMMARY = {
  totalQuestions: 350,
  counts: {
    All: 350,
    Regulations: 112,
    Airspace: 66,
    Weather: 57,
    Operations: 41,
    "Loading & Performance": 16,
    "Airport Operations": 39,
    "Radio Communications": 10,
    "Crew Resource Management": 11,
    "Emergency Procedures": 6,
    Physiology: 8,
    "Remote ID": 12,
  } satisfies Record<StudyCategory, number>,
} as const;
