---
name: variant-display-merge
description: "Merging LinearVariantDisplay and LinearMultiSampleVariantDisplay into one LinearVariantDisplay with a records band over genotype rows (Colin, 2026-10-30: \"i'd like convergence\"). Slice one (ADR-254, the SV records band on the matrix display) landed; sub-slices A (records as the whole display with no rows, density gate included) and B (record settings under `records`) built, then the pre-C steering (one record color rule, records on by default, the band as one seam) and C1 (ADR-255: one `LinearVariantDisplay`, the multi-sample name a deprecated alias) and C2 (the in-repo sweep); D remains; E is settled: records-only opens at its stack up to 200, once, and over rows the band is every record, added to the track, its rows hiding past the cap (ADR-254's fifth amendment). Open: the multi-way key position."
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
  rows (no samples; since ADR-254's sixth amendment not `genotypes.show` off,
  which keeps the band's look over rows) the band is the display under
  `heightMode`, every record in its SV class color or `featureDefaultColor`, labels and fit by the
  records on screen, a click reading the record's INFO. The benchmark is in
  reference/MULTI_SAMPLE_VARIANTS.md. The density gate is done (ADR-254's
  amendment): `records.maxFeatureScreenDensity` through `FeatureGateMixin`,
  records-only alone. The Rows, Clustering and arrangement menus go while
  no row draws (`drawsRows`). Left: "Color by" still offers the row colors,
  and the rows panel's scrollbar stays mounted (invisible, under the band)
  with no rows. Over rows the band's height
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
  Still branching outside it: `variantDisplayMenuItems.ts` (5),
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
  read sort and Highlight; search hits box records on the band and the
  breakpoint split view finds them (`searchFeatureByID`); the R export,
  launch args and jbrowse-img read the one type. Left from C1:
  LinearBasicDisplay's Show/hide rows (pin, show only, hide) on a record.
  Hiding wants the record out of the cells as well, a worker-side id filter
  (the parked
  `ideas/ready/give-the-multi-sample-variant-display-a-hide-this-feature-item.md`).
- **C2. The sweep.** Built: nothing in-repo writes
  `LinearMultiSampleVariantDisplay` but the alias declaration, its
  back-compat tests and the generated schema and migration tables; the one
  beta top-level record key (`tcga.ts`'s unused ClinVar track) sits under
  `records`. The tutorials and user guides no longer route through
  **Display types** to reach the rows. File names inside
  `LinearVariantDisplay/` are neutral; the RPC names (and
  `shared/components/MultiSampleVariantClusterDialog.tsx`, beside them) stay.
  Left from C2, for a reshoot: the
  `variants/trio_phased_matrix` tour, whose Display types steps are gone and
  whose first caption changed (refilm); figures whose default display is now
  the rows (`trio-basic`, `volvox_variants`, `variant_with_pileup`,
  `variant_panel`); `figure-manifest.json`, `liveLinks.generated.ts` and the
  config docs regenerate on push.
- **D. Outside writers**: jb2hubs (`pangenomeLinks.ts`, `config/jbrowse.ts`,
  pangenome-config JSONs), ggjbrowse (`R/variants.R`; `jbrowse_features`
  reads a records-only track's settings as the R export hands them over),
  jb2plugins/jbrowse-plugin-graphgenomeviewer
  (`src/WalkFormsAdapter/formsMenu.ts` `FORMS_DISPLAYS`, matched by
  `Core-extendPluggableElement` at :196, names only
  `LinearMultiSampleVariantDisplay`, so its forms menu is gone until it
  names `LinearVariantDisplay`), JBrowseR, the hosted demo configs (the
  in-repo `demos/` and the `scripts/build_*.sh` outputs on S3 are swept but
  not redeployed); then drop the alias.
- **E. Height.** Records-only height settled (ADR-255's amendment): the
  first layout with a record on screen sets `height` once to the stack, up
  to 200 (`settleRecordsOpeningHeight`, `recordsBandViews.ts`); a pan
  never moves it. Over rows (ADR-254's fifth amendment): every record, the
  band added to the track above the rows, record rows past the cap hidden
  and counted by a chip, one row past the density budget. (Records showing
  by default is settled: on.) Left: refilm the figures whose VCF draws rows,
  since the band now draws its small records over them too.

## Open calls (Colin)

- **The multi-way synteny key** now sits under its anchor lane over the next
  lane (`FloatingLegend` `pushedDown`).

## Evidence

Write-ups (claude.ai artifacts): the eight-review decision
`5FzxxtApj1gxYQEnX1yC6U`, band height `9Y7TGDk8PtSam8g5Rajb7v`, slice one
`AVbDTzGnE2g4zcFECrMN5U`.
