---
status: Accepted
summary: "`svSignal` replaces `properPairs` as the one SV-evidence read category. A record is evidence when it is split, carries an insertion or deletion of 50 bp or more, or is a paired primary read that fails `isConcordantPairRead`; the extract stores `READ_SV_INSERTION` and `READ_DISCORDANT` beside the split and SV-deletion bits, and `READ_SV_SIGNAL` is the mask the filter, the sort and the breakpoint split view read. The filter keeps a chain when any record is evidence, the sort lifts split reads, then SV-size indels, then discordant reads, and jb2export refuses `properPairs:`. Amends ADR-226's `svSignal` and supersedes its `properPairs` consequence"
---

# ADR-229: SV evidence is one read category

## Status

Accepted (2026-10-12), from Colin's decisions on the
`sv-signal-filter-and-coverage` proposal (now
[`ideas/ready/category-filters-leave-coverage-whole.md`](../ideas/ready/category-filters-leave-coverage-whole.md)).
Amends [ADR-226](adr-226-reads-are-categorized-once.md): its `svSignal` sort
lifted split reads and SV-size deletions, and its consequence about
`properPairs: 'exclude'` with `split: 'only'` no longer applies.

## Context

- **`properPairs` was SAM jargon.** The menu had to explain that "Hide proper
  pairs" meant "leave the SV signal on screen".
- **On long reads it did nothing useful.** No unpaired record has 0x2, so
  "Hide proper pairs" hid nothing and "Only proper pairs" hid every read.
- **The sort and the filter disagreed.** `svSignal` lifted split reads and
  50 bp deletions; the filter kept non-concordant chains. Each missed what the
  other kept.
- **jb2export's SV recipe equalled `split:only`.** No split chain was proper,
  so `properPairs:exclude split:only` never kept a discordant pair.

## Decision

- **A record is SV evidence when any of these holds:**
  - it is split: an SA tag or 0x800 (`splitBit`);
  - its whole CIGAR has a deletion of 50 bp or more (`CIGAR_HAS_SV_DELETION`);
  - its whole CIGAR has an insertion of 50 bp or more
    (`CIGAR_HAS_SV_INSERTION`, from the same `cigarCategoryBits` walk on BAM,
    SAM, CRAM and synteny CIGAR strings);
  - it is paired and primary and fails `isConcordantPairRead` (`discordantBit`):
    no 0x2, a mate unmapped or on another chromosome, or a pair not facing FR.
- **One mask.** `packages/alignments-core/src/readCategoryBits.ts` holds the
  bits and `READ_SV_SIGNAL`. The extract stores `readCategoryBits(flags, sa,
  cigarBits, pairOrientationNum)` per read; the filter computes the same
  function from the feature (`readCategoryBitsOf`).
- **`filter.svSignal: 'only' | 'exclude'`, judged per chain.** A chain counts
  when any record counts, so a split read's concordant mate stays with it.
  The chain is the region fetch's, as it was for `properPairs`: in a
  multi-region view a mate in another region counts by what that region
  holds.
  `properPairs` leaves the schema, the types, `READ_CATEGORIES` and the menus
  ("SV evidence", "Only SV evidence", "Hide SV evidence").
- **The `svSignal` sort is tiered** (`svSignalTier`): split reads, then SV-size
  indels, then discordant reads, then the rest. `split` still lifts split
  reads alone.
- **The breakpoint split view takes the reads the mask admits as entries**
  (`isEvidenceRead`), read by read, and keeps its link rule
  (`isEvidenceLink`): a split junction always, a mate link only for a pair
  that fails `isConcordantPairRead`. A curve between two mates of a proper
  pair would show no rearrangement, whatever else the mates carry.
- **jb2export takes `svSignal:only|exclude`**, and an old `properPairs:`
  modifier is an error naming `svSignal:only`. The unknown-modifier warning
  would scroll past and leave the script an unfiltered figure.
- **`minMapq` stays per record.** A MAPQ-60 read whose mate was placed at MAPQ
  0 still counts by its flags, and the menu's help text names that limit.
- **The arcs keep `isConcordantPairRead`** for "Show ordinary pairs", the
  predicate `discordantBit` negates.

## Consequences

| Case | `properPairs: exclude` before | `svSignal: only` |
| --- | --- | --- |
| Concordant pair, mate split | kept | kept (split) |
| Discordant pair, no split | kept | kept |
| Interchromosomal or unmapped mate | kept | kept |
| Concordant pair with a 60 bp deletion or insertion | dropped | kept |
| Long read | kept, every one | kept if split or SV indel |
| Synteny block (flags 0) | kept | kept if SV indel |

- `filterChainFeatures.test.ts` has a row per line, and
  `svSignalParity.test.ts` holds the filter, the sort tier and
  `isEvidenceRead` to one answer on a mixed fixture.
- A v5-beta config's `filter.properPairs` loads with ADR-221's console line
  and filters nothing. No `retired` lift: `exclude` proper pairs and `only` SV
  evidence differ on the rows above.
- The split view admits two kinds of entry it skipped before:
  - an unpaired 0x800 record with no SA tag, which now joins its primary's
    junction where the source dropped the supplementary's SA (a new curve,
    pinned in `readChains.test.ts`);
  - a concordant mate carrying an SV-size indel, which enters the chain and
    can take a hover box, but draws no curve, since the link rule drops its
    mate link.

  A secondary record lacking 0x2 now stays out as an entry. That changes only
  hover boxing, since `partitionReadGroup` already dropped secondaries from
  every connection.
- jb2export's breakpoint images (`breakpointInit.ts`) and joined images
  (`applyDisplayOpts`) default to `sort: 'svSignal'`, so on paired-end data
  discordant reads now sit above the plain ones, under the split reads and
  SV-size indels, and an exported figure's rows can move.
- LGVSyntenyDisplay's `filter.svSignal` answers by SV-size indels; its menu
  still offers no read category.
- The category filters still thin the coverage band; the proposal's Idea 2
  changes that.
- The scans keep main's cost: 9.6 ms against 9.4-9.9 over 335 long BAM reads
  and 3.2 against 3.4-3.9 on CRAM (`categoryBits.bench.ts`).

## Rejected alternatives

- **Renaming `properPairs` and keeping its rule.** Long reads keep the no-op.
- **`pairing` as the filter, or a fifth `pairing` level.** ADR-226: `pairing`
  answers for a chain by its primary read.
- **The insert-size band as the discordance test.** The band is sampled per
  region, so the filter would change with the window. The aligner's 0x2 does
  not.
- **Folding `split` and `singletons` into `svSignal`.** `split` is the
  long-read question alone, and `singletons` asks about the window.
- **A chain-level MAPQ rule**, every record passing `minMapq` before the chain
  counts. The proposal left it open, and nothing decided needs it yet.
- **A `retired` lift from `properPairs` to `svSignal`.** The two keep
  different reads, so the lift would change a figure in silence.
