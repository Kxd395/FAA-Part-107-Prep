# 🛩️ Part 107 Drone Exam Prep

**Free FAA Part 107 Remote Pilot exam prep — web + native Apple apps.**
Updated for 2026 rules including Remote ID and Operations Over People.

## Architecture

```
FAA_107_Study_Guide/
├── apps/
│   ├── web/                    # Next.js web app → deploys to Vercel
│   │   └── src/app/
│   │       ├── page.tsx        # Landing page
│   │       ├── study/page.tsx  # Study mode (instant feedback)
│   │       └── exam/page.tsx   # Exam mode (timed, no feedback)
│   └── ios/                    # SwiftUI universal app
│       └── Part107Prep/        # iPhone, iPad, Mac
├── packages/
│   ├── content/                # Shared question bank + figures
│   │   ├── questions/          # JSON question files by category
│   │   ├── figures/            # High-res sectional chart images
│   │   ├── categories.json     # Category definitions + colors
│   │   └── schema/             # JSON schema for validation
│   └── core/                   # Shared quiz engine (TypeScript)
│       └── src/
│           ├── types.ts        # Type definitions
│           ├── engine.ts       # Quiz logic, scoring, timer
│           └── index.ts        # Public API
├── tools/
│   └── content-pipeline/       # Python scripts for content generation
│       ├── generate_questions.py   # PDF → AI → structured JSON
│       ├── extract_figures.py      # PDF → high-res figure PNGs
│       └── requirements.txt
└── source materials (PDFs)     # FAA official study guides
```

## Quick Start

### Web App (Next.js)

```bash
cd FAA_107_Study_Guide
npm install
npm run dev
# → http://localhost:3000
```

Deploy to Vercel:
```bash
npx vercel
```

### Local Build/Test (macOS)

```bash
cd FAA_107_Study_Guide
npm install
npm run lint
npm run test
npm run build
```

### Content Pipeline (Generate Questions from PDFs)

```bash
cd tools/content-pipeline
pip install -r requirements.txt

# Preview PDF extraction (no AI call)
python generate_questions.py --pdf ../../remote_pilot_study_guide.pdf --topic "Regulations" --count 5 --dry-run

# Generate questions with Claude
export ANTHROPIC_API_KEY="your-key"
python generate_questions.py --pdf ../../remote_pilot_study_guide.pdf --topic "Regulations" --count 10

# Extract figures from Testing Supplement
python extract_figures.py --pdf ../../sport_rec_private_akts.pdf --dpi 300
```

### iOS/macOS App (SwiftUI)

See [apps/ios/README.md](apps/ios/README.md) for Xcode setup instructions.

## Features

### Implemented ✅

| Feature | Web | iOS |
|---------|-----|-----|
| Study Mode (instant feedback) | ✅ | 🔲 (views scaffolded) |
| Exam Mode (timed, 60Q) | ✅ | 🔲 (views scaffolded) |
| Mark for Review | ✅ | 🔲 |
| Question Navigator | ✅ | 🔲 |
| Category filtering | ✅ | ✅ |
| Score + category breakdown | ✅ | ✅ |
| Distractor explanations | ✅ | 🔲 |

### Roadmap 🗺️

- [ ] AI "Explain Like I'm 5" (Claude API)
- [ ] Smart Weak Spot Detection (auto-quiz on weak categories)
- [ ] High-res Sectional Chart Viewer (pinch-to-zoom)
- [ ] User progress persistence (localStorage + Supabase sync)
- [ ] Offline mode (service worker / Core Data)
- [ ] PWA manifest for mobile web install
- [ ] Full SwiftUI quiz views for iOS/Mac

## Adaptive Quiz Generation

Quiz generation now supports deduplication + adaptive per-user selection.

- Deduplication key:
  - Normalized prompt text (trim, collapse whitespace, lowercase)
  - Plus normalized choices (default enabled)
  - Stored as a canonical hashed key
- Adaptive stats tracked per user + canonical key:
  - Core:
    - `attempts`, `correct`, `incorrect`, `correctStreak`, `wrongStreak`
    - `lastAttemptAt`, `lastCorrectAt`, `lastResultWasCorrect`
  - Rolling windows:
    - `last10Bits`, `last10Count`, `last10Accuracy`
    - `last20Bits`, `last20Count`, `last20Accuracy`
    - `momentum` (`last10Accuracy - last20Accuracy`)
    - `volatility` (flip rate across last-10 outcomes)
  - Trend/speed:
    - `emaAccuracy`, `emaResponseTimeMs`, `averageResponseTimeMs`
  - Scheduling:
    - `intervalDays`, `nextDueAt`
  - `masteryScore`
- Mastered rule defaults:
  - `minAttempts = 3`
  - `minAccuracy = 0.85` (used as mastery score threshold)
  - `minStreak = 3`
- Selection behavior:
  - Excludes mastered questions by default
  - If not enough non-mastered questions exist, backfills with mastered review items
  - Weights selection toward lower `masteryScore` (weakness-first)
  - Adds boosts for due items (`nextDueAt`) and unseen items
  - Adds a boost for recently missed questions

### Mastery Formula

`masteryScore` is computed as:

- `base = posteriorMean(correct, attempts)` using Beta prior (`a=1`, `b=1`)
- `recent = last10Accuracy` (or `base` until 10 attempts exist)
- `recencyPenalty` based on days since last attempt
- `volatilityPenalty` based on flips in last-10 outcomes

Final:

- `masteryScore = clamp(0.6*base + 0.4*recent - recencyPenalty - volatilityPenalty, 0, 1)`

### Scheduling Rule (Spaced Review)

Each answer updates `intervalDays` and `nextDueAt`:

- Wrong answer: `intervalDays = 1`
- Correct + fast (`responseTimeMs <= fastResponseTimeMs`): `intervalDays *= 2`
- Correct + slower: `intervalDays *= 1.5`
- Interval is clamped to `[minIntervalDays, maxIntervalDays]`

### Adaptive Stats Storage

Current implementation stores adaptive stats in browser `localStorage`:

- Key: `part107_adaptive_stats_v2`
- Scope: per-browser, per-device
- Default user ID: `local-user`
- Adapter interface: `AdaptiveStatsStore` (`apps/web/src/lib/adaptiveStatsStore.ts`)

Storage is intentionally separated from selection logic, so you can swap to a DB/API backend later without rewriting core selection behavior.

### Adaptive Config Options

Defaults come from `@part107/core` (`DEFAULT_ADAPTIVE_QUIZ_CONFIG`):

- `minAttempts`
- `minAccuracy`
- `minStreak`
- `excludeMastered`
- `includeMasteredOnShortfall`
- `reviewRate`
- `includeChoicesInCanonicalKey`
- `recentMissWindowMs`
- `recentMissBoost`
- `emaAlpha`
- `posteriorPriorCorrect`
- `posteriorPriorIncorrect`
- `recencyPenaltyDays`
- `recencyPenaltyMax`
- `volatilityPenaltyMax`
- `fastResponseTimeMs`
- `slowResponseTimeMs`
- `minIntervalDays`
- `maxIntervalDays`
- `weakWeightBoost`
- `dueWeightBoost`
- `noveltyWeightBoost`

### Attempt Event Logging

The app now writes one immutable attempt event per graded answer:

- Key: `part107_attempt_events_v1`
- Stored fields:
  - `attemptId`, `userId`, `questionKey`, `questionId`, `timestamp`
  - `mode` (`pretest`, `practice`, `quiz`, `mock`)
  - `correct`, `responseTimeMs`, `selectedOptionId`, `quizId`
  - `topicTags`, `difficulty`, `confidence`
- Adapter interface: `AttemptEventStore` (`apps/web/src/lib/attemptEventStore.ts`)

### Learning Event Logging

The app also logs question interaction events in browser `localStorage` for analysis and future coaching features:

- Key: `part107_learning_events_v1`
- Event types:
  - `question_shown`
  - `answer_submitted`
  - `review_opened`
  - `citation_clicked`
- Adapter interface: `LearningEventStore` (`apps/web/src/lib/learningEventStore.ts`)

This is separate from session-level progress history and can be swapped to a backend sink later (e.g., Supabase/Postgres, Segment, or custom API ingestion).

## Question Bank

Current bank: **343 questions** across 5 active categories.
The bank includes curated exam-style items and ACS mastery items.

| Category | Count | Status |
|----------|-------|--------|
| Regulations | 147 | ✅ Active |
| Airspace | 51 | ✅ Active |
| Weather | 34 | ✅ Active |
| Operations | 99 | ✅ Active |
| Loading & Performance | 12 | ✅ Active |
| Emergency Procedures | — | 🔲 Generate |
| CRM | — | 🔲 Generate |
| Radio Comms | — | 🔲 Generate |
| Airport Operations | — | 🔲 Generate |
| Maintenance | — | 🔲 Generate |
| Physiology | — | 🔲 Generate |
| Remote ID | — | 🔲 Generate |

## UAG Test Format Notes

The real FAA Part 107 UAG test is MCQ-only. Per FAA testing references:

- UAG is **60 questions**, **2.0 hours**, **70 passing score**.
- ACS codes are printed on the **AKTR** for missed-item remediation.
- The ACS/learning-code matching workflow is a **post-test review step**, not a live test question type.

Local extracted references used for these facts:

- `source-materials/PDFtoMD/out_to_ocr/markdown/testing-matrix.md`
- `source-materials/PDFtoMD/out_to_ocr/markdown/learningstatementreferenceguide.md`
- `source-materials/PDFtoMD/out_to_ocr/markdown/uas-testing-information.md`

## Monetization (Freemium)

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 2 practice exams, all study questions, standard explanations |
| Pro | $9.99 (one-time) | Unlimited exams, AI Tutor, weak spot targeting, offline mode |

## Source Materials

All content is based on official FAA public domain sources:

- **FAA-G-8082-22** — Remote Pilot Study Guide
- **FAA-CT-8080-2H** — Airman Knowledge Testing Supplement
- **14 CFR Part 107** — Small UAS regulations
- **UAS Airman Certification Standards** (ACS)

## Tech Stack

- **Web:** Next.js 14, TypeScript, Tailwind CSS → Vercel
- **iOS/Mac:** SwiftUI, Swift 5.9+ → App Store
- **Content:** JSON question bank (shared between platforms)
- **AI:** Claude API (content generation + AI Tutor)
- **Pipeline:** Python + PyMuPDF + Anthropic SDK

## License

MIT — App code is open source.
Question content derived from FAA public domain materials.
