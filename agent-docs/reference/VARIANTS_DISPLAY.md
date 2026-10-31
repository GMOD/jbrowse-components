---
name: variants-display
description: How the variant display (LinearVariantDisplay) draws records and genotypes: what it retired, cells, the one composition rule, the legend, mixed ploidy, layouts, bands and connectors. Read before touching plugins/variants rendering.
kind: spec
---

# The variant display

`plugins/variants/src/CLAUDE.md` points here. Bare paths
below are relative to `plugins/variants/src/`.

## One display

`LinearVariantDisplay` (`LinearVariantDisplay/`) is a VariantTrack's one
linear display: its records band over one genotype row per sample (ADR-255).
What it replaced is declared in `LinearVariantDisplay/retired.ts` (ADR-168):

- **`retiredTypes`**: `LinearMultiSampleVariantDisplay`, the betas' name, a
  `@deprecated` alias while hosted configs write it; v4's
  `MultiLinearVariantDisplay`; v4's `LinearVariantMatrixDisplay` in
  `variantLayout: 'columns'`.
- **`retiredConfigSpellings`**: the v4 multi-sample spellings, and v4's
  feature-display `LinearVariantDisplay` keys run through LinearBasicDisplay's
  own lifts (`basicRetired`) and re-rooted under `records` (`underRecords`):
  `renderer.*`, `featureHeight`, `showLabels`, `showDescriptions`,
  `mouseover`, `maxFeatureScreenDensity`, `color1`. v4's `maxHeight`
  drops. The betas' top-level `displayMode`, `mark`, `labels`, `facet` and
  `tooltip.field` are not lifted; `facet` and `tooltip` are this display's
  own names for the sample facet and the hover toggle.
- **`retiredState`**: the v4 row arrangement, `jexlFilters`,
  `renderingModeSetting`, and v4 `LinearVariantDisplay`'s
  `jexlFiltersSetting`.

**The record menu is plugin-features's.** A right-click resolves a record
(off the band or a cell) and `recordMenuHit` places it in the displayed
region holding its first base; `featureRecordMenuItems` builds the feature
track's zoom to, get sequence and copy rows from it, which read
`fetchFullFeature` (the adapter's record) and `loadedRegions`. The display's
own open-details row stays first, since a cell's opens on its sample card.
`sortReadsMenu.ts` sorts the view's pileups off the clicked record's REF and
ALT, with no fetch.

**Highlights and overlays read the band.** `featureHighlights` (a search
hit's `setSearchHighlight`, the Highlight row) resolve over the band's
records and light as `pinnedInk` (`recordsHighlightViews.ts`). Every record
box (hover, the record a menu is open on, the session's selection, a pin) is
plugin-features's `featureHighlightInk` over the band (`recordsInkHost`), so
a record lights over its glyph and labels exactly as a feature track's
feature does, and its tooltip drops what the labels say (`drawnLabelTexts`).
`searchFeatureByID` answers the breakpoint split view's overlay off the
laid-out band, its top shifted by
`scrollTop - recordsScrollTop` since the overlay subtracts the display's
`scrollTop` and the band scrolls only with no rows.

## Genotypes

- **Codes, never strings**, and Uint32 — Uint16 capped the dictionary at 65535,
  past which a genotype interned to 0 = "no call".
- **Nothing on the per-cell path is keyed by sample NAME.** Index by the column
  the callback already holds.
- **A code's column is the canonical `sampleNames` position, never
  `processGenotypes`' `sampleIdx`.** They differ only for
  `SplitVcfTabixAdapter`, and the disagreement files every genotype against a
  neighbouring sample in silence. `buildHeaderRemap` translates;
  `phaseSetReader` needs it too.
- **PS reads through `processFormatFields`, not `samples`.**
- Maps crossing RPC key by `sampleName`, never `name` (HP-suffixed when phased).
- **`featureInfo` records every genotype, not what got painted** — the cell
  loop ships the interned per-feature array by reference. Under the default
  `referenceDrawingMode: 'skip'` a painted-cells copy makes every hom-ref row
  decode as MISSING to the anchored sort.
- **`NaN` is the only missing marker.** A value-scale sentinel made samples
  cluster by missingness.
- The `"<sampleName> HP<n>"` convention lives in `getSources.ts` alone:
  `haplotypeRow` writes it, a haploid sample's one row taking the sample's name
  as its label but never as its name, and `parseRowName` reads it back, a
  current sample's own name winning. `buildGenotypeMatrix.ts` alone picks a
  matrix.

## Cells

- **Buckets stay sorted by `(featureIndex, rowIndex)`** within each of the
  reference / non-reference partitions, or `findCellIndex` needs reworking. Read
  `numCells`, never `.length` — buffers are `slice`d only when cells were
  skipped.
- Cell arrays stay in the **worker's** row numbering; the hit test converts its
  one query row through `rowUnmap`.
- **`encoding.color` is the single cell-coloring axis** (`shared/cellHue.ts`).
  A preset (`impact`, `phaseSet`) and a record field (`svType` among them) are
  both fields of it, and a record with no value keeps the alt hue. Color never
  depends on zoom. A purple marker made a variant read as an insertion only at
  the zooms where the marker outgrew its cell.
- **An insertion draws at its reference span**, as every record does, and the
  hover's "Insertion" row names its bp. A per-cell marker sized by the inserted
  bp (`showInsertionGlyphs`, cut 2026-10-23) put a zoom-dependent pixel width on
  the span channel and repeated it down every carrier row as a wall over
  reference the haplotypes keep; the hosted HPRC launch had turned it off.
- **A cell's alpha does depend on zoom, where records share pixels**
  (`LinearVariantDisplay/densityFade.ts`). At genomic positions each
  record shorter than the 2 px a cell draws is drawn at `1 - 0.1 ** (1 / n)`,
  `n` the most such records over any pixel it covers, so a row's pixel reaches
  90% opacity when every record under it is alt and less when a share are. A
  record longer than a cell covers its pixels alone and draws at full strength:
  counted with the SNPs it spans, an 86 kb HLA-DRB deletion faded out along its
  whole length. Without it every pixel of a 2 Mb HPRC window held some alt
  record and the rows drew a solid wall; with it the haplotype blocks show.

## One composition rule: `fill = shade(hue(variant, cell), dosage)`

`shared/cellFill.ts` is that rule, and every cell in every mode goes through it.
Each channel carries one variable through one scale.

- **`hue` is the mode's per-variant nominal** — the constant alt hue by default,
  an impact tier, an SV class, a phase-set hue, a plain CSS color, or, in
  phased mode, the per-haplotype allele identity. Which alt a sample carries is
  not on it in allele-count mode; the matrix's per-alt columns and phased mode
  carry that.
- **`dosage` is over CALLED alleles**, so `1/2` is a hom and `0/2` a het, and
  `./1` is a full dose on the one haplotype that was called. A wholly uncalled
  genotype is the no-call category, never a blend into it.
- **One ramp for every mode**, in OKLCH: a lower dosage lifts the hue's
  lightness by a fixed step, holding hue and chroma, below a pale ceiling.
  Full dosage is the hue itself, which is also what makes a legend swatch and
  a hom cell the same color. The `shadeByDosage` slot turns it off.
- **The step is the same for every hue.** An HSL lift
  toward a ceiling moved the SV classes' hets by OKLab ΔE 0.08 (inversion
  orange) to 0.31 (insertion purple), and raised the purple's chroma until
  its het (`#ff0cff`) outshone its hom.
- **The main thread paints the hue and the shade (ADR-203).** The worker reads
  what the hue needs off each variant (`cellHueOf`'s `read`: a field's value as
  text, or a `jexl:` callback's color) and ships it beside each cell's
  `altDosageByte`; `LinearVariantDisplay/paintCells.ts` repaints the alt cells
  from them, each color map a computed apart from row placement. So the dosage
  is the byte, in the cells and the key's het swatch (`HET_DOSAGE`) alike. A
  phase-set hue is per cell and stays the worker's.
- **A scale's domain has no gaps**: a record with no structural class files
  under the SV key's `''`, which core's vocabulary names `SNV/indel`, and an
  unannotated record is `UNANNOTATED_IMPACT`. Without those the mode was class
  colors beside the default blue, i.e. two scales at once.
- **The absent-data colors are off every wheel.** The phase-set hue band is
  saturation/lightness the no-call yellow is not on, or a phase set paints a
  called haplotype the "missing" color.
- **Cross-mode identity**: INS takes `palette.insertion`, and the phased allele
  colors come from a palette the SV scale does not touch — red cannot mean
  "deletion" in one mode and "secondary alt" in another.

## The legend lists what was painted

`LinearVariantDisplay/variantLegend.ts` builds from the scale in use plus the absent-data
categories present, and its swatches come from the same functions the cells do.
`hasSecondaryAlt`, `hasAltWithoutPhaseSet`, `hasUnphased` and `hasNoCall` are the cell loops' own record
of what they emitted (`paintedCategories`, one bit per `CELL_*`), merged across
regions in `paintedLegendFlags`; `paintedDomain` keys the values a variant with
an alt cell carried (`paintedColorValues`). "The site is multiallelic" is not
the same claim as "a secondary-alt cell is in the fetched cell data", and the
legend makes the second one. Fetched, not visible: the regular display fetches
wider than the viewport.

## Mixed ploidy: five consumers, one contract

Mixed-ploidy files are routine (1000G chrX non-PAR). Both cell loops,
`readPhasedAlleleIndicators` and `buildValueTable` must agree that **a diploid
sample has no allele for HP2 in a triploid file** and that **haploid is phased**
(`isPhasedOrHaploid`, not `includes('|')`). **A new fixture for anything phased
should mix ploidies.** `readAltDosages` is the fifth and is ploidy-invariant.

**Phased mode shows what the file phased.** A call written with `/` is unphased
whatever its alleles, so a homozygous `1/1` or `0/0` fills every haplotype row
black like `0/1`, and is missing to the phased matrix and the anchored sort.
WhatsHap and HiPhase leave homozygous calls unphased, so on their output that is
a large share of the cells (41% of the NA12878 WhatsHap demo's records in
chr1:1-3Mb are `1/1`); reading their haplotypes off the alleles was proposed and
declined (2026-09-28).

## The unphased matrix is one column per ALT, not one per site

A dosage class made `0/1/1` and `0/0/1` identical and couldn't say which alt was
carried. Each site contributes `ALT.length` columns, summed into `colOffsets` in
a pre-pass so rows stay one pre-sized Float32Array; a biallelic site is one
column and bit-identical to the old encoding. The anchored haplotype sort ranks
by `altDosageByte`, the dosage the cells paint.

## A split site sorts siblings first and clusters by allele

`bcftools norm -m-` and vcfwave write a multiallelic site as one record per
ALT, all spanning one reference interval.

- **The anchored sort** reads the clicked record, then its siblings
  (`sitesBySpan`, `anchorFirstRecords`), then the sites outward, each record
  apart. A walk outward record by record reached unrelated records before the
  far siblings and scattered one inversion's carriers. A sort that valued the
  site as one record mixed the carriers of an insertion and a deletion sharing
  a span in sample mode, and dropped the clicked allele down its site.
- **Both matrices keep one column per record.** Whether two alleles at a site
  are one event (the HPRC FLNA/EMD inversion's 64) or two (C4's deletion and
  insertion) is a similarity call the matrix cannot make from the VCF. That
  call belongs in the data build that writes the callset.

## Settings

- **Row order is not a fetch input** (ARCHITECTURE.md). The row _set_ is
  (`sampleFilter`, sent **sorted**). **Nothing may wait on the refetch this
  removed** — the cluster tree did and silently drew nothing.
- **`rpcProps()` must not read fetch-derived state** — `sampleFilter` reads
  `sourcesBase`, not `sources`.
- **Feature filters are the `filter` config slot alone**
  (`@jbrowse/core/util/jexlFilters`): the dialog, a feature's filter actions and
  "Edit plot..." all write it, and "Clear all filters" returns it to what the
  track's config declares. A runtime override once shadowed the slot, so a
  filter written through `applyDisplaySettings` reported success and did
  nothing.
- **The tier is per layout, not per setting**: `referenceDrawingMode` is a fetch
  input at genomic positions and inert in columns, which draw every reference
  cell, so `rpcProps` sends it only in the first.
- A drag-resized dimension goes on a config slot; the node outlives the display.

## The arrangement is `rows` and `rowColor`, by row name

**`rows` (`SampleRows`: `sample` is its one field, since the rows are the
samples) holds the order, labels, tree, provenance and focus; `rowColor` holds the tints**, display-kit's
`RowColor`: a samplesTsv attribute whose values each take a palette color, or
`name`, the default, whose entries are the tints set row by row. Both are
config, written by a drag, the arrangement dialog, "Sort rows by genotype here"
and a clustering run, and every product writes them as session deltas (ADR-157).
Every other channel resolves when the rows are read.

**Names are at the mode's granularity** — a sample in allele-count mode, a
haplotype in phased mode — and a row answers to its own name, then to its
sample's, for an order, a label, a tint and the focus alike. So a config naming
samples still arranges a phased track, and a mode switch resets the arrangement
because it renames the rows. The answering is `rowAlias`, the hook this display
gives `TreeSidebarMixin`, and a run writes names beside its tree, re-appending
the rows a focus hides after the clade.

**Named stages, named readers.** `sourcesBase` is the adapter's samples narrowed
to `rows.kept`, the fetch key's input, so it reads no `samplePloidy`: a focus
naming a haplotype keeps its sample there (`keptRows` with `rowAlias`, through
`parseRowName`). The rest are `TreeSidebarMixin`'s over this display's hooks:
`discoveredRows`, `expandRows` (`expandPhasedRows`), then `editableSources`,
ordered, relabelled and tinted by pair with no focus, palette or band — the
dialog's list and the sort's — `clusterableSources`, narrowed to the focus,
which both clustering paths send, and `bandedSources`, stacked in the `facet`'s
bands. `sources` adds the palette.

**Phased rows are the ploidy `samplePloidy` reports plus any haplotype the order
names.** Until the ploidy lands, the named haplotypes stand in for it, so an
arranged track keeps its haplotype rows and its tree across the refetch a
settings change triggers rather than folding back to samples. `samplePloidy`
keeps its identity while each fetch reports the same ploidies, so a region
arrival re-derives no row.

**A row's color is its `rowColor`**, the label bar tree-sidebar's
`RowLabelsOverlay` and `SvgRowLabels` draw — the cells are colored by genotype,
so `rowColorPaintsMarks` is false and the bar is the only place it shows. The
tooltip swatch reads it too, and tree-sidebar's row color key
(`rowColorScales`) keys it by an attribute, after the genotype key; by `name` the
labels are the key. A `samplesTsv` `color` column
is the row's own `color`, which `resolvedRowColors` falls back to.

**An attribute in `rowColor.field` beats a `samplesTsv` `color` column**: a
channel bound to a variable beats a per-row constant. `TreeSidebarMixin` deals
the attribute's values first seen first over the rows in source order, so a focus
or the phased expansion recolors nothing, and `rowColorPaintsMarks` is false,
since the cells paint by genotype. Its `setRowColorChoice` is the mixin's, then a
warning for a field no sample carries: a pick starts from the colors the current object or the
config gives that choice (`startingRowColor`), and '' is None,
`{ field: 'name' }`. The menu's Samples group offers None and the attributes
and ticks the dialog's choice (`rowColorChoice`), Each row included; the dialog
picks a value's color under an attribute and a sample's under Each row
(ADR-209). A reset returns `rowColor` by tree-sidebar's `rowColorResetTarget`,
which keeps the choice, so a Color by survives it and a mode switch. The
missing-attribute warning reads the mixin's `rowColorField`.
The flip ADR-160 names puts the row's own color ahead of the palette here too.

**The `facet` bands win over a cluster tree** (tree-sidebar's "A tree per
band"): `rowBanding` is the `facet`, each band draws the clade of exactly its
rows, and a run under bands clusters each band apart into one forest. A run
never writes the `facet` slot, so a session spec's own `facet` survives it.

## One display, two layouts: `variantLayout`

The x position is a setting of the one display, `'genomic'` or `'columns'`, the
choice the LD display makes under the same slot, not a second display type. The
worker ships one payload shape for both
([ADR-210](../architecture-decision-records/adr-210-both-variant-layouts-ship-one-cell-payload.md)):
at genomic positions a `VariantCellData` per displayed region, in columns one
under 0 for the whole window, laid out by feature **index** at equal widths,
fetched visible-only and zoom-strict. The layout is a fetch input
(`rpcProps().layout`).

Each layout mounts its own `DisplayChrome` and mark backend (`matrix/` holds the
columns' body, marks and export). **The upload lifecycle installs once per
model**, so `startRenderingBackend` tags which backend is attached
(`backendDrawsColumns`) and the one spec sends each backend only the payload it
draws; across a switch the old backend is sent an empty map until the other
chrome's backend arrives.

Columns are for genotype PATTERN, not spans: the records band and the reference toggle are genomic-position features and answer off in columns.

**Each display names the slot's checkbox for its own picture**, so the two check
for opposite values: "Layout → Genotype matrix" here (columns), "Size cells by
genomic distance" in LD's Layout (genomic). One shared label read wrong on one of them,
and was reverted on 2026-09-30.

## Bands above the rows

`variantTopBands.ts` resolves both bands, the records band (genomic positions)
over the connector zone (columns), and **the layout reserving a strip and the
painter filling it read that one function**.

- `rowsHeaderHeight` is `topBands.bottom`; `rowsTopOffset` adds the focus
  chip's line and is where rows begin.
- **A band comes out of `availableHeight`, never `height`.**
- **A band a layout cannot paint answers 0 there** (`lineZoneHeight` at genomic
  positions), whatever the config says.
- A drag-resized height goes on a config slot, clamped via `clampBandHeight`
  (`@jbrowse/core/util/bandHeight`, shared with the alignments and MAF bands).
  `boundBandHeight` is its read-time twin: a _stated_ height — config, menu,
  slider — takes the bounds alone, while a resize additionally leaves a band a
  config declared below the floor where it is.

**The container the rows are offset into is 0x0**, everything in it being
absolutely positioned. So it is the right parent for a child placed by
`left`/`top` (the canvas, the hover box, the glyph overlay) and the wrong one
for a child placed by `right` — `ScrollChrome` mounted in there put the thumb a
track width off the display's LEFT edge, where `contain: strict` clipped it, and
gave the edge fade zero width. Anything anchored to the right edge, or that
applies `rowsTopOffset` itself, goes on the display's own box, where
`RowsPanel` mounts the scrollbar and the row labels.

**The records band is plugin-features's pipeline, not a painter of ours**
(ADR-254, amending ADR-250). `buildRecordsRenderData` rebuilds each
structural-variant record from the cell payload as a `SimpleFeature`, and
everything after is `@jbrowse/plugin-features/band`: the pack,
LinearBasicDisplay's own fit ladder (`fitLadderViews` over a plain
`FitLadderHost`, since this model's `facet` is the sample facet),
`paintFeatureBand` on screen and in the export, and
`performMultiRegionHitDetection` for the pick. Nested records stack. The
band is one seam on the model, `recordsBandViews.ts`: its settings, actions,
render data, the hosted ladder and the display hooks it decides
(`rowsHeaderHeight`, `growMaxHeight`, `growTargetHeight`, the
scroll hooks, `densityGateActive`), composed in order as views factories, so
a `recordsOnly` choice in the model belongs there.

- **On by default, every record.** `records.show` defaults to `true`
  (ADR-254's third amendment), and the band draws every record the filter
  admits, over rows as without (its fifth). `VariantFeatureInfo.svType` is
  the record's `svClassOf` class, set in the worker: it colors and keys the
  record, and an SV paints after the small records so it lies over them. The
  worker keeps a sample-less VCF's sites at genomic positions only
  (`keepSampleLessSites`), since a site test reads called alleles.
- **Hiding either band is a chip** (`BandChips`, one row under the band):
  `Records ×` and `Genotypes ×` while both draw, `Show records` or `Show
  genotypes` for the one hidden, beside the hidden-records count. With
  `genotypes.show` off on a VCF with samples (`drawsRows` false) the rows
  take 0 px and the track is the band as it draws over rows plus the chips'
  strip (`BAND_CHIPS_HEIGHT`), the slot `height` kept for the rows' return;
  the band can't hide then (`showRecords`). The worker reads no genotype
  (an empty `sampleFilter`), so no record states carriers. The key sits at
  the top of the display, beside a track label, over the band.
- **No samples makes the band the display** (`recordsOnly`: a sample listing
  that landed empty). The rows take 0 px, the band is
  `height`, and `HeightModeMixin` sizes it as it sizes a feature track
  (`heightMode` fit/fixed/grow, `growMaxHeight`; `growTargetHeight` is the
  `full` stack on screen). It opens at that stack, once: the first layout
  with a record on screen writes `height` as
  `min(growTargetHeight, height)` (`settleRecordsOpeningHeight`, flagged by
  `recordsOpeningHeightSettled`), unless a config, session or drag wrote
  `height`, rows drew at that layout, or `grow` or a ring's host sizes it.
  After that a pan never moves it (ADR-255's amendment). Before the listing lands it is not records-only, so
  a sampled VCF never flashes the records-only height. The records
  take the one color rule below, and no genotype is keyed unless
  `encoding.color` is set; the key sits at the top; the seam handle goes, the track's own handle
  resizing. They letter as a feature track does: `normal` size, the
  display's `records.labels` fields, the description on its own line under
  the name. What `fixed` or a capped `grow` cannot show scrolls: the scroll
  hooks point at the band's drawn stack, the band paints and picks offset by
  `recordsScrollTop`, its div takes `usePanelVirtualScroll` and the
  scrollbar. The allele-count filters (MAF, missingness) leave the menu, and
  Genotype rows and Feature height (with Track sizing) show at genomic
  positions only.
- **The record settings are a feature track's, under `records`** (ADR-254's
  sub-slice B amendment): `displayMode`, `mark`, `facet` (plugin-features's
  and display-kit's own sub-schemas) and `tooltip.field`. An unset
  `displayMode` resolves in one place, `recordsDisplayMode`: `compact` over
  rows, `normal` with none. `records.facet` is the record sections, through
  the hosted ladder's `facet` and `layoutInputs.hiddenGroupKeys`, with
  `RecordsSectionChips` over the band and `GroupLabelBoxes` in the export;
  the display's top-level `facet` stays the sample facet. A facet field and
  a non-default tooltip field are read in the worker (`recordFields` in
  `rpcProps`, `shared/recordFields.ts`) onto `VariantFeatureInfo.groupKey`
  and `.tooltip`, since the payload carries no INFO; the band's synthetic
  record carries them as `recordGroup` and `recordTooltip`. A default tooltip
  reads nothing extra: `DEFAULT_TOOLTIP` over the synthetic record is its
  name. `tooltip.show` stays the display's one toggle for both bands.
- **Menus follow the band.** With no rows: Feature height (display mode,
  then Track sizing), Names and Descriptions in Show, Group by → Field...
  (`RecordsFacetFieldDialog`), each built from plugin-features's own menu
  builders (`featureHeightMenuItem`, `labelCheckboxItems`). Over rows the
  band has no height menu: its seam handle sizes it and the fit ladder
  shrinks what does not fit, so Row height is the one height row and
  `records.displayMode` is config only. Group by stays the sample attributes.
- **No rows gates on density, as a feature track does.** The display
  composes `FeatureGateMixin` (from `@jbrowse/plugin-features/band`) and
  overrides `densityGateActive` to act only while `recordsOnly` at genomic
  positions, so over rows the byte gate alone guards the fetch. The budget is
  `records.maxFeatureScreenDensity` (1 record/px, the mixin's
  `featureGateConfigSchemaFields`, read through the overridable
  `configuredMaxFeatureScreenDensity`). The worker counts each region's
  admitted records after the filter (`CellDataResult.recordCounts`, in
  `regions` order) and, sent a budget, refuses past it before building cells
  (`RecordsTooDenseResult`, the counts still on it);
  `fetchRegionsBatched`'s `onComplete` commits them through
  `commitGateMeasurements` (`recordCountMeasurements`). The banner and Force
  load are `RegionTooLargeMixin`'s. Unlike the feature RPC there is no
  pre-fetch sample: a refused window still reads its records once per
  settled viewport.
- **Its height over rows is written, and added.** `records.height` (no
  default, so a value equal to the default still reads as written), once a
  drag, a config or the opening settle writes it, whatever the records in
  view need, so a pan never resizes the track (`recordsBandHeightOverRows`).
  Unwritten, the `full` rung's packed height at compact feature size up to
  the default (170), until the first layout that draws a record writes that
  (`settleRecordsBandHeight`). The model's `height` is the rows' slot
  plus the band, so the rows keep their slot `height` under every
  `heightMode` (`growMaxHeight` is Infinity over rows); in a ring's band the
  band is taken from the rows instead.
- **Past its height the record rows decimate, then hide.** The ladder drops
  descriptions, thins bodies and decimates names, but over rows never scales
  the boxes: `recordsLaidOutDataMap` leaves a record that still ends below
  `recordsPlacedHeight` unplaced (`unplaceBelow`), so no painter, pick,
  highlight or `searchFeatureByID` sees it, and `HiddenRecordsChip` counts
  the ones on screen (`recordsHiddenCount`; a click is
  `showAllRecordRows`). Past `records.maxFeatureScreenDensity` on screen the
  records pack in one row (`recordsPackMode` `collapsed`), where a feature
  track refuses the window.
- **Labels follow the records on screen**, as LinearBasicDisplay's do:
  `recordsOnScreenIds` (`featureIdsTouchingBlocks` over the payload's spans,
  `recordSpans`) is the density `labelVisibility` gates on (names past 0.2
  records/px, descriptions past 0.1), counted off the payload, not the render
  data, whose label text depends on it. **The fit and height measure them only
  with no rows** (`recordsMeasureIds`); over rows they measure the payload.
  Labelling every record at a dense ClinVar window cost 260 ms of fit per
  navigation; measuring 99k buffered records with no rows cost 64 s on a pan
  onto an empty stretch. Unlabelled, sub-pixel records past 25 deep collapse
  into one faded row (`planDensityCollapse`).
- **No second fetch to draw.** The payload already carries every record, so
  `records.show` and `records.height` are render-tier settings. **A click does fetch**:
  the payload has no INFO, so `fetchFullRecord` reads the record through
  `GetBasicFeatureDetails`, as LinearBasicDisplay's `fetchFullFeature` does,
  over its first base (a 5 Mb SV's span would be a 5 Mb read), the next click
  aborting one in flight. It keeps a genotype cell's sample card and drops the
  record's `samples` where rows draw them, the widget's feature persisting to
  localStorage (`withClickedSample`); the click's own record opens where the
  adapter finds none.
- **A record takes its SV class's color, otherwise `featureDefaultColor`**
  (`svClassColors`, the `svType` preset), with rows or without, while no
  `encoding.color` is picked, the SV classes drawn keyed as "SV type" above
  the genotypes; under a picked `encoding.color`, the cell hue at full dose
  (`paintFeatureColors`). It crosses over as a per-feature jexl rather than
  the BED `itemRgb` path, which drops alpha.
- **One label line over rows**: ID, description, then the share of the shown samples
  carrying it (`recordCarriers.ts`; the denominator is `recordCarrierSamples`,
  one line to make it every sample in the payload), as `recordLabel`. The label
  pipeline places a description under its name, so an inline description is
  part of the name and the ladder drops it with the name.
- **What is still ours**: the record tooltip (`buildRecordHit`, sample fields
  empty so one `hoveredFeature` slot serves both bands), the gestures
  (`RecordsBandOverlay`, a div over its `OverlayCanvas`) and the seam drag,
  which writes `records.height` as the drawn height at the press plus the
  pointer's whole travel (`RecordsSeamHandle`), past the stack included, so
  the seam waits at the floor until the pointer comes back to it.

## How wide a cell draws

A cell is its record's reference span floored at `MIN_CELL_PX`, insertions
included, with both sides on the backing store's device pixels
(`snapCellEdgePx`). Its hover box and click target are the cell mark's own ink.

**Edges go in in RECORD order, `toX(start)` then `toX(end)`** — never sorted,
never pre-snapped. `snappedCellLeftPx` hangs the 2px floor off the record's
_start_, which on a reversed block is its right edge (the reversed-block family
in `packages/render-core/CLAUDE.md`). Snapping first puts both edges of a
sub-pixel record on one pixel, making a pivot comparison a no-op in the exact
case it exists for.

**The cell hover names the inserted bp** (`buildVariantHit`): a cell is the
reference span, which is about 1 bp for any insertion.

## Connectors and allele counting

`connectorLineCoords` is a **model getter**, never a component `useMemo` — a
memo that doesn't re-run also stops tracking `bpPerPx`/`offsetPx`.

The faint field paints on a canvas, **one `stroke()` per line**: a rasterizer
composites a stroked path once, so lines batched into a single path union
instead of accumulating and the field loses the density it exists to show
(`drawConnectorField`, and the test beside it).

The two per-cell counters in `shared/alleleCounts.ts` are context-tuned, not
duplication: the VCF hot path accumulates into an object because mutating
captured primitives inside the `processGenotypes` closure forces a V8 deopt. The
third, `countGenotypeAlleles`, is weighted and runs per distinct genotype off
`analyzeVariants`' memo, which is how the default fetch counts alleles without a
second scan (`reference/MULTI_SAMPLE_VARIANTS.md`). MAF is over **called**
alleles, not genotype classes, so a mixed-ploidy site weights a haploid call
once. A monomorphic site is not dropped.
