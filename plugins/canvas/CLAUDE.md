# Canvas plugin

## Layout is per reference sequence

A feature spanning several displayed regions on one refName gets one Y in all of
them, so regions sharing assemblyName + refName share a layout and others don't.
The key is `LayoutRegionData.regionKey`, stapled onto the region at fetch time —
**keep it on the region, not in a parallel map**: a region missing from a map
falls into one group with every other missing region and mis-stacks. Don't
derive it from `loadedRegions` either; that map is empty during the refetch
window canvas paints through.

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
