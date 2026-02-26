# Part 107 Prep — iOS App

## Status

`apps/ios` now includes a committed SwiftUI scaffold plus an XcodeGen project spec.

This gives you a real, repeatable iOS foundation with:
- app target + test target
- API client to the existing web backend (`/api/questions`)
- local fallback question bank (`runtime_question_bank.json`)
- Study tab with live question session flow

## Quick Start

1. Generate project:
```bash
cd apps/ios
xcodegen generate
```

2. Open in Xcode:
```bash
open Part107Prep.xcodeproj
```

3. Build & test from CLI (optional):
```bash
xcodebuild -project Part107Prep.xcodeproj -scheme Part107Prep -destination 'generic/platform=iOS Simulator' build
xcodebuild -project Part107Prep.xcodeproj -scheme Part107Prep -destination 'generic/platform=iOS Simulator' test
```

## Runtime Config

Set these in target build settings (or xcconfig) as `Info.plist` entries:

- `PART107_API_BASE_URL` (String)
  - Example: `https://faa-part-107-prep-9af9.vercel.app`
- `PART107_REQUEST_TIMEOUT` (Number)
  - Default: `15`
- `PART107_USE_LOCAL_FALLBACK` (Boolean)
  - Default: `true`

If API access fails, the app falls back to bundled `runtime_question_bank.json`.

## Folder Layout

```text
apps/ios/
├── project.yml
├── Part107Prep/
│   ├── App/
│   ├── Core/
│   │   ├── Config/
│   │   ├── Models/
│   │   └── Networking/
│   ├── Features/
│   │   ├── Home/
│   │   ├── Study/
│   │   ├── Exam/
│   │   └── Progress/
│   ├── Services/
│   └── Resources/
└── Part107PrepTests/
```

## Next Slice (Recommended)

1. Add mobile-safe auth token flow (do not rely on browser-cookie semantics).
2. Implement Study save/resume parity with web (`part107_study_draft_v1` equivalent).
3. Add `/api/user/*` sync + scoring summary integration.
4. Implement image/figure modal with pinch zoom + fit-width controls to match web behavior.
