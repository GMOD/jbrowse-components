---
name: alignments--canvas
description: seven independent small items
metadata:
  area: alignments, canvas
  category: ready
---

# Alignments / canvas

- Group by strand, `plugins/canvas`. There is no FEATURE grouping in the canvas
  pileup path today — `applyRowGroups`
  (`LinearMultiRowFeatureDisplay/sourcesLogic.ts`) groups source ROWS, which is a
  different axis and shipped with its own config slot, legend and SVG export — so
  the vocabulary to copy is still
  `plugins/alignments/src/shared/groupFeatures.ts` (`GROUP_BY_DIMENSIONS`,
  section dividers).
- Sample/library (SM/LB) grouping. `RG` already works via the generic tag
  dimension, but SM/LB live in the header's `@RG` lines, not in the record, so
  this needs an RG→SM/LB map from the adapter.
- Separate quantitative splice-junction track. Sashimi exists only as an overlay
  (`plugins/alignments/src/features/sashimi`).
- Toggle off tooltips for `LinearMultiSampleVariantDisplay`. This is a re-add:
  the old `showTooltips` prop was dropped in the rewrite (see the legacy-props
  comment in `shared/MultiSampleVariantBaseModel.ts`).
- Add a "hide this feature" option to `LinearMultiSampleVariantDisplay` (and
  similar displays). `plugins/canvas` already has `hideFeature`
  (`LinearBasicDisplay/baseModel.ts`) to copy.
- Say how many features are under the cursor in a collapsed pileup,
  `plugins/canvas`. The density collapse pins sub-pixel marks to row 0, where
  several share a pixel column; `performMultiRegionHitDetection` resolves the
  topmost, so the rest can be seen (they fade, so the column's opacity tracks
  how many there are — `pileupFadeIds`) but never inspected. The count is
  already in hand at hit time: the flatbush search returns every match before
  `topmostMatch` picks one. A tooltip line ("+3 more here") is probably the
  whole job; a click-to-list is the larger version.
- Name the base in the coverage tooltip's `Ref` row. That row reports the count
  (depth minus the alts) and cannot say `Ref (G)`, because the reference base is
  not on the main thread: `executeRenderAlignmentData` fetches `regionSequence`
  only under bisulfite colouring and ships it to nobody. Shipping it per fetch
  to letter one tooltip row is the wrong trade, so the version worth costing is
  a one-base fetch on hover, next to the widget round trip the click already
  makes.
