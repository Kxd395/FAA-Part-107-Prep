# Figure Context Audit

- Generated: 2026-03-13T22:17:08.713Z
- Total questions audited: **141**
- Questions with `figure_reference`: **16**
- Questions with `(Refer to ... Figure N)` prompt: **16**
- Questions with usable visual context: **16**
- Issues found: **0**

## Rules enforced
- If prompt includes `Refer to ... Figure N`, `figure_reference` must exist and match.
- Figure-based questions must provide at least one visual context path:
  - valid `image_ref` file in `apps/web/public`, or
  - local `public/figures/<figure_reference>.png`, or
  - non-empty `figure_text` fallback.
- If `image_ref` is present, file must exist.
- If citation names a figure, it must match `figure_reference`.
- Figure-context questions must include provenance metadata:
  - `source_pdf` (non-empty string)
  - `source_figure` (must match resolved figure)
  - `source_page` (positive number or `null` when unknown).
  - `source_locator` (non-empty string, e.g., `Figure 20, area 3`).

## Issues
- None.
