# Multi-sample variants

Pipeline, measurements and what each optimization bought:
[reference/MULTI_SAMPLE_VARIANTS.md](../../../agent-docs/reference/MULTI_SAMPLE_VARIANTS.md).
Fetch/render tiering: `agent-docs/ARCHITECTURE.md`.

**Hot loops** (`computeVariantCells.ts`, `computeVariantMatrixCells.ts`, the
upload/render callbacks) run 10⁸+ times: indexed `for`,
`for (const key in obj)`, no `??`/`||` wrapping an allocating right-side. Not
elsewhere.

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
- **`featureGenotypeMap` records every genotype, not what got painted** — both
  cell loops ship the interned per-feature array by reference. Under the default
  `referenceDrawingMode: 'skip'` a painted-cells copy makes every hom-ref row
  decode as MISSING to the anchored sort.
- **`NaN` is the only missing marker.** A value-scale sentinel made samples
  cluster by missingness.
- The `"<sampleName> HP<n>"` convention lives in `getSources.ts` alone:
  `expandSourcesToHaplotypes` writes it and `parseRowName` reads it back, a
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
  (`impact`, `svType`, `phaseSet`) and a record field are both fields of it, and
  a record with no value keeps the alt hue. Colour never depends on zoom: the
  insertion marker is the cell's own colour widened, and "insertion" is its
  shape and width. A purple marker made a variant read as an insertion only at
  the zooms where the marker outgrew its cell.

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
  `shadeByDosage` slot turns it off; it is a fetch input, since the worker
  colours the cells.
- **A scale's domain has no gaps**: a record with no structural class is
  `NON_SV_TYPE`, an unannotated record is `UNANNOTATED_IMPACT`. Without those
  the mode was class colours beside the default blue, i.e. two scales at once.
- **The absent-data colours are off every wheel.** The phase-set hue band is
  saturation/lightness the no-call yellow is not on, or a phase set paints a
  called haplotype the "missing" colour.
- **Cross-mode identity**: INS takes `palette.insertion`, and the phased allele
  colours come from a palette the SV scale does not touch — red cannot mean
  "deletion" in one mode and "secondary alt" in another.
- **The lane's record colour is `hue(variant)`**, not a constant of its own. A
  goldenrod mark over blue cells was a hue standing for nothing.

## The legend lists what was painted

`shared/variantLegend.ts` builds from the scale in use plus the absent-data
categories present, and its swatches come from the same functions the cells do.
`hasSecondaryAlt`, `hasUnphased`, `hasNoCall` and `paintedDomain` are the cell
loops' own record of what they emitted (`paintedCategories`, one bit per
`CELL_*`), merged across regions in `paintedLegendFlags`. "The site is
multiallelic" is not the same claim as "a secondary-alt cell is in the fetched
cell data", and the legend makes the second one. Fetched, not visible: the
regular display fetches wider than the viewport.

## Mixed ploidy: five consumers, one contract

Mixed-ploidy files are routine (1000G chrX non-PAR). Both cell loops,
`readPhasedAlleleIndicators` and `buildValueTable` must agree that **a diploid
sample has no allele for HP2 in a triploid file** and that **haploid is phased**
(`isPhasedOrHaploid`, not `includes('|')`). **A new fixture for anything phased
should mix ploidies.** `readAltDosages` is the fifth and is ploidy-invariant.

## The unphased matrix is one column per ALT, not one per site

A dosage class made `0/1/1` and `0/0/1` identical and couldn't say which alt was
carried. Each site contributes `ALT.length` columns, summed into `colOffsets` in
a pre-pass so rows stay one pre-sized Float32Array; a biallelic site is one
column and bit-identical to the old encoding. `classifyGenotypeDosage` stays for
the anchored haplotype sort.

## Settings

- **Row order is not a fetch input** (ARCHITECTURE.md). The row _set_ is
  (`sampleFilter`, sent **sorted**). **Nothing may wait on the refetch this
  removed** — the cluster tree did and silently drew nothing.
- **`rpcProps()` must not read fetch-derived state** — `sampleFilter` reads
  `sourcesBase`, not `sources`.
- **Feature filters are the shared two-tier contract**
  (`@jbrowse/core/util/jexlFilters`): the `jexlFilters` config slot declares the
  baseline **unprefixed**, `jexlFiltersSetting` is the dialog's already-prefixed
  override, and `activeFilters()` is the only thing anything reads. The property
  used to be called `jexlFilters` and shadowed the slot, so a config declaring
  filters on one of these tracks did nothing and said nothing.
- **The tier is per layout, not per setting**: `referenceDrawingMode` is a fetch
  input at genomic positions and a render input in columns, so `rpcProps` sends
  it only in the first.
- A drag-resized dimension goes on a config slot; the node outlives the display.

## The arrangement is `rows` and `rowColor`, by row name

**`rows` (`RowArrangement`, no field: the rows are the samples) holds the order,
labels, tree, provenance and focus; `rowColor` holds the tints**, display-kit's
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
to `rows.kept`, the fetch key's input, so it reads no `sampleInfo`: a focus
naming a haplotype keeps its sample there (`keptRows` with `rowAlias`, through
`parseRowName`). The rest are `TreeSidebarMixin`'s over this display's hooks:
`discoveredRows`, `expandRows` (`expandPhasedRows`), then `editableSources`,
ordered, relabelled and tinted by pair with no focus, palette or band — the
dialog's list and the sort's — `clusterableSources`, narrowed to the focus,
which both clustering paths send, and `bandedSources`, stacked in the `facet`'s
bands. `sources` adds the palette.

**Phased rows are the ploidy `sampleInfo` reports plus any haplotype the order
names.** Until the ploidy lands, the named haplotypes stand in for it, so an
arranged track keeps its haplotype rows and its tree across the refetch a
settings change triggers rather than folding back to samples. The expansion
reads `samplePloidy`, which keeps its identity while each fetch reports the same
ploidies, so a region arrival re-derives no row.

**The row tint is `labelColor`**, the channel tree-sidebar's `RowLabelsOverlay`
and `SvgRowLabels` draw — the cells are colored by genotype, so a row has no
`color` of its own to spend. `applyAttributeColors` writes it there, the group
legend and the tooltip swatch read it there, and `discoveredRows` folds a
`samplesTsv` `color` column onto it. Carrying the tint under `color` is what
kept these displays on a label gutter of their own.

**An attribute in `rowColor.field` beats a `samplesTsv` `color` column**: a
channel bound to a variable beats a per-row constant. The palette is dealt by
`TreeSidebarMixin` over this display's `rowColorDealFor` (`attributeColorDeal`),
the values ranked by how many samples carry them, so a focus or the phased
expansion recolours nothing. `setRowColorField` writes the object through
`colorForField`: a new attribute starts with no entries, '' is `scale: 'none'`
keeping the attribute, and `name` is each row its own. The menu's Samples group
and the arrangement dialog offer the same choices (`rowColorChoice`), and under
an attribute the dialog edits each value's colour, never a row's (ADR-164). A
reset returns `rowColor` only where its `name` pairs differ from the config's,
so over a config setting no row colour a Color by survives it and a mode switch.
The flip ADR-160 names puts the row's own colour ahead of the palette here too.

**The `facet` bands win over a cluster tree** (tree-sidebar's "A tree per
band"): `rowBanding` is the `facet`, each band draws the clade of exactly its
rows, and a run under bands clusters each band apart into one forest. A run
never writes the `facet` slot, so a session spec's own `facet` survives it, and
the colour key lists its values in the band order while both read one attribute
(`rowColorKeyOrder`).

**A `layout`, `clusterTree`, `clusterProvenance` or `subtreeFilter` on the
display snapshot, or a `domain` in its config, fails the load**, naming `rows`:
MST drops an undeclared key in silence, and the track would otherwise open
unarranged.

## One display, two layouts: `variantLayout`

The x position is a setting of the one display, `'genomic'` or `'columns'`, the
choice the LD display makes under the same slot, not a second display type. At
genomic positions the worker ships cells per displayed region
(`cellData.mode: 'regular'`); in columns it ships one matrix over the visible
regions, laid out by feature **index** at equal widths (`'matrix'`), fetched
visible-only and zoom-strict. The layout is a fetch input (`rpcProps().mode`).

Each layout mounts its own `DisplayChrome` and mark backend (`matrix/` holds the
columns' body, marks and export). **The upload lifecycle installs once per
model**, so `startRenderingBackend` tags which backend is attached
(`backendDrawsColumns`) and the one spec sends each backend only the payload it
draws; across a switch the old backend is sent an empty map until the other
chrome's backend arrives.

Columns are for genotype PATTERN, not spans: the lane, the insertion markers and
the reference toggle are genomic-position features and answer off in columns.

## Bands above the rows

`variantTopBands.ts` resolves both bands, and **the layout reserving a strip and
the painter filling it read that one function**.

- `rowsTopOffset` is the total and is where rows begin; `lineZoneHeight` is the
  connector zone alone, not an offset.
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
applies `rowsTopOffset` itself, goes on the display's own box beside
`VariantOverlay`.

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

Three geometries must agree — the insertion-marker overlay, the cells' hover box
and their click target — and all three go through it. The **lane** is no longer
one of them: its marks, their hover box and their click target are
plugin-canvas's layout (see the band section above), which is why they can
stack.

**Edges go in in RECORD order, `toX(start)` then `toX(end)`** — never sorted,
never pre-snapped. `snappedCellLeftPx` hangs the 2px floor off the record's
_start_, which on a reversed block is its right edge (the reversed-block family
in `packages/render-core/CLAUDE.md`). Snapping first puts both edges of a
sub-pixel record on one pixel, making a pivot comparison a no-op in the exact
case it exists for.

**`insertionsWiden` has no default on purpose** — implicitly defaulted, cells
drew a 2px SNP while the lane drew a 40px bar. Only `markersForBlock` passes a
literal.

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
