---
name: avoiding-the-maf-overlays-forced-style-flush
description: Avoiding the MAF overlays' forced style flush
area: performance-and-measurement
---

# Avoiding the MAF overlays' forced style flush

four shapes costed
2026-08-24 and all four declined: making one overlay pay per frame, moving the
draw off the passive-effect path, a pre-rasterised glyph atlas drawn with
`drawImage`, and putting labels on the GPU path. A production profile books
~249ms self + 247ms of forced style recalc to `DeletionsOverlay` and ~144ms +
140ms to `InsertionsOverlay`, which reads like the largest block in a zoom
gesture. It is not a block anyone can remove.

**The ceiling is exactly 0ms, and the trace says so.** Style flush is per
DOCUMENT, not per canvas, and the harness's `(no stack)` recalc bucket — the
frames' own lifecycle recalcs — is **3.2ms across 27 events while the two MAF
buckets hold 387ms of a 394ms total**. So MAF's forced flushes are absorbing
the frame's own recalc entirely: the document is dirty when the overlay effect
runs, and if MAF does not flush it the frame's lifecycle does, a few hundred
microseconds later, in a task `main busy` also sums. Every avoidance
re-attributes the microseconds; none removes work. rAF deferral additionally
lands labels a frame behind the cells they annotate, which a zoom makes
obvious.

Two further traps in the number itself: `topSelf` (v8 samples) and
`styleRecalc` (Blink trace events) are independent instruments that do not
subtract from each other, so a recalc run synchronously inside `fillText` is
plausibly counted in both — the honest attributable total is ~395-780ms, not
780. And both gates already exist and are correct; a previously recorded
"insertions fell to 40ms" was taken where rows are too short for a letter, so
reading it against a sweep that draws labels looks like a regression and is
not.

**What the investigation actually found**: MAF writes no per-frame inline
styles at all. The dirty set is ~150-160 elements, ~90% of it the ~144 tick
transforms at `ScalebarCoordinateLabels.tsx:81`. **Reopen only** via the
coordinate ruler — see `ideas/give-the-coordinate-ruler-a-genuinely-fixed-tick-pool.md`,
whose priority this raises, since the ruler turns out to be charging four
other subsystems for its dirt.
