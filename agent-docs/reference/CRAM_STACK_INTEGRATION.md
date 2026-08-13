---
name: cram-stack-integration
description: The vertical audit of CramAdapter x @gmod/cram — every lever the library exposes, whether the adapter reaches it, the five non-integrations that are deliberate, the three seams that remain, and the one BAM optimization that does not transfer. Read before adding a CRAM read-path optimization.
---

# The CRAM stack, layer by layer

The companion to [BAM_STACK_INTEGRATION.md](BAM_STACK_INTEGRATION.md), and it
should be read after it: the two formats share a consumer, so several of the
conclusions there are quoted rather than re-derived here, and the interesting
part of this document is where CRAM **differs**.

Read it before adding anything to the CRAM read path.

## The layers, and what crosses each join

```
plugins/alignments  CramAdapter -> CramSlightlyLazyFeature (a wrapper, not a
                    recordClass — @gmod/cram has no such hook)
        |           CramRecord.forEachMismatch / forEachCigarOp called directly
        v
@gmod/cram          IndexedCramFile.getRecordsForRange
                    .crai -> slices -> SliceRecordCache -> decode (worker pool)
        |           decoded CramRecords, columnar inside a slice
        v
        |           slice decode also calls BACK UP through
        |           fetchReferenceSequence -> the adapter's sequence adapter
        v
packages/core       RemoteFileWithRangeCache / CachedFilehandle
                    256 KiB chunk LRU, in-flight dedup, refcounted aborts
```

The shape that matters and has no BAM equivalent is that **arrow going back
up**. A CRAM record is reference-compressed, so its bases do not exist without
the reference, and `@gmod/cram` resolves that inside the slice decode
(`applyReferenceSequence`) rather than leaving it to the caller. The reference
read is therefore issued by the library, on the adapter's callback, in the
middle of a decode the adapter is awaiting — which is what seam 1 below is
about.

## What the adapter wires, and what it does not

| Lever | Wired | Where / why not |
| --- | --- | --- |
| `cramFilehandle` / `index` | yes | `openLocation`, `CraiIndex` |
| `fetchReferenceSequence` | yes | `seqFetch`, resolving the refName against the sequence adapter's own names first |
| `checkSequenceMD5` | yes | `false` — the check needs the slice's whole declared span |
| `cacheBudget` | yes | `decodedRecordsBudget`, records not bytes — see below |
| `useSliceWorkerPool` | yes | config slot |
| `numSliceWorkers` | yes | `sliceWorkerCount()`, halved from the library default because the pool is per JS context and tracks spread over up to five RPC workers |
| `onProgress` (index + records) | yes | `downloadStatus` on both phases |
| `signal` | yes | `withStopTokenSignal` |
| `index.getEntriesForRange` | yes | `bytesForRegions`, deduping slices before summing |
| `CramRecord.getTag` | yes | one column probe instead of building `tags` |
| `forEachMismatch` | yes | `CramSlightlyLazyFeature`, with a reused options object |
| `forEachCigarOp` | yes | via `packCigar` |
| `getLeadingClipLength` / `getTrailingClipLength` | yes | `clipLengthAtStartOfRead`, O(1) |
| `getPairOrientation` | yes | `pair_orientation` |
| `getReadBases` | yes | `seq`, and only off the modification / bisulfite / per-base-letter paths |
| `qualityScores` | yes | one view per read, then indexed per base — the documented right shape |
| `cacheSize` | no | library default; `cacheBudget` bounds the sum, which is the part that matters |
| `cacheIdleTimeoutMs` | no | library default (3 min) is the intent |
| `decodeTags` | **no** | deliberate — see below |
| `viewAsPairs` / `pairAcrossChr` / `maxInsertSize` | **no** | deliberate, same reason as BAM |
| `getMismatches` | no | allocating form; the walk is used instead |
| `getCigarString` | no | see below |
| `qualityScoreAt` / `qualityColumn` + `qualityStart` | no | correctly — one view per read beats a call per base for a walk that reads every base |
| `readFeatureArena` / `TagColumn` exports | no | correctly — `forEachMismatch` and `getTag` are the level this consumer wants |
| `hasDataForReferenceSequence` | no | nothing asks the question |
| `setSyntheticReadName` / `addReferenceSequence` | no | writer-side entry points |
| `destroySharedSliceWorkerPool` | no | same as bgzf: the pool reaps itself |

## The five non-integrations that are deliberate

**`decodeTags`.** `@gmod/cram` will skip the tag column entirely, and this
consumer cannot use it: the render path reads `MM`/`ML` (modifications), `SA`
(arcs), `RG` (read groups), the `colorBy` tag and the sort tag. Worse than
merely unusable — `Slice.getRecords` puts `decodeTags` **in the slice cache
key**, so a track that turned it off for one query and on for the next would
decode every slice twice.

**`viewAsPairs` / `pairAcrossChr` / `maxInsertSize`.** This repo does its own
chaining in `partitionChains` / `filterChainFeatures`, over reads it already
has. Identical to the BAM case.

**`getCigarString`.** `CramSlightlyLazyFeature.CIGAR` goes through
`NUMERIC_CIGAR` and `numericCigarToString`, so asking for the string builds and
memoizes the packed array as a side effect where `record.getCigarString()`
would walk once and emit the string directly. It stays that way because `CIGAR`
is read **zero times per read on the render path** — only `toJSON` and the
details panel touch it, once — so the array it leaves behind is the thing a
subsequent consumer wants anyway. Do not "fix" this without first showing a
render path that reads `CIGAR`.

**A `recordClass`.** BAM injects `BamSlightlyLazyFeature` into `@gmod/bam` so a
read is one object rather than a record plus a wrapper (ADR-049); `@gmod/cram`
has no such hook and CRAM pays a wrapper per record per fetch. ADR-049's own
finding is why this is not worth chasing: the win there was moving the wrapper
from **retained** to transient, and CRAM's wrapper is already transient (the
`ultraLongFeatureCache` retains only reads over 5 kb). Adding the hook would
also have to survive `sliceTransfer` — records decoded on the worker pool are
rehydrated on the other side.

**`cacheIdleTimeoutMs`.** Left at the library's 3 minutes. `CramFileOptions`
names this consumer while documenting it: `CramAdapter` memoizes one
`IndexedCramFile` for the life of the track, so a tab parked on a region holds
its last view until the track is closed, times every open track. The 3-minute
sweep is the only thing that lowers an idle cache, and it is doing that job.

## Seam 1 — the reference read is strictly downstream of the slice decode

**The live gap, and the CRAM twin of BAM's seam 3 — which was closed, and
measured at 1.50x on a pan.**

`applyReferenceSequence` computes the span from **the slice's decoded records**,
so the read cannot be issued until the slice's bytes have been fetched,
inflated and decoded. Every query therefore pays slice-read → decode →
reference-read → resolve, in series, per slice.

Two things make this worth more than the BAM case rather than less:

- **The gate is always open.** BAM only needs reference bases for reads lacking
  an MD tag, which is why `BamAdapter` gates its prefetch on a sticky
  `needsReference` and a BAM carrying MD never reads sequence at all. A
  reference-compressed CRAM needs the reference for *every* slice.
- **BAM's fix does not port.** `BamAdapter` overlaps the two by issuing the
  region's sequence read alongside `getRecordsForRange` and letting the records
  decide whether to use it. Here the library owns the call, and the span it asks
  for is a slice's, not the query's.

What could port is the **byte-cache warm**: issue `getSequence` for the queried
region alongside `getRecordsForRange` and drop the result. `RemoteFileWithRangeCache`
dedupes in-flight reads and caches 256 KiB chunks, so `seqFetch`'s later call
lands on chunks already fetched or already in flight. It is not exact — a slice's
span is the extent of its reads, which for long reads reaches outside the
viewport — but it does not have to be, because the chunks are what is shared.

**Unmeasured, deliberately.** The number that would justify it needs emulated
latency, and `products/jbrowse-web/browser-tests/seqfetch-timing-probe.ts` is
the harness that already does this for BAM — point it at a CRAM track. Read
BAM_STACK_INTEGRATION.md's seam 3 first for the three traps that each cost a run
there, in particular that a "% of query" figure returns nonsense the moment the
read stops being serial, and that a fixture whose whole reference fits in one
256 KiB chunk cannot show the effect at all.

## Seam 2 — the record-count budget cannot see `getReadBases`

`decodedRecordsBudget` is a `SharedBudget(1_000_000)` in **records**, which is
the only unit a decoded-slice cache has (`@gmod/cram` says so at `cacheSize`,
and `packages/core/src/util/cacheBudgets.ts` names the pair). `getReadBases()`
memoizes the decoded sequence **onto the cached record**, so reading `seq` turns
a compact record into one retaining its own bases — 50 kB apiece on ONT data,
against a budget that counts it as 1.

It is bounded in practice and that is why this is a note rather than a bug: the
plugin reads `seq` only on the modification, bisulfite and per-base-letter
paths, long-read slices hold few records, and the 3-minute idle sweep drops
them. But it is the same shape as the problem ADR-064 fixed for bytes — a
ceiling in a unit that does not track the thing being retained — and if a CRAM
memory question ever comes up on a modification track, this is where to look
first.

## Seam 3 — `ultraLongFeatureCache` has not been measured since its payload shrank

Flagged in `CramAdapter.getOrCacheFeature`'s own comment and repeated here so it
is findable: the LRU was worth ~13% of the extract pass when the wrapper
retained a rebuilt `NUMERIC_CIGAR` (~2 MB across a 37-read ONT slice). The
render path now reads `clipLengthAtStartOfRead`, which memoizes as a **number**,
and `NUMERIC_CIGAR` is built only on demand. So the LRU may now be doing its own
bookkeeping to preserve 8 bytes per read, while also retaining the records
themselves. Deleting it is the simpler answer if that is what a measurement
says; it is in place because nobody has measured, not because it is known to pay.

## Things checked and found already integrated, or found not to transfer

Stated so the next audit does not re-derive them.

- **`getTagAlt` has no CRAM twin and does not need one.** In `@gmod/bam` the
  MM/Mm pair was 12.9% of a 1000x short-read query because `_findTag` proves a
  tag's absence by walking every tag on the record, twice. CRAM's `TagColumn`
  resolves a name through `keyIdByName` first, so an absent tag costs a Map miss
  and no walk at all — `getTag(a) ?? getTag(b)` is already the cheap form.
  `modifications-utils`' `getTagAlt` duck-types the method and falls back to
  exactly that, so the CRAM path is correct as written. **Do not add
  `getTagAlt` to `@gmod/cram`** on the strength of the BAM measurement; it is
  the clearest case in either stack of an optimization that does not transfer.
- **The clip length is O(1) on both sides.** `getLeadingClipLength` /
  `getTrailingClipLength` answer off the read features at that end, so the
  render path's one CIGAR value costs nothing and `NUMERIC_CIGAR` — ~7,000
  manufactured operations for a 49 kb ONT read — is never built for it.
- **The mismatch walk is the library's, once.** `readFeaturesToMismatches` on
  this side emits this repo's vocabulary and is not a second walk of the format;
  `@gmod/cram` ADR 0008 has why the callback goes straight to the consumer.
- **The slice worker pool is sized for this host, not for the library's idea of
  one.** `sliceWorkerCount()` carries the measurement (5 tracks x 4 workers is
  1.41x slower than 5 x 2 on a 4-core box).
- **The byte gate dedupes slices.** Adjacent regions routinely share a `.crai`
  slice and it is downloaded once, so `bytesForRegions` keys on
  `containerStart:sliceStart` before summing.
