# shared (MultiSampleVariant)

## Hot loops: indexed for-loops only

The per-feature × per-sample loops run 10⁸+ times on real VCFs. Inside them:
indexed `for`, `for (const key in obj)`, no `??`/`||` wrapping an allocating
right-side. Applies to `computeVariantCells.ts`, `computeVariantMatrixCells.ts`,
and the upload/render callbacks — **not** elsewhere; the rest of the codebase
prefers declarative iteration.

## Invariants

- **Cell buckets stay sorted by `(featureIndex, rowIndex)`** within each of the
  reference / non-reference partitions. Anything that reorders cells must
  preserve that or rework `findCellIndex`. The both-ends write means the
  backward half lands reversed and is flipped back, and buffers are only
  `slice`d when cells were skipped — read `numCells`, never `.length`.
- **Genotype maps crossing RPC key by `sampleName`**, never `name` (HP-suffixed
  in phased mode).
- **`featureGenotypeMap` is a genotype record, not a log of what got painted** —
  both cell loops ship the adapter's whole genotype map for the feature, by
  reference, so the two displays are handed the same object and cannot disagree.
  Don't rebuild it from the rows being drawn: under the default
  `referenceDrawingMode: 'skip'` a hom-ref call paints nothing, so a
  painted-cells copy made every hom-ref row decode as MISSING to the anchored
  sort — while the matrix, which always paints ref, sorted the same data
  differently. It is also the largest single cost the loop can take on: a fresh
  dictionary-mode object per feature with one insert per sample, which is
  features × samples inserts to reproduce a map already in hand.
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
  wait on the refetch this removed.** The cluster tree did: it was stashed as
  `pendingClusterTree` and promoted in `setCellData`, so once a reorder stopped
  refetching it was never promoted and a `runClustering: true` display drew no
  dendrogram — silently, because the rows were still clustered. It applies
  immediately now, which is safe for the same reason: `rowRemap` is derived from
  `sources`, so the cells re-place in the tick the layout changes.
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
