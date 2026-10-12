---
name: sv-signal-filter-and-coverage
description: Decided 2026-10-12. `properPairs` gives way to one chain-wide `svSignal` category (split, an SV-size deletion or insertion, a pair the aligner did not call concordant), shared by the read filter, a tiered sort, the breakpoint split view and jb2export. The category filters then stop thinning the coverage band, with the tooltip and SNP hit test counting every read. A grey-for-no-evidence `svSignal` color replaces a dim mode. Step 0 has landed, so the insert-size band comes from the deduped, MAPQ-passed sample ahead of the category filters.
---

# One SV-evidence category, and category filters that leave coverage whole

Colin asked "I felt like we tried to move away from properPairs. Is that
correct?", reviewed this proposal, and decided its calls on 2026-10-12.

- **Partly.** `91d2828e37` renamed the arc and cloud setting to
  `showOrdinaryPairs`, but the arcs still hide by `isConcordantPairRead`
  (`features/arcs/compute.ts:627-633`), the rule `properPairs` filters by.
- **ADR-226 rejected `pairing` as the replacement** because `pairing` answers
  for a chain by its primary read. `svSignal` asks of every record in the
  chain, as `properPairs` does.

Paths are under `plugins/alignments/src/` unless they say otherwise.

## The problem

- **The name is SAM jargon.** `isProperPairChain`
  (`RenderAlignmentDataRPC/filterChainFeatures.ts:32-41`) calls a chain proper
  when every record has 0x2, faces FR and is not split. The menu's help has to
  explain that "Hide proper pairs" means "leave the SV signal on screen".
- **On long reads the filter does nothing useful.** No unpaired record has
  0x2, so "Hide proper pairs" hides nothing and "Only proper pairs" hides all.
- **The filter thins coverage.** `filterChainFeatures` runs at
  `executeRenderAlignmentData.ts:305`, ahead of the facet (318), the extract
  (356) and `runCoveragePipeline` (171). `website/scripts/specs/ui.ts:1061`
  records that `properPairs: 'exclude'` "was never the answer" for this reason.
- **jb2export's SV recipe equals `split:only`.** Since `2e630d59d0` no split
  chain is proper, so `properPairs:exclude split:only`
  (`products/jbrowse-img/README.md:673-675`) never keeps a discordant pair.
- **The sort and the filter disagree.** `LIFTED_BITS.svSignal`
  (`sortLayout.ts:487-491`) lifts split reads and 50 bp deletions; the filter
  keeps non-concordant chains. Each misses what the other keeps.

## Where filtering happens today

One worker call per displayed region:

1. **Adapter parse:** `dropsRead` (`shared/util.ts:203-216`) drops by flag
   masks, `readName`, `tagFilters` and `spliced`.
2. **`sampleFeatures`:** dedupe, then `minMapq` per record.
3. **Insert-size stats** (`computePairedInsertSizeStats`) over that sample.
4. **`selectChains`:** `singletons`, `properPairs` and `split` per chain
   grouped by name.
5. **`partitionFeatures`** cuts facet sections; **`extractFeatureArrays`**
   fills `readCategoryBits` per section (`shared/extractFeatureArrays.ts:173-174`).
6. **`buildGroupResult`** (145-190): detail arrays, then `runCoveragePipeline`
   (depth, per-instance frequencies, SNP, interbase, modification, sashimi).
7. **Main thread:** layout, color bakes, the coverage tooltip, arcs and cloud.

`GetConsensusSequence.ts:105` and `GetGlobalValueForTag.ts:83` call
`filterChainFeatures`, steps 2 and 4 in one, and `tables.ts:837` calls the
same RPC.

## Step 0: insert-size stats from the sample (landed)

The band follows Idea 2's line. The sample filters (flags, `minMapq`, tags)
shape it, and the category filters do not. `computePairedInsertSizeStats`
reads `sampleFeatures`' output, so a filter that keeps only discordant pairs
still colors them against the concordant ones it hid, while MAPQ-0 pairs in
repeats and a duplicated record stay out. The pins and their sabotages are in
`executeRenderAlignmentData.test.ts`.

- **Open: `readName` on one pair leaves no band.** The adapter drops every
  other read before the worker sees them, and one pair's sample collapses to
  `upper === lower`. Idea 2 moves `readName` and `spliced` out of `dropsRead`;
  placing them after `sampleFeatures` then fixes both.

## Idea 1: one `svSignal` category

**Definition.** A record is SV evidence when any of these holds:

- `isSplitAlignment` returns true (SA tag or 0x800);
- its CIGAR has a deletion of 50 bp or more (`CIGAR_HAS_SV_DELETION`);
- its CIGAR has an insertion of 50 bp or more (a new `CIGAR_HAS_SV_INSERTION`
  from the same `cigarCategoryBits` walk);
- it is paired and primary and fails `isConcordantPairRead` (0x2 plus FR),
  which takes in a mate on another chromosome and an unmapped mate.

The filter keeps a chain when any record qualifies.

**Why the aligner's 0x2 and not the insert-size band.** The flag does not
depend on the view, for the reason ADR-226 rejected an insert-size facet: the
band is sampled per region, so a band-based filter would change with the
window. The two disagree at the edges. A red long-insert pair that BWA flagged
0x2 is not evidence; a grey pair that bowtie2 left unflagged at `-X 500` can be.

**MAPQ, stated plainly.** `passingMapq` judges each record alone, so a MAPQ-60
read whose mate was misplaced at MAPQ 0 stays, and its flags make it
discordant. A chain-level rule, where every record in the chain must pass
`minMapq` before the chain counts as evidence, closes that. It is an option
for the build to settle.

**The sort becomes tiered:** split reads first, then SV-size deletions or
insertions, then discordant reads, then the rest, so discordant short reads do
not bury the split reads. The sort is per read: the mate of a read with a
60 bp deletion is kept by the filter and not lifted.

**One mask, every reader.** The extract adds `READ_SV_INSERTION` and
`READ_DISCORDANT` to `readCategoryBits`. The sort tiers, the filter and the
breakpoint split view's `isEvidence`
(`plugins/breakpoint-split-view/src/BreakpointSplitView/readChains.ts:64-67`)
read the same definition, and the parity test holds all three to it.

| Case | `properPairs: exclude` today | `svSignal: only` |
| --- | --- | --- |
| Concordant pair, mate split | kept | kept (split) |
| Discordant pair, no split | kept | kept |
| Interchromosomal or unmapped mate | kept | kept |
| Concordant pair with a 60 bp deletion | dropped | kept |
| Long read | kept, every one | kept if split or SV indel |
| Synteny block (flags 0) | kept | kept if SV indel |

`split` stays a category (the long-read question by itself) and so does
`singletons` (a question about the window).

**Consumers that change:**

- **Model and menus:** `shared/types.ts:165-204`, `READ_CATEGORIES` ("SV
  evidence", "Only SV evidence", "Hide SV evidence"), and help or examples at
  `readFilterConfigSchema.ts:88`, `configSchema.ts:185-189`,
  `configSlotViews.ts:111` and `menus/readConnections.ts:114`. No `retired`
  lift: ADR-221 warns on a v5-beta `properPairs` and loads without it.
- **jb2export:** `applyTrackOpts.ts:486-491` keeps its own key list, held to
  the type by `Covers`, so it needs `svSignal` added by hand. An old
  `properPairs:` modifier refuses with an error naming `svSignal:only`, not
  the unknown-modifier warning. `breakpointInit.ts:101` and
  `applyTrackOpts.ts:815` already sort by `svSignal`.
- **Docs:** the jbrowse-img README, `website/docs/jbrowse-img.md:684-692`,
  `config/LGVSyntenyDisplay.md`, `models/LinearAlignmentsDisplay.md`,
  `user_guides/sv_visualization.md:266`, `website/scripts/screenshot-review-plan.md`,
  the v5.0.0 changelog draft (203), and the autogen outputs. ggjbrowse's
  `R/alignments.R:58-61` lists `properPairs` and lacks `svSignal` in `sort`.
- **Stale "Show proper pairs" comments:** `features/arcs/compute.ts:611`,
  `packages/alignments-core/src/orientation.ts:84`, `ARC_BAND.md:52`,
  `DEEP_COVERAGE.md:85`.
- **Tests:** `filterChainFeatures.test.ts`, `concordantPairParity.test.ts`,
  `GetGlobalValueForTag.test.ts`, and the `properPairs` fixtures in
  `model.coupling`, `contextMenu`, `fetchAutorun`, `FilterByTagDialog`,
  `reads.test.tsx` and `applyTrackOpts.test.ts`.

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
  `split:exclude`, `flags:PROPER_PAIR:` against the category, and "Filter for
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
`GRAMMAR_OF_GRAPHICS.md:125-127` keeps `opacity` a uniform.

## Precedent

- **IGV** applies its duplicate, vendor-failed, secondary, supplementary and
  MAPQ filters at load, so coverage counts that set, including reads
  downsampling hides. It colors by insert size and orientation over grey
  normal pairs and has no "hide concordant pairs".
- **samtools:** `view -f 2`/`-F 2` is the literal proper-pair filter; `depth`
  takes `-q`, `-Q` and a flag mask.
- **Callers:** samblaster and LUMPY take discordance from 0x2. Manta and DELLY
  fit their own insert-size distribution and apply a MAPQ floor. Sniffles and
  cuteSV read split reads plus CIGAR insertions and deletions.

## Decisions (Colin, 2026-10-12)

1. Replace `properPairs` outright; jb2export refuses the old modifier.
2. A read whose mate is unmapped counts as evidence.
3. Insertions of 50 bp or more count.
4. Tag filters thin coverage; `readName` leaves it whole.
5. Order: step 0, then Idea 1, then Idea 2 once the tooltip and SNP hit test
   count from all reads.
6. The four figures above get a `split` facet and say so in their captions.
7. The consensus follows the drawn reads.
8. Idea 3 is a color field plus the sort, with no `dim` value.

## Build plan

Each pin names the sabotage that turns it red.

1. **Idea 1**, with an ADR amending ADR-226's definition:
   - `filterChainFeatures.test.ts`, a row per line of the table. Sabotage:
     drop the insertion or the unmapped-mate clause.
   - `sortLayout.test.ts`: a split read above a discordant pair at depth.
     Sabotage: one tier for all three.
   - The parity test across filter, sort bits and `isEvidence`. Sabotage:
     revert `isEvidence` to its own rule.
   - jb2export `properPairs:` refuses naming `svSignal:only`. Sabotage: fall
     through to the unknown-modifier warning.
2. **Idea 2**, after the per-position table:
   - Depth identical with and without each category filter. Sabotage: filter
     ahead of the extract.
   - Tooltip SNP counts and depth agree under a filter. Sabotage: skip the
     all-reads table.
   - A strand facet with an `svSignal` chain keeps both mates. Sabotage: judge
     chains per section.
   - Each per-read array's read index after compaction. Sabotage: skip the
     remap.
   - The 300x bench, and the four figures rebuilt.
3. **Idea 3**: the color field, pinned by a canvas2d-against-WebGPU capture.

## Rejected variants

- **Rename `properPairs` and keep its rule.** Long reads keep the no-op.
- **`pairing` as the filter, or a fifth `pairing` level.** ADR-226.
- **The insert-size band as the discordance test.** It changes with the view.
- **Every filter leaves coverage whole.** Duplicates and MAPQ-0 reads would
  count, against samtools and IGV.
- **An unfiltered depth lane beside the filtered one.** A facet already draws
  per-category depth, and a second lane is a second band to explain.
- **Folding `split` and `singletons` into `svSignal`.** See Idea 1.
- **Filtering on the main thread** (ship every read, mask at layout, as
  ADR-188 moved chain identity). Instant toggles, for a skip path in every
  row-instanced packer; nothing decided needs it.
- **A `dim` filter value or an `opacity` channel.** The color field does it.
