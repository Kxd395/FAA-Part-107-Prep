# Virtualization Threshold Notes

Last updated: 2026-02-24

## Current thresholds
- `Progress` history virtualization threshold: `250` sessions
- `Progress` virtual window size: `80` rows
- `Progress` row estimate: `108px`
- `Missed` virtualization threshold: `300` entries
- `Missed` virtual window size: `90` rows
- `Missed` row estimate: `124px`

## Why these values
- Keep normal usage paths in simple paged mode (`Load More`) for lower implementation complexity.
- Switch to virtualized rendering only for extreme local datasets where initial mount cost becomes noticeable.
- Maintain enough buffered rows (`80-90`) to avoid visible pop-in during scroll on desktop and mobile.

## Known limitations
- Row-height estimates are static and can drift for unusually long question text.
- Filtering/sorting still processes full arrays before virtualization windowing.
- Thresholds are heuristic and should be tuned with real production telemetry.

## Follow-up tuning plan
1. Capture render timings in browser profiling for 100/250/500/1000 row datasets.
2. Compare window sizes (`50`, `80`, `120`) for scroll smoothness and CPU time.
3. Move thresholds into runtime config once benchmarks stabilize.
