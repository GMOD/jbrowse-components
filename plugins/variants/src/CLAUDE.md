# Multi-sample variants

Pipeline and measurements:
[reference/MULTI_SAMPLE_VARIANTS.md](../../../agent-docs/reference/MULTI_SAMPLE_VARIANTS.md).
Fetch/render tiering and the `rpcProps()` loop trap:
`agent-docs/ARCHITECTURE.md`.

## Hot loops: indexed for-loops only

The per-feature × per-sample loops run 10⁸+ times on real VCFs. Inside them:
indexed `for`, `for (const key in obj)`, no `??`/`||` wrapping an allocating
right-side. Applies to `computeVariantCells.ts`, `computeVariantMatrixCells.ts`
and the upload/render callbacks — **not** elsewhere.

## Genotypes

- **Genotypes reach the cell loops as codes, never strings**, and a new consumer
  reads codes. Codes are **Uint32** (Uint16 capped the dictionary at 65535, past
  which a genotype interned to 0 = "no call").
- **Nothing on the per-cell path may be keyed by sample NAME** — index by the
  column the callback already holds.
- **A code's column is the canonical `sampleNames` position, never
  `processGenotypes`' `sampleIdx`.** They differ only for
  `SplitVcfTabixAdapter`, and the disagreement files every genotype against a
  neighbouring sample in silence. `buildHeaderRemap` translates;
  `phaseSetReader` needs it too.
- **Phase-set coloring reads PS through `processFormatFields`, not `samples`.**
- Genotype maps crossing RPC key by `sampleName`, never `name` (HP-suffixed in
  phased mode).
- **`featureGenotypeMap` records every genotype, not what got painted** — both
  cell loops ship the interned per-feature array by reference, so the two
  displays cannot disagree.
- **`NaN` is the only missing marker.** A sentinel on the value scale made
  samples cluster by missingness.
- The `"<sampleName> HP<n>"` convention lives only in
  `expandSourcesToHaplotypes`; `buildGenotypeMatrix.ts` is the only place
  picking a matrix for a mode.

## Cells

- **Cell buckets stay sorted by `(featureIndex, rowIndex)`** within each of the
  reference / non-reference partitions, or `findCellIndex` needs reworking. The
  both-ends write lands the backward half reversed and flips it back, and
  buffers are `slice`d only when cells were skipped — read `numCells`, never
  `.length`.
- Cell arrays stay in the **worker's** row numbering; placement writes a second
  array and the hit test converts its one query row through `rowUnmap`.
- **`featureColor` is the single cell-coloring axis.** New modes go there, not
  as sibling toggles.

## Mixed ploidy: five consumers, one contract

Expansion is per-sample max ploidy and mixed-ploidy files are routine (1000G
chrX non-PAR). Both cell loops, `readPhasedAlleleIndicators` and
`buildValueTable` must agree that **a diploid sample has no allele for HP2 in a
triploid file** and that **haploid is phased** (`isPhasedOrHaploid`, not
`includes('|')`). **A new fixture for anything phased should mix ploidies.**
`readAltDosages` is the fifth, and is **ploidy-invariant**:
`2 * calls(allele) / called`.

## The unphased matrix is one column per ALT, not one per site

A dosage class made `0/1/1` and `0/0/1` identical and couldn't say which alt was
carried. Each site contributes `ALT.length` columns, summed into `colOffsets` in
a pre-pass so rows stay one pre-sized Float32Array; a biallelic site is one
column, bit-identical to the old encoding. `classifyGenotypeDosage` stays for
the anchored haplotype sort. Phased mode keeps its binary per-haplotype
indicator and so still collapses two alts.

## Settings

- **Row order is not a fetch input** (ARCHITECTURE.md). The worker ships
  `rowNames`; the client places them (`rowRemap` → `placeVariantRows`). The row
  _set_ still is one (`sampleFilter`, sent **sorted**). **Nothing may wait on
  the refetch this removed** — the cluster tree did and silently drew nothing.
- **`rpcProps()` must not read fetch-derived state**, which is why
  `sampleFilter` reads `sourcesBase`, not `sources`.
- **The tier is per display, not per setting** — `referenceDrawingMode` is a
  fetch input for regular and a render input for the matrix, so the base carries
  only what both send.
- A drag-resized dimension goes on a **config slot**; the config node outlives
  the display instance.
- **Matrix mode is zoom-cache-strict** (`isCacheValid` requires
  `bpPerPx === loadedBpPerPx`) and fetches visible-only; regular mode is
  neither.

## `layout` orders rows; `subtreeFilter` narrows them

`getSources` appends a sample a `layout` omits rather than dropping it —
tree-sidebar's `reconcileLayout` rule, spelled here because the phased case keys
"already covered" on `sampleName`. Narrowing is `subtreeFilter`, which is also
the half reaching the fetch via `sampleFilter`.

Row-arrangement actions persist through the mixin's `setLayout` (never
`self.layout =`), and `applyArrangement` re-arranges the rows already on screen
rather than re-deriving from adapter order — re-deriving made "Color by…"
discard a clustering run and halve the row count in phased mode.

## Which display: the matrix is for genotype PATTERN, not spans

`LinearMultiSampleVariantMatrixDisplay` lays columns out by feature **index** at
equal widths — right when the question is which samples share which calls.

**It is the wrong display for structural variants**, whose SPAN is the thing
being shown. **SVs go in the regular display**, where `showVariantLane` and
`showInsertionGlyphs` give an insertion the length its reference span cannot
express.

## Bands above the rows

The variant lane (`showVariantLane`) and the matrix-only connector-line zone
(`lineZoneHeight`) are both resolved by `variantTopBands.ts`, and **the layout
reserving a strip and the painter filling it read that one function**.

- `rowsTopOffset` is the total and is where the rows begin — what
  `TreeSidebarModel` reads. `lineZoneHeight` is the connector zone alone.
- **A band comes out of `availableHeight`, never `height`.**
- **Off spends 0 px, not a clamped minimum**, or every committed figure moves.
- **The slots live on the display that can paint the band**, not the shared
  schema; the base declares the geometry plus a `false`/default getter pair.
- A drag-resized band height goes on a config slot, clamped in the setter
  through `clampBandHeight`.

The lane is deliberately **not** a hosted `LinearVariantDisplay` — a track
renders one display, the two base models don't nest, and a combo would buy a
second parse of the same VCF. It shares `forEachFeatureSpan`,
`drawVariantShape`, `featureColor`, `featureDefaultColor`,
`createFeatureFloatingLabels` and `breakendSplitViewMenuItem` instead.

## How wide a record draws: `variantCellSpanPx`

Four geometries must agree on a record's drawn extent — marker overlay, lane
mark, hover box, click target — and all four go through it, whose base span
comes from the cell painter's own `snapVariantCellX`.

**Edges go in in RECORD order — `toX(start)`, `toX(end)` — never sorted, never
pre-snapped.** `snappedCellLeftPx` reads the orientation to hang the 2px floor
off the record's _start_, which on a reversed block is its right edge (see the
reversed-block family in `packages/render-core/CLAUDE.md`). The snap happens
_inside_ those two functions: snapping first puts both edges of a sub-pixel
record on one pixel, making a pivot comparison a no-op in exactly the case it
exists for.

The insertion-marker branch keeps the **unsnapped** reference-span centre and
returns it from the same call. **`insertionsWiden` has no default on purpose** —
implicitly defaulted, cells drew a 2px SNP while the lane drew a 40px bar. The
only caller passing a literal is `markersForBlock`.

## Connectors and allele counting

`connectorLineCoords` is a **model getter**, never a component `useMemo` — a
memo that doesn't re-run also stops tracking `bpPerPx`/`offsetPx`. LD's column
pitch comes from the fetch-time cell width, not the live block width.

The two counters in `shared/alleleCounts.ts` are context-tuned, not duplication
— the VCF hot path must accumulate into an object because mutating captured
primitives inside the `processGenotypes` closure forces a V8 deopt. MAF is over
**called** alleles; LD computes its own and must land on the same number by
counting **alleles**, not genotype classes. A monomorphic site is not dropped.
