---
name: variants-display
description: How does the variant display (LinearVariantDisplay) draw records and genotypes? Retired spellings, cells, the one composition rule, the legend, mixed ploidy, layouts, bands and connectors. Read before touching plugins/variants rendering.
kind: spec
---

# The variant display

`plugins/variants/src/CLAUDE.md` points here. Bare paths below are relative to
`plugins/variants/src/`. Config spellings are
[CONFIG_SPELLINGS.md](CONFIG_SPELLINGS.md)'s; the grammar objects
(`encoding.color`, `facet`, `rows`, `filter`) are
[GRAMMAR_OF_GRAPHICS.md](GRAMMAR_OF_GRAPHICS.md)'s and
[MARK_ENCODING.md](MARK_ENCODING.md)'s. This doc keeps what is specific to
variants.

## One display

`LinearVariantDisplay` (`LinearVariantDisplay/`) is a VariantTrack's one linear
display: its records band over one genotype row per sample (ADR-255). What it
replaced is declared in `LinearVariantDisplay/retired.ts` (ADR-168):

- **`retiredTypes`**: `LinearMultiSampleVariantDisplay` (a `@deprecated` alias
  while hosted configs write it), v4's `MultiLinearVariantDisplay`, and v4's
  `LinearVariantMatrixDisplay` in `variantLayout: 'columns'`.
- **`retiredConfigSpellings`**: the v4 multi-sample spellings, and v4's
  feature-display keys run through LinearBasicDisplay's own lifts
  (`basicRetired`) and re-rooted under `records` (`underRecords`):
  `renderer.*`, `featureHeight`, `showLabels`, `showDescriptions`, `mouseover`,
  `maxFeatureScreenDensity`, `color1`. v4's `maxHeight` drops. The betas'
  top-level `displayMode`, `mark`, `labels`, `facet` and `tooltip.field` are
  not lifted; `facet` and `tooltip` are this display's own names for the sample
  facet and the hover toggle.
- **`retiredState`**: the v4 row arrangement, `jexlFilters`,
  `renderingModeSetting`, and v4 `LinearVariantDisplay`'s `jexlFiltersSetting`.

**The record menu is plugin-features's.** A right-click resolves a record (off
the band or a cell) and `recordMenuHit` places it in the displayed region
holding its first base; `featureRecordMenuItems` builds the zoom to, get
sequence and copy rows from it, reading `fetchFullFeature` and `loadedRegions`.
The display's own open-details row stays first, since a cell's opens on its
sample card. `sortReadsMenu.ts` sorts the view's pileups off the clicked
record's REF and ALT, with no fetch.

**Highlights and overlays read the band.** `featureHighlights` (a search hit's
`setSearchHighlight`, the Highlight row) resolve over the band's records and
light as `pinnedInk` (`recordsHighlightViews.ts`). Every record box (hover, the
record a menu is open on, the session's selection, a pin) is plugin-features's
`featureHighlightInk` over the band (`recordsInkHost`), and its tooltip drops
what the labels say (`drawnLabelTexts`). `searchFeatureByID` answers the
breakpoint split view's overlay off the laid-out band, its top shifted by
`scrollTop - recordsScrollTop`, since the overlay subtracts the display's
`scrollTop` and the band scrolls only with no rows.

## Genotypes

The mechanism is [MULTI_SAMPLE_VARIANTS.md](MULTI_SAMPLE_VARIANTS.md).

- **Codes, never strings**, and Uint32.
- **Nothing on the per-cell path is keyed by sample NAME.** Index by the column
  the callback already holds.
- **A code's column is the canonical `sampleNames` position**, never
  `processGenotypes`' `sampleIdx` (`buildHeaderRemap` translates;
  `phaseSetReader` needs it too).
- **PS reads through `processFormatFields`, not `samples`.**
- Maps crossing RPC key by `sampleName`, never `name` (HP-suffixed when phased).
- **`featureInfo` records every genotype, not what got painted** — the cell loop
  ships the interned per-feature array by reference. With reference cells off,
  the default, a painted-cells copy makes every hom-ref row decode as MISSING to
  the anchored sort.
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
- **`encoding.color` is the single cell-coloring axis** (`shared/cellHue.ts`). A
  preset (`impact`, `phaseSet`) and a record field (`svType` among them) are
  both fields of it, and a record with no value keeps the alt hue. Color never
  depends on zoom: a purple marker made a variant read as an insertion only at
  the zooms where the marker outgrew its cell.
- **An insertion draws at its reference span**, as every record does, and the
  hover's "Insertion" row names its bp. A per-cell marker sized by the inserted
  bp was declined: it put a zoom-dependent pixel width on the span channel and
  repeated it down every carrier row as a wall over reference the haplotypes
  keep.
- **A cell's alpha does depend on zoom, where records share pixels**
  (`LinearVariantDisplay/densityFade.ts`). At genomic positions each record
  shorter than the 2 px a cell draws is drawn at `1 - 0.1 ** (1 / n)`, `n` the
  most such records over any pixel it covers, so a row's pixel reaches 90%
  opacity when every record under it is alt and less when a share are. A record
  longer than a cell covers its pixels alone and draws at full strength:
  counted with the SNPs it spans, a long deletion faded out along its whole
  length.

## One composition rule: `fill = shade(hue(variant, cell), dosage)`

`shared/cellFill.ts` is that rule, and every cell in every mode goes through it.
Each channel carries one variable through one scale.

- **`hue` is the mode's per-variant nominal** — the constant alt hue by default,
  an impact tier, an SV class, a phase-set hue, a plain CSS color, or, in phased
  mode, the per-haplotype allele identity. Which alt a sample carries is not on
  it in allele-count mode; the matrix's per-alt columns and phased mode carry
  that.
- **`dosage` is over CALLED alleles**, so `1/2` is a hom and `0/2` a het, and
  `./1` is a full dose on the one haplotype that was called. A wholly uncalled
  genotype is the no-call category, never a blend into it.
- **One ramp for every mode**, in OKLCH: a lower dosage lifts the hue's
  lightness by a fixed step, holding hue and chroma, below a pale ceiling. Full
  dosage is the hue itself, which is also what makes a legend swatch and a hom
  cell the same color. No setting turns it off: a flat hue would need a
  lightness channel, which Vega-Lite lacks, and `opacity` would blend a het into
  the reference grey.
- **The step is the same for every hue.** An HSL lift toward a ceiling moved the
  SV classes' hets by very different OKLab distances and raised the purple's
  chroma until its het outshone its hom.
- **The main thread paints the hue and the shade (ADR-203).** The worker reads
  what the hue needs off each variant (`cellHueOf`'s `read`: a field's value as
  text, or a `jexl:` callback's color) and ships it beside each cell's
  `altDosageByte`; `LinearVariantDisplay/paintCells.ts` repaints the alt cells
  from them, each color map a computed apart from row placement. So the dosage
  is the byte, in the cells and the key's het swatch (`HET_DOSAGE`) alike. A
  phase-set hue is per cell and stays the worker's.
- **A scale's domain has no gaps**: a record with no structural class files
  under the SV key's `''`, and an unannotated record is `UNANNOTATED_IMPACT`, so
  a mode never draws class colors beside a second default.
- **The absent-data colors are off every wheel.** The phase-set hue band is
  saturation/lightness the no-call yellow is not on, or a phase set paints a
  called haplotype the "missing" color.
- **Cross-mode identity**: INS takes `palette.insertion`, and the phased allele
  colors come from a palette the SV scale does not touch — red cannot mean
  "deletion" in one mode and "secondary alt" in another.

## The legend lists what was painted on screen

`LinearVariantDisplay/variantLegend.ts` builds from the scale in use plus the
absent-data categories present, and its swatches come from the same functions
the cells do. The cell loop records, per variant, the `CELL_*` categories its
cells painted (`featureCategories`, one bit each). `keyedVariants.ts` reads
those, the color values and the SV classes off the variants whose span touches
the view's settled window (ADR-093), since the view fetches wider than it shows:
`hasSecondaryAlt`, `hasAltWithoutPhaseSet`, `hasUnphased` and `hasNoCall`, and
`paintedDomain`, the values a variant on screen with an alt cell carried. "The
site is multiallelic" is not the same claim as "a secondary-alt cell is on
screen", and the legend makes the second one. The columns layout fetches only
the visible span, and the tables their own regions, so both read every variant
fetched.

## Mixed ploidy: five consumers, one contract

Mixed-ploidy files are routine (1000G chrX non-PAR). Both cell loops,
`readPhasedAlleleIndicators` and `buildValueTable` must agree that **a diploid
sample has no allele for HP3 in a triploid file** and that **haploid is phased**
(`isPhasedOrHaploid`, not `includes('|')`). **A new fixture for anything phased
should mix ploidies.** `readAltDosages` is the fifth and is ploidy-invariant.

**Phased mode shows what the file phased.** A call written with `/` is unphased
whatever its alleles, so a homozygous `1/1` or `0/0` fills every haplotype row
black like `0/1`, and is missing to the phased matrix and the anchored sort.
WhatsHap and HiPhase leave homozygous calls unphased, so on their output that is
a large share of the cells. Reading their haplotypes off the alleles was
proposed and declined.

## The unphased matrix is one column per ALT, not one per site

A dosage class made `0/1/1` and `0/0/1` identical and couldn't say which alt was
carried. Each site contributes `ALT.length` columns, summed into `colOffsets` in
a pre-pass so rows stay one pre-sized Float32Array; a biallelic site is one
column. The anchored haplotype sort ranks by `altDosageByte`, the dosage the
cells paint.

## A split site sorts siblings first and clusters by allele

`bcftools norm -m-` and vcfwave write a multiallelic site as one record per ALT,
all spanning one reference interval.

- **The anchored sort** reads the clicked record, then its siblings
  (`sitesBySpan`, `anchorFirstRecords`), then the sites outward, each record
  apart. A walk outward record by record reached unrelated records before the
  far siblings and scattered one inversion's carriers; a sort that valued the
  site as one record mixed the carriers of an insertion and a deletion sharing a
  span in sample mode, and dropped the clicked allele down its site.
- **Both matrices keep one column per record.** Whether two alleles at a site
  are one event or two is a similarity call the matrix cannot make from the VCF.
  That call belongs in the data build that writes the callset.

## Settings

- **Row order is not a fetch input**
  ([FETCH_KEYS.md](FETCH_KEYS.md#row-order-is-not-a-fetch-input)). The row _set_
  is (`sampleFilter`, sent **sorted**). **Nothing may wait on the refetch this
  removed** — the cluster tree did and silently drew nothing.
- **`rpcProps()` must not read fetch-derived state** — `sampleFilter` reads
  `sourcesBase`, not `sources`.
- **Feature filters are the `filter` config slot alone**
  (`@jbrowse/core/util/jexlFilters`): the dialog, a feature's filter actions and
  "Edit plot..." all write it, and "Clear all filters" returns it to what the
  track's config declares. A runtime override would shadow the slot, so a filter
  written through `applyDisplaySettings` would report success and do nothing.
- **The tier is per layout, not per setting**: `genotypes.reference.show` is a
  fetch input at genomic positions and inert in columns, which draw every
  reference cell, so `rpcProps` sends it only in the first.
- A drag-resized dimension goes on a config slot; the node outlives the display.

## The arrangement is `rows`, by row name

`rows` (`VariantRows`: `rows.field` is `sample` or `haplotype`) holds the order,
labels, tints, tree, provenance and focus, all config, written as session deltas
(ADR-157). The stages that derive the rows from it (`discoveredRows`,
`expandRows`, `editableSources`, `clusterableSources`, `bandedSources`), the row
color getter (`resolvedRowColors`), the color key (`rowColorScales`) and the
reset rules are [TREE_SIDEBAR.md](TREE_SIDEBAR.md)'s. What is specific here:

- **Names are at the mode's granularity** — a sample in allele-count mode, a
  haplotype (`<sample> HP1`, `HP2`, the name counting from 1 while the row's
  `HP` stays the 0-based allele index) in phased mode — and a row answers to its
  own name, then to its sample's, for an order, a label, a tint, the tree and
  the focus alike. So a config naming samples still arranges a phased track, and
  a `rows.field` switch keeps the arrangement (`refines: { haplotype: 'sample'
  }` on the rows' `writes`, ADR-257): a row ranks at the earlier of its own and
  its sample's entry, a sample at its first haplotype entry; a haplotype's own
  label shows exactly, else its sample's composes (`Mother HP1`); a sample-keyed
  tree forks over the haplotype rows at zero length, and a per-haplotype tree
  hides in sample mode with `finerTreeHint`. The hooks this display gives the
  mixin are `rowParent` and `finerRows`, read off each row's `sampleName` and
  `HP`; a run writes names beside its tree, re-appending the rows a focus hides
  after the clade. A sample named as another's haplotype row (`X HP1` beside
  `X`) warns once per listing.
- **`sourcesBase` is the fetch key's input**: the adapter's samples narrowed by
  `rowNarrowing` (`rows.filter` over the samplesTsv attributes, then
  `rows.kept`). It reads no `samplePloidy`, so a focus naming a haplotype keeps
  its sample there (`keptRows` with `entryAliasOf`, through `parseRowName`).
- **Phased rows are the ploidy `samplePloidy` reports plus any haplotype the
  order names.** Until the ploidy lands, the named haplotypes stand in for it, so
  an arranged track keeps its haplotype rows and tree across the refetch a
  settings change triggers. `samplePloidy` keeps its identity while each fetch
  reports the same ploidies, so a region arrival re-derives no row.
- **A row's color shows on the label bar only**: the cells are colored by
  genotype, so `rowColorPaintsMarks` is false. The tooltip swatch reads it too,
  and the row color key follows the genotype key. A `samplesTsv` `color` column
  is the row's own `color`.
- **The `facet` bands win over a cluster tree**
  ([A tree per band](TREE_SIDEBAR.md#a-tree-per-band)): `rowBanding` is the
  `facet`, and a run under bands clusters each band apart into one forest. A run
  never writes the `facet` slot, so a session spec's own `facet` survives it.

## One display, two layouts: `variantLayout`

The x position is a setting of the one display, `'genomic'` or `'columns'`, the
choice the LD display makes under the same slot. The worker ships one payload
shape for both
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

Columns are for genotype PATTERN, not spans: the records band and the reference
toggle are genomic-position features and answer off in columns.

**Each display names the slot's checkbox for its own picture**, so the two check
for opposite values: "Layout → Genotype matrix" here (columns), "Size cells by
genomic distance" in LD's Layout (genomic). One shared label read wrong on one
of them.

## Bands above the rows

`variantTopBands.ts` folds the bands, the records band (genomic positions), its
chip strip and the connector zone (columns), through `stackBands`, and
`topBands` is the whole `BandStack`: **the layout reserving a strip, the painter
filling it and the pointer dispatching on it read that one fold**
(`reserved.records`, `top.chips`, `bandAt`).

- `rowsHeaderHeight` is `topBands.bottom`; `rowsTopOffset` adds the focus chip's
  line and is where rows begin.
- **The records band and the chips add to the track; the connectors come out of
  the rows' slot.** `addedHeight` is the first two, which the model's `height`
  adds to the slot. The order decides it: a band placed before `connectors` in
  `VARIANT_BAND_ORDER` adds to the track, and one from `connectors` on is
  taken from the rows and binds against their plot.
- **A band a layout cannot paint answers 0 there** (`connectorsHeight` at
  genomic positions), whatever the config says.
- A drag-resized height goes on a config slot, clamped via `clampBandHeight`
  (`@jbrowse/core/util/bandHeight`; the connectors through `dragBandHeight`,
  as the alignments and MAF bands are). `boundBandHeight` is its read-time
  twin: a _stated_ height — config, menu, slider — takes the bounds alone,
  while a resize additionally leaves a band a config declared below the floor
  where it is.
- **A stated height is bound before the fold, never inside it.** The records
  band is added above the rows, so it takes a floor and no ceiling
  (`recordsBandHeightOverRows`). Bands taken from a plot they share — the MAF
  and alignments stacks, and the `connectors` band over the variant columns or
  the LD triangle (`boundConnectorsBand`) — bind as one stack
  (`boundStackedBands`, top-down) and drag to the room the others leave
  (`dragBandHeight`), so a band at its ceiling still leaves the plot its floor.
- **The records band has one resize path**: its seam handle goes through
  `resizeRecordsBand`, as the track handle does, from the height it draws.

**The container the rows are offset into is 0x0**, everything in it being
absolutely positioned. So it is the right parent for a child placed by
`left`/`top` (the canvas, the hover box, the glyph overlay) and the wrong one for
a child placed by `right`: `ScrollChrome` mounted there put the thumb a track
width off the display's LEFT edge, where `contain: strict` clipped it. Anything
anchored to the right edge, or that applies `rowsTopOffset` itself, goes on the
display's own box, where `RowsPanel` mounts the scrollbar and the row labels.

**The records band is plugin-features's pipeline, not a painter of ours**
(ADR-254, amending ADR-250). `buildRecordsRenderData` rebuilds each
structural-variant record from the cell payload as a `SimpleFeature`, and
everything after is `@jbrowse/plugin-features/band`: the pack,
LinearBasicDisplay's own feature band (`featureBandViews` over a plain
`FeatureBandHost`, since this model's `facet` is the sample facet), which
owns the fit ladder, the kept stack, its sections, id lookups and hit
indexes, `paintFeatureBand` on screen and in the export, and
`performMultiRegionHitDetection` for the pick. Nested records stack. The
band is one seam on the model, `recordsBandViews.ts`: its settings, actions,
render data, the hosted feature band and the display hooks it decides
(`rowsHeaderHeight`, `growMaxHeight`, `growTargetHeight`, the
scroll hooks, `densityGateActive`), composed in order as views factories, so
a `recordsOnly` choice in the model belongs there.

- **On by default, every record.** `records.show` defaults to `true` (ADR-254's
  third amendment), and the band draws every record the filter admits, over rows
  as without (its fifth). `VariantFeatureInfo.svType` is the record's
  `svClassOf` class, set in the worker: it colors and keys the record, and an SV
  paints after the small records so it lies over them. The worker keeps a
  sample-less VCF's sites at genomic positions only (`keepSampleLessSites`),
  since a site test reads called alleles.
- **Hiding either band is a chip** (`BandChips`, a strip of its own under the
  band, `BAND_CHIPS_HEIGHT`, since the rows' tree, facet strip and labels draw
  over the rows' left edge): `Records ×` and `Genotypes ×` while both draw,
  `Show records` or `Show genotypes` for the one hidden, beside the
  hidden-records count. The export leaves the strip out, since it holds
  controls: the display's `rowsHeaderControlsHeight` hook names it, and
  tree-sidebar's `svgControlsStrip` joins it to the focus chip's line, which
  the export shell drops (`exportedHeight`, `exportedY`), so the rows sit
  flush under the records.
  With `genotypes.show` off on a VCF with samples
  (`drawsGenotypeRows` false) the rows take 0 px and the track is the band plus
  the chips' strip, the slot `height` kept for the rows' return; the band can't
  hide then (`showRecords`). The worker reads no genotype (an empty
  `sampleFilter`), so no record states carriers. The key sits at the top of the
  display, over the band.
- **No samples, or one, makes the band the display** (`recordsOnly`: a sample
  listing that landed empty, or one sample with `genotypes.show` unset; ADR-254's
  eighth amendment). The rows take 0 px, the band is `height`, and
  `HeightModeMixin` sizes it as it sizes a feature track (`heightMode`
  fit/fixed/grow, `growMaxHeight`; `growTargetHeight` is the `full` stack on
  screen). It opens at that stack, once: the first layout with a record on
  screen holds `min(growTargetHeight, 200)` in the `openingHeight` volatile
  (`settleRecordsOpeningHeight`), which `configuredHeight` reads while
  `recordsOnly` and no `height` is written, unless `grow` or a ring's host sizes
  it. Nothing is written, so viewing a track edits no session; `height` has no
  default, so a written 200 holds. After that a pan never moves it (ADR-255's
  amendment). Before the listing lands it is not records-only, so a sampled VCF
  never flashes the records-only height. The records take the one color rule
  below, with no genotype keyed unless `encoding.color` is set, and letter as a
  feature track does (`normal` size, the `records.labels` fields, the
  description on its own line). What `fixed` or a capped `grow` cannot show
  scrolls: the scroll hooks point at the band's drawn stack, the band paints and
  picks offset by `recordsScrollTop`, its div takes `usePanelVirtualScroll` and
  the scrollbar. The allele-count filters (MAF, missingness) leave the menu.
- **The record settings are a feature track's, under `records`** (ADR-254's
  sub-slice B amendment): `displayMode`, `mark`, `facet` (plugin-features's and
  display-kit's own sub-schemas), `tooltip.field` and `labels`. An unset
  `displayMode` resolves in one place, `recordsDisplayMode`: `compact` over rows,
  `normal` with none. `records.facet` is the record sections, through the hosted
  ladder's `facet` and `layoutInputs.hiddenGroupKeys`, with `RecordsSectionChips`
  over the band and `GroupLabelBoxes` in the export; the display's top-level
  `facet` stays the sample facet. A facet field and a non-default tooltip or
  label field are read in the worker (`recordFields` in `rpcProps`,
  `shared/recordFields.ts`) onto `VariantFeatureInfo.groupKey`, `.tooltip`,
  `.labelName` and `.labelDescription`, since the payload carries no INFO; the
  band's synthetic record carries them as `recordGroup`, `recordTooltip` and
  `recordLabelName`/`recordLabelDescription` (`labelsReadByWorker`). A default
  tooltip or label reads nothing extra: over the synthetic record it reads the
  name or description. A label field is read whether it shows or not, so its
  checkbox redraws rather than refetches. `tooltip.show` stays the display's one
  toggle for both bands.
- **Menus follow the band.** With no rows: Feature height, Names and
  Descriptions in Show, Group by → Field... (`RecordsFacetFieldDialog`), built
  from plugin-features's menu builders (`featureHeightMenuItem`,
  `labelCheckboxItems`). Over rows the band has no height menu, since its seam
  handle sizes it and the fit ladder shrinks what does not fit: Row height is the
  one height row, `records.displayMode` is config only, and Group by stays the
  sample attributes.
- **No rows gates on density, as a feature track does.** The display composes
  `FeatureGateMixin` (from `@jbrowse/plugin-features/band`) and overrides
  `densityGateActive` to act only while `recordsOnly` at genomic positions, so
  over rows the byte gate alone guards the fetch. The budget is
  `records.maxFeatureScreenDensity` (1 record/px, the mixin's
  `featureGateConfigSchemaFields`, read through the overridable
  `configuredMaxFeatureScreenDensity`). The worker counts each region's admitted
  records after the filter (`CellDataResult.recordCounts`, in `regions` order)
  and, sent a budget, refuses past it before building cells
  (`RecordsTooDenseResult`, the counts still on it); `fetchRegionsBatched`'s
  `onComplete` commits them through `commitGateMeasurements`
  (`recordCountMeasurements`). The banner and Force load are
  `RegionTooLargeMixin`'s. There is no pre-fetch sample, so a refused window
  still reads its records once per settled viewport.
- **Its height over rows holds, and is added.** `records.height` (no default, so
  a value equal to the default still reads as written) once a drag, `+N hidden`
  or a config writes it, else the `openingRecordsHeight` volatile the first
  layout that draws a record holds (`settleRecordsBandHeight`), but not one
  collapsed past the density budget, whose one row a zoom in would leave the
  band at, so a pan never resizes the track (`recordsBandHeightOverRows`).
  Before that, the `full` rung's packed height at compact feature size up to the
  default (170). With the rows hidden (`rowsHidden`) the track's edge and its
  double click resize the band. The model's `height` is the rows' slot plus the
  band, so the rows keep their slot `height` under every `heightMode`
  (`growMaxHeight` is Infinity over rows). In a circular view's ring (`inRing`)
  the display is records-only: the ring samples one canvas of its strip, the
  band's, so no row draws or is fetched there. Taking the band from the rows
  instead, or compositing every canvas in the ring host, was declined: rows drew
  in a ring only by accident (`records.show` off, or in columns), and a whole
  chromosome trips the byte gate on any real cohort.
- **Past its height the record rows decimate, then hide.** The ladder drops
  descriptions, thins bodies and decimates names, but over rows never scales the
  boxes: `recordsLaidOutDataMap` leaves a record that still ends below
  `topBands.reserved.records` unplaced (`unplaceBelow`), so no painter, pick,
  highlight or `searchFeatureByID` sees it, and `BandChips`' `+N hidden` chip
  counts the ones on screen (`recordsHiddenCount`; a click is
  `showAllRecordRows`). Past `records.maxFeatureScreenDensity` on screen the
  records pack in one row (`recordsPackMode` `collapsed`), where a feature track
  refuses the window.
- **Labels follow the records on screen**, as LinearBasicDisplay's do:
  `recordsOnScreenIds` (`featureIdsTouchingBlocks` over the payload's spans,
  `recordSpans`) is the density `labelVisibility` gates on (names past 0.2
  records/px, descriptions past 0.1), counted off the payload, not the render
  data, whose label text depends on it. **The fit and height measure them only
  with no rows** (`recordsMeasureIds`); over rows they measure the payload.
  Labelling every record, or measuring every buffered record with rows hidden,
  costs seconds on a dense window
  ([the measurement](MULTI_SAMPLE_VARIANTS.md#the-records-band-against-linearvariantdisplay)).
  Unlabelled, sub-pixel records past 25 deep collapse into one faded row
  (`planDensityCollapse`).
- **No second fetch to draw.** The payload already carries every record, so
  `records.show` and `records.height` are render-tier settings. **A click does
  fetch**: the payload has no INFO, so `fetchFullRecord` reads the record through
  `GetBasicFeatureDetails`, as LinearBasicDisplay's `fetchFullFeature` does, over
  its first base (a 5 Mb SV's span would be a 5 Mb read), the next click aborting
  one in flight. It keeps the record's `samples`, which the widget's sample grid
  shows, and a genotype cell's sample card (`withClickedSample`); the click's own
  record opens where the adapter finds none, INFO-less, so a breakpoint split
  view launched from it stops its junction walk there. Dropping the samples where rows draw
  them left the grid empty. Persistence needs no trim, since the feature widget
  leaves out a feature over 2 MB of JSON.
- **A record takes its SV class's color, otherwise `featureDefaultColor`**
  (`svClassColors`, the `svType` preset), with rows or without, while no
  `encoding.color` is picked, the SV classes drawn keyed as "SV type" above the
  genotypes; under a picked `encoding.color`, the cell hue at full dose
  (`paintFeatureColors`). It crosses over as a per-feature jexl rather than the
  BED `itemRgb` path, which drops alpha.
- **One label line over rows**: ID, description, then the share of the shown
  samples carrying it (`recordCarriers.ts`; the denominator is
  `recordCarrierSamples`, one line to make it every sample in the payload), as
  `recordLabel`. A record is counted when a label with text or a hover first
  asks (`recordCarriersOf`), never every fetched record up front. The label pipeline places a description under its name, so an
  inline description is part of the name and the ladder drops it with the name.
- **What is still ours**: the record tooltip (`buildRecordHit`, sample fields
  empty so one `hoveredFeature` slot serves both bands), the gestures
  (`RecordsBandOverlay`, a div over its `OverlayCanvas`) and the seam drag, which
  writes `records.height` as the drawn height at the press plus the pointer's
  whole travel (`RecordsBandOverlay`'s `BandSeamHandle`), past the stack
  included, so the seam waits at the floor until the pointer comes back to it.
- **Toggling genotype rows remounts the GPU canvas**, since `VariantBody` moves
  in and out of `RowsPanel`: one re-upload per toggle, as a layout switch costs.
- **Mode branches stay few.** `recordsOnly` is read at nine sites outside
  `recordsBandViews.ts` (2026-11-06), and the menu branches on
  `drawsGenotypeRows` (15 rows, each its own rule); a count well past that is
  the band growing a mode switch again (ADR-254's third amendment). Declined, as
  every site would still branch: a role table (`recordsRole.scrolls`,
  `.overflow`, `.measures`), which names one fact seven ways; one
  `'none' | 'hidden' | 'drawn'` getter for `recordsOnly`, `drawsGenotypeRows`
  and `rowsHidden`, each derived from the other two inputs so no state is
  impossible today; and splitting `variantDisplayMenuItems.ts` by band. Lifting
  `recordsOnScreenIds` and `recordsLabelDensityPerPx` beside LinearBasicDisplay's
  `onScreenFeatureIds` was declined too: the two read different payload shapes.

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
second scan ([MULTI_SAMPLE_VARIANTS.md](MULTI_SAMPLE_VARIANTS.md)). MAF is over
**called** alleles, not genotype classes, so a mixed-ploidy site weights a
haploid call once. A monomorphic site is not dropped.
