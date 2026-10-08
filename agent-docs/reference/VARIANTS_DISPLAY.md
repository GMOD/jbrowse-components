---
name: variants-display
description: How the multi-sample variant display draws genotypes: cells, the one composition rule, the legend, mixed ploidy, layouts, bands and connectors. Read before touching plugins/variants rendering.
kind: spec
---

# Multi-sample variants

The rules list and the subsystem's overview are `plugins/variants/src/CLAUDE.md`. Bare paths
below are relative to `plugins/variants/src/`.

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
- **`color` is the single cell-coloring axis** (`shared/cellHue.ts`). A preset
  (`impact`, `phaseSet`) and a record field (`svType` among them) are both
  fields of it, and a record with no value keeps the alt hue. Colour never
  depends on zoom: the insertion marker is the cell's own colour widened, and
  "insertion" is its shape and width. A purple marker made a variant read as an
  insertion only at the zooms where the marker outgrew its cell.
- **A cell's alpha does depend on zoom, where records share pixels**
  (`LinearMultiSampleVariantDisplay/densityFade.ts`). At genomic positions each
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
  an impact tier, an SV class, a phase-set hue, a plain CSS colour, or, in
  phased mode, the per-haplotype allele identity. Which alt a sample carries is
  not on it in allele-count mode; the matrix's per-alt columns and phased mode
  carry that.
- **`dosage` is over CALLED alleles**, so `1/2` is a hom and `0/2` a het, and
  `./1` is a full dose on the one haplotype that was called. A wholly uncalled
  genotype is the no-call category, never a blend into it. `altDosageByte` is
  the same number for the insertion marker.
- **One ramp for every mode**, bounded by a fixed pale ceiling so a het in a
  class colour still reads as that class. Full dosage is the hue itself, which
  is also what makes a legend swatch and a hom cell the same colour. The
  `shadeByDosage` slot turns it off.
- **The main thread paints the hue and the shade (ADR-203).** The worker reads
  what the hue needs off each variant (`cellHueOf`'s `read`: a field's value as
  text, or a `jexl:` callback's colour) and ships it beside each cell's
  `altDosageByte`; `LinearMultiSampleVariantDisplay/paintCells.ts` repaints the alt cells and the lane
  from them, each colour map a computed apart from row placement. So the dosage
  is the byte, in the cells and the key's het swatch (`HET_DOSAGE`) alike. A
  phase-set hue is per cell and stays the worker's.
- **A scale's domain has no gaps**: a record with no structural class files
  under the SV key's `''`, which core's vocabulary names `SNV/indel`, and an
  unannotated record is `UNANNOTATED_IMPACT`. Without those the mode was class
  colours beside the default blue, i.e. two scales at once.
- **The absent-data colours are off every wheel.** The phase-set hue band is
  saturation/lightness the no-call yellow is not on, or a phase set paints a
  called haplotype the "missing" colour.
- **Cross-mode identity**: INS takes `palette.insertion`, and the phased allele
  colours come from a palette the SV scale does not touch — red cannot mean
  "deletion" in one mode and "secondary alt" in another.
- **The lane's record colour is `hue(variant)`**, not a constant of its own. A
  goldenrod mark over blue cells was a hue standing for nothing.

## The legend lists what was painted

`LinearMultiSampleVariantDisplay/variantLegend.ts` builds from the scale in use plus the absent-data
categories present, and its swatches come from the same functions the cells do.
`hasSecondaryAlt`, `hasUnphased` and `hasNoCall` are the cell loops' own record
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
`RowColor`: a samplesTsv attribute whose values each take a palette colour, or
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

**A row's colour is its `rowColor`**, the label bar tree-sidebar's
`RowLabelsOverlay` and `SvgRowLabels` draw — the cells are colored by genotype,
so `rowColorPaintsMarks` is false and the bar is the only place it shows. The
tooltip swatch reads it too, and tree-sidebar's row colour key
(`rowColorScales`) keys it by an attribute, after the genotype key; by `name` the
labels are the key. A `samplesTsv` `color` column
is the row's own `color`, which `resolvedRowColors` falls back to.

**An attribute in `rowColor.field` beats a `samplesTsv` `color` column**: a
channel bound to a variable beats a per-row constant. `TreeSidebarMixin` deals
the attribute's values first seen first over the base arrangement, so a focus
or the phased expansion recolours nothing, and `rowColorPaintsMarks` is false,
since the cells paint by genotype. `setRowColorField` is the mixin's
`setRowColorChoice`: a pick starts from the colours the current object or the
config gives that choice (`startingRowColor`), and '' is None,
`{ field: 'name' }`. The menu's Samples group offers None and the attributes
and ticks the dialog's choice (`rowColorChoice`), Each row included; the dialog
picks a value's colour under an attribute and a sample's under Each row
(ADR-209). A reset returns `rowColor` by tree-sidebar's `rowColorResetTarget`,
which keeps the choice, so a Color by survives it and a mode switch. The
missing-attribute warning reads the mixin's `rowColorAttribute`.
The flip ADR-160 names puts the row's own colour ahead of the palette here too.

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

Columns are for genotype PATTERN, not spans: the lane, the insertion markers and
the reference toggle are genomic-position features and answer off in columns.

**Each display names the slot's checkbox for its own picture**, so the two check
for opposite values: "Show as genotype matrix" here (columns), "Size cells by
genomic distance" on LD (genomic). One shared label read wrong on one of them,
and was reverted on 2026-09-30.

## Bands above the rows

`variantTopBands.ts` resolves both bands, and **the layout reserving a strip and
the painter filling it read that one function**.

- `rowsHeaderHeight` is the bands' total; `rowsTopOffset` adds the focus
  chip's line and is where rows begin; `lineZoneHeight` is the connector zone
  alone, not an offset.
- **A band comes out of `availableHeight`, never `height`.**
- **Off spends 0 px, not a clamped minimum**, or every committed figure moves.
- **A band a layout cannot paint answers 0 there** (`lineZoneHeight` at genomic
  positions, the lane in columns), whatever the config says.
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

The lane **is** a plugin-canvas feature band, not a painter of ours. It is not a
_hosted_ `LinearVariantDisplay` — a track renders one display, and a second one
would parse the same VCF again — but it holds that display's payload and runs
that display's functions:

`buildLaneRenderData` rebuilds `SimpleFeature`s from the cell payload (the span,
ID, description and SO type are all already on the wire) and hands them to
plugin-canvas's `buildFeatureRenderData`; `computeLaidOutData` packs them;
`resolveFitLadder` compacts the stack into `laneHeight`; `paintFeatureBand`
paints it; `forEachDisplayLabel` + `paintLabels` letter it;
`performMultiRegionHitDetection` picks. So overlap packing, paint order, label
placement, outlines and the click target are decided once — there, for both
displays — and the band cannot drift from the display it stands in for.

- **Main thread, and no second fetch.** Everything a variant _record_ is already
  rides in the payload, so the band costs no RPC change and no extra bytes, and
  `showVariantLane` stays a render-tier setting a toggle must not refetch. The
  pass is per record (thousands), not per cell (millions), and plugin-canvas
  packs main-thread anyway.
- **The lane is one row** (`flattenRows`, ADR-037), so a nested record cannot
  stack under the one holding it. The packer drops a record's name and
  description where they would overprint a kept one, and a long record's labels
  claim its whole span, since a label that fits inside slides with the viewport.
- **The color crosses over as a per-feature jexl.** `buildLaneRenderData` stamps
  each rebuilt feature with the `laneColor` attribute the display already
  resolved for the alt cells, and the lane's `color` slot is a jexl reading it —
  which is how a lane mark stays the color of the column under it. Not the BED
  `itemRgb` path `boxColor` falls through to: that takes an `r,g,b` triple and
  drops the alpha a jexl-authored cell color can carry.
- **`variantTopBands` no longer splits the band.** Mark strip, label strip and
  "do the labels fit" were ours and are now the fit ladder's; that file answers
  only how many pixels the band gets, plus which label kinds the slot asked for
  (`wantsName` / `wantsDescription`). What is drawn is `laneRenderedLabels`.
- **What is still ours** is what plugin-canvas has no opinion on: the record
  tooltip table (`buildVariantLaneHit`, sample fields left empty so one
  `hoveredFeature` slot serves both bands), the gestures (`variantSurface.ts` —
  hover off the chrome's `onPointerPosition`, click and right-click on a div
  because `OverlayCanvas` is `pointerEvents: none`), and
  `breakendSplitViewMenuItem`.

## How wide a cell draws: `variantCellSpanPx`

Three geometries must agree — the insertion mark, the cells' hover box and
their click target. The box is the cell united with the marker wherever the
mark's own gate (`insertionMarkerDraws`, unsnapped, floored at `MIN_CELL_PX`)
draws one, so it reads no pan phase and the legend asks the painter's question. The **lane** is no longer
one of them: its marks, their hover box and their click target are
plugin-canvas's layout (see "Bands above the rows"), which is why they can
stack.

**Edges go in in RECORD order, `toX(start)` then `toX(end)`** — never sorted,
never pre-snapped. `snappedCellLeftPx` hangs the 2px floor off the record's
_start_, which on a reversed block is its right edge (the reversed-block family
in `packages/render-core/CLAUDE.md`). Snapping first puts both edges of a
sub-pixel record on one pixel, making a pivot comparison a no-op in the exact
case it exists for.

**`insertionsWiden` has no default on purpose** — implicitly defaulted, cells
drew a 2px SNP while the lane drew a 40px bar.

**The band does not widen an insertion at all.** A plugin-canvas box is its
reference span, and that plugin has no insertion-length glyph — its own
`LinearVariantDisplay` draws a 65 kb `<INS>` as a 2px box too. So in this
display the length lives in the cells' marker only. Fixing it belongs there, in
a glyph both displays would get, not in a second painter here.

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
