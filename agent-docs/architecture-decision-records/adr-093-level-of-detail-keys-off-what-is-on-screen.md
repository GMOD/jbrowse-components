---
status: Accepted
summary: "Level-of-detail decisions key off what is DRAWN, not off the fetch buffer or off which side of the RPC boundary hid something: the isoform badge becomes a width-gated presentation rule (MIN_ISOFORM_BADGE_GENE_PX), `showLabels: 'auto'` gates on the exact on-screen density (labelDensityPerPx) instead of a fetched-span average, and fixed height measures its ladder over the on-screen set and declines a trim that cannot achieve a fit — amends ADR-092"
---

# ADR-093: Level of detail keys off what is on screen

## Status

Accepted (2026-08). Amends
[ADR-092](adr-092-isoform-trimming-is-a-rung-of-the-fit-ladder.md), whose "the
badge is main-thread" consequence recorded that a `longestCoding` gene carries
no badge. That is reversed here, along with the rationale on
`moreIsoformsBadge.test.tsx`'s representative-transcript case. Everything else
in ADR-092 stands.

## Context

Three of this display's level-of-detail decisions were keyed off something other
than the picture the reader is looking at.

**Badge presence named the subsystem, not the loss.** A gene the fit ladder
trimmed carried "+N more"; a gene the WORKER collapsed to one transcript
(`geneGlyphMode: 'longestCoding'`) deliberately carried none, on the reasoning
that the corner chip already names the mode. Two consequences. Crossing 100
bp/px under `auto` — where the mode resolves to `longestCoding` — flipped every
badge on screen, for a reader whose picture had merely got smaller. And
`longestCoding` was left with no per-gene expand affordance: the badge is the
only way to open one gene, and switching the whole track's mode from the chip is
not the same gesture.

**`showLabels: 'auto'` read a region average.** `visibleFeatureDensityPerPx`
(`shared/CanvasFeatureGateMixin.ts`, `shared/regionDensity.ts`) is a region's
feature count divided by its whole FETCHED span, and the fetch buffers half a
viewport either side. So names and descriptions toggled off the buffer's
average, and a refetch that widened the buffer moved the verdict with nothing on
screen changed — while the exact on-screen set (`onScreenFeatureIds`) already
existed for the fit ladder and the scroll extent.

**Fixed height measured the whole fetch buffer.** `fitMeasureFeatureIds` was
fit-only, so fixed mode chose its rung and solved its isoform count over every
buffered feature: an off-screen cluster trimmed the genes in view. And where no
count fit, `solveIsoformCount` answered 1 — right for fit mode, whose
`decimated` and `bodies` rungs inherit it, and wrong for fixed, which has no
rung below the trim: the reader lost every transcript AND still scrolled.

A fourth, smaller: `fitDrops` reported "some names hidden" whenever the
`decimated` rung survived, but that rung commits at whitespace factor 0 whenever
the unseeded pack fits where the seeded `labels` pack did not (see
`solveLabelRoomFactor`), and factor 0 drops no name — `keepFeatureLabel` asks
for `room >= width * 0`, and `labelOverhangRoomPx` never returns a negative
room.

## Decision

**What is drawn decides. Not what was fetched, and not which side of the RPC
boundary did the hiding.**

- **The badge is a width-gated presentation rule.** A gene showing fewer
  isoforms than it has carries the badge iff its name is drawn AND its drawn
  extent is at least `MIN_ISOFORM_BADGE_GENE_PX` (100) wide — uniformly across
  ladder trims, worker collapses and expanded genes ("show fewer" gets the same
  gate). The gate is what keeps the zoomed-out crowd readable, and it is a
  property of the picture rather than of the mode, so it does not flip a
  screenful of badges at a zoom threshold. `planIsoformTrims` (`isoformTrim.ts`)
  returns `{ trims, badges }` and applies the gate itself, which is what stops
  `decideLabelReservations`' pricing and `applyIsoformTrim`'s writing from
  disagreeing about a badge. A worker-collapsed gene stays OUT of `trims` —
  nothing is dropped on the main thread there — so `isoformPicks.byCap` and the
  `full` rung's array identity are unchanged.

- **`auto` gates on the on-screen density.** `labelDensityPerPx`
  (`baseModel.ts`) is `onScreenFeatureIds.size` over the summed `widthPx` of the
  view's coarse blocks, and `showLabels` / `effectiveShowDescriptions` read it.
  The thresholds are untouched: `MAX_LABEL_FEATURE_DENSITY` (0.2) and
  `MAX_DESCRIPTION_FEATURE_DENSITY` (0.1) in `zoomThresholds.ts` were already
  written in on-screen terms ("roughly 240 features visible on a 1200px
  screen"), which is what the number now means. The region average keeps its own
  job in the too-large gate (`densityTooLarge`) and stands in while there is no
  window to measure.

- **Fixed height measures the window, and declines a trim that buys nothing.**
  `fitMeasureFeatureIds` narrows in fit and fixed, and stays undefined in grow —
  grow's height IS its content's, so it owes every buffered feature a row to
  grow into, while the other two size a stack to a slot the user set.
  `solveIsoformCount` takes its "even one per gene overflows" answer from the
  caller: fit passes 1, fixed passes undefined and draws the stack whole inside
  the lane's own scrollbar, which is fixed mode's contract.

- **A note reports a loss, not a rung.** `fitDrops` (`fitNotes.ts`) takes the
  committed decimated factor and says "some names hidden" only above 0.

## Consequences

- **The drawing height and the measured height are now different questions in
  fixed mode.** `settledMaxY` returns `maxBottom(fitStage.layout)` unfiltered
  outside fit mode, because it sizes the canvas, the overlay layer and the
  peptide lane through `contentHeight`, and a buffered feature packed below the
  viewport still draws its box and its label. Only fit mode reads the stage's
  narrowed `contentHeight` there, where the scale makes the two the same
  measurement. `scrollExtentMaxY` was already narrow and is unchanged.

- **Fixed mode's resolved stage can be `isoforms` with `maxIsoforms:
  undefined`** — the rung packing the base layout because no count fit. Both
  consumers read that correctly already: `renderedShowDescriptions` treats a
  non-fit `isoforms` rung as descriptions-kept, which is what the base pack did,
  and `geneGlyphIsoformCap` reads undefined, so the chip and the badges stay
  quiet about a trim that did not happen.

- **`truncatedFeatureCount` narrows in fixed mode too.** Its own rationale
  already said a buffer-inclusive count lies — it is surfaced as "N not shown
  (filter or zoom in)" about features a pan would have revealed.

- **`showLabels` now depends on the fetched data.** It reads
  `onScreenFeatureIds`, so `layoutReady` and `onScreenFeatureIds` moved into an
  earlier views block than the label getters. Nothing in that chain reads a
  label flag, so there is no cycle, but a getter added between them has one
  fewer place it can go.

- **A `longestCoding` gene at working zoom carries a badge, and clicking it
  refetches.** The per-gene expansion is still the worker's
  (`expandedGeneIds` is an RPC cache key), which is exactly what ADR-092 left in
  the worker. The badge is what reaches it.
