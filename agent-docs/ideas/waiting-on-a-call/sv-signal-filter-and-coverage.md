---
name: sv-signal-filter-and-coverage
description: The alignments filter's `properPairs` asks a SAM question (0x2 and FR) where the user asks "show me the SV evidence", hides nothing on long reads, and drops reads ahead of the coverage pipeline, so excluding proper pairs empties the coverage band and switches off insert-size coloring. One `svSignal` category (split, deletion of 50 bp or more, discordant pair, chain-wide) would replace it and become the definition the filter, the `svSignal` sort and jb2export share; category filters would stop thinning coverage; a dimmed-context mode would follow.
---

# One SV-evidence category, and category filters that leave coverage whole

Written 2026-10-12 for Colin's review of "I felt like we tried to move away
from properPairs. Is that correct?"

- **Partly.** `91d2828e37` renamed the arc and cloud setting to
  `showOrdinaryPairs`, but the arcs still hide by `isConcordantPairRead`
  (`features/arcs/compute.ts:627-633`), the rule `properPairs` filters by.
  The setting name went and the rule stayed.
- **ADR-226 rejected `pairing` as the replacement** because `pairing` answers
  for a chain by its primary read. That row holds: `svSignal` below asks of
  every record in the chain, as `properPairs` does.

Paths are under `plugins/alignments/src/` unless they say otherwise.

## The problem

- **The name is SAM jargon.** `isProperPairChain`
  (`RenderAlignmentDataRPC/filterChainFeatures.ts:32-41`) calls a chain proper
  when every record has 0x2, faces FR and is not split. The menu's help
  (`shared/readCategoryFilters.ts:42-49`) has to explain that "Hide proper
  pairs" means "leave the SV signal on screen".
- **On long reads the filter does nothing useful.** No unpaired record has
  0x2, so "Hide proper pairs" hides nothing and "Only proper pairs" hides
  everything.
- **The filter thins coverage.** `filterChainFeatures` runs at
  `executeRenderAlignmentData.ts:305`, ahead of the facet (318), the extract
  (356) and `runCoveragePipeline` (171). `website/scripts/specs/ui.ts:1061`
  records that `properPairs: 'exclude'` "was never the answer" for this reason.
- **The filter switches off insert-size coloring.**
  `computePairedInsertSizeStats` (`executeRenderAlignmentData.ts:374`) builds
  its band from the primary proper pairs that survived the filter. A scratch
  run (40 proper pairs, 3 pairs of 5 kb insert, color by insert size) gave a
  152-610 band unfiltered and `undefined` under `properPairs: 'exclude'`, so
  the long-insert pairs the user asked to see lose their red.
- **jb2export's SV recipe is redundant.** `products/jbrowse-img/README.md:673-675`
  spells it `properPairs:exclude split:only`. Since `2e630d59d0` no split chain
  is proper, so the pair equals `split:only`, and it never kept a discordant
  pair without a split read.
- **The sort and the filter disagree.** `LIFTED_BITS.svSignal`
  (`RenderAlignmentDataRPC/sortLayout.ts:487-491`) lifts split reads and
  deletions of 50 bp or more. The filter keeps non-concordant chains. The sort
  lifts a concordant pair with a 60 bp deletion and the filter hides it; the
  filter keeps a discordant pair and the sort leaves it down.

## Where filtering happens today

One worker call per displayed region, in this order:

1. **Adapter parse:** `dropsRead` (`shared/util.ts:203-216`) drops records by
   flag masks, `readName`, `tagFilters` and `spliced`.
2. **`filterChainFeatures`:** dedupe, `minMapq` per record, then `singletons`,
   `properPairs` and `split` per chain grouped by name.
3. **`partitionFeatures`** cuts facet sections, and **`extractFeatureArrays`**
   runs per section, filling `readCategoryBits` with
   `READ_SPLIT | cigarCategoryBits` (`shared/extractFeatureArrays.ts:173-174`).
4. **Insert-size stats**, pooled over the sections.
5. **`runCoveragePipeline`** per section: depth, the per-instance frequencies
   behind the pileup's mismatch fade, SNP, interbase, modification coverage
   and sashimi junctions, all over that section's extracted reads.
6. **Main thread:** layout, color bakes, arcs and the read cloud, all from the
   shipped `WorkerPileupData`.

`GetConsensusSequence.ts:105` and `GetGlobalValueForTag.ts:83` call
`filterChainFeatures` too. `tables.ts:837` calls the same RPC, so the R tables
and ggjbrowse follow whatever the RPC does.

## Idea 1: one `svSignal` category

**Definition.** A record is SV evidence when any of these holds:

- `isSplitAlignment` returns true (SA tag or 0x800);
- its CIGAR has a deletion of 50 bp or more (`CIGAR_HAS_SV_DELETION`);
- `pairingOf` returns `discordant`: paired, both mates mapped, primary, and
  not `isConcordantPairRead`.

The filter keeps a chain when any of its records qualifies, as `properPairs`
judges whole chains. The sort stays per read: a pair's flags and a split
read's SA tag already describe the whole fragment.

**How the helpers compose.** The extract adds `READ_DISCORDANT` (8) to
`readCategoryBits`, from `readFlags` and `readPairOrientations`. One mask,
`READ_SPLIT | READ_SV_DELETION | READ_DISCORDANT`, feeds
`LIFTED_BITS.svSignal`, and the filter computes the same three answers per
record through one helper. After Idea 2 the filter can read the extracted
byte, which completes ADR-226's "one evaluation".

| Case | `properPairs: exclude` today | `svSignal: only` |
| --- | --- | --- |
| Concordant pair, mate split at a breakpoint | kept | kept (split) |
| Discordant pair, no split | kept | kept |
| Interchromosomal mate | kept (no 0x2) | kept (discordant) |
| Concordant pair with a 60 bp deletion | dropped | kept |
| Mate unmapped (0x8) | kept | dropped |
| Long read | kept, every one | kept if split or SV deletion |
| Synteny block (flags 0) | kept | kept if SV-size deletion |

- **`split` stays.** It is a subset of `svSignal`, but "Only split alignments"
  is a long-read question in its own right, and the `split` sort and facet stay.
- **`singletons` stays.** The category describes the fetch window, so it
  answers a different question from a molecule-level one.
- **MAPQ composes and stays out of the definition.** `passingMapq` runs per
  record before chains group, so a pair whose low-MAPQ mate went is still
  discordant by the other mate's flags. At segmental duplications MAPQ-0
  interchromosomal mates flood `svSignal: only`; the Mapping quality row and
  jb2export's `mapq:20` handle that.

**Consumers that change:**

- **Model and menus:** `shared/types.ts:165-204` (`ReadFilter`,
  `READ_CATEGORY_KEYS`) and `READ_CATEGORIES` ("SV evidence", "Only SV
  evidence", "Hide SV evidence"), which the filter dialog and "Filter by..."
  read. Help naming the Proper pairs filter: `menus/readConnections.ts:114`,
  `configSlotViews.ts:112`.
- **Schema:** `LinearAlignmentsDisplay/readFilterConfigSchema.ts:90`,
  `configSchema.ts:187`. Under ADR-221 a v5-beta `properPairs` warns on load
  and draws without it; no `retired` lift.
- **jb2export:** `applyTrackOpts.ts:496-512` generates the modifiers from
  `READ_CATEGORY_KEYS`, so `svSignal:only` needs no code. `breakpointInit.ts:101`
  and `applyTrackOpts.ts:815` already sort by `svSignal`.
- **LGV synteny:** its menu omits category rows
  (`plugins/linear-comparative-view/src/LGVSyntenyDisplay/menus.ts:98-103`).
- **Docs:** the jbrowse-img README and `website/docs/jbrowse-img.md:684-692`,
  `user_guides/sv_visualization.md:266`, the v5.0.0 changelog draft (203),
  `reference/ARC_BAND.md`, `DEEP_COVERAGE.md`, and the autogen outputs. No
  tutorial or figure spec sets `properPairs`. ggjbrowse's
  `R/alignments.R:58-61` lists it, and its `sort` list already lacks `svSignal`.
- **Tests:** `filterChainFeatures.test.ts`; `concordantPairParity.test.ts`,
  rewritten to pin the filter's discordant part as the complement of the arcs'
  ordinary pair; `properPairs` fixtures in `model.coupling`, `contextMenu`,
  `fetchAutorun`, `FilterByTagDialog`, `reads.test.tsx`, `applyTrackOpts.test.ts`.

**Risks.** The literal 0x2 view goes (`flags:PROPER_PAIR:` still writes it).
The `svSignal` sort lifts every discordant pair on short reads, which may push
split reads below the fold; check on the HG002 300x window in
`DEEP_COVERAGE.md`.

## Idea 2: category filters leave coverage whole

**The line.** A filter that defines the sample thins coverage, as `samtools
depth` and IGV's load filters do. A filter that picks reads to inspect leaves
coverage whole. A user who wants one category's depth facets by it, and the
display draws a band per section.

| Thins coverage (the sample) | Leaves coverage whole (what to inspect) |
| --- | --- |
| `flagInclude`, `flagExclude`, `minMapq` | `svSignal`, `split`, `spliced`, `singletons` |
| `tagFilters` (a haplotype or read group) | `readName` |

**The worker change** follows ADR-112, where a layer owns its transform: the
coverage stops sharing the reads' filter.

1. Adapters drop by flags and tags only; `spliced` and `readName` leave
   `dropsRead`. Dedupe and `minMapq` stay first.
2. Extract every read. Insert-size stats, `computeReadBaseCounts`, depth, SNP,
   interbase, modification, sashimi and the per-instance frequencies run over
   all of them, so a drawn mismatch fades against the sample's depth.
3. The category filters and `readName` become a keep-mask over the
   extraction, chain-wide by name as now. One compaction drops the other reads
   from the per-read arrays and from every per-instance array, each of which
   has a `readIndex` field, before `buildAlignmentDetailArrays`.
4. `GetConsensusSequence` and `GetGlobalValueForTag` apply the sample filters
   only.

**Costs.** A filtered extract costs the unfiltered default plus the
compaction, so no filtered view costs more than opening the track. The byte
gate and the transfer are unchanged.

**UX costs.**

- The band no longer matches the drawn reads. "Filter by... (n)"
  (`menus/filters.ts:35-47`) counts filters without naming what they reach,
  and the legend is silent on filters. A coverage tooltip line, "Counts every
  read; a read filter hides some", would say so while a category filter is set.
- SNP coverage counts every read's mismatches, so a het SNP reads 50% while
  the evidence reads may show none. The band states the sample's allele
  fraction, and the tooltip line explains the gap.
- Under `spliced: 'exclude'` the sashimi junctions keep their counts, since
  they belong to the band.
- Arcs and the read cloud still come from drawn reads, so `svSignal: only`
  leaves evidence arcs alone, as `properPairs: exclude` does.

**Text that changes:** `ui.ts:1061`, `applyTrackOpts.ts:607-615` ("the band
should describe the reads that are drawn"), `products/jbrowse-img/README.md:667-669`,
the header of `readCategoryFilters.ts` and `filterChainFeatures.ts:130-143`.

## Idea 3 (follow-up): dim the context rather than hide it

- **Use a grey category, as the arcs do.** An ordinary pair's arc paints the
  baseline grey slot underneath the rest (`arcPaintOrder`). No opacity channel
  exists: `GRAMMAR_OF_GRAPHICS.md:125-127` keeps `opacity` a uniform, and
  `read.slang` writes alpha 1.0.
- **What it needs:** every read crosses with a keep bit (the compaction is
  skipped in this mode), a context slot in `readColorCategories`, and a
  per-read `Fade` rule code in `pileupShape` for the mismatches and indels on
  context reads.
- **Spelling:** a third `CategoryFilter` value, `dim`, which composes with any
  `color` and any category ("dim unspliced reads" on RNA-seq too).

## Precedent

- **IGV** applies its duplicate, vendor-failed, secondary, supplementary and
  MAPQ filters at load, so coverage counts that set, including reads
  downsampling hides. For SVs it colors by insert size and orientation over
  grey normal pairs and groups by orientation or mate chromosome; it has no
  "hide concordant pairs".
- **samtools:** `view -f 2`/`-F 2` is the literal proper-pair filter; `depth`
  takes `-q`, `-Q` and a flag mask, so flags and MAPQ define the counted set.

## Open questions for Colin

1. **Replace `properPairs` outright, with no lift?** Recommended: yes, per
   ADR-221 and the v5-beta stance.
2. **Is a mate-unmapped read evidence?** Recommended: no. One-end-anchored
   reads point at novel insertions, but unmappable mates swamp them at
   short-read depth, and the `pairing` facet's `unpaired` section isolates them.
3. **Add insertions of 50 bp or more?** Recommended: yes. Insertions are the
   commonest long-read SV class, `numericCigarCategoryBits` already walks every
   op, and the sort would lift them too.
4. **Do tag filters thin coverage?** Recommended: yes; `HP` or `RG` is how a
   user takes a haplotype or a sample as the data set.
5. **Does `readName` leave coverage whole?** Recommended: yes; one read's
   depth is useless.
6. **Ship Idea 1 first?** Recommended: Idea 2 first or both together, since
   until Idea 2 lands `svSignal: only` empties the band as `properPairs` does.
7. **Build Idea 3?** Recommended: wait for someone to ask for context around
   the evidence after using Ideas 1 and 2.

## Build plan

1. **Idea 2**, shippable alone:
   - the worker change above;
   - pins in `executeRenderAlignmentData.test.ts`: depth identical with and
     without each category filter; `insertSizeStats` defined under one (the
     scratch fixture); a kept mismatch's frequency equal to its unfiltered
     value; sashimi counts unchanged under `spliced: 'exclude'`. Sabotage each
     by moving the filter back ahead of the extract;
   - a bench pair, unfiltered against `split: only`, on the 200x fixture.
2. **Idea 1**, one commit plus an ADR amending ADR-226's definition: the bit,
   the mask, the key, the row, the schema, the docs. Pins: a
   `filterChainFeatures.test.ts` row per line of the table above,
   `sortLayout.test.ts` lifting a discordant pair, the reworked parity test,
   and `applyTrackOpts.test.ts` writing `svSignal: 'only'`.
3. **Idea 3**, if wanted: `dim`, the context slot and the `Fade` code, pinned
   by a canvas2d-against-WebGPU capture of one dimmed window.

## Rejected variants

- **Rename `properPairs` and keep its rule.** Long reads keep the no-op, and
  concordant pairs with an SV deletion stay hidden.
- **`pairing` as the filter, or a fifth `pairing` level.** ADR-226's Rejected
  rows.
- **Every filter leaves coverage whole.** Duplicates and MAPQ-0 reads would
  count, against samtools and IGV.
- **An unfiltered depth lane beside the filtered one.** Twice the band's
  compute and upload, where a facet already draws per-category depth.
- **A MAPQ floor inside `svSignal`.** Two MAPQ knobs, one of them hidden.
- **Folding `split` and `singletons` into `svSignal`.** See Idea 1.
- **Filtering on the main thread now** (ship every read, mask at layout, as
  ADR-188 moved chain identity). Instant toggles and view-wide singletons,
  for a skip path in every row-instanced packer. Idea 3 needs every read on
  the main thread anyway, so the move waits for it.
- **An `opacity` channel for Idea 3.** Declined in `GRAMMAR_OF_GRAPHICS.md`.
