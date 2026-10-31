---
name: variant-display-merge
description: "Merging LinearVariantDisplay and LinearMultiSampleVariantDisplay into one LinearVariantDisplay with a records band over genotype rows (Colin, 2026-10-30: \"i'd like convergence\"). Slice one (ADR-254, the SV records band on the matrix display) landed; sub-slices A (records as the whole display with no rows, density gate included) and B (record settings under `records`) built, then the pre-C steering (one record color rule, records on by default, the band as one seam) and C1 (ADR-255: one `LinearVariantDisplay`, the multi-sample name a deprecated alias); C2, D and E remain. Open: added vs taken band height, the default `height`, the multi-way key position."
---

# One variant display

The matrix display's model survives (rows, clustering and the tree sidebar are
the hard part); the records band rides on it through plugin-features'
pipeline (`@jbrowse/plugin-features/band`, the seam
`mechanisms/feature-band-consumers.md` names), and the type takes the name
`LinearVariantDisplay`. Slice one is ADR-254; its height rule and admission
rule over rows are marked provisional there (the default is settled: on).

## Sub-slices, smallest first

- **A. Records as the whole display.** Built (ADR-254's amendment): with no
  rows (no samples, or `genotypes.show` off) the band is the display under
  `heightMode`, every record in its SV class color or `featureDefaultColor`, labels and fit by the
  records on screen, a click reading the record's INFO. The benchmark is in
  reference/MULTI_SAMPLE_VARIANTS.md. The density gate is done (ADR-254's
  amendment): `records.maxFeatureScreenDensity` through `FeatureGateMixin`,
  records-only alone. Left: the default `height`
  (open calls below), and the row-only menus (Rows,
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
- **Before C (built, ADR-254's third amendment).** A cold review found the
  band accreting a mode switch, `recordsOnly` branching at 39 sites. One
  record color rule in both modes (SV class, otherwise
  `featureDefaultColor`; the SV type key wherever an SV draws);
  `records.show` on by default (a SNV-only file spends 0 px); the band's
  members lifted into `recordsBandViews.ts`, which the model composes in
  order, so the model holds one `recordsOnly` site (`withClickedSample`).
  Still branching outside it: `multiSampleVariantMenuItems.ts` (5),
  `RecordsBandOverlay.tsx` (4), `variantTopBands.ts` (3, its input).
  Figure specs that now draw the band over SV rows, unreshot: `ui.ts`
  (`multisv_rhd`, which also shows `kgp_sv_records` beside it, `multisv`,
  `multisv_svtype`), `paper-cohort.ts`, `popgen.ts`, `pangenome.ts`,
  `graph-ecoli.ts`, `dog10k.ts` (`dog10k_fgf4_svs`, `dog10k_nhej1_svs`); the
  SNV callsets (`trio.ts`, `protein_variants.ts`, `variants.ts`, the dog10k
  SNVs) only if an allele reaches `SV_MIN_LENGTH` in frame. None wrote
  `records: { show: true }`.
- **C1. The rename.** Built (ADR-255): the multi-sample model is
  `LinearVariantDisplay` in `plugins/variants/src/LinearVariantDisplay/`,
  the feature-based one deleted; `retired.ts` declares
  `LinearMultiSampleVariantDisplay` (deprecated alias),
  `MultiLinearVariantDisplay` and `LinearVariantMatrixDisplay`, and re-roots
  v4's feature-display keys under `records`; no plugin gate; a right-clicked
  record gets plugin-features's zoom to, get sequence and copy rows and the
  read sort. Left from C1: LinearBasicDisplay's Highlight and Show/hide (pin,
  show only, hide) rows on a record. Hiding wants the record out of the
  cells as well, a worker-side id filter (the parked
  `ideas/ready/give-the-multi-sample-variant-display-a-hide-this-feature-item.md`),
  and highlight wants ink on the band.
- **C2. The sweep.** Writers that still spell
  `LinearMultiSampleVariantDisplay` or write the betas' top-level
  `displayMode`/`mark`/`labels`/`facet`/`tooltip.field` on a
  `LinearVariantDisplay` (which no longer lift, ADR-255): test_data
  (`config_demo.json`, volvox, breakpoint, dog10k, protein3d), figure specs,
  docs and tutorials (39 `website/docs` mentions), the examples-site
  nextstrain configs, `tables.ts`, the jbrowse-web tests and browser-test
  suites; R export `READERS` (`rScript.ts`) picks `jbrowse_features` for a
  sample-less track; launch-args aliases `multivariant`/`multivariantmatrix`
  and `displaySettings.ts`; jbrowse-img `applyTrackOpts.ts`; product-core's
  `pruneUnbuildableNodes.ts` comment; the jbrowse-authoring skill. File
  names inside `LinearVariantDisplay/` still say MultiSample
  (`multiSampleVariantMenuItems.ts`, `setupMultiSampleVariantAutoruns.ts`);
  the RPC names are wire names and stay.
- **D. Outside writers**: jb2hubs (`pangenomeLinks.ts`, `config/jbrowse.ts`,
  pangenome-config JSONs), ggjbrowse (`R/variants.R`), redeployed demo
  configs; then drop the alias.
- **E. Height.** Added vs taken. (Records showing by default is settled: on.)

## Open calls (Colin)

- **The default `height`** is 200, against the feature track's 100. A
  sites-only VCF, records-only under C1, then opens twice a
  `LinearVariantDisplay`'s height; over rows 200 is the matrix's.

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
