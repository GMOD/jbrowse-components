---
name: category-filters-leave-coverage-whole
description: The category filters (`svSignal`, `split`, `spliced`, `singletons`, `readName`) stop thinning the coverage band, with the tooltip and SNP hit test counting every read through a per-position table, and an `svSignal` color field paints no-evidence reads grey. Decided 2026-10-12; Idea 1, `svSignal` in place of `properPairs`, landed as ADR-229.
---

# Category filters that leave coverage whole

Colin reviewed this proposal and decided its calls on 2026-10-12. Idea 1, one
`svSignal` category in place of `properPairs`, landed as
[ADR-229](../../architecture-decision-records/adr-229-sv-evidence-is-one-read-category.md),
which holds its definition, its consumers and its rejected variants. Ideas 2
and 3 are left.

Paths are under `plugins/alignments/src/` unless they say otherwise.

## The problem

- **The category filters thin coverage.** `filterChainFeatures` runs at
  `executeRenderAlignmentData.ts:305`, ahead of the facet (318), the extract
  (356) and `runCoveragePipeline` (171). `website/scripts/specs/ui.ts:1061`
  records that `svSignal: 'only'` is not the answer for an arc figure for this
  reason.

## Where filtering happens today

One worker call per displayed region:

1. **Adapter parse:** `dropsRead` (`shared/util.ts`) drops by flag masks,
   `readName`, `tagFilters` and `spliced`.
2. **`sampleFeatures`:** dedupe, then `minMapq` per record.
3. **Insert-size stats** (`computePairedInsertSizeStats`) over that sample.
4. **`selectChains`:** `singletons`, `svSignal` and `split` per chain grouped
   by name.
5. **`partitionFeatures`** cuts facet sections; **`extractFeatureArrays`**
   fills `readCategoryBits` per section.
6. **`buildGroupResult`** (145-190): detail arrays, then `runCoveragePipeline`
   (depth, per-instance frequencies, SNP, interbase, modification, sashimi).
7. **Main thread:** layout, color bakes, the coverage tooltip, arcs and cloud.

`GetConsensusSequence.ts:105` and `GetGlobalValueForTag.ts:83` call
`filterChainFeatures`, steps 2 and 4 in one, and `tables.ts:837` calls the
same RPC.

## Step 0: insert-size stats from the sample (landed)

The band follows Idea 2's line. The sample filters (flags, `minMapq`, tags)
shape it, and the category filters do not. The pins and their sabotages are in
`executeRenderAlignmentData.test.ts`.

- **Open: `readName` on one pair leaves no band.** The adapter drops every
  other read before the worker sees them, and one pair's sample collapses to
  `upper === lower`. Idea 2 moves `readName` and `spliced` out of `dropsRead`;
  placing them after `sampleFeatures` then fixes both.

## Idea 2: category filters leave coverage whole

**The line.** A filter that defines the sample thins coverage, as `samtools
depth` and IGV's load filters do. A filter that picks rows to inspect leaves
coverage whole. A user who wants one category's depth facets by it.

| Thins coverage (which reads count) | Leaves it whole (which reads are drawn) |
| --- | --- |
| `flagInclude`, `flagExclude`, `minMapq`, `tagFilters` | `svSignal`, `split`, `spliced`, `singletons`, `readName` |

**The worker change**, after ADR-112's rule that a layer owns its transform:

1. Adapters drop by flags and tags only. `spliced` and `readName` leave
   `dropsRead`, which makes both apply to synteny blocks for the first time.
2. Chains are judged over the whole fetch, before `partitionFeatures`, so a
   strand facet cannot split a chain's verdict.
3. Every read is extracted and runs through `buildAlignmentDetailArrays` and
   the coverage pipeline.
4. One compaction after `buildAlignmentDetailArrays`
   (`executeRenderAlignmentData.ts:145-190`) drops the undrawn reads, trimming
   the sorted per-instance arrays, their frequencies and the `*ReadIndices`
   together, and remapping each index.
5. The worker ships a per-position table from all reads. The coverage tooltip
   (`getCoverageBin`, `components/positionStats.ts:223-258`, which counts SNPs
   off the per-read mismatch arrays) and `findSignificantInBin`
   (`packages/alignments-core/src/coverageDownsampling.ts:635`) read it, or
   depth and allele counts disagree.
6. The consensus follows the drawn reads (`GetConsensusSequence.ts:103-104`);
   `GetGlobalValueForTag` applies the sample filters.

**UX.**

- The tooltip says, while a category filter is set: "Counts reads passing the
  flag, MAPQ and tag filters; category filters only hide rows".
- The Filter dialog splits into "Which reads count" and "Which reads are
  drawn". Near-duplicates to word apart: `flags::SUPPLEMENTARY` against
  `split:exclude`, `flags:PROPER_PAIR:` against `svSignal`, and "Filter for
  this read" against "Filter for this haplotype" (`menus/contextMenu.ts:170-199`).
- Sashimi junctions keep their counts under `spliced: 'exclude'`. Arcs and the
  read cloud still come from drawn reads.

**Costs.** A category filter no longer saves the extract or the detail
arrays. Bench "Filter for this read" at 300x against today's filtered path,
the case that loses most.

**Figures.** Four `cancer_sv` figures rely on `split: 'only'` thinning the
band: `derivative_inserts` (`website/scripts/specs/cancer_sv.ts:876-894`),
`derivative_synteny` (683), `k562_fusion_inspector_reads` (1507) and
`k562_bcr_abl_split` (1676). Rebuild each with a `split` facet and say so in
the caption. Lines 296 and 828 also set `split: 'only'`; check them too.

## Idea 3 (follow-up): an `svSignal` color field

A color field `svSignal` paints no-evidence reads grey, as an ordinary pair's
arc paints the baseline slot (`arcPaintOrder`), and the tiered sort lifts the
evidence. No opacity channel and no `dim` filter value:
`GRAMMAR_OF_GRAPHICS.md:125-127` keeps `opacity` a uniform. The color can read
`readCategoryBits` through `svSignalTier`.

## Precedent

- **IGV** applies its duplicate, vendor-failed, secondary, supplementary and
  MAPQ filters at load, so coverage counts that set, including reads
  downsampling hides. It colors by insert size and orientation over grey
  normal pairs and has no "hide concordant pairs".
- **samtools:** `view -f 2`/`-F 2` is the literal proper-pair filter; `depth`
  takes `-q`, `-Q` and a flag mask.

## Decisions (Colin, 2026-10-12)

Decisions 1-3 (replace `properPairs` outright, an unmapped mate counts, 50 bp
insertions count) are ADR-229's.

4. Tag filters thin coverage; `readName` leaves it whole.
5. Order: step 0, then Idea 1, then Idea 2 once the tooltip and SNP hit test
   count from all reads.
6. The four figures above get a `split` facet and say so in their captions.
7. The consensus follows the drawn reads.
8. Idea 3 is a color field plus the sort, with no `dim` value.

## Build plan

Each pin names the sabotage that turns it red.

1. **Idea 2**, after the per-position table:
   - Depth identical with and without each category filter. Sabotage: filter
     ahead of the extract.
   - Tooltip SNP counts and depth agree under a filter. Sabotage: skip the
     all-reads table.
   - A strand facet with an `svSignal` chain keeps both mates. Sabotage: judge
     chains per section.
   - Each per-read array's read index after compaction. Sabotage: skip the
     remap.
   - The 300x bench, and the four figures rebuilt.
2. **Idea 3**: the color field, pinned by a canvas2d-against-WebGPU capture.

## Rejected variants

- **Every filter leaves coverage whole.** Duplicates and MAPQ-0 reads would
  count, against samtools and IGV.
- **An unfiltered depth lane beside the filtered one.** A facet already draws
  per-category depth, and a second lane is a second band to explain.
- **Filtering on the main thread** (ship every read, mask at layout, as
  ADR-188 moved chain identity). Instant toggles, for a skip path in every
  row-instanced packer; nothing decided needs it.
- **A `dim` filter value or an `opacity` channel.** The color field does it.
