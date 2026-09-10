---
name: look-at-the-mark-layers-guides-in-a-real-browser
description: the bar shape, the frame plan, the chrome-placed legend and the chrome-placed axis all landed on jsdom and MockHal alone; one real-browser pass over the displays that moved is owed before release, and this run also re-baselines the cross-backend distribution, which no longer matches any commit
metadata:
  area: rendering, chrome
  category: ready
  order: 2
  first_move: "build jbrowse-web at HEAD (the tree has moved ~900 commits past the last gate build), check `ps -Ao command | grep runner.ts` is empty for this worktree, then `node browser-tests/runner.ts --backend=all --skip-webgpu --swiftshader --gate-only --ci-gate --drift-report` for the bar shape, the frame plan and the new baseline, and a screenshot pass (jbrowse-capture) over a multi-row, HiC, variants, multi-wiggle, Manhattan and mark-display track with the legend and axis on"
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

**This run also carries the re-baseline**, which is why it moved up the list.
The 66-pair distribution CROSS_BACKEND_GATE.md §"What made a blocking gate
possible" records (max 0.62%, median 0.00%) predates the mark-grammar pass and
about 900 other commits, so nothing in the tree currently matches it — the AA
ramp entry that used to sit above this one closed on 2026-09-09 for exactly
that reason (§"The AA ramp prediction outlived its instrument"). Write the new
distribution into that section, dated and with the commit it was measured at.
Take the gate on a quiet worktree with no second `runner.ts`: three of the four
attempts on record died to load or to another run, one of them wedging 23
minutes on `Alignments Track > volvox_sv track screenshot`. If it wedges there
again, that is a finding about the alignments capture, and `--filter` the run to
the suites you need.
