# Part 107 Prep Architecture (ASCII)

Last updated: 2026-02-24
Owner: @kevindialmb

## 1) System Context
```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                               Browser (Next.js)                              │
│  Pages: /, /login, /study, /exam, /flashcards, /learn, /missed, /progress,   │
│         /charts                                                                 │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                │ HTTP (App Router APIs)
                                v
┌───────────────────────────────────────────────────────────────────────────────┐
│                                Server API Layer                              │
│  /api/questions      /api/auth/session      /api/auth/magic-link             │
│  /api/auth/verify    /api/user/profile      /api/user/state                  │
│  /api/sync/session   /api/sync/upload       /api/sync/download               │
│  /api/_internal/rate-limit-metrics                                          │
└───────────────┬──────────────────────┬───────────────────────────┬────────────┘
                │                      │                           │
                v                      v                           v
        Question Source         Session/Auth Logic          Sync/Auth/Rate Limit
   (local bank + optional       (signed cookie token)        + signature checks
    remote QUESTION_SOURCE_URL)
                │
                v
┌───────────────────────────────────────────────────────────────────────────────┐
│                               Persistence                                    │
│  Client localStorage: progress/adaptive/attempts/events/drafts               │
│  Server .data: user-state-v1.json, sync-store-v1.json                        │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 2) Page & Navigation Topology
```text
[Root Layout Header]
   ├── [/]
   ├── [/login]
   │    ├──> [/study?type=...]
   │    ├──> [/exam?type=...]
   │    ├──> [/study?category=...&type=...]
   │    ├──> [/exam?category=...&type=...]
   │    └──> [/study?type=weak_spots]
   ├── [/study] --------┐
   ├── [/exam] -----┐   │
   ├── [/flashcards]│   │
   ├── [/learn]     │   │
   ├── [/missed]    │   │
   ├── [/progress] <┘<──┘ (all modes feed progress and telemetry)
   └── [/charts]
```

## 3) Runtime Data Flow (Question + Attempt Cycle)
```text
User opens mode page
   -> useQuestionBank()
      -> GET /api/questions
         -> local/remote source validation
         -> response cached snapshot fallback (client-side) on failures

User answers/rates
   -> recordLearningAttempt(...) [shared pipeline]
      -> adaptive.recordAnswer(...) [attempt + scheduling stats]
      -> events.logEvent(type=answer_submitted)
      -> (optional) analytics sink send with retry/dead-letter

Mode-specific queue/session logic
   -> studySession / examSession / learn queue / flashcard queue
   -> saveSession() -> local progress history
```

## 4) Adaptive "ML" Loop (Current Implementation)
Note: current "ML" is adaptive scoring/scheduling heuristics, not a trained model service.

```text
Attempt outcome + confidence + response time
   -> quality score q (0..5)
      -> next interval days (spaced repetition)
      -> queue action:
           q>=4 remove
           q=3 reinsert later (5-8)
           q=2 reinsert soon (2-4)
           q<=1 reinsert very soon (1-2)
   -> stats update per canonical question key
      -> mastery score
      -> nextDueAt
      -> streak / last confidence
   -> progress/insights compute:
      -> due now / due soon
      -> avg confidence
      -> calibration score
      -> overconfidence rate
```

## 5) Multi-User / Sync Path (Current)
```text
Progress page:
   Sign In (dev-only direct)
     -> POST /api/auth/session (set part107_auth cookie)
     -> GET  /api/auth/session (hydrate auth state)
     -> GET  /api/user/state (auto-load account snapshot into import preview)

   Sign In (magic-link flow)
     -> POST /api/auth/magic-link (email link)
     -> POST /api/auth/verify (validate token, set part107_auth cookie)
     -> GET  /api/user/profile + /api/user/state

   Save Account State
     -> PUT /api/user/state (merge|overwrite)
        -> server user-state-v1.json keyed by userId

   Load Account State
     -> GET /api/user/state
        -> import preview
        -> Apply Import -> localStorage updates

Optional device-to-device sync:
   -> POST /api/sync/session (token)
   -> POST /api/sync/upload
   -> GET  /api/sync/download
```

## 6) Storage Map
```text
Client localStorage keys:
  part107_progress
  part107_adaptive_stats_v2
  part107_attempt_events_v1
  part107_learning_events_v1
  part107_flashcard_sr
  part107_learn_draft_v1
  part107_question_bank_snapshot_v1
  part107_analytics_sink_deadletter_v1

Server files:
  apps/web/.data/user-state-v1.json
  apps/web/.data/sync-store-v1.json
```

## 7) Current Constraints
```text
- Adaptive logic is heuristic-based (no external model training/inference service yet).
- Server persistence is file-backed (single-node friendly, not ideal for multi-instance).
- Cloud account merge happens through preview/apply flow (manual conflict confirmation).
- No global auth gate for app pages; auth currently scopes account state endpoints.
```
