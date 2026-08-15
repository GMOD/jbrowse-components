# Multi-sample variants

## Hot loops: indexed for-loops only

The per-feature × per-sample loops run 10⁸+ times on real VCFs. Inside them:
indexed `for`, `for (const key in obj)`, no `??`/`||` wrapping an allocating
right-side. Applies to `computeVariantCells.ts`, `computeVariantMatrixCells.ts`
and the upload/render callbacks — **not** elsewhere.

## The genotype pipeline

[reference/MULTI_SAMPLE_VARIANTS.md](../../../agent-docs/reference/MULTI_SAMPLE_VARIANTS.md)
has the interned-code pass and what each half measured; read it before adding a
consumer or re-evaluating either optimization. The rules:

- **Genotypes reach the cell loops as codes, never strings**, and a new consumer
  reads codes. A per-feature `Record<sampleName, genotype>` to serve one is how
  four redundant passes come back.
- **Nothing on the per-cell path may be keyed by sample NAME** — that is 10⁸
  string hashes. Index by the column the callback already holds.
- **A code's column is the canonical `sampleNames` position, never
  `processGenotypes`' `sampleIdx`.** They differ only for
  `SplitVcfTabixAdapter`, and the disagreement files every genotype against a
  neighbouring sample in silence. `buildHeaderRemap` is the translation;
  `phaseSetReader` needs it too.
- **Phase-set coloring reads PS through `processFormatFields`, not `samples`** —
  `get('samples')` is an order of magnitude and three orders of memory worse.
- **Codes are Uint32**: Uint16 capped the dictionary at 65535, past which a
  genotype interned to 0, which means "no call".
- **Don't re-evaluate the packed key and the name-lookup removal separately** —
  the packed key is 1.02x alone and 1.15x once the name lookup is gone.

## Invariants

- **Cell buckets stay sorted by `(featureIndex, rowIndex)`** within each of the
  reference / non-reference partitions, or `findCellIndex` needs reworking. The
  both-ends write means the backward half lands reversed and is flipped back,
  and buffers are `slice`d only when cells were skipped — read `numCells`, never
  `.length`.
- **Genotype maps crossing RPC key by `sampleName`**, never `name` (HP-suffixed
  in phased mode).
- **`featureGenotypeMap` records every genotype, not what got painted** — both
  cell loops ship the interned per-feature array by reference, so the two
  displays cannot disagree. Under the default `referenceDrawingMode: 'skip'` a
  painted-cells copy makes every hom-ref row decode as MISSING to the anchored
  sort.
- **`NaN` is the only missing marker** in genotype matrices. A sentinel on the
  value scale (`-1`) made samples cluster by missingness.
- **`featureColor` is the single cell-coloring axis.** Add new modes there, not
  as sibling toggles — two switches need a precedence rule and the legend has to
  guess the same way.
- The `"<sampleName> HP<n>"` convention lives only in
  `expandSourcesToHaplotypes`; `buildGenotypeMatrix.ts` is the only place that
  picks a matrix for a mode.

## Mixed ploidy: five consumers, one contract

Expansion is per-sample max ploidy, and mixed-ploidy files are routine (1000G
chrX non-PAR). Both cell loops, `readPhasedAlleleIndicators` and
`buildValueTable` must agree that **a diploid sample has no allele for HP2 in a
triploid file** (draw nothing, don't read past the end) and that **haploid is
phased** (`isPhasedOrHaploid`, not `includes('|')`). **A new fixture for
anything phased should mix ploidies.**

`readAltDosages` is the fifth, and its contract is **ploidy-invariance**:
`2 * calls(allele) / called`, so a haploid alt is 2 like `1/1`, not 1 like a
het.

## The unphased matrix is one column per ALT, not one per site

A dosage class made `0/1/1` and `0/0/1` identical and could not say _which_ alt
was carried, so at a multiallelic site `1|1` and `2|2` landed on the same point.
Each site contributes `ALT.length` columns, summed into `colOffsets` in a
pre-pass so the rows stay one pre-sized Float32Array. A biallelic site is one
column and bit-identical to the old encoding, so ordinary VCFs neither widen nor
reorder.

`classifyGenotypeDosage` stays for the anchored haplotype sort, which wants a
category. Phased mode keeps its binary per-haplotype indicator and so still
collapses two alts — the anchored sort is the exact-allele tool there.

## Settings: classify by invalidation tier

Fetch input → `rpcProps()`. Layout input → `sourcesBase`/`sources`/`hierarchy`.
Render input → the subclass `renderState` getter.

- **`rpcProps()` must not read fetch-derived state** or it loops — which is why
  `sampleFilter` reads `sourcesBase`, not `sources`.
- **Row order is not a fetch input.** The worker builds its own row list and
  ships `rowNames`; the client places those onto screen rows (`rowRemap` →
  `placeVariantRows`), so reorders, "Group by", clustering and "Sort by
  genotype" re-upload rather than refetch. The row _set_ still is an input
  (`sampleFilter`, sent **sorted** so only membership can move it). **Nothing
  may wait on the refetch this removed** — the cluster tree did and silently
  drew nothing (CLUSTERING_WORKFLOW.md).
- The cell arrays stay in the **worker's** row numbering, since `findCellIndex`
  binary-searches `(featureIndex, rowIndex)`. Placement writes a second array;
  the hit test converts its one query row through `rowUnmap`.
- The tier is **per display**, not per setting — `referenceDrawingMode` is a
  fetch input for regular and a render input for the matrix, so the base carries
  only what both send.
- A drag-resized dimension goes on a config slot; the config node outlives the
  display instance.
- **Matrix mode is zoom-cache-strict** (`isCacheValid` requires
  `bpPerPx === loadedBpPerPx`). Don't extend that or the visible-only fetch to
  regular mode.

## `layout` orders rows; `subtreeFilter` narrows them

A `layout` is an ordering/override hint, so `getSources` appends a sample it
omits rather than dropping it — tree-sidebar's `reconcileLayout` rule, spelled
here only because the phased case keys "already covered" on `sampleName` (layout
rows are haplotypes). Narrowing is `subtreeFilter`, which is also the half that
reaches the fetch via `sampleFilter`.

Row-arrangement actions persist through the mixin's `setLayout` (never a direct
`self.layout =`) so a stale dendrogram is dropped, and `applyArrangement`
re-arranges the rows already on screen rather than re-deriving from adapter
order — re-deriving made "Color by…" discard a clustering run and halve the row
count in phased mode.

## Which of the two displays: the matrix is for genotype PATTERN, not spans

`LinearMultiSampleVariantMatrixDisplay` lays columns out by feature **index** at
equal widths — right when the question is which samples share which calls across
many sites, since every site gets the same width whatever its allele frequency.

**It is the wrong display for structural variants**: an SV's SPAN is the thing
being shown. Two ~220 bp SINE deletions drew as half-width blocks across an 18
kb window, and the figure needed a caption, a raised `lineZoneHeight` and a
duplicate track at real coordinates — all of which went away in
`LinearMultiSampleVariantDisplay` with `showVariantLane`. **SVs go in the
regular display**, where `showInsertionGlyphs` gives an insertion the length its
reference span cannot express.

## Bands above the rows

The **variant lane** (`showVariantLane`) and the matrix-only **connector-line
zone** (`lineZoneHeight`) are both resolved by `variantTopBands.ts`, and **the
layout that reserves a strip and the painter that fills it read that one
function** — deriving them separately paints over the first row with nothing
failing.

- `rowsTopOffset` is the total and is where the rows begin; it is what
  `TreeSidebarModel` reads and what every component offsetting past the bands
  takes. `lineZoneHeight` is the connector zone **alone** — not an offset.
- **A band comes out of `availableHeight`, never `height`.** Turning one on
  leaves the track the same size and the rows shorter.
- **Off spends 0 px, not a clamped minimum**, or every committed figure moves.
- **The slots live on the display that can paint the band, not the shared
  schema.** The base declares the geometry plus a `false`/default getter pair to
  override. That is why the matrix has no variant lane: it has no painter for a
  genomic one.
- A drag-resized band height goes on a **config slot**, clamped in the setter
  through `clampBandHeight` — floor keeps the handle grabbable, ceiling stops a
  drag swallowing the plot.

The lane is deliberately **not** a hosted `LinearVariantDisplay`: a track
renders one display, the two base models don't nest, and a combo would buy a
second parse of the same VCF. It shares the variant-specific code instead —
`forEachFeatureSpan` (one per-record walk, so a lane mark cannot sit a pixel off
its column), `drawVariantShape`, `featureColor`, `featureDefaultColor`,
`createFeatureFloatingLabels`, `breakendSplitViewMenuItem`.

## How wide a record draws: `variantCellSpanPx` decides

Four geometries must agree on a record's drawn extent — marker overlay, lane
mark, hover box, click target — and all four go through `variantCellSpanPx`,
whose base span comes from `snapVariantCellX`, the cell painter's own. Sharing
the 2px floor is not sharing the span: `drawVariantBlocks` snaps both edges to
the grid `variant.slang` snaps to (about the canvas CENTRE, which is why
`canvasWidth` reaches here), and computing min/max raw instead put all four up
to half a pixel off — a quarter of the mark at the 2px floor.

**Edges go in in RECORD order — `toX(start)`, `toX(end)` — never sorted, never
pre-snapped.** `snappedCellLeftPx` reads the orientation to hang the 2px floor
off the record's _start_, which on a reversed block is its **right** edge; see
the reversed-block family in `packages/render-core/CLAUDE.md`. The snap happens
**inside** those two functions: snapping first puts both edges of a sub-pixel
record on one pixel, so a pivot comparing the snapped pair is a no-op in exactly
the case it exists for.

The insertion-marker branch keeps the **unsnapped** reference-span centre — no
shader draws a marker, so there is nothing to match — and returns it from the
same call rather than re-deriving beside it.

**`insertionsWiden` has no default on purpose.** Implicitly defaulted, with
glyphs off the GPU cells drew a 2px SNP while the lane drew a 40px bar, and a
click 20px clear of the cell opened its widget. The only caller passing a
literal is `markersForBlock`, where the widening _is_ the marker.
`showInsertionGlyphs` is a model getter for the same reason.

## Connector lines

`connectorLineCoords` is a **model getter**, never a component `useMemo` — a
memo that doesn't re-run also stops tracking `bpPerPx`/`offsetPx`, so the
overlay misses a zoom. One frame, no group transform: the `|offsetPx|` gap is
baked into the coords. LD's column pitch comes from the fetch-time cell width,
not the live block width (which double-applies zoom during the RPC window).

## Allele counting

The two counters in `shared/alleleCounts.ts` are context-tuned, not duplication
— the VCF hot path must accumulate into an object because mutating captured
primitives inside the `processGenotypes` closure forces a V8 deopt. Don't merge
them.

MAF is over **called** alleles — `.` is never a candidate minor allele nor part
of the denominator. LD computes its own and must land on the same number: count
**alleles**, not genotype classes. A monomorphic site is not dropped.
