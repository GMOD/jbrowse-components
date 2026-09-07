---
name: a-scratch-rect-for-the-off-screen-mate-hit-test
description: A scratch rect for the off-screen mate hit test
area: performance-and-measurement
---

# A scratch rect for the off-screen mate hit test

measured 2026-08-20 and
declined, because it moves the cost onto the hotter of the two paths.
`offscreenMateRectAt` allocates a rect per alignment and `offscreenMateAt`
throws each one away, once per alignment on every pointer move inside the
strip — the `makeCornerScratch` case exactly, and the strip hover is
allocation-dominated (15.6ns per mark before, 7ns after). Two shapes tried,
`offscreenMateOverlay.bench.ts`, three interleaved samples each, controls
0.96-1.04, mins on the reliable rows:

- a `{x, width}` scratch the draw copies into a rect literal — strip hover
  0.039 -> 0.019ms (demo), 0.78 -> 0.35ms (50k); **repaint 0.297 -> 0.439ms
  and 4.96 -> 6.00ms**.
- the scratch IS the rect, pushed on a hit and replaced — same hover, repaint
  0.297 -> 0.370ms and 4.96 -> 5.56ms. Better, still a regression.

**The repaint runs on every pan frame and the strip hover only when the
pointer is on six pixels of the band**, so 12-25% on the first does not buy
50% on the second. Both shapes lose on both fixtures that measure reliably;
the 250k row read faster with the scratch, and that row's own spread
(23.6-52.4ms across these samples, on untouched code) is wider than the
difference. What would actually pay is not allocating rects at all — flat
`xs`/`widths`/`ids` arrays for the whole lane — and that is a rewrite of
`labelRuns` and `placeLabels`, which read the rects, not a draw-loop change.
