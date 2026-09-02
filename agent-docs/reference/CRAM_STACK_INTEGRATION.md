---
name: cram-stack-integration
description: The vertical audit of CramAdapter x @gmod/cram — every lever the library exposes, whether the adapter reaches it, the five non-integrations that are deliberate, which seams closed and how, the two BAM optimizations that do not transfer, and the ready-to-apply recordClass plan for @gmod/cram 14. Read before adding a CRAM read-path optimization.
audience: internal
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
@gmod/range-cache-filehandle  RemoteFileWithRangeCache / CachedFilehandle
                              256 KiB chunk LRU, in-flight dedup, refcounted
                              aborts
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
| `forEachCigarOp` | yes | via `packCigar`, on purpose — driving the per-base walks off the callback directly was measured and lost, see below |
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
finding is why this was not worth chasing against 13: the win there was moving
the wrapper from **retained** to transient, and CRAM's wrapper is already
transient. `@gmod/cram` grew the hook on its main branch anyway, alongside the
change that makes it cheap to offer (a record is a view constructed on the host
from a transferred slice, so there is nothing to rehydrate); the adoption is
written out in "When @gmod/cram 14 is published" below and waits only on the
release.

**`cacheIdleTimeoutMs`.** Left at the library's 3 minutes. `CramFileOptions`
names this consumer while documenting it: `CramAdapter` memoizes one
`IndexedCramFile` for the life of the track, so a tab parked on a region holds
its last view until the track is closed, times every open track. The 3-minute
sweep is the only thing that lowers an idle cache, and it is doing that job.

## Seam 1 — the reference read was strictly downstream of the slice decode (closed in the library, lands with 14)

**Closed on the library side by `@gmod/cram` `674bef2` (main, unreleased —
it ships in 14), the CRAM twin of BAM's seam 3, which was closed here and
measured at 1.50x on a pan.**

What the seam was: `applyReferenceSequence` computed the span it needed from
**the slice's decoded records**, so the read could not be issued until the
slice's bytes had been fetched, inflated and decoded, and every slice paid
slice-read → decode → reference-read → resolve in series. The gate is always
open for CRAM (a reference-compressed slice needs the reference for every
read, where BAM only needs it for reads lacking MD), and BAM's fix did not
port because the library owns the call and the span it asks for is a slice's,
not the query's.

How it closed: the span the reference read needs is the extent of the slice's
reads, and **the `.crai` entry declares that same extent** (`start`, `span`,
and now `seqId` on every index entry). `IndexedCramFile.getRecordsForRange`
therefore starts `fetchReferenceSequence` for a slice from its index entry
**before the slice's own bytes are read**, and the decode joins the in-flight
fetch when it needs the bases. The exact, post-decode fetch remains as the
fallback for a slice whose records reach outside the declared span; measured
over every indexed fixture in the library, the declared span equals the reads'
extent on all but one slice (an unmapped read placed past it), which pays what
it always paid. `docs/optimizations.md` and `test/referencePrefetch.test.ts`
there carry it.

What it means for this side: **nothing to change.** `seqFetch` is the same
callback with the same `(seqId, start, end)` arguments — only *when* it is
called moved — and it still resolves the refName against the sequence
adapter's own names first. The byte-cache warm the old version of this section
proposed (a throwaway `getSequence` for the queried region alongside
`getRecordsForRange`) is moot and should not be added: it would issue a second
read for the same chunks the library now asks for at the same moment. Not
measured on this side; the number would need emulated latency
(`products/jbrowse-web/browser-tests/seqfetch-timing-probe.ts` pointed at a
CRAM track) and only exists once the adapter builds against 14.

## The per-base walks stay on the packed array (measured, rejected)

`packedCigarOps(feature)` reads `NUMERIC_CIGAR`, which for CRAM triggers
`packCigar` — a full `forEachCigarOp` walk into an array, memoized on the
wrapper — on the per-base-quality, per-base-letter, bisulfite and
`computeReadBaseCounts` paths, while for BAM it is a zero-copy view. The
obvious fix is to let a feature that offers `forEachCigarOp(cb)` drive those
walks directly, so CRAM manufactures nothing. It was built and measured, and
it loses; this section is here so it is not built again.

**What was tried.** A `walkCigar(feature, step)` in `alignedBaseWalk.ts`
that called `feature.forEachCigarOp(step)` where the feature had one
(`CramSlightlyLazyFeature` delegating to `CramRecord.forEachCigarOp`) and
looped the packed array through the same `step` otherwise, with the four
walks rewritten as steppers over `(op, len)`. Captured offsets the inner loops
read were copied to locals (a closure variable a loop reads is reloaded from
the context each iteration — that alone was worth ~10% on the walls). Both
arms emitted byte-identical output on every fixture.

**How it was measured.** Interleaved, min of 25 rounds, a second copy of
HEAD as control, one fixture per process, CPU time via `process.cpuUsage`
because the box sat at a load average of 50-100 throughout (other agents'
builds); wall clock was recorded beside it and agreed. The control's distance
from 1.00 is the floor for each row. Fixtures: `wgsim_short_reads` and
`badread_long_reads` from `test_data/volvox` converted to CRAM with samtools,
`deep_sequencing.cram`, and cram-js's 37-read HG002 ONT slice (mean 58 kb)
against the hg19 chr1 window it needs.

CPU-time ratio of the direct walk against HEAD, with the control's ratio in
brackets; below 1.00 is slower:

| | per-base quality | per-base letter | readBaseCounts | bisulfite |
| --- | --: | --: | --: | --: |
| wgsim.cram, 7,733 x 149 bp | 0.97 [1.01] | 0.93 [1.07] | 0.33 [0.81] | 0.56 [0.98] |
| deep.cram, 38,475 x 70 bp | 1.01 [0.96] | 1.00 [0.95] | 1.05 [0.98] | 0.77 [0.80] |
| badread.cram, 52 x 3.7 kb | 0.91 [1.22] | 0.88 [1.01] | 0.27 [0.85] | 0.37 [0.81] |
| HG002 ONT, 37 x 58 kb | 1.05 [1.11] | **1.24 [1.00]** | 0.75 [0.75] | 0.69 [0.90] |
| HG002 at `binBp` 64 | 0.77 [1.02] | 0.94 [1.00] | | |
| badread.cram at `binBp` 16 | 0.42 [1.08] | 1.16 [1.25] | | |
| wgsim.bam | 0.86 [1.01] | 0.82 [0.99] | 0.46 [0.47] | 0.92 [0.98] |
| badread.bam | 0.67 [1.03] | 0.85 [1.00] | 0.54 [0.98] | 0.45 [1.08] |

One row is a win (HG002 per-base letter at full resolution); most of the rest
are losses that clear the floor, and the BAM rows are losses on a path that
was supposed to be untouched — the array now went through the stepper call
per op instead of an inline loop.

**Why.** A CPU profile of `computeReadBaseCounts` over `badread.cram`, one
arm per process: on HEAD the library walk plus the packing is **~5%** of the
path (`forEachCigarOp` 4.0%, `packCigar` 0.8%); with the direct walk the
library function reads 11.5% self time and the step closure another 20%, on a
total ~15-20% higher. The array was never the cost. What the callback design
adds is a per-read closure with a dozen captured variables and one
non-inlinable call per operation into it — and `CramRecord.forEachCigarOp`
inlines HEAD's two-line `push` callback, which it cannot do with a stepper.
The per-op call is amortized only when the work per operation dwarfs it,
which on these walls happens on a 58 kb read at 1 bp per cell and nowhere
else; every sparse walk, every short read and every zoomed-out wall pays it.

A trap worth naming, since it produced the 0.27x above before the profile
explained it: three arms in one process share `CramRecord.forEachCigarOp`'s
callback call site, so the arm whose callback does real work degrades while
the one whose callback is `push` does not. In isolation the same badread
`readBaseCounts` row is 0.87x, which is the honest number; the in-process
harness overstates the loss but does not invent it. BENCHMARKING.md's
"one process per fixture" applies per arm too when the arms meet inside a
library.

**What would win, if anything.** Not a callback: a library walk that fills a
caller-provided buffer (`record.packCigarInto(buf): count`) would keep the
consumer's loop inline and drop the allocation, but the allocation is the
~1% `packCigar` row, so the ceiling is a few percent on long reads at full
resolution. Not worth a cram-js API. The retained array on a long read was
the other half of the argument and it belongs to seam 3 below, which closes
it from the other side.

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

## Seam 3 — `ultraLongFeatureCache` (measured, removed)

The LRU of 500 `CramSlightlyLazyFeature` for reads over 5 kb, keyed by
`uniqueId`, was worth ~13% of the extract pass when the wrapper retained a
rebuilt `NUMERIC_CIGAR` (~2 MB across a 37-read ONT slice). Since the render
path moved to `clipLengthAtStartOfRead` — memoized as a number, and answered
by `@gmod/cram` in O(1) off the read features at that end — the only thing it
preserved across a pan was that number, and its own comment said so. It is
now measured, and gone.

**The measurement.** `CramAdapter.getFeatures` plus `extractFeatureArrays`
over a ten-window pan, three adapters in one process (with the LRU, a copy
with the branch replaced by `new CramSlightlyLazyFeature(record, this)`, and a
second copy with the LRU as control), each with its own `IndexedCramFile` so
the slice cache is warm for every arm from the second round; interleaved, min
of 20-40 rounds, CPU time, same loaded box as the section above. Without the
LRU against with it, control in brackets:

| pan | reads/pan | with LRU | without | |
| --- | --: | --: | --: | --- |
| HG002 ONT, 37 x 58 kb, default colour | 134 | 105.5 ms | 0.88 [0.89] | parity |
| HG002 ONT, per-base quality | 134 | 313.5 ms | 0.95 [0.96] | parity |
| arabidopsis ONT modBAM (88 of 154 reads > 5 kb), modifications | 550 | 153.2 ms | 0.95 [0.99] | parity |
| arabidopsis, default colour | 550 | 15.3 ms | 0.64 [0.79] | see below |
| badread, 52 x 3.7 kb (18 > 5 kb), default colour | 126 | 6.4 ms | 0.88 [1.18] | see below |

The two default-colour rows are the ones the LRU could in principle win, and
in the shared process they read as a loss. Run one arm per process, with a
CPU profile, the arabidopsis row is **7.90 ms with the LRU against 8.28 ms
without — 0.95x**, and the two profiles are the same list (`forEachMismatch`,
`getModTypes`, the header decode) with nothing LRU-shaped in either. The
in-process loss is the trap named in the section above from the other side:
three adapters share `@gmod/cram`'s `forEachMismatch` callback site, and the
arm that degrades is not the one being asked about. A few percent on a 5-15 ms
pan, which is inside what the isolated harness resolves, is what a `Map.get`
per long read against a `new` of a two-field wrapper was ever going to be.

**Why removal rather than keep-at-parity.** The LRU pinned up to 500 records
outside anything that bounds them: a `CramRecord` in 13 references its slice's
read-feature arena, quality column and tag column, so an evicted or
idle-swept slice stayed alive through the wrapper for as long as the LRU held
it, and `decodedRecordsBudget` never saw it. Under 14 a record is a view and
the pin is the whole `DecodedSlice`; ADR 0012 says views are per query and
short-lived, and `recordClass` makes the feature the record, so there is no
wrapper left to cache. A memo of one number does not buy any of that.

## The per-read array pass, and how little of it transferred

The jbrowse worker's four per-read `string[]`s were rebuilt for BAM this week
(BAM_STACK_INTEGRATION seams and `plugins/alignments/src/CLAUDE.md`). Measured
on `1000x.shortread.cram`, the same 153,677-record window as the BAM fixture:

| | CRAM | BAM |
| --- | --: | --: |
| `readKeys` | 4.40ms, already numeric | 3.2ms |
| name block | 18.36ms, against 22.29 as a `string[]` — **1.2x** | 42.2 -> 24.7, **1.7x** |
| `readNextRefs`, stock | 10.88ms | — |
| `readNextRefs`, with `nextRefId` | **5.31ms — 2.1x** | 2.8x |

- **`readKeys` transferred for free.** `CramSlightlyLazyFeature.recordId` is
  cram-js's record `uniqueId`, so the numeric identity path was already reached
  the day it landed.
- **The name block did NOT transfer, and this is the interesting one.** BAM's
  1.7x is almost entirely the DECODE — `@gmod/bam` builds each QNAME with
  `String.fromCharCode` on every access, and the fix was to copy bytes and decode
  once. cram-js has already decoded `readName` by the time a record exists, so
  there is no per-read decode to avoid and no raw bytes to copy; all that is left
  is the join against the clone, 22.29ms -> 18.36ms. Worth keeping for the one
  shape downstream, not worth pursuing further. **Do not add a `copyNameInto` to
  `@gmod/cram`** on the strength of the BAM number.
- **`readNextRefs` transferred, by a different field.** cram-js stores the
  mate's reference as `nextSequenceId`, so `nextRefId` resolves one name per
  contig exactly as BAM's does. The one subtlety is CRAM's: `hasNextPosition()`
  is the test, not `>= 0`, because **-2 means the file gave no position at all**
  and is deliberately distinct from **-1**, a next segment that has a position
  but is unplaced. Both collapse to the table's -1 slot; only one is a missing
  mate.

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
- **The worker blob is code-split, from 13.3.0.** Before it, `sliceWorkerPool.js`
  imported the ~400 KB inlined bundle statically and `file.ts` imports that
  module to start the pool, so anything reaching `IndexedCramFile` pinned it —
  the chunk was 547.0 KB raw / **182.5 KB gzipped**, against 274.1 / **96.1** now,
  plus 89.3 KB gz fetched when a pool actually starts. Same trick core applies to
  `@gmod/bgzf-filehandle`'s equivalent blob in `util/bgzfWorkerPool.ts`.
  **Do not restate this as 86 KB off the bundle**, which is the reading it
  invites and is wrong twice over: `CramAdapter` is already behind
  `getAdapterClass: () => import(...)` so none of it was ever in the initial
  bundle, and `useSliceWorkerPool` defaults to true so the ordinary case still
  fetches those bytes. What moved is the **critical path** — the whole 182.5 KB
  used to have to land and parse before `IndexedCramFile` could be constructed
  and the `.crai` read could start. The unconditional saving is only for a track
  with the pool off, and for contexts that cannot start one.
- **A pan reuses the slice cache essentially perfectly, and BAM does not.**
  `benches/panRedundancyCram.probe.ts` against `panRedundancy.probe.ts`, same ten
  windows, same 308,998 records either way: CRAM re-reads **0.1%** of the bytes
  it reads, BAM **54.7%**. A slice is a fixed partition of the file, so a shifted
  window asks for the same slices; `@gmod/bam` keys on a query-dependent merged
  span, so it does not. Nothing to do here — it is filed because it is the
  strongest evidence for the BAM-side fix that `@gmod/bam` ADR 0019 parks, and
  BAM_STACK_INTEGRATION seam 2 quotes it. The trade it also shows is CRAM's 126
  file reads against BAM's 13, which is free locally and is seam 7's problem
  remotely.

## When @gmod/cram 14 is published

Three things on the library's main branch concern this adapter and land
together in 14 (`04c05a6`, `674bef2`, `91b4926` there; ADR 0012 and
MIGRATION.md have the reader-facing story):

- **A `CramRecord` is a view** — `new CramRecord(slice, index)` over a
  per-slice column set (`DecodedSlice`), every field a getter, records handed
  out fresh per query. Retained heap on short reads fell ~17%.
- **The reference fetch overlaps the slice decode** — seam 1 above.
- **`recordClass`** — the hook `@gmod/bam` has: a `CramRecord` subclass
  constructed as `new RecordClass(slice, index)` and handed out from every
  query. It survives the worker pool for free, because what crosses the
  boundary is the `DecodedSlice` and the views are constructed on the host
  (`DecodedSlice.records(filter, RecordClass)`).

The paragraph under "A `recordClass`" in the deliberate non-integrations is
therefore obsolete the day 14 is adopted, and this is the adoption. It is
written so it can be applied as-is once `plugins/alignments/package.json`
moves to `^14`; **do not apply any of it against 13** — `CramRecord` there
has the options constructor and standalone fields, and the subclass below
would not construct.

### `CramSlightlyLazyFeature extends CramRecord`

```ts
// plugins/alignments/src/CramAdapter/CramSlightlyLazyFeature.ts
import { CramRecord } from '@gmod/cram'

export default class CramSlightlyLazyFeature
  extends CramRecord
  implements MismatchFeature
{
  // set by CramAdapter.getFeatures on every record it emits, exactly as
  // BamAdapter does with `record.adapter = this`
  public adapter!: CramAdapter

  private numericCigar?: ArrayLike<number>

  private clipStart?: number

  // every `this.record.x` in the wrapper becomes `this.x`; the members below
  // are the ones whose body changes shape, the rest are a mechanical rename
  ...
}
```

No explicit constructor: the implicit one forwards `(slice, index)` to
`CramRecord`, which is what `new RecordClass(slice, index)` wants and what
`BamSlightlyLazyFeature` does. The wrapper's `record` and `adapter` parameter
properties go, and every `this.record.` becomes `this.`.

**Members to DELETE, because the base already answers identically** (each
would otherwise be a shadow the guard test below rejects):

- `start` — `CramRecord.start`.
- `end` — `CramRecord.end` is `start + Math.max(lengthOnRef ?? 0, 1)` since
  13.4.3 (`0a53bef`, bam_endpos semantics), the same floor-at-1 this wrapper
  spells.
- `flags` — `CramRecord.flags`.
- `forEachCigarOp` — the wrapper's is a pure delegation; `walkCigar` duck-types
  the name and finds the inherited one.

**Members that become `override`s**, and the only four allowed to:

- `forEachMismatch(callback, opts?)` — keeps the `MISMATCH_OPTS` reuse and the
  `origin = this.start` translation, calling `super.forEachMismatch(callback,
  MISMATCH_OPTS)`. Its signature has to stay compatible with
  `CramRecord.forEachMismatch(callback, opts?: MismatchOptions)`, the same
  constraint `@gmod/bam` 8.6.0 put on the BAM twin.
- `getTag(name)` — the RG arm through `cramReadGroup(this.adapter.samHeader,
  this)`, else `super.getTag(name)`.
- `tags` — the getter that splices the header's RG over `super.tags`. The base
  also declares a `tags` setter; a getter-only override makes assignment throw
  in strict mode, which is the behaviour this side wants.
- `toJSON()` — a `SimpleFeatureSerialized`, where `CramRecord.toJSON` emits the
  library's own field names. Same collision `BamSlightlyLazyFeature` carries.

Everything else the wrapper defines (`name`, `score`, `strand`, `qual`,
`qualRaw`, `refName`, `pair_orientation`, `template_length`, `next_ref`,
`nextRefId`, `next_segment_position`, `next_pos`, `seq`, `NUMERIC_CIGAR`,
`clipLengthAtStartOfRead`, `CIGAR`, `id`, `recordId`, `get`, `parent`,
`children`, `mismatches`, `fields`) is a name `CramRecord` does not have, as
of its main branch. `cramReadGroup` keeps its `(samHeader, record)` signature —
the adapter's tag filter calls it on records it has not yet decorated.

### The adapter

```ts
// plugins/alignments/src/CramAdapter/CramAdapter.ts, configure()
const cram = new IndexedCramFile({
  ...,
  recordClass: CramSlightlyLazyFeature,
})

// getFeatures(), the emit loop
for (const record of records) {
  report()
  if (shouldFilterRecord(record, filterBy, samHeader)) {
    continue
  }
  record.adapter = this
  observer.next(record)
}
```

One typing gap to close before this lands: `@gmod/bam` is `BamFile<T extends
BamRecordLike>` with `T` inferred from `recordClass`, so `BamAdapter`'s loop
sees `BamSlightlyLazyFeature` with no cast; `IndexedCramFile` on cram-js main
is not generic and `getRecordsForRange` returns `CramRecord[]`. Ask the library
for the same generic (`IndexedCramFile<T extends CramRecord = CramRecord>`,
`recordClass?: CramRecordClass<T>`) before 14 ships, so this side does not have
to spell `(await ...) as CramSlightlyLazyFeature[]`. `shouldFilterRecord`
keeps its `CramRecord` parameter and runs before `adapter` is assigned, which
is why `cramReadGroup` takes the header explicitly rather than reading it off
`record.adapter`.

### `ultraLongFeatureCache`

Already gone (seam 3), and it **must not come back** under 14 in any form
that retains a record. A view pins its `DecodedSlice` — the whole
slice's read-feature arena, quality column and tag column — so an LRU of 500
long-read views would hold up to 500 slices' columns outside the
`decodedRecordsBudget` that is supposed to bound them. The same hazard existed
under 13 (a standalone `CramRecord` held references to those columns too) and
was tolerated because the cache was small; with `recordClass` there is also
nothing left for it to memoize, since the feature *is* the record and is
handed out fresh per query by design (ADR 0012: "views are handed out fresh
by each query and are meant to be short-lived").

### The guard test

`bamRecordOverrides.test.ts` exists because inheriting from a library class
lets a purely additive minor release shadow one of this side's members without
semver saying anything. The CRAM twin, to land in the same commit as the
inheritance:

```ts
// plugins/alignments/src/CramAdapter/cramRecordOverrides.test.ts
import { CramRecord } from '@gmod/cram'

import CramSlightlyLazyFeature from './CramSlightlyLazyFeature.ts'

const INTENDED_OVERRIDES = ['forEachMismatch', 'getTag', 'tags', 'toJSON']

const own = (c: { prototype: object }) =>
  Object.getOwnPropertyNames(c.prototype).filter(n => n !== 'constructor')

test('CramSlightlyLazyFeature shadows only what it means to', () => {
  const base = new Set(own(CramRecord))
  const collisions = own(CramSlightlyLazyFeature).filter(n => base.has(n))
  expect(collisions.sort()).toEqual([...INTENDED_OVERRIDES].sort())
})

test('the intended overrides still exist on both sides', () => {
  for (const name of INTENDED_OVERRIDES) {
    expect(own(CramRecord)).toContain(name)
    expect(own(CramSlightlyLazyFeature)).toContain(name)
  }
})
```

The first test is what catches the quiet case — `CramRecord` growing a
`name`, `score` or `seq` whose signature happens to be compatible with ours —
and the second is what catches one of the four overrides being renamed away
so the base silently takes over (a `toJSON` emitting `readName` instead of
`name` is the visible symptom).

### What to re-measure after

`benches/recordShape.bench.ts` is the reproducible form of ADR-049's number
for BAM; run its CRAM analogue over the same fixtures the per-base measurement
above used. The expectation is small — with records as views the wrapper was
already transient, so this is one object per read rather than two, and
ADR-049's own finding is that transient objects are the cheap kind. The reason
to do it anyway is that it is the change that makes `MismatchFeature` and
`CramRecord` one prototype chain, which is what `hasCigarOpWalk` and
`isMismatchFeature` probe by name.
