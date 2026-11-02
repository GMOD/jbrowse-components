---
name: variant-display-merge
description: "Merging LinearVariantDisplay and LinearMultiSampleVariantDisplay into one LinearVariantDisplay with a records band over genotype rows (Colin, 2026-10-30: \"i'd like convergence\"). Slice one (ADR-254, the SV records band on the matrix display) landed; sub-slices A (records as the whole display with no rows, density gate included) and B (record settings under `records`) built, then the pre-C steering (one record color rule, records on by default, the band as one seam) and C1 (ADR-255: one `LinearVariantDisplay`, the multi-sample name a deprecated alias) and C2 (the in-repo sweep); D remains; E is settled: records-only opens at its stack up to 200, once, and over rows the band is every record, added to the track, its rows hiding past the cap (ADR-254's fifth amendment). Open: D (jb2hubs and JBrowseR still name the old type), the trio tour refilm, the scrolled export and split view not yet driven in the app, and whether an SVG export keeps the chips' blank strip."
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
  no row draws (`drawsRows`), and "Color by" offers the records' colors.
  `RowsPanel` mounts only while rows draw (`drawsRows`). Over rows the band's height measures the whole payload, so
  it steps only on a refetch (every record, E below).
- **B. Records settings under `records`.** Built (ADR-254's second
  amendment): `records.height` (was `records.growMaxHeight`, then
  `records.maxHeight` until the seventh amendment made it the band's height
  rather than a cap; top-level `growMaxHeight` is the track's grow ceiling), `records.displayMode` (unset:
  compact over rows, normal without, in `recordsDisplayMode`),
  `records.mark`, `records.facet` (record sections, chips, export),
  `records.tooltip.field`, and `identity` on the display's one
  `encoding.color`. Records-only menus: Feature height, Names/Descriptions,
  Group by → Field.... Left: over rows `records.facet` has no menu row (config
  only).
- **Before C (built, ADR-254's third amendment).** A cold review found the
  band accreting a mode switch, `recordsOnly` branching at 39 sites. One
  record color rule in both modes (SV class, otherwise
  `featureDefaultColor`; the SV type key wherever an SV draws);
  `records.show` on by default (a SNV-only file spends 0 px); the band's
  members lifted into `recordsBandViews.ts`, which the model composes in
  order. `recordsOnly` is read at nine sites outside the seam on
  2026-11-01 (`model.ts` 5, `RecordsBandOverlay.tsx` 3,
  `variantDisplayMenuItems.ts` 1), and the menu branches on `drawsRows`
  instead, so a count well past that is the accretion the review found
  coming back. Inside `recordsBandViews.ts` the label decision is one
  getter (`recordsLabelPlan`). A role table (`recordsRole.scrolls`,
  `.overflow`, `.measures`...) was reviewed and declined: its fields are
  one fact, the band is the display, under seven names, so every site
  still branches and can read the wrong name.
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
  Left from C2: refilm the `variants/trio_phased_matrix` tour, whose
  Display types steps are gone and whose first caption changed (its
  script moved on 2026-10-31, `website/media.lock` last on 10-15).
- **D. Outside writers**: jb2hubs (`pangenomeLinks.ts`, `config/jbrowse.ts`,
  pangenome-config JSONs), JBrowseR, the hosted demo configs (the in-repo
  `demos/` and the `scripts/build_*.sh` outputs on S3 are swept but not
  redeployed); then drop the alias. Done: graphgenomeviewer 8.7.0 attaches
  its forms menu by track type (hosted `latest/` too), and ggjbrowse
  `ccee3b7` writes `genotypes.reference.show` on an engine from `5e6d117f55`.
- **E. Height.** Records-only height settled (ADR-255's amendments): the
  first layout with a record on screen holds `height` once at the stack, up
  to 200 (`settleRecordsOpeningHeight`, `recordsBandViews.ts`), on the
  display and never written; a pan never moves it. Over rows (ADR-254's fifth amendment): every record, the
  band added to the track above the rows, record rows past the cap hidden
  and counted by a chip, one row past the density budget. (Records showing
  by default is settled: on.)

## Left from the audit against the retired displays

Compared with `643ea4fe89^`'s two displays; the plain regressions are fixed
(labels, HTML tooltips, the scrolled export, the split view's record, the
widget's samples). Still differing, besides C1's Show/hide rows:

- A record the adapter does not find launches the split view from the
  click's record, INFO-less, and the junction walk stops there.
- Driven on hosted main (2026-11-01, volvox): the record hover, the record
  menu and the details widget, samples included, on a one-sample and a
  1,094-sample VCF. The scrolled export and the split view's record have not
  been driven in the app.

## Left from the band pass (2026-11-01)

`topBands` is the whole `BandStack`, the live band and the export share
`recordsBandPainter`, hover is one `hovered` slot, and the R export reads
`recordsAlone`. Left:

- **The export's chip strip.** An SVG export reserves `BAND_CHIPS_HEIGHT`
  between the records band and the rows but draws no chips, so figures
  carry a blank ~20px strip. Kept because the export matches the screen;
  undecided whether figures want the rows flush.
- **Driven only through jest:** the single scrollbar with no rows
  (`RowsPanel` mounts only while rows draw) and a band opened on a dense
  window, then zoomed in. The exports were drawn through jbrowse-img from
  the branch (a cohort VCF, a sites-only VCF, LD with connectors on and
  off).
- **A window that opens dense settles nothing**: the band stays one
  collapsed row until a sparser pan or zoom packs a real stack (ADR-254's
  seventh amendment).
- **Toggling genotype rows remounts the GPU canvas**, since `VariantBody`
  moves in and out of `RowsPanel`: one re-upload per toggle, as a layout
  switch already costs.
- **Declined:** splitting `variantDisplayMenuItems.ts` by band (its 14
  `drawsRows` checks each name their own rule), and the `recordsRole` table
  (the "Before C" bullet).

## Evidence

Write-ups (claude.ai artifacts): the eight-review decision
`5FzxxtApj1gxYQEnX1yC6U`, band height `9Y7TGDk8PtSam8g5Rajb7v`, slice one
`AVbDTzGnE2g4zcFECrMN5U`.
