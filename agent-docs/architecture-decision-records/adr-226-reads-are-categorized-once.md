---
status: Accepted
summary: "The alignments roles that ask the same question of a read answer it once. A read is split when it carries an SA tag (the primary included) or flag 0x800, spliced when its whole CIGAR carries a skip, and an SV-size deletion when its whole CIGAR carries a deletion of 50 bp or more; each record class answers the CIGAR's two in `cigarCategoryBits`, the worker stores all three in `readCategoryBits`, and the filter, facet and sort read them. The `split` order lifts split reads alone and `svSignal` lifts both. The facet gains `pairing`, `spliced` and `mateRefName`, renames `splitRead` to `split`, and names a field no read answers; the filter gains `minMapq`; the column sort gains `mapq` and `pairOrientation`"
---

# ADR-226: Reads are categorized once

## Status

Accepted (2026-10-11), from the 2026-10-11 analysis of the alignments plugin
against the grammar of graphics and its three reviews.

## Context

Each role kept its own list of the read fields it understood, and some kept
their own test. "Split" was the SA tag or 0x800 to the filter and the facet,
and the SA tag or a 50 bp deletion to the sort, which ignored 0x800. "Spliced"
was the whole CIGAR to the filter and the gap arrays to the sort, which the
worker clips to the region, so a read spliced outside the window passed
`spliced: 'only'` and was not lifted. A facet over a color field the facet did
not know (`insertSize`) drew one section and said nothing. The display had no
mapping-quality filter.

## Decision

- **One evaluation.** `cigarCategoryBits` on each record class answers
  `CIGAR_HAS_SKIP` and `CIGAR_HAS_SV_DELETION` over the whole record (BAM and
  SAM off the packed CIGAR, CRAM off the slice's read-feature columns, a
  synteny block off its CIGAR string). The extract stores those with the split
  bit in `readCategoryBits`; `dropsRead`, `isSplitAlignment` and the facet
  read the record, the sort reads the byte.
- **Split is SA or 0x800.** SA is the signal, written on every piece of a
  chimeric alignment, the primary included; 0x800 is the backstop for a piece
  whose SA the source dropped. The SA lookup skips a record with no end clip,
  exact on conforming input since SAM clips every chimeric record.
- **`split` lifts split reads; `svSignal` lifts the SV evidence**, split reads
  and reads carrying a deletion of 50 bp or more, the order jb2export's
  breakpoint panels and junction rows default to.
- **The facet takes `split`** (was `splitRead`), **`spliced`**, **`pairing`**
  (concordant, discordant, unpaired, nonPrimary, through `pairingOf`) and
  **`mateRefName`**, and `facetValueNotices` names a field no fetched read
  answers.
- **`filter.minMapq`** keeps a read at or over the minimum, through
  `getMappingQuality`, in `filterChainFeatures`, so a synteny source answers
  it too.
- **Column sorts by `mapq` and `pairOrientation`** read arrays the worker
  already ships.

## Consequences

- The byte costs 0.08-0.39 of the windowed CIGAR walk each read already pays
  (`plugins/alignments/benches/categoryBits.bench.ts`); a long read is the
  costly case, since the bits read every op.
- A v5-beta config's `sort: 'split'` keeps loading and lifts fewer reads, and
  its `facet: 'splitRead'` names a field nothing answers, which the notice
  says. No migration, per ADR-221.
- The color key's "Unsplit read" is "No orientation" (`noOrientation`), the
  facet's word for the same reads.

## Rejected alternatives

- **A registry checked by a parity test alone.** The sort's clipped gap arrays
  and the filter's whole CIGAR would have failed it on RNA fixtures; a test
  reports drift, one evaluation removes it.
- **A facet by insert size.** The band is sampled per region and pinned on the
  main thread, so a worker facet would disagree with the color or refetch on
  every `color.domain` edit.
- **A `filter.where` predicate list.** Its gains, a MAPQ filter and one tag
  reader, need no list, and GRAMMAR_OF_GRAPHICS.md declines the shorthand.
- **Renaming the color runtime's scheme names to field names.** The config
  already speaks fields (ADR-148); the rename changes nothing a user sees.
