# Features plugin

## Layout is per reference sequence

A feature spanning several displayed regions on one refName gets one Y in all of
them, so regions sharing assemblyName + refName share a layout and others don't.
The key and the region's bounds (`regionKey`, `regionStart`, `regionEnd`) are
stapled onto `LayoutRegionData` at fetch time — **keep them on the region, not
in a parallel map**: a region missing from a map falls into one group with every
other missing region and mis-stacks. Don't derive them from `loadedRegions`
either; that map is empty during the refetch window the display paints through.

**Every bp in the pack is on the drawn axis.** The packer cuts the stretches
hidden between a group's regions (`drawnAxis.ts`), so map anything new it reads
through the group's axis, or two features meeting at a collapsed-intron seam
share a row again and read as one. Rationale:
`agent-docs/reference/FEATURE_TRACK_DECISION_TREE.md`.

## Label space and label ink are one decision

The packer widens each box by its widest visible label, so **`renderedLabelSet`
(`components/labelPositioning.ts`) is the only predicate** for which labels
render — the reservation, the walker and the positioner all read it. Disagreeing
copies fail silently, as reserved whitespace or overhanging text.

Two asymmetries in it are deliberate:

- The description is gated on `showDescriptions` alone, not `showLabels`.
  Descriptions-without-names is a real state (the fit ladder's `labels` rung, v4
  configs).
- A subfeature label is ungated: the worker bakes it. `collapsed` mode
  suppresses it by forcing `effectiveSubfeatureLabels` to `'none'`.

Measure label width at `renderedLabelFontSize`, not `labelFontSize`; they differ
on the `bare` rung. What a rung reserved is `FitRung.reserved`; nothing
re-derives it from the rung's name.
