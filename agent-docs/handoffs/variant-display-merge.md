---
name: variant-display-merge
description: "Merging LinearVariantDisplay and LinearMultiSampleVariantDisplay into one LinearVariantDisplay with a records band over genotype rows (Colin, 2026-10-30: \"i'd like convergence\"). Slice one (ADR-254, the SV records band on the matrix display) landed; sub-slices A (records as the whole display with no rows, density gate included) and B (record settings under `records`) built; C–E remain. Open: added vs taken band height, default-on, the multi-way key position."
---

# One variant display

The matrix display's model survives (rows, clustering and the tree sidebar are
the hard part); the records band rides on it through plugin-features'
pipeline (`@jbrowse/plugin-features/band`, the seam
`mechanisms/feature-band-consumers.md` names), and the type takes the name
`LinearVariantDisplay`. Slice one is ADR-254; its height rule, default and
admission rule are marked provisional there.

## Sub-slices, smallest first

- **A. Records as the whole display.** Built (ADR-254's amendment): with no
  rows (no samples, or `genotypes.show` off) the band is the display under
  `heightMode`, every record in `featureDefaultColor`, labels and fit by the
  records on screen, a click reading the record's INFO. The benchmark is in
  reference/MULTI_SAMPLE_VARIANTS.md. The density gate is done (ADR-254's
  amendment): `records.maxFeatureScreenDensity` through `FeatureGateMixin`,
  records-only alone. Left: the default `height`
  is 200 against the feature track's 100, and the row-only menus (Rows,
  clustering, row color) still show with no rows, and the rows panel's
  scrollbar stays mounted (invisible, under the band) with no rows. Over rows the band's height
  measures the whole payload, so it steps only on a refetch; whether it
  should instead follow the screen (rows moving on pan) belongs to the added
  vs taken call below.
- **B. Records settings under `records`.** Built (ADR-254's second
  amendment): `records.maxHeight` (was `records.growMaxHeight`; top-level
  `growMaxHeight` is the track's grow ceiling), `records.displayMode` (unset:
  compact over rows, normal without, in `recordsDisplayMode`),
  `records.mark`, `records.facet` (record sections, chips, export),
  `records.tooltip.field`, and `identity` on the display's one
  `encoding.color`. Records-only menus: Feature height, Names/Descriptions,
  Group by → Field.... Left: over rows `records.facet` has no menu row (config
  only), and the sample "Group by" hides with no rows while Rows, clustering
  and row color still show.
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
  The move from a `LinearVariantDisplay` config, B having built every target:
  `displayMode`, `mark`, `labels`, `facet`, `maxFeatureScreenDensity` and
  `tooltip.field` go under `records`; `tooltip.show`, `heightMode`,
  `growMaxHeight`, `height`, `filter`, `encoding` and `legend` stay top-level.
  v4's `renderer.displayMode`, `featureHeight` and `mouseover` re-root to
  `records.displayMode`, `records.mark.height` and `records.tooltip.field`;
  v4's `maxHeight` still drops rather than becoming `records.maxHeight`. A
  `LinearVariantDisplay` config that never wrote `displayMode` lands unset,
  so over a sampled VCF's rows it draws compact, the SV band's look.
  Blocked until: a record click shows full INFO (`enrichFeatureFromClick.ts`
  builds a slim feature; `LinearVariantDisplay` re-fetches); R export picks
  `jbrowse_features` for a sample-less track in the rename's commit. Band gaps
  that are additive, not blocking: `featureContextMenu.ts`'s rows (zoom to,
  sequence, highlight, hide/show only, copy), search-hit highlight,
  `sortReadsMenu.ts`.
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
