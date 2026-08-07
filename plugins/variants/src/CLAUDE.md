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
- **`featureGenotypeMap` records every genotype, not what got painted** — both
  cell loops ship the whole per-feature genotype array `computeSampleInfo`
  interned, by reference, so the two displays are handed the same object and
  cannot disagree. Don't rebuild it from the rows being drawn: under the default
  `referenceDrawingMode: 'skip'` a hom-ref call paints nothing, so a
  painted-cells copy made every hom-ref row decode as MISSING to the anchored
  sort — while the matrix, which always paints ref, sorted the same data
  differently.
- **Genotypes reach the cell loops as codes, never as strings.**
  `computeSampleInfo` makes one `processGenotypes` pass per feature — the
  `@gmod/vcf` callback that reports a genotype as a range into the line — and
  from it interns `genotypeCodes`, accumulates `sampleInfo`, and folds the
  legend flags. The cell loops then index those codes by a source's column
  (`buildSourceSampleIndices`, resolved once per pass) and key their style memos
  by code, so a genotype string is materialized once per (site, distinct
  genotype) rather than once per cell. What this replaced was a
  `Record<sampleName, genotype>` per feature, built by `GENOTYPES()` and walked
  three more times — flags, colors, interning — to reproduce a payload the
  worker only ever ships as codes: the analyze+cells stage went 613ms → 168ms on
  2504 samples × 400 variants, and the 168ms covers the cell painting the 613ms
  doesn't. **A new consumer reads codes.** Reintroducing the record to serve one
  is how the four passes come back.
- **A code's column is the canonical `sampleNames` position, never
  `processGenotypes`' `sampleIdx`.** That callback numbers samples against the
  header of the file _its own_ feature came from; `sampleNames` is the union of
  every header in the fetch. The two are the same list for a single-header
  adapter — which is all of them but `SplitVcfTabixAdapter` — and are not the
  same list when per-contig files order or omit samples differently, which is
  the case the union exists for. `buildHeaderRemap` translates header position
  to column and answers `undefined` when they already agree, so the common fetch
  keeps its direct index and pays no extra read. Writing `codes[sampleIdx]`
  filed each genotype, and each sample's ploidy, against a neighbouring sample
  on any multi-contig view over such files — silently, since every row still
  held a real genotype. `phaseSetReader` reads PS through the same callback and
  so needs the same translation.
- **Phase-set coloring reads PS through `processFormatFields`, not `samples`.**
  `feature.get('samples')` parses every FORMAT field of every sample — an object
  and an array apiece — to reach one: 343ms/239MB per fetch on a 100-sample
  phased callset over 2k variants, 1686ms/1.17GB at 500 samples, against
  33ms/113ms and 4MB. `makePhaseSetReader` is shared by both cell loops rather
  than written twice, because the two displays paint the same phase sets and a
  second copy of the absent/malformed rules is how they drift: an absent column,
  an empty field and `.` all mean "no phase set" and fall back to allele
  coloring, while a present-but-unparseable id is NaN and paints hue 0 — which
  is what `SAMPLES()`' `+` coercion produced. GT is deliberately not read there;
  it comes from the interned codes, so there is one source of it. An adapter
  that can't report FORMAT ranges paints by allele, the same outcome an absent
  `samples` field already gave.
- Codes are **Uint32**. They were Uint16, which capped the dict at 65535
  distinct genotype strings — reachable on a decomposed pangenome callset, where
  a multiallelic site's genotypes grow with the square of the alt count. Past
  the cap a genotype interned to 0, and 0 now means "this sample has no call",
  so the cell loops would decline to paint it at all.
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
