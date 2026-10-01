---
name: cram-stack-integration
description: The vertical audit of CramAdapter x @gmod/cram — every lever, the deliberate non-integrations, the BAM optimizations that do not transfer, and the @gmod/cram 14 adoption with its measurement. Read before adding a CRAM read-path optimization.
audience: internal
kind: measurement
---

# The CRAM stack, layer by layer

The companion to [BAM_STACK_INTEGRATION.md](BAM_STACK_INTEGRATION.md); read
that first. This doc covers where CRAM **differs**. Read it before adding
anything to the CRAM read path.

## The layers

```
plugins/alignments  CramAdapter -> CramSlightlyLazyFeature (the recordClass)
        |
@gmod/cram          IndexedCramFile.getRecordsForRange
                    .crai -> slices -> SliceRecordCache -> decode (worker pool)
        |           slice decode calls BACK UP through fetchReferenceSequence
        v           -> the adapter's sequence adapter
@gmod/range-cache-filehandle  chunk LRU, in-flight dedup, refcounted aborts
```

The arrow back up has no BAM equivalent. A CRAM record is
reference-compressed, so `@gmod/cram` fetches the reference inside the slice
decode, on the adapter's `seqFetch` callback. Since 14 the library starts that
fetch from the `.crai` entry's declared span before the slice bytes arrive, so
the reference read overlaps the decode. Nothing on this side needs to change
for that; **don't add a reference prefetch here** — it would issue a second
read for chunks the library already asks for at the same moment.

## What the adapter wires, and what it does not

| Lever | Wired | Where / why not |
| --- | --- | --- |
| `cramFilehandle` / `index` | yes | `openLocation`, `CraiIndex` |
| `fetchReferenceSequence` | yes | `seqFetch`, resolving the refName against the sequence adapter's own names first |
| `checkSequenceMD5` | yes | `false` — the check needs the slice's whole declared span |
| `cacheBudget` | yes | `decompressedBytesBudget`, the byte budget BAM and tabix share (`cacheBudgets.ts`, ADR-064) |
| `recordClass` | yes | `CramSlightlyLazyFeature extends CramRecord` |
| `useSliceWorkerPool` | yes | config slot |
| `numSliceWorkers` | yes | `sliceWorkerCount()`, which carries its own measurement |
| `onProgress` | yes | `downloadStatus` on index and records |
| `signal` | yes | forwarded as is |
| `index.getEntriesForRange` | yes | `bytesForRegions`, deduping shared slices before summing |
| `CramRecord.getTag` | yes | one column probe instead of building `tags` |
| `forEachMismatch` | yes | `CramSlightlyLazyFeature`, with a reused options object |
| `forEachCigarOp` | yes | via `packCigar` on purpose — see below |
| `getLeadingClipLength` / `getTrailingClipLength` | yes | `clipLengthAtStartOfRead`, O(1) |
| `getPairOrientation` | yes | `pair_orientation` |
| `getReadBases` | yes | `seq`, only on the modification / bisulfite / per-base-letter paths |
| `qualityScores` | yes | one view per read, indexed per base |
| `maxCacheBytes` | no | library default equals the shared budget, which binds first |
| `cacheIdleTimeoutMs` | no | the library's idle sweep is the only thing that lowers a parked tab's cache |
| `decodeTags` | **no** | deliberate — see below |
| `viewAsPairs` / `pairAcrossChr` / `maxInsertSize` | **no** | this repo chains in `filterChainFeatures` / `attachChainFields`, as for BAM |
| `getMismatches` | no | allocating form; the walk is used instead |
| `getCigarString` | no | see below |
| `qualityScoreAt` / `qualityColumn` | no | one view per read beats a call per base |
| `readFeatureArena` / `TagColumn` | no | `forEachMismatch` and `getTag` are the right level |
| `hasDataForReferenceSequence`, writer entry points | no | nothing asks |
| `destroySharedSliceWorkerPool` | no | the pool reaps itself |

## Deliberate non-integrations

**`decodeTags`.** The render path reads `MM`/`ML`, `SA`, `RG`, the `colorBy`
tag and the sort tag. And `Slice.getRecords` puts `decodeTags` **in the slice
cache key**, so toggling it would decode every slice twice.

**`getCigarString`.** `CramSlightlyLazyFeature.CIGAR` goes through
`NUMERIC_CIGAR`, so reading the string builds and memoizes the packed array.
`CIGAR` is read zero times per read on the render path (only `toJSON` and the
details panel), so the array it leaves is what a later consumer wants. Don't
"fix" this without a render path that reads `CIGAR`.

**The per-base walks stay on the packed array.** `packedCigarOps` triggers
`packCigar` for CRAM on the per-base-quality, per-base-letter, bisulfite and
`computeReadBaseCounts` paths. Driving those walks straight off
`forEachCigarOp(cb)` was built and measured: mostly slower (down to ~0.4x CPU),
BAM included, with one win on 58 kb ONT reads at 1 bp per cell. The array was
never the cost (~5% of the path); the per-op call into a closure the library
cannot inline is. Don't rebuild it. A `packCigarInto(buf)` library API would
win at most a few percent on long reads — not worth it.

## Measuring this stack: one arm per process

Arms that meet inside a library share its callback call sites, so the arm
whose callback does real work degrades the others: an in-process harness read
the 14 subclass adoption as parity-to-worse where one arm per process measured
1.05–1.20x wall on short reads. Quote the one-process number; use the
interleaved run only as the identity check. BENCHMARKING.md §"Measuring the
wrong thing" has the general rule.

## The record class

`CramSlightlyLazyFeature extends CramRecord`
(`plugins/alignments/src/CramAdapter/CramSlightlyLazyFeature.ts`), the shape
`BamSlightlyLazyFeature` has. A `CramRecord` is a view over a per-slice
`DecodedSlice`, constructed on the host, so the subclass survives the worker
pool. The adapter assigns `record.adapter = this` before emitting; the shared
`dropsRead` filter runs after, so an RG filter reads through the header.

The only four overrides:

- `forEachMismatch(callback, opts?)` — reuses `MISMATCH_OPTS`, translates
  origin, and must stay signature-compatible with `CramRecord.forEachMismatch`.
- `getTag(name)` — RG answers the header's read group, falling back to
  `super.getTag('RG')` (never `this.getTag`, which recursed).
- `tags` — splices the header's RG over `super.tags`; getter-only, so
  assignment throws in strict mode, which is intended.
- `toJSON()` — a `SimpleFeatureSerialized`.

`cramRecordOverrides.test.ts` pins that list in both directions: an additive
library release can shadow a member here with a compatible signature, and tsc
won't notice.

**`ultraLongFeatureCache` must not come back** in any form that retains a
record. A view pins its whole `DecodedSlice` outside the byte budget, and with
`recordClass` the feature *is* the record, handed out fresh per query
(`@gmod/cram` ADR 0012). Removing it measured at parity.

**`getReadBases()` memoizes onto the slice after the budget weighed it** — on
the order of 50 kB a read on ONT data the budget never sees. Bounded in
practice (few paths read `seq`, long-read slices hold few records, the idle
sweep drops them); look here first for a CRAM memory question on a
modification track.

## The per-read array pass

The worker's per-read arrays were rebuilt for BAM (BAM_STACK_INTEGRATION). On
CRAM:

- **`readKeys` transferred for free**: `recordId` is cram-js's numeric
  `uniqueId`.
- **The name block did not.** BAM's win was avoiding a per-access QNAME decode;
  cram-js has already decoded `readName`. **Don't add a `copyNameInto` to
  `@gmod/cram`** on the BAM number.
- **`readNextRefs` transferred** via `nextSequenceId`. Test
  `hasNextPosition()`, not `>= 0`: **-2 means no position at all**, distinct
  from **-1**, a next segment with a position but unplaced. Both collapse to
  the table's -1 slot; only one is a missing mate.

## Slice-decode parallelism is not the lever

The slice worker pool speeds the decode alone 2–4x (`@gmod/cram`
`docs/WORKERS.md`) but a pan ~1.0–1.1x. A whole-thread profile of a
1000x-shortread CRAM render shows every thread mostly idle — the slice workers
starved, not saturated — and the RPC worker spending ~12% (724 ms) in GC. The
pool's win also grows with query size, while the byte gate (5 MB for CRAM)
refuses a pileup well before that, so an interactive pileup sits at the
shallow end permanently; exports and force-loads collect the rest. Whether
allocation is the lever instead is parked in
[ideas/collections/alignments.md](../ideas/collections/alignments.md).

## Checked, and not to re-derive

- **`getTagAlt` has no CRAM twin and needs none.** `TagColumn` resolves a name
  through `keyIdByName`, so an absent tag is a Map miss. **Don't add
  `getTagAlt` to `@gmod/cram`** on the BAM measurement.
- **The mismatch walk is the library's, once** (`@gmod/cram` ADR 0008).
- **The byte gate dedupes slices**: `bytesForRegions` keys on
  `containerStart:sliceStart`.
- **The worker blob is code-split** (since 13.3.0), which moved it off the
  critical path to the first `.crai` read. It is not a bundle saving:
  `CramAdapter` was already lazy, and the pool defaults on.
- **A pan reuses the slice cache almost perfectly, and BAM does not**
  (`benches/panRedundancyCram.probe.ts` against `panRedundancy.probe.ts`): a
  slice is a fixed partition of the file, where `@gmod/bam` keys on a
  query-dependent span. BAM_STACK_INTEGRATION seam 2 quotes it. The cost is
  many more, smaller file reads, which matters remotely.
