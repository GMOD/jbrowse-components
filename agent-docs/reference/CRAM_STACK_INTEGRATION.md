---
name: cram-stack-integration
description: Where the CRAM read path differs from BAM, the deliberate non-integrations of @gmod/cram, and the optimizations measured and rejected. Read before adding a CRAM read-path optimization.
audience: internal
kind: measurement
---

# The CRAM stack, layer by layer

The companion to [BAM_STACK_INTEGRATION.md](BAM_STACK_INTEGRATION.md); read that
first. This doc covers where CRAM **differs**.

`CramAdapter` (`plugins/alignments`) wraps `IndexedCramFile`. A CRAM record is
reference-compressed, so slice decode calls back up through `seqFetch` to the
sequence adapter. Since `@gmod/cram` 14 the library starts that fetch from the
`.crai` entry before the slice bytes arrive. **Don't add a reference prefetch
here**: it would issue a second read for chunks the library already requests.

## Deliberate non-integrations

- **`decodeTags` stays off.** The render path reads `MM`/`ML`, `SA`, `RG`, the
  `colorBy` tag and the sort tag, and `Slice.getRecords` puts `decodeTags` in
  the slice cache key, so toggling it decodes every slice twice.
- **`getCigarString` stays unused.** `CramSlightlyLazyFeature.CIGAR` goes
  through `NUMERIC_CIGAR`, which builds and memoizes the packed array. The
  render path reads `CIGAR` zero times, so don't "fix" this without a render
  path that does.
- **Per-base walks stay on the packed array.** Driving them off
  `forEachCigarOp(cb)` was built and measured mostly slower (down to ~0.4x
  CPU, BAM included): the array was never the cost, the per-op call into a
  closure the library cannot inline is. A `packCigarInto(buf)` library API
  would win at most a few percent. Don't rebuild either.
- **`viewAsPairs` / `pairAcrossChr` / `maxInsertSize` stay off**: this repo
  chains in `filterChainFeatures` / `attachChainFields`, as for BAM.
- **`qualityScoreAt` / `qualityColumn`, `readFeatureArena` / `TagColumn`,
  `getMismatches`**: one `qualityScores` view per read, `forEachMismatch` and
  `getTag` are the right level.

## The record class

`CramSlightlyLazyFeature extends CramRecord`
(`plugins/alignments/src/CramAdapter/CramSlightlyLazyFeature.ts`) overrides
exactly `forEachMismatch`, `getTag`, `tags` and `toJSON`.
`cramRecordOverrides.test.ts` pins that list in both directions: an additive
library release can shadow a member with a compatible signature and tsc won't
notice. `getTag` falls back to `super.getTag('RG')`, never `this.getTag`
(recursed).

**`ultraLongFeatureCache` must not come back** in any form that retains a
record. A view pins its whole `DecodedSlice` outside the byte budget, and with
`recordClass` the feature *is* the record (`@gmod/cram` ADR 0012). Removing it
measured at parity.

**`getReadBases()` memoizes onto the slice after the budget weighed it**, about
50 kB a read on ONT data the budget never sees. Look here first for a CRAM
memory question on a modification track.

## The per-read array pass

- **`readNextRefs`**: test `hasNextPosition()`, not `>= 0`. **-2 means no
  position at all**, distinct from **-1**, a next segment with a position but
  unplaced; both collapse to the table's -1 slot, only one is a missing mate.
- **The name block did not transfer from BAM**: cram-js has already decoded
  `readName`. **Don't add a `copyNameInto` to `@gmod/cram`** on the BAM number.
- **Don't add `getTagAlt` to `@gmod/cram`**: `TagColumn` resolves names through
  `keyIdByName`, so an absent tag is a Map miss.

## Slice-decode parallelism is not the lever

The slice worker pool speeds the decode alone 2-4x (`@gmod/cram`
`docs/WORKERS.md`) but a pan only ~1.0-1.1x: a whole-thread profile of a
deep short-read render shows the slice workers starved, not saturated, and the
RPC worker spending a visible share in GC. The byte gate refuses a pileup well
before the pool's win grows. Whether allocation is the lever is parked in
[ideas/collections/alignments.md](../ideas/collections/alignments.md).

## Measuring this stack: one arm per process

Arms that meet inside a library share its callback call sites, so the arm whose
callback does real work degrades the others: an in-process harness read the 14
subclass adoption as parity-to-worse where one arm per process measured
1.05-1.20x wall on short reads. Quote the one-process number; use the
interleaved run only as the identity check. BENCHMARKING.md §"Measuring the
wrong thing" has the general rule.

## Checked, and not to re-derive

- **A pan reuses the slice cache almost perfectly, and BAM does not**
  (`benches/panRedundancyCram.probe.ts` against `panRedundancy.probe.ts`): a
  slice is a fixed partition of the file, where `@gmod/bam` keys on a
  query-dependent span. The cost is many more, smaller file reads, which
  matters remotely.
- **The worker blob is code-split**, which moved it off the critical path to
  the first `.crai` read. It is not a bundle saving: `CramAdapter` was already
  lazy.
