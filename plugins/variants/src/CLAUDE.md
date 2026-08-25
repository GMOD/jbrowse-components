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
- The `"<sampleName> HP<n>"` convention lives only in
  `expandSourcesToHaplotypes`; `buildGenotypeMatrix.ts` alone picks a matrix.

## Cells

- **Buckets stay sorted by `(featureIndex, rowIndex)`** within each of the
  reference / non-reference partitions, or `findCellIndex` needs reworking. Read
  `numCells`, never `.length` — buffers are `slice`d only when cells were
  skipped.
- Cell arrays stay in the **worker's** row numbering; the hit test converts its
  one query row through `rowUnmap`.
- **`featureColor` is the single cell-coloring axis.**

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
- **The tier is per display, not per setting**: `referenceDrawingMode` is a
  fetch input for regular and a render input for the matrix, so the base carries
  only what both send.
- A drag-resized dimension goes on a config slot; the node outlives the display.
- **Matrix mode is zoom-cache-strict** and fetches visible-only; regular is
  neither.

## `layout` orders rows; `subtreeFilter` narrows them

`getSources` appends a sample a `layout` omits rather than dropping it — spelled
here because the phased case keys "already covered" on `sampleName`.

Row-arrangement actions persist through `setLayout` (never `self.layout =`), and
`applyArrangement` re-arranges the rows already on screen rather than
re-deriving from adapter order, which made "Color by…" discard a clustering run.

**An action computing a NEW order keeps the palette color, label and labelColor
that only `layout` holds** — by sorting rows that already carry them
(`editableSources`, as `sortByGenotype` does) or by merging a fresh order back
with `applyLayoutOverrides` (`@jbrowse/tree-sidebar`, as clustering does through
`buildClusteredLayout`). Doing neither blanked every sidebar swatch on a callset
colored by a `samplesTsv` column while the menu still showed the palette ticked.
`applyLayoutOverrides` matches on `name`, so it cannot merge across
granularities: in phased mode a fresh order is haplotypes and `layout` is
sample-level, and nothing matches.

**The row tint is `labelColor`**, the channel tree-sidebar's `RowLabelsOverlay`
and `SvgRowLabels` draw — the cells are colored by genotype, so a row has no
`color` of its own to spend. `maybeApplyColorByPalette` writes it there, the
group legend and the tooltip swatch read it there, and `getSources` folds a
`samplesTsv` `color` column (or a session saved when the palette wrote `color`)
onto it. Carrying the tint under `color` is what kept these displays on a label
gutter of their own until 2026-08.

## Which display: the matrix is for genotype PATTERN, not spans

The matrix lays columns out by feature **index** at equal widths. **SVs go in
the regular display**, whose `showVariantLane` and `showInsertionGlyphs` give an
insertion the length its reference span cannot express.

## Bands above the rows

`variantTopBands.ts` resolves both bands, and **the layout reserving a strip and
the painter filling it read that one function**.

- `rowsTopOffset` is the total and is where rows begin; `lineZoneHeight` is the
  connector zone alone, not an offset.
- **A band comes out of `availableHeight`, never `height`.**
- **Off spends 0 px, not a clamped minimum**, or every committed figure moves.
- **The slots live on the display that can paint the band**, not the shared
  schema.
- A drag-resized height goes on a config slot, clamped via `clampBandHeight`
  (`@jbrowse/core/util/bandHeight`, shared with the alignments and MAF bands).
  `boundBandHeight` is its read-time twin: a _stated_ height — config, menu,
  slider — takes the bounds alone, while a resize additionally leaves a band a
  config declared below the floor where it is.

**The container the rows are offset into is 0x0**, everything in it being
absolutely positioned. So it is the right parent for a child placed by
`left`/`top` (the canvas, the hover box, the glyph overlay) and the wrong one
for a child placed by `right` — `VariantScrollbar` mounted in there put the
thumb a track width off the display's LEFT edge, where `contain: strict` clipped
it, and gave the edge fade zero width. Anything anchored to the right edge, or
that applies `rowsTopOffset` itself, goes on the display's own box beside
`VariantOverlay`.

The lane **is** a plugin-canvas feature band, not a painter of ours. It is not a
_hosted_ `LinearVariantDisplay` — a track renders one display, and a second one
would parse the same VCF again — but it holds that display's payload and runs
that display's functions:

`buildLaneRenderData` rebuilds `SimpleFeature`s from the cell payload (the span,
ID, description and SO type are all already on the wire) and hands them to
plugin-canvas's `buildFeatureRenderData`; `computeLaidOutData` packs them;
`resolveFitLadder` compacts the stack into `laneHeight`; `drawFeatureBlocks`
paints it; `forEachDisplayLabel` + `paintLabels` letter it;
`performMultiRegionHitDetection` picks. So overlap packing, paint order, label
placement, outlines and the click target are decided once — there, for both
displays — and the band cannot drift from the display it stands in for.

- **Main thread, and no second fetch.** Everything a variant _record_ is already
  rides in the payload, so the band costs no RPC change and no extra bytes, and
  `showVariantLane` stays a render-tier setting a toggle must not refetch. The
  pass is per record (thousands), not per cell (millions), and plugin-canvas
  packs main-thread anyway.
- **The color crosses over as `itemRgb`.** With `config.color` unset,
  `getBoxColor` lets a feature's own BED color speak — which is how a lane mark
  stays the color of the alt cells in the column under it.
- **`variantTopBands` no longer splits the band.** Mark strip, label strip and
  "do the labels fit" were ours and are now the fit ladder's; that file answers
  only how many pixels the band gets, plus which label kinds the slot asked for
  (`wantsName` / `wantsDescription`). What is drawn is `laneRenderedLabels`.
- **What is still ours** is what plugin-canvas has no opinion on: the record
  tooltip table (`buildVariantLaneHit`, sample fields left empty so one
  `hoveredGenotype` slot serves both bands), the gestures
  (`useVariantCanvasInteraction`, on a div because `OverlayCanvas` is
  `pointerEvents: none`), and `breakendSplitViewMenuItem`.

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

The two counters in `shared/alleleCounts.ts` are context-tuned, not duplication:
the VCF hot path accumulates into an object because mutating captured primitives
inside the `processGenotypes` closure forces a V8 deopt. MAF is over **called**
alleles; LD must land on the same number by counting **alleles**, not genotype
classes. A monomorphic site is not dropped.
