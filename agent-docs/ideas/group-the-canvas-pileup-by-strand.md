---
name: group-the-canvas-pileup-by-strand
description: copy alignments' feature-grouping vocabulary; the canvas pileup has no FEATURE grouping at all, and the row grouping that looks like it is a different axis
---

# Group the canvas pileup by strand

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. A feature, and the vocabulary to copy is already written
down.

There is no FEATURE grouping in the canvas pileup path. `applyRowGroups`
(`LinearMultiRowFeatureDisplay/sourcesLogic.ts`) looks like it and is not — it
groups source ROWS, a different axis, and it shipped with its own config slot,
legend and SVG export.

So the vocabulary to copy is `plugins/alignments/src/shared/groupFeatures.ts`:
`GROUP_BY_DIMENSIONS` and its section dividers. Confirmed 2026-08-26 that
neither name appears anywhere under `plugins/canvas`.
