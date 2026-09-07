---
name: unifying-plugins-alignments-src-linearalignmentsdisplay-spanoverlaps-ts-with-plugins-canvas
description: Unifying `plugins/alignments/src/LinearAlignmentsDisplay/spanOverlaps.ts` with `plugins/canvas/src/shared/mergeSpans.ts` on core's `mergeIntervals`
area: performance-and-measurement
---

# Unifying `plugins/alignments/src/LinearAlignmentsDisplay/spanOverlaps.ts` with `plugins/canvas/src/shared/mergeSpans.ts` on core's `mergeIntervals`

—
declined 2026-09-02 by the LinearAlignmentsDisplay review. Canvas merges
`[start, end]` tuples on a hot path, alignments merges `{start, end}` objects
fed sorted by construction, and `mergeIntervals` always sorts a copy, so it
cannot back the sorted-input entry point without paying the sort the caller
already avoided.
