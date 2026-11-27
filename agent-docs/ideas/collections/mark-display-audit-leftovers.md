---
name: mark-display-audit-leftovers
description: "What the 2026-11-21 LinearMarkDisplay audit left: a link's far foot placed in another assembly's region that covers its position, and one on no displayed region hovering under an unrecorded assembly's spelling."
---

# Mark display audit leftovers

A pass over `plugins/marks/src/LinearMarkDisplay`, the worker side in
`packages/core/src/util` (`markEncoding.ts`, `featureTransforms.ts`,
`stepTables.ts`) and the hover, legend and export path. Three Opus readers took
a slice each; the main session read `model.ts`, `markConfigViews.ts`,
`markResolveViews.ts`, `markRequest.ts`, `markList.ts` and the default-plot
scan, and found those sound. The items it checked were fixed, each with a
test; what is below is left, re-read against main on 2026-11-26.

Each item says how far it was checked. "Checked" means the main session read
the cited code after the reader reported it; "traced" means a reviewer followed
it through the code.

## Open

- **A far foot lands in another assembly's region that covers its position**,
  even when its own assembly has the contig off screen. `withMateRegions`
  takes the block's own region if it holds the foot, else any displayed
  region on any of the track's assemblies that does (`onRef.find(holds)`).
  A reviewer's probe reproduced it (2026-11-27): a track on P (`chr1`) and Q (`1`) showing P
  `chr1:0-1000` and Q `1:4000-6000` draws P's pair `chr1:100`–`5000` into
  Q's region, at a position in the other assembly's coordinates. Nothing on a
  record says it crosses assemblies, so preferring the own assembly's regions
  looks right, but `badee04f11` chose the cross-assembly search on purpose;
  read why before changing it.

## Pointers from the hover fix, read, not run

- **A far foot on no displayed region hovers with no assembly.** In
  `withMateRegions`, when the track's own assembly has no region of that name,
  `x2CanonicalRefNames` takes another assembly's spelling and which one is not
  recorded. It cannot mix spans, since the refName differs.

## Read and left alone

- Stale layers drawn through a changed mark list are ADR-006's scrim, and
  `hasLanes` plus the stored `request` keep the draw and the details click
  consistent with the payload held.
- `RowKeys` growing only is ADR-165.
- The request key, absolute uint32 output, hit tests against drawn geometry,
  the legend's tables and SVG export were traced by the readers and found in
  agreement.

## Not covered

render-core shape internals beyond `barMark`, `lineMark` and `rowSpanIndex`;
`cellsStep.ts`; core's `colorProblems` and `scaleEndProblems`;
`MarkClusterDialog`'s matrix arguments; `LinearManhattanDisplay`.
