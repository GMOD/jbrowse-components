---
name: variant-display-merge
description: "Merging LinearVariantDisplay and LinearMultiSampleVariantDisplay into one LinearVariantDisplay with a records band over genotype rows (Colin, 2026-10-30: \"i'd like convergence\"). Slice one (ADR-254, the SV records band on the matrix display) landed; sub-slices A–E remain, A first: records as the whole display for a sample-less VCF, gated on a dense-gnomAD benchmark. Open: added vs taken band height, default-on, the multi-way key position."
---

# One variant display

The matrix display's model survives (rows, clustering and the tree sidebar are
the hard part); the records band rides on it through plugin-features'
pipeline (`@jbrowse/plugin-features/band`, the seam
`mechanisms/feature-band-consumers.md` names), and the type takes the name
`LinearVariantDisplay`. Slice one is ADR-254; its height rule, default and
admission rule are marked provisional there.

## Sub-slices, smallest first

- **A. Records as the whole display.** With no genotype rows (no samples, or a
  `genotypes.show` off), the rows take 0 px and the records band becomes the
  remainder under `heightMode`, not the 170 px band cap. Gate: benchmark a dense
  gnomAD window, band (main-thread pack, Canvas2D `paintFeatureBand`) against
  today's `LinearVariantDisplay` (worker pack, GPU); if clearly slower, route
  records-only through `RenderFeatureData`. Seen 2026-10-30 on ClinVar
  chr17:43,100,000-43,103,000: the band reserved 170 px for a ~50 px thinned
  stack, over an empty grey rows area.
- **B. Records settings move under `records`**: `displayMode`, `mark`,
  `facet` (sections), `maxFeatureScreenDensity`; `tooltip.field`; the color
  scale's `identity`. Amends ADR-231.
- **C. The merge.** One type; `LinearMultiSampleVariantDisplay` is beta-only
  (no v4.3.0 hit), so only a `@deprecated` `retiredTypes` alias while hosted
  writers carry it; `MultiLinearVariantDisplay` and `LinearVariantMatrixDisplay`
  (real v4) move over. Re-root `basicRetired`/`migrateBasicConfigSnapshot`
  under `records`, including v4's `renderer.displayMode`. The
  `hasPlugin('FeaturesPlugin')` gate (`LinearVariantDisplay/index.ts`) goes.
  Sweep: R export `READERS` (`rScript.ts`), launch-args aliases
  `multivariant`/`multivariantmatrix`, jbrowse-img `applyTrackOpts.ts`, tables
  engine, figure specs, config docs, tutorials, test_data. New ADR superseding
  ADR-250, amending ADR-168, ADR-232 and VARIANTS_DISPLAY.md.
  Blocked until: B lands (today's `facet` is section facets and top-level
  `growMaxHeight` a track grow cap, both meaning something else on the
  matrix, so `retiredTypes` must move them under `records`, not pass them
  through); a record click shows full INFO (`enrichFeatureFromClick.ts`
  builds a slim feature; `LinearVariantDisplay` re-fetches); R export picks
  `jbrowse_features` for a sample-less track in the rename's commit. Band gaps
  that are additive, not blocking: `featureContextMenu.ts`'s rows (zoom to,
  sequence, highlight, hide/show only, copy), search-hit highlight,
  `sortReadsMenu.ts`, `tooltip.field`.
- **D. Outside writers**: jb2hubs (`pangenomeLinks.ts`, `config/jbrowse.ts`,
  pangenome-config JSONs), ggjbrowse (`R/variants.R`), redeployed demo
  configs; then drop the alias.
- **E. Defaults and height.** Whether records show by default; added vs taken.

## Open calls (Colin)

- **Added vs taken.** Captures favor added: taking 170 px from a 40-sample
  matrix drops rows to ~2.5 px and loses labels. Taken moves the rows on pan;
  added moves the track's height on pan. Switch point: `availableHeight` in
  the multi-sample `model.ts`.
- **The multi-way synteny key** now sits under its anchor lane over the next
  lane (`FloatingLegend` `pushedDown`).

## Evidence

Write-ups (claude.ai artifacts): the eight-review decision
`5FzxxtApj1gxYQEnX1yC6U`, band height `9Y7TGDk8PtSam8g5Rajb7v`, slice one
`AVbDTzGnE2g4zcFECrMN5U`.
