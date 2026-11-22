---
name: mark-display-audit
description: "An audit of LinearMarkDisplay (plugins/marks, the worker encoder, Edit plot, hover, legend, export) on 2026-11-21, its checked and hover items fixed: the interval bins the fused kernel leaves unclipped await a ruling, and two link-identity pointers are unread."
---

# Mark display audit

A pass over `plugins/marks/src/LinearMarkDisplay`, the worker side in
`packages/core/src/util` (`markEncoding.ts`, `featureTransforms.ts`,
`stepTables.ts`) and the hover, legend and export path. Three Opus readers took
a slice each; the main session read `model.ts`, `markConfigViews.ts`,
`markResolveViews.ts`, `markRequest.ts`, `markList.ts` and the default-plot
scan, and found those sound. The items it checked were fixed on this stack,
each with a test; what is below is left.

Each item says how far it was checked. "Checked" means the main session read
the cited code after the reader reported it; "traced" means a reviewer followed
it through the code.

## Open

- **An interval `bin` the fused kernel does not clip still cuts a row along
  its whole length.** A fused bin and aggregate keeps only the fetched
  region's bins (ADR-197); these still make length over step pieces at any
  zoom, and a mark's `maxBpPerPx` does not bound them:
  - an unfused interval `bin`;
  - a `bin` in the display's shared steps with its `aggregate` in a mark's
    list (`lastBinEdges(sharedSteps)`, `markRequest.ts`), which never fuses;
  - a fused pair in the display's shared steps, the facet's own steps or
    ahead of a facet split, which never clips so a click's one-layer rerun
    matches the draw;
  - a fused pair in a layer's own steps followed by any step `isRowwise`
    (`stepOutputs.ts`) says is not row-wise or that writes `refName`, `start`
    or `end`, or a pair right after `cells`.

## Pointers from the hover fix, read, not run

- **`linkOwners.ts` keys a link's feet by refName and bp with no assembly**
  (`footKey`, `linkKeys`), so two identical-looking links on hg38 chr1 and hs1
  chr1 regions in one row would merge into one curve.
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
