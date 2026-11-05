# Features plugin

- **Keep a layout region's key and bounds (`regionKey`, `regionStart`,
  `regionEnd`) on `LayoutRegionData`**, stapled at fetch time. Regions sharing
  assemblyName + refName share a layout, so a feature spanning them gets one Y.
  In a parallel map, a missing region falls into one group with every other
  missing region and mis-stacks; derived from `loadedRegions`, they vanish
  during the refetch window the display paints through.
- **Map anything new the packer reads through the group's drawn axis**
  (`drawnAxis.ts`). The packer cuts the stretches hidden between a group's
  regions, so a raw genomic bp lets two features meeting at a collapsed-intron
  seam share a row again and read as one.
- **`renderedLabelSet` (`LinearBasicDisplay/components/labelPositioning.ts`) is
  the only predicate for which labels render** — the packer's reservation, the
  walker and the positioner all read it. A disagreeing copy fails silently, as
  reserved whitespace or overhanging text.
- **Measure label width at `renderedLabels.fontSize`, not `labelFontSize`**;
  they differ on the `bare` rung. What a rung reserved is `FitRung.reserved`;
  nothing re-derives it from the rung's name.
