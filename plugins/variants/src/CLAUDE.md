# Multi-sample variants

## Hot loops: indexed for-loops only

The per-feature × per-sample loops run 10⁸+ times on real VCFs. Inside them:
indexed `for`, `for (const key in obj)`, no `??`/`||` wrapping an allocating
right-side. Applies to `computeVariantCells.ts`, `computeVariantMatrixCells.ts`,
and the upload/render callbacks — **not** elsewhere; the rest of the codebase
prefers declarative iteration.

## The genotype pipeline

How a genotype reaches those loops — the interned-code pass, what it replaced,
and what each half measured — is
[reference/MULTI_SAMPLE_VARIANTS.md](../../../agent-docs/reference/MULTI_SAMPLE_VARIANTS.md).
Read it before adding a consumer of genotype data or re-evaluating either
optimization. The rules that fall out of it:

- **Genotypes reach the cell loops as codes, never as strings**, and **a new
  consumer reads codes.** Reintroducing a per-feature
  `Record<sampleName, genotype>` to serve one is how four redundant passes come
  back.
- **Nothing on the per-cell path may be keyed by sample NAME** — that is 10⁸
  string hashes on a real panel. Index by the column the callback already holds.
- **A code's column is the canonical `sampleNames` position, never
  `processGenotypes`' `sampleIdx`.** They differ only for
  `SplitVcfTabixAdapter`, and the disagreement files every genotype against a
  neighbouring sample in silence. `buildHeaderRemap` is the translation;
  `phaseSetReader` needs it too.
- **Phase-set coloring reads PS through `processFormatFields`, not `samples`** —
  `get('samples')` is an order of magnitude and three orders of memory worse.
  `makePhaseSetReader` is shared by both cell loops so the absent/malformed
  rules cannot drift.
- **Codes are Uint32**, because Uint16 capped the dictionary at 65535 and past
  the cap a genotype interned to 0, which now means "no call".
- **Don't re-evaluate the packed key and the name-lookup removal separately** —
  the packed key is 1.02x alone and 1.15x once the name lookup is gone.

## Invariants

- **Cell buckets stay sorted by `(featureIndex, rowIndex)`** within each of the
  reference / non-reference partitions. Anything that reorders cells must
  preserve that or rework `findCellIndex`. The both-ends write means the
  backward half lands reversed and is flipped back, and buffers are only
  `slice`d when cells were skipped — read `numCells`, never `.length`.
- **Genotype maps crossing RPC key by `sampleName`**, never `name` (HP-suffixed
  in phased mode).
- **`featureGenotypeMap` records every genotype, not what got painted** — both
  cell loops ship the whole per-feature genotype array `computeSampleInfo`
  interned, by reference, so the two displays are handed the same object and
  cannot disagree. Don't rebuild it from the rows being drawn: under the default
  `referenceDrawingMode: 'skip'` a hom-ref call paints nothing, so a
  painted-cells copy made every hom-ref row decode as MISSING to the anchored
  sort — while the matrix, which always paints ref, sorted the same data
  differently.
- **`NaN` is the only missing marker** in genotype matrices. A sentinel on the
  value scale (`-1`) made samples cluster by missingness.
- **`featureColor` is the single cell-coloring axis.** Add new modes there, not
  as sibling toggles — two switches need a precedence rule and the legend has to
  guess the same way.
- The `"<sampleName> HP<n>"` convention lives only in
  `expandSourcesToHaplotypes`; `buildGenotypeMatrix.ts` is the only place that
  picks a matrix for a mode. Re-inlining either drifts labels from rendered
  rows.

## Mixed ploidy: five consumers, one contract

Expansion is per-sample max ploidy, and mixed-ploidy files are routine (1000G
chrX non-PAR). Both cell loops, `readPhasedAlleleIndicators`, and
`buildValueTable` must agree that **a diploid sample has no allele for HP2 in a
triploid file** (draw nothing, don't read past the end) and that **haploid is
phased** (`isPhasedOrHaploid`, not `includes('|')`). **A new fixture for
anything phased should mix ploidies.**

`readAltDosages` is the fifth, and its contract is **ploidy-invariance**: it
writes `2 * calls(allele) / called`, so a haploid alt (`1`) is 2 like `1/1`, not
1 like a het.

## The unphased matrix is one column per ALT, not one per site

`readAltDosages` replaced `classifyGenotypeDosage`'s 0/1/2 _class_ in
`getGenotypeMatrix`. A class is a category, not a quantity: it made `0/1/1` and
`0/0/1` identical, and — worse — it could not say _which_ alt was carried, so at
a multiallelic site `1|1` and `2|2` landed on the same point despite sharing no
allele. Each site therefore contributes `ALT.length` columns, summed into
`colOffsets` in a pre-pass so the rows stay one pre-sized Float32Array.

**A biallelic site is one column and is bit-identical to the old encoding**
(0/0→0, 0/1→1, 1/1→2, haploid 1→2), so an ordinary VCF neither widens nor
reorders. Only multiallelic sites cost extra width.

`classifyGenotypeDosage` itself stays: the anchored haplotype sort buckets rows
by genotype category and wants exactly a category. Phased mode keeps its binary
per-haplotype indicator (`readPhasedAlleleIndicators`) and so still collapses
two alts — the anchored sort is the exact-allele tool there.

## Settings: classify by invalidation tier

Fetch input → `rpcProps()`. Layout input → `sourcesBase`/`sources`/`hierarchy`.
Render input → the subclass `renderState` getter.

- **`rpcProps()` must not read fetch-derived state** or it loops — which is why
  `sampleFilter` reads `sourcesBase`, not `sources`.
- **Row order is not a fetch input.** The worker builds its own row list
  (`buildCanonicalRows`), ships `rowNames`, and the client places those names
  onto screen rows (`rowRemap` → `placeVariantRows`). A drag-reorder, a "Group
  by", a clustering run and "Sort by genotype" therefore re-upload the cells
  already in hand; none of them refetches. The row _set_ still is an input —
  `sampleFilter`, sent **sorted** so only membership can move it — because a
  focused clade is genuinely fewer cells to compute. Same split maf makes
  (`subtreeFilter` + `placeMafRegionData`); multi-wiggle makes it by passing
  sources as a structural arg and re-encoding from `gpuProps()`. **Nothing may
  wait on the refetch this removed** — the cluster tree did, and silently drew
  nothing once reorders stopped refetching (CLUSTERING_WORKFLOW.md, "Why the
  tree no longer waits"). Applying immediately is safe because `rowRemap` is
  derived from `sources`: the cells re-place in the tick the layout changes.
- The cell arrays stay in the **worker's** row numbering, because they are
  sorted by `(featureIndex, rowIndex)` and `findCellIndex` binary-searches that.
  Placement writes a second array; the hit test converts its one query row
  through `rowUnmap` instead.
- The tier is **per display**, not per setting — `referenceDrawingMode` is a
  fetch input for regular and a render input for the matrix, so the base carries
  only what both send.
- A drag-resized dimension goes on a config slot; the config node outlives the
  display instance.
- **Matrix mode is zoom-cache-strict** (`isCacheValid` requires
  `bpPerPx === loadedBpPerPx`). Don't extend that or the visible-only fetch to
  regular mode.

## `layout` orders rows; `subtreeFilter` narrows them

Same split as maf, multi-row features and multi-wiggle. A `layout` is an
ordering/override hint, so `getSources` appends a sample it omits rather than
dropping it — tree-sidebar's `reconcileLayout` rule, spelled here only because
the phased case has to key "already covered" on `sampleName` (layout rows are
haplotypes, which match no sample name). Narrowing the rows is `subtreeFilter`,
which is also the half that reaches the fetch via `sampleFilter`.

`getSources` used to iterate `layout` alone, so a layout that omitted a sample
hid it. Nothing could produce one — every layout the app writes covers all rows
(`arrangeSources`, `buildClusteredLayout`, `sortSourcesAroundVariant`, the
arrangement dialog) — so it was reachable only by hand-editing a session, and
two tests used it as a shortcut to states `setSubtreeFilter` reaches properly.

Row-arrangement actions share the rest too: they persist through the mixin's
`setLayout` (never a direct `self.layout =`) so a stale dendrogram is dropped,
and `applyArrangement` re-arranges the rows already on screen rather than
re-deriving from adapter order — re-deriving made "Color by…" discard a
clustering run, and halve the row count in phased mode.

## Which of the two displays: the matrix is for genotype PATTERN, not for spans

`LinearMultiSampleVariantMatrixDisplay` lays its columns out by feature
**index** at equal widths. That is the right trade when the question is which
samples share which calls across many sites — a haplotype block, an LD
structure, a missingness pattern — because it gives every site the same width
whatever its allele frequency or its size, and the connector band ties the
columns back to the genome.

**It is the wrong display for structural variants**, and the failure is not
subtle: an SV's SPAN is the thing being shown, and equal-width columns destroy
it. Two SINE deletions of ~220 bp drew as half-width blocks across an 18 kb
window, reading as multi-kb deletions over the whole gene, and the figure needed
three separate corrections — a caption, a raised `lineZoneHeight`, and a second
track of the same records at their real coordinates — all of them for the layout
rather than for anything about the data. All three went away when it moved to
`LinearMultiSampleVariantDisplay` with `showVariantLane`.

So: **SVs go in the regular display.** It draws each record at its own
coordinate and width, `showInsertionGlyphs` gives an insertion the length its
reference span cannot express, and the variant lane names each record above its
own column. A caption that apologises for a rendering choice is the sign the
choice was wrong.

## Bands above the rows

Two things stack over the genotype rows — the **variant lane** (records at their
genomic spans, `showVariantLane`) and the **connector-line zone** (matrix only,
`lineZoneHeight`) — and `variantTopBands.ts` resolves both in one pure function,
the way `belowCoverageBandsGeometry` does for the alignments display. **The
layout that reserves a strip and the painter that fills it read that one
function.** Deriving them separately is how a painter draws over the first row
of the plot with nothing failing; it just looks like a rendering bug.

- `rowsTopOffset` is the total, and is where the rows begin. It is the name
  `TreeSidebarModel` reads (the sidebar positions against the rows, not against
  any one band) and what every component offsetting past the bands takes.
  `lineZoneHeight` is the connector zone **alone** — don't reach for it as an
  offset.
- **A band comes out of `availableHeight`, never out of `height`.** Turning one
  on must leave the track the same size and the rows shorter; in the default
  fit-to-height mode they re-divide what is left.
- **Off spends 0 px, not a clamped minimum.** The toggle has to leave the
  display pixel-identical to what it was before the band existed, or every
  committed figure moves.
- **The slots live on the display that can paint the band, not the shared
  schema.** A display that reserves a band it cannot fill takes the height from
  its rows and leaves it blank. The base declares the geometry plus a
  `false`/default getter pair for the subclass to override. That is why the
  matrix has no variant lane yet: it lays columns out by feature index and has
  no painter for a genomic one.
- A drag-resized band height goes on a **config slot** (it outlives the display
  instance) and is clamped in the setter through `clampBandHeight` — floor keeps
  the resize handle grabbable, ceiling stops a drag swallowing the plot.

The lane is deliberately **not** a hosted `LinearVariantDisplay`: a track
renders one display (`track.activeDisplay`), the two base models don't nest, and
the worker already ships the records the lane draws — so a combo would buy a
second parse of the same VCF. What it shares instead is the variant-specific
code: `forEachFeatureSpan` (one per-record walk, so a lane mark cannot sit a
pixel off the column it names), `drawVariantShape`, `featureColor`, core's
`featureDefaultColor`, plugin-canvas's `createFeatureFloatingLabels`, and
`breakendSplitViewMenuItem`.

## How wide a record draws: `variantCellSpanPx` decides, and it asks

Four geometries have to agree on one record's drawn extent — the marker overlay,
the lane's mark, the hover box, the click target — and all four go through
`variantCellSpanPx`.

**And its base span comes from `snapVariantCellX`, the cell painter's own.**
Sharing the 2px floor is not sharing the span: `drawVariantBlocks` snaps both
edges to the grid `variant.slang` snaps to (about the canvas CENTRE, which is
why `canvasWidth` has to reach here), and computing min/max raw instead put all
four up to half a pixel off the cell they were describing — 0.48px measured on a
genome-wide window, where the snap fires on every record and every mark is at
the 2px floor, so it is a quarter of the mark. There is one span function; the
four consumers are its callers.

**Edges go in in RECORD order — `toX(start)`, `toX(end)` — never sorted, and
never pre-snapped.** `snappedCellLeftPx` reads the orientation to hang the 2px
floor off the record's _start_, which on a reversed block is its **right** edge.
This is the reversed-block family in `packages/render-core/CLAUDE.md`, which the
cells were the fourth painter to get wrong; read it there.

The snap has to happen **inside** those two functions, and that is the part
local to here: snapping first puts both edges of a sub-pixel record on one
pixel, so a pivot that compares the snapped pair is a no-op in exactly the case
it exists for. Raw px in, decision inside.

The insertion-marker branch keeps the **unsnapped** reference-span centre, and
that is not an oversight: no shader draws a marker, so there is nothing to
match, and all four consumers take it from here so they agree with each other.
That centre comes back from the same call (`center`) rather than being
re-derived beside it — one rect, so one number.

**`insertionsWiden` (the display's `showInsertionGlyphs`) has no default there
on purpose.** It had one implicitly, by nobody asking: with glyphs switched off
the GPU cells drew a 2px SNP while the lane drew a 40px bar above it, the hover
box covered 40px of nothing, and a click 20px clear of the cell still opened its
widget. The only caller that passes a literal is `markersForBlock`, where the
widening _is_ the marker.

`showInsertionGlyphs` is a model getter for the same reason — it is one answer
four consumers need, not four `getConf` reads.

## Connector lines

`connectorLineCoords` is a **model getter**, never a component `useMemo` — a
memo that doesn't re-run also stops tracking `bpPerPx`/`offsetPx`, so the
overlay misses a zoom. One frame, no group transform: the `|offsetPx|` gap is
baked into the coords. LD's column pitch comes from the fetch-time cell width,
not the live block width (which double-applies zoom during the RPC window).

## Allele counting

The two counters in `shared/alleleCounts.ts` are context-tuned, not duplication
— the VCF hot path must accumulate into an object because mutating captured
primitives inside the `processGenotypes` closure forces a V8 deopt. Count
inline; don't merge them.

MAF is over **called** alleles — `.` is never a candidate minor allele nor part
of the denominator. LD computes its own and must land on the same number: count
**alleles**, not genotype classes. A monomorphic site is not dropped.
