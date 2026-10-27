---
status: Accepted
summary: "The multi-sample variant display draws no variant lane: the `variants` band (`show`, `height`, `labels`), its overlay, hit test, menu entries, SVG export band and `variantTopBands.ts` are deleted, and `rowsHeaderHeight` is the connector zone alone. The records themselves, with nesting, labels and a layout of their own, are a `LinearVariantDisplay` track over the same VCF above the genotype display, as `multisv_rhd` already composes it. The lane was one 40px row (`flattenRows`, ADR-037) taken out of the genotype rows, so a nested SV could not stack under the one holding it. Amends ADR-232, which named and kept the band, and ADR-037, whose `flattenRows` opt-out leaves plugin-features with it"
---

# ADR-250: The multi-sample variant display draws no variant lane

## Status

Accepted (2026-10-26), Colin: the lane is "completely unadequate at showing
nested SV", the display needs "true plugins/features layouts for these", and the
lane "is not helping much". Amends ADR-232, which renamed the band `variants`
and froze its slot paths for 5.0.0, and ADR-037, whose `flattenRows` opt-out
the lane was the only consumer of.

## Context

- **The lane is one row.** It packs every record onto row 0 with
  `flattenRows` (ADR-037) in a 40px band, 120px at most, taken from the
  genotype rows' `availableHeight`. Stacking was its first form and was
  dropped (`ad1fa4d8ee`): the callset it was measured on stacked to 68px, and
  the fit ladder paid for that in the band by dropping every name.
- **Nested records cannot show.** Shot on 2026-10-26 over the 1000 Genomes
  ensemble SV callset at the RHD locus (200 kb, 3202 samples), the lane drew
  one bar for the 6.23 Mbp deletion spanning the window and none for the calls
  inside it. The genotype rows already show each deletion's boundaries as a
  block of carriers. Over 50 kb of 1000 Genomes SNPs the lane added rsIDs and
  allele changes, which a `LinearVariantDisplay` track labels as well.
- **A real layout already exists.** `LinearVariantDisplay` lays out one record
  per row, takes `displayMode`, filters and menus, and stacks nested records.
  The `multisv_rhd` figure already puts it above the genotype display as a
  second track at its own height.
- **The default was off.** `variants.show` defaulted to `false`, so the
  lane was a setting the figure specs turned on.

## Decision

The display has no lane.

- `variants` leaves `LinearMultiSampleVariantDisplayConfig`, with
  `showVariantLane`, `variantLaneHeight` and their actions, the "Variant lane"
  and "Variant lane labels" Show entries, `VariantLaneOverlay`,
  `buildVariantLaneHit`, `buildLaneRenderData`, `laneDisplayConfig`, the lane's
  fit-ladder views, its SVG band and `variantTopBands.ts`.
- `rowsHeaderHeight` is `lineZoneHeight`, which is 0 at genomic positions, so
  the genomic layout's rows start at the top of the display.
- A reader who wants the records over the genotypes adds a
  `LinearVariantDisplay` track over the same VCF above the display. A view shows
  a track once, so a session track with its own `trackId` carries the second
  display, as `rhdPanel` does.
- 5.0.0 is the first release to freeze these slot paths, so no lift reads a
  stored `variants` object.

## Rejected alternatives

| Alternative | Why not |
| --- | --- |
| Un-flatten the lane: drop `flattenRows`, add a `displayMode`, size the band to its packed rows | The packing is shared and comes free. The height does not: the band's pixels come from the genotype rows, so 20 nested rows crowd out the samples. Capping the band and scrolling it, or sharing the track's height by a rule, builds a second `LinearVariantDisplay` that competes with the matrix for space |
| Flip `variants.show` to `true` | The lane shows one bar where records nest, so the default would put a misleading strip on every SV view |
| Keep the lane for SNPs only | A mode that is right for one record density and wrong for another is two features behind one toggle |

## Consequences

- **Figures move.** The `variants: { show: true }` entries leave the figure
  specs, so each figure gains the band's 40px for its rows. The figures need a
  reshoot, and a figure that read its records off the strip wants a
  `LinearVariantDisplay` track in its session.
- **plugin-features loses what only the lane used.** `flattenRows` and the
  one-row label drop it enabled, `paintFeatureBand`, and the index's block of
  band-as-functions exports go. The layout, fit and hit-test functions stay,
  unexported, for the feature display's own use.
- **Writers outside this repo.** jb2hubs writes `variants: { show, height,
  showLabels }` into its pangenome configs and links, and the graph plugin's
  figure sessions may too. A closed-schema bundle drops the key without a
  message, so hosted configs keep working and lose the strip until their
  writers change.
