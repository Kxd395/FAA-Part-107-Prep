/**
 * Custom SVG icon set for the DarkWater Drones v2 UI.
 *
 * Every icon is a pure inline SVG — no emoji, no third-party icon library.
 * Designed at a 24×24 viewBox, 1.5 px stroke, round caps/joins.
 * Pass className to control size & color (e.g. "h-5 w-5 text-blue-400").
 */

type IconProps = React.SVGProps<SVGSVGElement>;

const defaults: IconProps = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function icon(paths: React.ReactNode, displayName: string) {
  const Icon = (props: IconProps) => (
    <svg {...defaults} {...props}>
      {paths}
    </svg>
  );
  Icon.displayName = displayName;
  return Icon;
}

/* ─── Navigation ──────────────────────────────────────────────── */

/** Grid of four squares — dashboard / home */
export const IconDashboard = icon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </>,
  "IconDashboard",
);

/** Open book — study */
export const IconStudy = icon(
  <>
    <path d="M2 4c2-1 4.5-1 6.5 0S13 5 14 5V19c-1 0-3.5-.5-5.5-1.5S4 16 2 17Z" />
    <path d="M14 5c1 0 3.5-.5 5.5-1.5S22 3 22 4v13c-2-1-3.5-1-5.5 0S14 19 14 19V5Z" />
  </>,
  "IconStudy",
);

/** Clipboard with checkmark — exam */
export const IconExam = icon(
  <>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M9 2v2h6V2" />
    <path d="m9 13 2 2 4-4" />
  </>,
  "IconExam",
);

/* ─── Practice ────────────────────────────────────────────────── */

/** Stacked cards — flashcards */
export const IconFlashcards = icon(
  <>
    <rect x="4" y="6" width="16" height="14" rx="2" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="8" y1="11" x2="16" y2="11" />
    <line x1="8" y1="15" x2="13" y2="15" />
  </>,
  "IconFlashcards",
);

/** Graduation cap — learn mode */
export const IconLearn = icon(
  <>
    <path d="m2 10 10-5 10 5-10 5Z" />
    <path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5" />
    <line x1="22" y1="10" x2="22" y2="16" />
  </>,
  "IconLearn",
);

/** Circular arrows — missed / retry */
export const IconMissed = icon(
  <>
    <path d="M1 4v6h6" />
    <path d="M23 20v-6h-6" />
    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10" />
    <path d="M3.51 15A9 9 0 0 0 18.36 18.36L23 14" />
  </>,
  "IconMissed",
);

/** Lightning bolt — smart review / AI drills */
export const IconSmartReview = icon(
  <path d="M13 2 3 14h9l-1 8 10-12h-9Z" />,
  "IconSmartReview",
);

/* ─── Tools ───────────────────────────────────────────────────── */

/** Folded map with pin — sectional charts */
export const IconCharts = icon(
  <>
    <path d="m1 6 7-3 8 3 7-3v15l-7 3-8-3-7 3Z" />
    <line x1="8" y1="3" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="21" />
  </>,
  "IconCharts",
);

/** Text block with an "A" — acronyms */
export const IconAcronyms = icon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M8 17l4-10 4 10" />
    <line x1="9.5" y1="14" x2="14.5" y2="14" />
  </>,
  "IconAcronyms",
);

/** Radio wave / signal — phonetic alphabet */
export const IconPhonetic = icon(
  <>
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
    <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
  </>,
  "IconPhonetic",
);

/* ─── Stats / Dashboard ──────────────────────────────────────── */

/** Crosshair — questions answered / target */
export const IconTarget = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
  </>,
  "IconTarget",
);

/** Trending up arrow — accuracy */
export const IconTrendUp = icon(
  <>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </>,
  "IconTrendUp",
);

/** Bar chart — study sessions */
export const IconBarChart = icon(
  <>
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </>,
  "IconBarChart",
);

/** Trophy — best exam */
export const IconTrophy = icon(
  <>
    <path d="M8 2h8v7a4 4 0 0 1-8 0Z" />
    <path d="M16 4h2a2 2 0 0 1 0 4h-2" />
    <path d="M8 4H6a2 2 0 0 0 0 4h2" />
    <line x1="12" y1="13" x2="12" y2="17" />
    <path d="M7 22h10" />
    <path d="M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </>,
  "IconTrophy",
);

/** Flame — streak */
export const IconFlame = icon(
  <path d="M12 22c-4 0-7-3-7-7a7 7 0 0 1 3-5.5c0 2 1 3 2.5 3.5C10 11 10 8 12 5c2 3 4 5 4.5 7a3 3 0 0 1-3.5 0c1.5 2 2.5 3.5 2.5 5.5 0 2.5-1.5 4.5-3.5 4.5Z" />,
  "IconFlame",
);

/** Circle with check — pass rate / ready */
export const IconCheckCircle = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </>,
  "IconCheckCircle",
);

/** Stacked layers — available questions */
export const IconLayers = icon(
  <>
    <path d="m2 12 10 5 10-5" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 7 10 5 10-5L12 2Z" />
  </>,
  "IconLayers",
);

/** Cap & diploma — categories count */
export const IconGradCap = icon(
  <>
    <path d="m2 10 10-5 10 5-10 5Z" />
    <path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5" />
  </>,
  "IconGradCap",
);

/* ─── Misc / UI ───────────────────────────────────────────────── */

/** Right arrow — PathCard chevron */
export const IconArrowRight = icon(
  <>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </>,
  "IconArrowRight",
);

/** Chevron down — dropdown toggle */
export const IconChevronDown = icon(
  <polyline points="6 9 12 15 18 9" />,
  "IconChevronDown",
);

/** Hamburger menu — mobile toggle */
export const IconMenu = icon(
  <>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </>,
  "IconMenu",
);

/** X / close */
export const IconClose = icon(
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>,
  "IconClose",
);

/** Progress ring / pie — progress page */
export const IconProgress = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 0 1 9.8 8" />
  </>,
  "IconProgress",
);
