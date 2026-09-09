---
name: look-at-the-mark-layers-guides-in-a-real-browser
description: the bar shape, the frame plan, the chrome-placed legend and the chrome-placed axis all landed on jsdom and MockHal alone; one real-browser pass over the displays that moved is owed before release
metadata:
  area: rendering, chrome
  category: ready
  order: 3
  first_move: "build jbrowse-web, then `node browser-tests/runner.ts --backend=all --skip-webgpu --swiftshader --gate-only --ci-gate` for the bar shape and the frame plan, and a screenshot pass (jbrowse-capture) over a multi-row, HiC, variants, multi-wiggle, Manhattan and mark-display track with the legend and axis on"
---

# Look at the mark layer's guides in a real browser

The 2026-09-09 mark-grammar pass (ADR-106 through ADR-109) moved what draws
on screen and in exports without a browser seeing it:

- The `bar` shape (`packages/render-core/src/marks/barMark.ts`) has MockHal
  uniform tests and jsdom Canvas2D paints; no GPU capture, and
  `browser-tests/compare-backends.ts` has not run over it or over the frame
  plan (`planMarks`).
- The chrome-placed legend (ADR-108) moved pixels in three export snapshots
  re-recorded on jsdom, and the multi-wiggle's caption-plus-key stack and the
  Hi-C key under its resolution box moved onto `legendTop` unseen.
- The chrome-placed axis (ADR-109) draws the single wiggle's, Manhattan's and
  the mark display's axis, hatches and rules from `ChromeYAxis` and
  `SvgYAxis`; on-screen DOM order changed (the axis now sits after the body's
  other overlays), which jsdom cannot judge.
- The mark display's glyph legend draws the plot's glyph as the swatch
  through render-core's own painter; only its SVG path data is pinned.

What "done" looks like: the gate run is green or its drift is read against
[reference/CROSS_BACKEND_GATE.md](../reference/CROSS_BACKEND_GATE.md), and a
screenshot per display above shows the key and the axis where the jsdom
snapshot says they are. A pixel that moved is a finding for the ADR that moved
it, not for this entry.
