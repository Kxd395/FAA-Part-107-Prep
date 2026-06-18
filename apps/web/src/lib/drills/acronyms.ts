import { shuffle, type ThreeChoiceQuestion, uniqueOptions } from "./threeChoice";

export interface AcronymEntry {
  term: string;
  expansion: string;
  note: string;
  group: "operations" | "radio" | "weather";
}

export const ACRONYM_ENTRIES: AcronymEntry[] = [
  {
    term: "RPIC",
    expansion: "Remote Pilot in Command",
    note: "The certificated remote pilot responsible for the operation.",
    group: "operations",
  },
  {
    term: "UAS",
    expansion: "Unmanned Aircraft System",
    note: "The aircraft, control station, link, and support equipment as a complete system.",
    group: "operations",
  },
  {
    term: "sUAS",
    expansion: "small Unmanned Aircraft System",
    note: "A UAS under 55 pounds within standard Part 107 scope.",
    group: "operations",
  },
  {
    term: "UA",
    expansion: "Unmanned Aircraft",
    note: "The aircraft itself, not the whole system.",
    group: "operations",
  },
  {
    term: "VO",
    expansion: "Visual Observer",
    note: "Crewmember assisting the RPIC with visual scanning and situational awareness.",
    group: "operations",
  },
  {
    term: "VLOS",
    expansion: "Visual Line of Sight",
    note: "The aircraft must remain visible without aids other than corrective lenses.",
    group: "operations",
  },
  {
    term: "BVLOS",
    expansion: "Beyond Visual Line of Sight",
    note: "Operations beyond normal visual-line-of-sight limits.",
    group: "operations",
  },
  {
    term: "FRIA",
    expansion: "FAA-Recognized Identification Area",
    note: "Area where certain aircraft may operate without standard Remote ID broadcast.",
    group: "operations",
  },
  {
    term: "RID",
    expansion: "Remote Identification",
    note: "Broadcast identity/location rules under the Remote ID framework.",
    group: "operations",
  },
  {
    term: "CRM",
    expansion: "Crew Resource Management",
    note: "Use of people, equipment, and information to improve safety and decision-making.",
    group: "operations",
  },
  {
    term: "ATC",
    expansion: "Air Traffic Control",
    note: "Controllers responsible for traffic management and controlled-airspace authorization.",
    group: "radio",
  },
  {
    term: "CTAF",
    expansion: "Common Traffic Advisory Frequency",
    note: "Self-announce frequency used at non-towered airports.",
    group: "radio",
  },
  {
    term: "LAANC",
    expansion: "Low Altitude Authorization and Notification Capability",
    note: "System for near-real-time authorization in controlled airspace.",
    group: "radio",
  },
  {
    term: "NOTAM",
    expansion: "Notice to Airmen",
    note: "Time-sensitive aeronautical notice that may affect a flight.",
    group: "radio",
  },
  {
    term: "TFR",
    expansion: "Temporary Flight Restriction",
    note: "Temporary airspace restriction that can prohibit or limit drone operations.",
    group: "radio",
  },
  {
    term: "AGL",
    expansion: "Above Ground Level",
    note: "Altitude measured from the terrain directly below the aircraft.",
    group: "operations",
  },
  {
    term: "MSL",
    expansion: "Mean Sea Level",
    note: "Altitude referenced to average sea level.",
    group: "operations",
  },
  {
    term: "METAR",
    expansion: "Meteorological Aerodrome Report",
    note: "Current observed weather report for an airport.",
    group: "weather",
  },
  {
    term: "TAF",
    expansion: "Terminal Aerodrome Forecast",
    note: "Forecast weather report for an airport and surrounding area.",
    group: "weather",
  },
];

const ACRONYM_DISTRACTORS: Record<string, [string, string]> = {
  RPIC: ["Remote Pilot Certificate", "Responsible Pilot in Control"],
  UAS: ["Unmanned Aerial Sensor", "Uncrewed Aviation Service"],
  sUAS: ["Standard Unmanned Aircraft System", "Small Utility Aircraft System"],
  UA: ["Uncontrolled Airspace", "Unmanned Airport"],
  VO: ["Visual Operations", "Vertical Observer"],
  VLOS: ["Visual Limit of Sight", "Vertical Line of Sight"],
  BVLOS: ["Basic Visual Line of Sight", "Beyond Vertical Line of Sight"],
  FRIA: ["FAA-Registered Identification Area", "Flight Restricted Identification Area"],
  RID: ["Registration Identification", "Remote Inspection Data"],
  CRM: ["Certified Remote Mission", "Crew Risk Management"],
  ATC: ["Airport Traffic Control", "Airspace Tracking Center"],
  CTAF: ["Controlled Traffic Advisory Frequency", "Common Terminal Area Frequency"],
  LAANC: [
    "Low Altitude Airspace Notification Center",
    "Local Air Authorization and Navigation Clearance",
  ],
  NOTAM: ["Notice to Air Missions", "Notice to Aviation Members"],
  TFR: ["Temporary Flight Route", "Terminal Flight Restriction"],
  AGL: ["Above Ground Limit", "Actual Ground Level"],
  MSL: ["Maximum Safe Level", "Measured Surface Level"],
  METAR: ["Meteorological Airport Report", "Measured Terminal Area Report"],
  TAF: ["Terminal Area Forecast", "Temporary Aerodrome Forecast"],
};

export function buildAcronymQuestion(
  target: AcronymEntry,
  pool: AcronymEntry[]
): ThreeChoiceQuestion<AcronymEntry> {
  const curatedDistractors = ACRONYM_DISTRACTORS[target.term] ?? [];
  const fallbackDistractors = pool
    .filter((entry) => entry.term !== target.term)
    .map((entry) => entry.expansion);
  const options = uniqueOptions([target.expansion, ...curatedDistractors, ...fallbackDistractors]);

  return {
    item: target,
    prompt: `What does ${target.term} stand for?`,
    answer: target.expansion,
    options: shuffle(options),
  };
}
