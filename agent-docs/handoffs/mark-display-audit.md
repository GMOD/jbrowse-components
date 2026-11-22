---
name: mark-display-audit
description: "An audit of LinearMarkDisplay (plugins/marks, the worker encoder, Edit plot, hover, legend, export) on 2026-11-21, its checked items fixed: two traced hover findings left open."
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

## Traced, not fixed: hover

- **A point or rect sharing the flatten root with a cross-sequence link
  still hovers a span mixing the two sequences.** `featureInstances.ts`
  `featureSpan` takes min and max over every instance of the root, the
  link's far `x2` included. The link's own hit reads its two feet
  (`findMarkHit.ts`); the other marks of that feature do not.
- **A link between two assemblies' same-named contigs (hg38 chr1 to hs1
  chr1) hovers as one sequence.** `findMarkHit.ts` compares the far foot's
  refName with the near one's and no assembly, so `x2RefName` drops and the
  locus spans both genomes' coordinates. Pre-existing.

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
