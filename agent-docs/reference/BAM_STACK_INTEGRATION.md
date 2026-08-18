---
name: bam-stack-integration
description: The vertical audit of BamAdapter x @gmod/bam x @gmod/bgzf-filehandle — every lever the two libraries expose, whether the adapter reaches it, the four non-integrations that are deliberate, the seven seams that remain, and the profile that ranks them (inflate dominates; the per-read work every seam here is about is under a tenth of a query). Read before adding a BAM read-path optimization, so you extend the stack rather than duplicate a layer of it. CRAM_STACK_INTEGRATION.md is the companion for the other format.
audience: internal
---

# The BAM stack, layer by layer

Three repos serve one query, and each has been optimized against measurements
of its own. This is the audit of the joins between them: what each layer
offers, what the layer above actually takes, and where an optimization stops
short of the consumer that would pay for it.

Read it before adding anything to the BAM read path. Most of what looks like a
missing optimization here is already present one layer down under a different
name, and two of the things that look like oversights are load-bearing.

## The layers, and what crosses each join

```
plugins/alignments  BamAdapter -> BamSlightlyLazyFeature (recordClass)
                    packReference / forEachMismatchNumeric imported directly
        |           records are SHARED across queries; bindings go on a view
        v
@gmod/bam           BamFile.getRecordsForRange
                    index -> chunks -> optimizeChunks -> per-chunk SharedReadCache
        |           chunk bytes + chunk virtual offsets
        v
@gmod/bgzf-filehandle  unzipChunkSlice(bytes, chunk, pool)
        |              -> {buffer, cpositions, dpositions}
        v
@gmod/range-cache-filehandle  RemoteFileWithRangeCache / CachedFilehandle
                              256 KiB chunk LRU, in-flight dedup, refcounted
                              aborts
```

Four caches stack, each bounded in its own unit and each with a documented
reason to exist at that level: 256 KiB compressed chunks in the range cache, decompressed
+ parsed records per merged BAM chunk in `@gmod/bam`, the parsed index and
header as one-entry shared reads, and the sequence adapter's own reads at the
bottom of the reference fetch. Nothing between them is redundant — a
`FastaAdapterBase` comment records the one time a fifth was added and measured
a loss.

## Where a query's time actually goes, which ranks everything below

Most of this document is about worker CPU spent per read, because that is what
is easiest to measure and what successive sessions have optimized. **It is the
minority of a query.** `benches/readPath.profile.ts` drives the shipped path —
`getRecordsForRange` with `recordClass` wired, then `extractFeatureArrays`, then
the per-read array builders `executeRenderAlignmentData` runs after it — so
`--cpu-prof` can split all three:

| fixture | records | fetch | extract | arrays | largest single cost |
| --- | --: | --: | --: | --: | --- |
| 1000x.shortread, 19 kb | 153,677 | 250ms (**54%**) | 175ms (37%) | 43ms (9%) | BGZF inflate wasm |
| 200x.longread, 19 kb | 335 | 459ms (**89%**) | 58ms (11%) | 0.1ms (0%) | BGZF inflate wasm |

The third column is the one to keep honest about: `extractFeatureArrays` is not
the end of the worker's work, and an earlier version of this table omitted
`buildBaseReadArrays` / `buildReadNameBlock` / `buildReadNextRefs` and so
overstated the other two. Its 43ms independently corroborates the 44ms those
builders measure on the GIAB 207k-read window (`plugins/alignments/src/CLAUDE.md`).

Inflate is the largest line in both, and on long-read data the whole per-read
pass is a ninth of the query. Two consequences worth carrying into any sizing
argument here:

- **The per-read arrays and tag walks are a few percent of a query, not of a
  phase.** The tag lookups that seam 4 is about measure ~38ms per extract pass on
  the 1000x fixture — real, and about a fifth of the extract phase, but under a
  tenth of the query. Seam 7 already says this from the network side ("the four
  per-read arrays are ~2% of one fetch"); this is the same statement for local
  files and worker CPU.
- **Long-read data does not have the regime seam 5 is sized for.** That seam
  prices a kilobyte-scale MD rescan per tag walk, on a synthesised sweep of
  50,000 spliced reads. A real long-read window has *hundreds* — 335 here — so
  `tagValueEnd` is 9.5% of the 58ms extract inside a 517ms query, about 1% of the
  whole. The sweep's shape finding stands; its weight does not transfer to an
  interactive pileup.

These numbers are the **serial floor**: `getSharedWorkerPool()` returns
`undefined` under node, so no bench in any of the three repos sees the inflate
pool. In a browser the pool spreads that dominant line across four workers
(measured 1.95x end to end, `util/bgzfWorkerPool.ts`). The ranking does not
change — it makes redundant inflate cheaper without making it less redundant,
which is seam 2.

## What the adapter wires, and what it does not

Every constructor option and public entry point of the two libraries, and
whether `BamAdapter` reaches it. This is the table to check a claim of "we
should pass X" against.

| Lever | Layer | Wired | Where / why not |
| --- | --- | --- | --- |
| `recordClass` | bam | yes | `BamSlightlyLazyFeature`, ADR-049 |
| `cacheBudget` | bam | yes | `decompressedBytesBudget`, ADR-064 |
| `bgzfWorkerPool` | bam | yes | `sharedBgzfWorkerPool()` |
| `onProgress` (index + chunks) | bam | yes | `downloadStatus` on both phases |
| `signal` | bam | yes | `withStopTokenSignal` |
| `estimatedBytesForRegions` | bam | yes | `getRegionByteSize`, byte gate |
| `packReference` | bam | yes | once per fetch, not per read |
| `forEachMismatchNumeric` | bam | yes | both feature classes |
| `getTagAlt` | bam | yes | duck-typed by modifications-utils |
| `maxCacheBytes` | bam | no | superseded by the shared budget |
| `cacheIdleTimeoutMs` | bam | no | library default (3 min) is the intent |
| `fetchReferenceSequence` | bam | **no** | deliberate — see below |
| `viewAsPairs` / `pairAcrossChr` | bam | **no** | deliberate — see below |
| `renameRefSeqs` | bam | no | aliasing is resolved above the adapter |
| `getMismatches` | bam | no | allocating form; the walk is used instead |
| `unzipChunkSlice` | bgzf | yes | via `@gmod/bam` |
| `getSharedWorkerPool` | bgzf | yes | `packages/core/src/util/bgzfWorkerPool.ts` |
| `BgzfWorkerPoolHost` / `Client` | bgzf | **no** | **gap — see seam 1** |
| `destroySharedWorkerPool` | bgzf | no | the pool reaps itself since 6.6.0 |

## The four non-integrations that are deliberate

Do not "fix" these. Each is a library feature this consumer cannot use, for a
reason that is written down on both sides.

**`fetchReferenceSequence` / `setReference` / `getReferenceRegion`.**
`@gmod/bam` will fetch reference bases for MD-less reads and bind them to the
records itself. `BamAdapter` does the same job with `seqFetchSpan` +
`packReference` + `withRegionRef` instead, and has to: `setReference` requires
a region covering the **whole** read (`@gmod/bam` ADR 0020) because records are
shared between queries (ADR 0006), while `seqFetchSpan` clamps to the viewport
so a chromosome-length contig read does not drag a chromosome of sequence in
behind it. A clamped region is exactly what `setReference` throws on. The
`RegionBoundBamFeature` view is the correct consumer-side answer, and
`regionRefAliasing.test.ts` is what pins it.

**`viewAsPairs` / `pairAcrossChr` / `maxInsertSize`.** `BamFile.fetchPairs`
exists and no in-tree code passes any of it: this repo does its own chaining in
`partitionChains` / `filterChainFeatures`, over reads it already has. Worth
knowing because `@gmod/bam` ADR 0003 rejected memoizing `get name` on the
grounds that `fetchPairs` is the only caller that re-reads a name — a
conclusion that depends on this staying unused.

**Filtering.** Flags, read name and tag filters are all applied in
`getFeatures`, not pushed down. `@gmod/bam` ADR 0005 moved them up on purpose;
the loop that applies them already visits every record to set `adapter` and
resolve the reference, so filtering there is free.

**`maxCacheBytes`.** Left at its 1 GB default and made irrelevant by
`cacheBudget`. Dividing it by track count is the obvious alternative and is
measurably worse than doing nothing (ADR-064).

## Seam 1 — per-context scoping multiplies by the RPC pool

**The live gap, and the biggest one. Measured, not reasoned.**

Three things in the read path are scoped **per JS context**, and adapters are
sticky per track to one of `clamp(hardwareConcurrency - 1, 1, 5)` RPC workers
(`WorkerPoolRpcDriver.getWorker`, keyed on `rpcSessionId` =
`adapterConfigCacheKey(adapter)`). So each of the three multiplies by however
many workers a session spreads its tracks over.

`browser-tests/percontext-probe.ts` counts it on a production build. N
alignments tracks with distinct adapter configs, reads carrying no MD tag so
every track fetches reference bases, one 10 kb window, 16 cores:

| tracks | RPC workers | bgzf pool workers | reference fetches |
| ------ | ----------- | ----------------- | ----------------- |
| 1      | 1           | 4                 | 1                 |
| 5      | 5           | 20                | 5                 |
| 8      | 5           | **20**            | **5**             |

**The 8-track row is the whole result.** Eight tracks over five workers is five
of each, not eight — so both quantities track the number of JS contexts, not
the number of tracks. Two tracks sharing a worker share its inflate pool and
its cached bytes. The caches work; their scope is what is wrong.

### The pool

`sharedBgzfWorkerPool()` calls `getSharedWorkerPool()`, which memoizes per
context, so `5 x min(hardwareConcurrency, 4)` = **20 inflate workers** on any
machine with six or more cores, plus the RPC workers themselves. Each runs its
own copy of the inlined wasm bundle, so each carries an independent
`WebAssembly.Memory` — and that memory is grow-only, which REJECTED_IDEAS.md
already names as the root cause of the transient RPC-worker peaks (deep CRAM,
~997 MB down to 7 MB after GC). Those heaps used to outlive the last bgzip
track; `@gmod/bgzf-filehandle` 6.6.0 reaps a pool's workers after 3 minutes
idle and respawns them on demand, which gives the resting level back without
the pool object ever becoming invalid — `destroy()` could not be used for this,
since a destroyed pool throws out of `decompressBlocks` and every open reader
holds one.

`@gmod/bgzf-filehandle` documents this case in `docs/worker-pool.md` and ships
`BgzfWorkerPoolHost` / `BgzfWorkerPoolClient` / `createPoolPort` for it, naming
JBrowse's data workers as the motivating consumer. Neither symbol appears
anywhere in this repo.

### The range cache

`RemoteFileWithRangeCache`'s chunk `Map` is module-global, i.e. per context, so
**the same reference sequence is downloaded once per RPC worker** — five times
for one region, for tracks that share an assembly and a viewport. Nothing
above it dedupes: there is no session-level sequence cache, and each
alignments adapter builds its own sequence sub-adapter inside its own worker
(`BaseAlignmentsAdapter.getSequenceAdapter`).

On the fixture that is 5 x 249 KB of a 255 KB FASTA, which is nothing. On a
real assembly it is the region's sequence per pan per worker, and the `.fai`
went 6x (five workers plus the main thread). The browser's own HTTP cache
absorbed some of the repeats in some runs and not others — which is the point:
whether the bytes are re-fetched is left to cache headers rather than decided
by the app.

### Why neither is wired yet

The third per-context scope, `SharedBudget` (ADR-064), is **defensible and
should stay** — a worker OOMs on its own heap, so per-worker is the scope that
matters. Threads and the network are not like that: they are machine-wide, and
are being bounded from inside a context that cannot see the others.

But the obvious fix is not free, which is why this is written down rather than
done. Three things to settle:

- **The speed argument is gone.** `pool-oversub-probe.ts` took the
  multiplication to its worst case — 4 cores under `taskset`, so 3 RPC workers x
  4 = 12 inflate workers, ~4x oversubscribed — with 5 no-MD tracks, min of 3:

  | arm                             | rpc | inflate | min    |
  | ------------------------------- | --- | ------- | ------ |
  | today, build 1                  | 3   | 12      | 2586ms |
  | today, build 2, identical code  | 3   | 12      | 2984ms |
  | `workerCount=1` (one pool)      | 1   | 4       | 2759ms |
  | pool capped to 1 per context    | 3   | 3       | 3382ms |

  The two `today` rows are the same code built twice and differ by 15%, wider
  than every gap between arms — so the only safe reading is that **no arm beat
  the status quo**, and cutting the inflate workers to 3 was slower in every
  batch. Per-chunk parallelism is worth more than avoiding oversubscription,
  which makes sense: the pool exists to split one chunk across workers, and
  starving it of that costs more than the threads do.

  That lowers the risk of doing this rather than raising it. The `capped to 1`
  arm is strictly worse than one shared pool of four — fewer threads AND no
  per-chunk parallelism — and cost only ~13%, inside the drift, so the worry
  that one shared pool of four would regress the several-tracks case is not
  supported.

  The remaining argument is the 20 grow-only wasm heaps, which is unmeasured and
  which JS heap counters cannot see — wasm memory is outside
  `Runtime.getHeapUsage`, so it needs process-level RSS per target rather than a
  heap snapshot. Weigh that before building the channel, and be willing to close
  the item instead: untidy and free is a fine place for this to end.
- `BgzfWorkerPoolClient` copies the compressed input once more per chunk so the
  transfer detaches a buffer it owns. The library calls this small against the
  inflate; it has not been measured here.
- The port has to reach an RPC worker at boot, through `makeWorker`, and
  survive the worker being re-booted after an error (`LazyWorker.invalidate`).
  The range cache needs the same channel, so build it once.

Measuring any of it needs a browser: `getSharedWorkerPool` returns `undefined`
under node, so every vitest bench in all three repos is blind to the pool. See
[BGZF_WORKER_POOL.md](BGZF_WORKER_POOL.md) for the harness and for the three
benchmark traps that have produced fake numbers here, and
`percontext-probe.ts`'s header for the four that cost a run each building this
one — chiefly that jb2bench's BAMs all carry MD, so on that corpus the
reference is never fetched and the whole question is invisible.

## Seam 2 — the chunk cache key slides as a query pans

`@gmod/bam` keys its parsed-chunk cache on the **merged** chunk's virtual-offset
span, and the merge is query-dependent, so two pans over the same bytes parse
them twice. `@gmod/bam` ADR 0019 measures it and parks it: **68-72% of
decompressed bytes redundant** on shallow-to-moderate short-read data —
including `volvox`, which is the file in front of everyone who tries JBrowse
for the first time — and 0% on deep long-read data at ordinary zoom.

It is filed there rather than here because the fix is a re-keying inside
`@gmod/bam` plus a batch-fill path in `@gmod/shared-read-cache`, and it lands
on four of that repo's ADRs at once. What matters on this side is that the cost
is real and is paid by this consumer, and that the variant that looks like a
small local fix — serving a subset chunk out of a cached superset — is
incorrect and silently returns duplicated reads. Read ADR 0019 before touching
`chunkCacheKey` from either end.

Note what does **not** save it: `RemoteFileWithRangeCache` absorbs the
re-download, so a pan re-reads no bytes. It re-inflates and re-parses them,
which is 70-90% of a cold query (`@gmod/bam` ADR 0003).

### Confirmed from this side, and priced in wall clock

`benches/panRedundancy.probe.ts` counts every byte `@gmod/bam` reads across a
pan and diffs it against the union of the ranges, so the waste is measured here
rather than quoted from upstream. It needs no library patch — a `LocalFile`
subclass counting `read()` is enough, and a read that reaches the filehandle is
by definition a chunk the parsed cache did not have, so bytes read **are** bytes
re-inflated and re-parsed.

Ten 19 kb windows stepping 9.5 kb, `chr22_mask:124000+`:

| fixture | records/window | pan wall | bytes read | distinct | redundant |
| --- | --: | --: | --: | --: | --: |
| 20x.shortread | ~3,100 | 49ms | 3.36 MB | 1.31 MB | **61.1%** |
| 200x.shortread | ~30,700 | 407ms | 23.39 MB | 10.59 MB | **54.7%** |
| 1000x.shortread | ~153,500 | 906ms | 49.64 MB | 48.52 MB | 2.3% |

That reproduces ADR 0019's shape independently — its 56-68% for 200x.shortread
and its 0% for 1000x.shortread — so the two measurements corroborate rather than
extend each other. **Three controls make it believable**, and they are the part
worth keeping:

    one query                  6 reads   3.45 MB   0.0%    68ms
    the SAME query x10         6 reads   3.45 MB   0.0%   117ms
    10 windows, step 9.5 kb   13 reads  23.39 MB  54.7%   407ms
    10 windows, step 19 kb    14 reads  22.61 MB  45.4%   381ms

So the cache is **perfect for a repeated query and collapses the moment the
window moves at all** — ten identical queries cost 3.45 MB, ten shifted ones
6.6x that. And the step-19 kb row is the one that kills the intuitive reading:
those windows do not overlap *at all*, and are still 45% redundant. This is not
a pan re-reading its own overlap, it is the merged span sliding under it.

**What it is worth.** `--cpu-prof` on the 200x pan puts inflate and its wasm
buffer marshalling at 269.5ms and record parsing at ~70ms, i.e. ~77% of the
pan's work is decompress-and-parse. Taking 54.7% off that is ~185ms of a 407ms
pan — call it **1.8x on panning at moderate depth**, which is the first
wall-clock figure this seam has had.

**The regimes are the catch, and they are opposed.** The percentage is highest
where the absolute cost is lowest (20x: 61% of 49ms) and near zero where the
cost is highest (1000x: 2.3% of 906ms). Only the middle of the depth range —
200x, i.e. exomes, panels and high-coverage WGS — has both, which is where the
1.8x lives. Anyone sizing this should quote 200x and not 20x, however good the
61% looks.

### CRAM does not have it, and that is the argument for the fix

`benches/panRedundancyCram.probe.ts` is the same instrument on the same windows.
The comparison is as close to controlled as the two formats allow — identical
record counts, both 308,998 over the pan:

| | records | pan wall | file reads | bytes read | redundant |
| --- | --: | --: | --: | --: | --: |
| 200x.shortread.**bam** | 308,998 | 407ms | 13 | 23.39 MB | **54.7%** |
| 200x.shortread.**cram** | 308,998 | 438ms | 126 | 2.48 MB | **0.1%** |

`@gmod/cram` keys its cache on a **slice** — a fixed partition of the file,
decided when the file was written — so a shifted window asks for the same slices
and gets them. `@gmod/bam` keys on a merged span, which is a property of the
query. Same consumer, same access pattern, same depth: the waste is the **key
design**, not the workload.

That is worth more than one more number, because ADR 0019 parks the fix partly
on unknowns — whether raw-chunk keys explode the entry count, how the early stop
behaves at finer granularity. CRAM is a working existence proof of the shape it
sketches, in the same family, under the same consumer.

The trade it also shows: CRAM pays 126 file reads against BAM's 13. On a local
file that is free and on a high-latency endpoint it is seam 7's problem, so a
BAM fix that keeps the merged **fetch** unit while making the **cache** unit raw
— which is exactly what ADR 0019 proposes — is taking the good half of this
comparison and leaving the bad half.

## Seam 3 — the reference fetch was serial (measured, then closed)

`getFeatures` used to await the whole of `getRecordsForRange` before calling
`seqFetchSpan`, and only then issue the sequence read. On a BAM whose reads
carry no MD — minimap2 and bwa both leave it off unless asked, so most long-read
data — every query paid the two round trips end to end.

`seqfetch-timing-probe.ts` measured it under emulated latency, because on
localhost the read is ~1ms and the cost is round trips rather than bytes. One
no-MD long-read track, 10 kb window; **serial in every arm** — the reference
read never once started before the last BAM byte landed:

| RTT   | bam phase | reference | gap  | removable | share |
| ----- | --------- | --------- | ---- | --------- | ----- |
| 0ms   | 69ms      | 142→151   | 74ms | 9ms       | 6%    |
| 20ms  | 148ms     | 182→218   | 34ms | 36ms      | 17%   |
| 60ms  | 291ms     | 335→417   | 43ms | 82ms      | 20%   |
| 150ms | 651ms     | 707→895   | 56ms | 188ms     | 21%   |

Two numbers, because the obvious one overstates: the **tail** (everything after
the last BAM byte) is 27-34%, but it includes `gap`, which is the filter loop
and building the sequence sub-adapter and would still run. **Removable** is the
reads themselves — ~20% at a CDN-like RTT. The 0ms arm is the control that says
which it is: strip the latency and the read collapses to 9ms while `gap` stays.

The fix is that the span never needed the records. `seqFetchSpan` clamps to
`[regionStart, regionEnd)`, so the queried region is already its upper bound,
and `PackedReference` carries its own `start` — one packed for the whole region
locates any read in itself and the walk windows to the viewport regardless. So
the read is now issued alongside the alignment fetch and the records only decide
whether to *use* it, gated on `needsReference`: MD-ness is a property of the
file, so one query's answer predicts the next one's, and a BAM that carries MD
never opens the gate at all.

**The after, measured on the tiled fixture.** Three reps at 60ms, both arms from
one run — the gate supplies them for free, since the first query is necessarily
unprefetched and the pan is prefetched:

| arm                      | reference read | hidden | critical path            |
| ------------------------ | -------------- | ------ | ------------------------ |
| first load (gate closed) | 67ms           | 0ms    | 663-698ms — SERIAL       |
| pan (gate open)          | 68ms           | 68ms   | 133-136ms — **OVERLAPPED** |

The pan's serial equivalent is 200-204ms, so **1.50x**. The read is entirely
inside the alignment fetch; what that is worth depends on the ratio between
them, which is why 10% (first load, 8-request BAM phase) and 33% (pan, 2
requests) are both right.

**Three traps, all of which bit.** `prefetched ?? this.fetchRegionSeq(…)`
evaluates its right side eagerly, so it read sequence on the first query of
every BAM including the MD-carrying ones — defeating the gate it sat under, and
caught only because `referencePrefetch.test.ts` asserts the MD case reads
nothing. A "% of query" figure assumes the read is serial and returns **-93%**
the moment it isn't, which is the case under test. And the original fixture
cannot show the fix at all: its 255 KB reference is smaller than one 256 KiB
`RemoteFileWithRangeCache` chunk, so the first query caches the whole genome and
a pan issues no reference request — while the gate stops the prefetch engaging
on the first query. The only query it showed the cost on was the one the fix
cannot help. `make-tiled-fixture.sh` is the way out, and it needs no read
simulator: tile the contig and shift a copy of each read into each tile, so the
reference tiles and every copy still aligns against identical sequence.

## Seam 4 — the SA lookup never joined the MM/Mm one

`getTagAlt` exists because `getTag('MM') ?? getTag('Mm')` walked the whole tag
block twice on every read of a file that carries neither, and that pair was
12.9% of a 1000x short-read query. `extractFeatureArrays` makes **two**
unconditional per-read tag reads, not one:

```
suppAlignments.push(getTag(feature, 'SA') ?? '')       // arcs
const mmTag = getTagAlt(feature, 'MM', 'Mm')           // extractModifications
```

`_findTag` proves absence by walking every tag on the record, so on an ordinary
short-read BAM that is still two full walks per read — the fix went to one of
them and the other is the same shape. **The cost is real. The fix is not
justified yet, and the numbers that made it look justified were wrong.**

`benches/tagAndSeq.probe.ts` sizes the two lookups against the mismatch walk,
which is the work that actually renders the pileup. Run **one fixture per
process** (`--only=`) — the first version of this table was taken from a single
process looping four fixtures, and every fixture after the first was
contaminated; see BENCHMARKING.md, where that is now its own trap:

| fixture | reads | SA | MM/Mm | both | fused | mismatch walk |
| --- | --: | --: | --: | --: | --: | --: |
| 1000x.shortread | 153,677 | 18.6ms | 20.8ms | 35.3ms | 23.2ms | 35.2ms |
| 200x.shortread | 31,133 | 4.5ms | 4.6ms | 8.0ms | 8.2ms | 7.6ms |

**What survives.** Proving two absences costs about as much as the whole
mismatch walk — 35.3ms against 35.2ms at 1000x, 8.0ms against 7.6ms at 200x. On
a file with neither tag that is the render's largest single avoidable cost, and
it is avoidable in principle by one pass over the tag block instead of two.

**What does not survive: that a fused pass is the fix.** It measures 1.52x at
1000x and **0.98x at 200x** — the same fixture shape, a fifth the reads. That
size-dependence has no explanation, and five have been eliminated:

- not the data — the two fixtures are byte-identical in tag layout (13.0 tags,
  75.4 tag bytes/read, same names and types) and in memory layout (383-byte
  records, 384-byte stride, 58% buffer occupancy);
- not JIT tiering — 300 rounds gives the same answer as 25;
- not live-heap pressure — releasing the other fixture's records changes nothing;
- not harness contamination alone — isolating the fixture moves 200x from 0.73x
  to ~0.98x, but not to a win;
- not arm warmup asymmetry — it survives a three-arm process.

So the honest state is: an unexplained per-read cost difference in a raw byte
walk, between two fixtures that differ only in how many reads they contain.

**Do not add the API on these numbers.** Even taking 1.52x at face value it
saves ~12ms on the deepest short-read fixture in the corpus and nothing on the
ordinary one, against a library API that every consumer then carries. What would
change the verdict is an explanation for the size-dependence, or an end-to-end
render measurement rather than a micro-probe — which is the same standard the
CRAM mismatch-walk delegation was held to (`CramSlightlyLazyFeature`, "revisit
if an end-to-end render measurement, not this micro-benchmark, shows the
short-read row mattering").

Two notes for whoever does pick it up. The fused walk in the probe reaches
private fields; a real implementation belongs inside `BamRecord`, where
`tagValueEnd` is already the shared cursor `_findTag`, `getTagAlt` and
`_computeTags` walk with, so it should be an argument-count change rather than a
fourth copy of the walk. And the consumer-side alternative — stop reading `SA`
unconditionally — is **closed, not open**: it was implemented and reverted. Only
the arc overlay was believed to read `readSuppAlignments`, and
`derivativePathCandidates` is the second reader, ungated by design, so gating the
walk emptied the derivative-allele dialog on the default fetch. The `rpcProps`
entry it needs also invalidates the fetch on a draw toggle, which was the smaller
of its two problems. The clone half of that saving is taken instead, by shipping
no array at all when the group has no SA tag anywhere.

## Seam 5 — a tag walk rescans an MD the record has already located

**The best-sized item here, and the only one whose fix is a few lines.**

Every walk of a record's tag block steps over each value to reach the next tag,
and for a `Z` value that means scanning byte by byte to the null terminator
(`tagValueEnd`). On long-read data `MD` is the whole tag block — 9,135 of the
9,135 tag bytes per read on `200x.longread` — so **any** lookup that does not
find its answer before MD pays a ~9 kB scan, and one that does two lookups pays
it twice. That is the entire reason the targeted-lookup form inverts against the
full decode in this regime.

`benches/gapStrand.bench.ts` sizes the candidate shapes against a synthesised
sweep — `jb2bench/make-mdsweep.py`, 50,000 spliced reads per fixture, identical
but for MD length, in two families. The real corpus gives two far-apart points
(~75 tag bytes on short reads, ~9,000 on long) and no idea where between them
the trade flips. One fixture per process, controls 0.96-1.03x:

| tag B/read | `get('tags')` | targeted | one walk | walk + MD skip |
| --: | --: | --: | --: | --: |
| *XS present, ahead of MD — the walk short-circuits* | | | | |
| 60 | 58.7ms | 7.3ms (8.0x) | — | 10.4ms |
| 1,550 | 167.1ms | 12.2ms (13.7x) | — | 12.9ms |
| 9,050 | 698.7ms | 13.1ms (**53.3x**) | 509.6ms | 14.7ms |
| *no XS/TS/ts — the walk must cross MD* | | | | |
| 446 | 86.6ms | 45.2ms (1.9x) | 30.5ms | 7.3ms (11.9x) |
| 1,546 | 137.3ms | 129.2ms (1.06x) | 80.6ms | 13.4ms (10.3x) |
| 9,046 | 647.6ms | 770.4ms (**0.84x**) | 432.6ms | 14.0ms (**46.2x**) |

**Tag ORDER is the second variable, and the one that is easy to miss.** A walk
looking for XS stops when it finds it, so a read carrying XS ahead of MD never
scans MD. The first version of the generator put XS immediately before MD and
measured 13.7x at 1,550 tag bytes — the best case dressed up as the general one.

**The shape matters more than any row.** `get('tags')` is the only form whose
cost scales with MD, 59ms to 699ms across the sweep. The other two are roughly
flat in MD for different reasons: `targeted` is flat when the tag it wants
appears early and degrades to worse-than-decode when nothing answers and it
crosses MD twice; the MD skip is flat *unconditionally*, ~7-15ms everywhere,
because it stops touching MD at all.

So the shipped targeted form wins in seven of eight cells, and its one loss
needs **both** a kilobyte-scale MD and no strand tag — long-read RNA aligned
with `--MD` from a library whose orientation could not be inferred.

**Folding the walks into one is not the fix** — 1.50x at best on the sweep, and
1.11x on the real long-read fixture. The cost is not how many walks there are,
it is that any walk past a kilobyte-scale MD scans it. Jumping that one value
collapses the walk to ~11 tag headers regardless of how long MD is.

**And the metadata to jump it already exists.** `NUMERIC_MD` memoizes
`getTagRaw('MD')`, which for a `Z` tag is `byteArray.subarray(p, end - 1)` — a
**view**, so it carries MD's start and length. The next tag begins at
`md.byteOffset - byteArray.byteOffset + md.length + 1`, in O(1), with nothing new
stored. On the alignments render path that memo is always populated before any
of these lookups run, because `forEachMismatch` reads `NUMERIC_MD` to walk the
read.

Three things for whoever implements it, all of which the bench had to respect:

- **It is a `@gmod/bam` change.** `_findTag`, `getTagAlt` and `_computeTags`
  share `tagValueEnd`; a consumer cannot reach the cursor. The bench hand-rolls
  the walk over the record's bytes purely to size it.
- **Read `_cachedNUMERIC_MD` only when already populated — never call the
  getter.** `NUMERIC_MD` resolves itself with `getTagRaw('MD')`, which is exactly
  the walk being avoided, so triggering it to speed up a walk pays for the walk
  twice.
- **The skip is not free where it does not help.** At 60 tag bytes it is 5.7x
  against the targeted form's 8.0x — the extra comparison per tag costs
  something, and short tag blocks are the dominant case. Whether that margin
  survives inside `_findTag`, which is a tighter loop than the bench's
  hand-rolled walk, is the thing to measure there rather than assume. The
  cleanest shape is probably to keep the targeted lookups and teach the shared
  cursor the skip, so the short-circuit and the jump compose.

The generalisation, which is what makes this worth an entry rather than a patch:
**a walk should never rescan a value the record has already located.** MD is the
only tag that is both routinely kilobytes and routinely already resolved, which
is why it is the one worth special-casing — but the rule is the reusable part.

## Seam 6 — the QNAME is decoded per read, and the record could write it instead

`BamRecord.name` builds a string with `String.fromCharCode` on every access,
deliberately unmemoized — its own comment says why, and that reasoning is right:
one consumer reading a name once should not pin a string on a cached record.

What it did not anticipate is a consumer that wants **every** name at once and
then almost never reads one. That was `readNames: string[]`, and on the
153,677-read window it measured 34.7ms to decode plus 7.5ms to clone, for an
array a pileup render touches only on hover. The plugin now builds one block
instead (`shared/readNameBlock.ts`): 42.2ms -> 24.7ms, 1.7x.

The seam is that **the copy is the record's own layout knowledge and lives
here**. `BamSlightlyLazyFeature` reads it back off three public getters
(`byteArray`, `b0`, `read_name_length`) to implement `nameLength` /
`copyNameInto`, which belong on `BamRecord` beside `name`:

```ts
get nameLength() { return this.read_name_length - 1 }
copyNameInto(dest: Uint8Array, at: number) { … }
```

**Allocation-free is the whole point, and it is the part that is easy to lose.**
The obvious API is a `nameBytes` view, and it was tried: a `subarray` per read is
an allocation per read, and the block built that way measured 35.9ms against
21.1ms — no better than decoding every name, which is what it was meant to
avoid. Whatever shape this takes upstream, it must not allocate per record.

`nextRefId` is the same seam in its simplest form and is already used the same
way: `next_ref` runs the mate's reference id through `refIdToName` on every
access, so a per-read array of mate references was manufacturing 153,677 strings
from a number, holding one distinct value. The plugin reads the id and resolves
a name once per contig. Nothing is needed upstream for that one — `next_refid`
is already public — but it belongs in this entry because it is the same
question: *what does the record hold, before it is turned into something?*

The generalisation is the mirror of seam 5's: **a bulk consumer should be able to
ask the record to write into its buffer, rather than asking for a value the
record has to allocate to hand over.** `seq` and `qual` have the same shape and
are already handled by returning views the caller consumes immediately; the
difference here is that a name's consumer is a concatenation, so a view is a
temporary that exists only to be copied out of.

## Seam 7 — one contiguous span is fetched as 28 requests, and it costs 5x

**The largest item in this document, by two orders of magnitude, and the least
investigated.** Everything else here is milliseconds of worker CPU. This is
seconds of wall clock.

Fetching `1:10,000,000-10,100,000` from GIAB's HG002 300x BAM (600GB, remote)
moves 26.8MB as **28 range requests, up to 6 in flight**. Four runs: 3.9, 5.5,
6.1, 6.2s — about **4.6 MB/s** effective. One `curl` range request for the same
26.8MB from the same host, interleaved with those runs: 1.18, 1.26, 0.95, 1.07s
— about **24 MB/s**. Consistently **~5x**, well outside the spread.

So the split into concurrent chunk requests is not paying for itself on this
endpoint; it is costing about 4.7 of the ~5.8 seconds. Per-request latency is
~140ms TTFB, which explains part of it, but not all — the requests do overlap,
and the tail is what dominates: one 3.7MB request took 3.0s while a sibling took
0.13s. That is the signature of an aggregate bandwidth cap being divided among
streams rather than of latency alone.

**For scale.** The four per-read arrays, before any of the work in this
document, cost 134ms on that same window. They are **~2%** of one fetch. Nobody
should optimise worker CPU for remote heavy files until this is understood.

**What is NOT established, and must be before acting:**

- **One server, one client, one afternoon.** `ftp-trace.ncbi.nlm.nih.gov` is not
  S3 or CloudFront, and those often *reward* concurrency. The same measurement
  against a bucket is the first thing to run.
- **Node, not a browser.** JBrowse fetches from a browser, over HTTP/2, through
  a connection pool this probe does not model. HTTP/2 multiplexing over one
  connection could make the whole effect vanish — or not, if the cap is
  server-side.
- **Local files are unaffected.** There is no seam here for a file on disk, and
  that is exactly where the per-read array work does pay.

### Two obvious culprits, both measured and both innocent

The shape of the stack invites a guess — `optimizeChunks` merging chunks in
`@gmod/bam`, then `RemoteFileWithRangeCache` re-splitting them into 256KB
chunks and fetching up to 20 at once. Two coalescing layers at different
granularities looks like exactly the sort of thing that would produce this.
Both were tested and neither is the cause.

**The range cache is not it.** Same query, cold: 4.77s through a bare
`RemoteFile`, 5.28s through `RemoteFileWithRangeCache`. It adds a layer and
costs about what a layer costs.

**`optimizeChunks` is not it either.** Disabling its merge entirely (a patched
copy of the library, so the pnpm store is never touched) takes the query from 28
range requests to 36 and from 26.8MB to 27.1MB — and the wall clock does not
move: 5.40 vs 5.10s on one cold pair, 5.09 vs 6.06s on another. Merging is
neither helping nor hurting on this query, because bam-js's chunks here are
already large and nearly contiguous. Whatever costs the 5x, it is not the number
of requests in the 28-36 range.

### The 5MB span cap is the unswept constant, and it is worth 4x at best

`optimizeChunks` has two constants: merge chunks whose gap is under 65000 bytes,
**as long as the combined span stays under 5MB**. bam-js ADR 0011 swept the gap
and the merge-or-not question; its status line confirms the gap constant and says
nothing about the span cap, and the cap does not appear in its table. So the
26.8MB this query wants becomes 28 requests because of a constant nobody
measured.

Raising it to 2GB (patched copy, store untouched), five interleaved pairs:

| | requests | bytes | wall |
| --- | --: | --: | --- |
| cap 5MB (current) | 28 | 26.8 MB | 4.95 / 4.13 / 3.98 / 5.73 / 5.48 |
| cap raised | **6** | **25.0 MB** | 4.71 / 1.40 / **0.98** / 5.37 / 5.35 |

Two things are deterministic and both favour raising it: **28 requests become 6,
and the bytes go DOWN** (25.0 against 26.8MB), because a merged span amortises
the per-chunk tail padding — the same effect ADR 0011 measured in the other
direction.

The wall clock is bimodal. Medians are a wash (4.95 vs 4.71s), but the best case
is **3.98 -> 0.98s**, and 25MB in 0.98s is 25.5 MB/s — the single-stream rate a
bare `curl` gets. The 5MB cap never came close to that in thirteen measurements.
So when the server is willing, six requests can saturate the link and 28 cannot;
when it is throttling, nothing helps. That is why the medians hide it.

### …and the sweep says leave it alone

Both costs are now measured, on the local 1000x fixture so the numbers are the
chunking's and not the network's, one process per cap. **A pan of ten
overlapping 20kb windows stepping 10kb** — i.e. browsing, which is what this
library is for:

| cap | reads | bytes | wall | retained heap |
| --- | --: | --: | --: | --: |
| 1MB | 19 | 49.8 MB | 1.17s | +551 MB |
| **5MB (current)** | **19** | **49.8 MB** | **1.04s** | **+552 MB** |
| 20MB | 14 | 98.2 MB | 2.45s | +1204 MB |
| 100MB | 14 | 125.9 MB | 2.94s | +1535 MB |
| 2GB | 14 | 125.9 MB | 3.62s | +1535 MB |

Raising the cap saves 5 reads across the pan and costs **2.5x the bytes, 2.8x
the retained memory and 3.5x the wall clock**. That is seam 2 quantified: the
parsed cache keys on the merged span and the merge is query-dependent, so with
big merges every pan step produces a *different* span, nothing is reused, and
each window re-reads and re-parses. Small merges produce spans that repeat, and
the cache hits.

The single-query memory cost is visible even where the request count is
identical — 6 reads at every cap on that fixture, but +199 MB retained at 1-5MB
against +262 MB at 20MB and above, because a larger span blunts the early stop
in `_fetchChunkFeatures` and parses records the query never wanted.

**So the 5MB cap stays, and it is not arbitrary after all** — it is just
defended on an axis its own comment does not name. 1MB is indistinguishable from
5MB here, so there is no evidence 5 is special; there is now good evidence that
anything much larger is worse.

What survives from the remote measurement is narrower and still real: on a
**single cold query to a high-latency endpoint**, 28 requests cannot saturate
the link and 6 can, so that one query can be 4x faster. That is a different
workload from panning, and the remote pan would be *worse* than the table above,
not better: 2.5x the bytes over a link running at 5 MB/s.

### Coalescing in the transport instead — tried, and it cannot work there

The obvious place to separate request shape from cache shape is
`RemoteFileWithRangeCache`, which already joins contiguous missing 256KB blocks
*within* one `read()`. Making it hold runs for a microtask and merge **adjacent**
ones *across* concurrent `read()` calls is free by construction — the bytes are
identical, and @gmod/bam's merged span stays the cache key it was, so none of the
pan cost above applies.

It was implemented and measured, and it does not pay: **28 requests become 23**,
wall clock inside the noise. Instrumenting the batch says why, and the answer is
structural rather than a tuning problem:

    runs per microtask flush:  1, 6, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, …
    runs merged per request:   1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, …

@gmod/bam issues about six reads concurrently and then the rest **sequentially**,
as earlier ones complete. So the transport never sees more than six of the 28 at
once, and of those only one group was adjacent. No batching window helps: the
later reads are issued a network round trip apart, and any delay long enough to
catch them is longer than the request it would save.

**The information needed is upstream.** Only @gmod/bam knows the whole chunk list
before the first byte is fetched. So the fix was built there too — and that is
where the premise finally broke.

### What the 28 requests actually are

Printing the chunk list for that query ends the guessing:

    chunk  0-6    ~3.5 MB each, each OVERLAPPING the next by exactly 65,536 B
                  (one max BGZF block) — 24.5 MB of contiguous pileup data
    chunk  7-27   ~0.1 MB each, scattered, gaps of 3 MB … 200 MB … 22 GB

It was never one contiguous span chopped into 28 pieces. It is **seven adjacent
chunks plus twenty-one tiny scattered ones**, and no adjacency merging can touch
the twenty-one. The ceiling for this whole line of attack is 28 -> 23 requests.

A demand-driven group prefetch in `_fetchChunkFeatures` — plan groups of chunks
whose byte ranges join, read each group once, hand the slices to the per-chunk
reads, leaving `optimizeChunks` and the parsed-cache keys untouched — reaches 24
(the 16MB group bound splits the 21MB head) and moves the wall clock not at all:
3.16 / 5.82 / 7.23s against a stock 5.98 / 5.18 / 5.78s. Records identical. Built,
tested green against bam-js's 259, measured, reverted.

**The `<=` is the one part worth keeping if anyone rebuilds this.** A chunk's
`endPosition` defaults to a whole max-size BGZF block past `maxv`, because the
index does not carry that block's compressed length. Consecutive chunks therefore
*overlap* rather than exactly touch, and a `===` adjacency test finds no groups
whatsoever — measured, 28 requests unchanged, which is how the first version of
this looked like it was working while doing nothing.

### And the earlier 4x was mostly the early stop, not the request count

Raising the 5MB cap produced 6 requests and 25.0MB where the current cap
produces 28 and 26.8MB. That is not the same query needing fewer requests: with
the cap raised, `optimizeChunks` merges chunks 0-6 into ONE chunk, so the first
batch of six covers far more of the query, `isPastQuery` fires after it, and the
twenty-one tail chunks are **never read**. Same records (207,260 either way),
1.8MB less fetched, and the speed came from work skipped rather than from
requests coalesced.

Which retires the whole seam as originally framed, and leaves one live question.

### The twenty-one tail chunks contribute NOTHING, and the early stop should have caught them

Reading each chunk and counting how many of its records fall in the query
answers it outright:

    chunk 0-6    32,800-35,504 records each, in range      <- the query's data
    chunk 7-27   131-349 records each, ZERO in range       <- 2.0 MB for nothing

Every read in those twenty-one starts past the query end. Their first-record
positions say what they are:

    10125165, 10141549, 10157933 …   step 16,384    = 2^14
    10354541, 10485613               step 131,072   = 2^17
    11534189, 12582765               step 1,048,576 = 2^20
    25165677, 33554285, 41942893 …   step 8,388,608 = 2^23

That is the BAI **bin hierarchy** — one chunk per level, each at the start of a
successively larger bin. `reg2bins` returns the containing bins at all six
levels and every one contributes its chunks, including chunks that sit after the
query. The linear index prunes only from below; the format has no upper bound.

**The index cannot fix it, and @gmod/bam already knows why.** `chunksLikelyRead`
computes exactly this upper bound and is deliberately a *forecast only*: a long
read reaching into the next window pins that window's linear-index entry low, so
pruning a fetch by it would drop records. Right call — that path is unsound.

**What can fix it is the early stop, which is calibrated on an assumption deep
coverage breaks.** `_fetchChunkFeatures` checks `isPastQuery` ONCE, over the
first `MAX_CONCURRENT_CHUNK_READS` (6) chunks, and ADR 0010 justifies the single
barrier with "the stop always fired inside the first batch on every fixture
measured (the first 1-3 chunks)". At 300x the query's OWN data is seven chunks —
one more than the batch — so chunk 5's last record is still inside the query, the
stop cannot fire, and all twenty-one tail chunks are then read. The batch size
doubles as the early-stop window, and that coupling breaks exactly when a
query's data is deeper than six chunks.

**Implemented in @gmod/bam**, branch `prefix-early-stop`, ADR 0010 amended with
the trade-off. Six paired runs against the stock reader, records identical every
time:

| | requests | bytes | wall (mean of 6) |
| --- | --: | --: | --: |
| stock | 28 | 26.8 MB | 6.68s |
| stop re-tested | **12** | **25.3 MB** | **5.40s** |

The link's own spread is ±3s and the prefix arm won four of six pairs, so the
request and byte counts are the result here and the time is only
consistent-in-direction. Not pushed — that is a release decision.

Two things worth carrying out of building it:

- **A completed-PREFIX check does not work**, which was the obvious design and
  the one this doc previously proposed. Chunk 6 is 3.5MB and slow, so while it
  is in flight the other five workers consume all 21 tiny tail chunks, and the
  prefix blocks at exactly the boundary that would have stopped it. Measured: 28
  requests, unchanged. What works is a monotone `stopIndex`: past-ness is
  monotone in chunk index, so the smallest past index is a function of the chunk
  list alone however the reads finish.
- **It costs a guarantee, and the ADR says so.** The stop index stays
  deterministic; the OVERSHOOT — how many chunks a worker had already taken when
  the stop landed — does not, bounded by the pool width. Those chunks contribute
  nothing, so unlike ADR 0010's failed first attempt this cannot change which
  records come back. But `cache.test.ts`'s "a repeated query reads no more
  chunks" is now a property of the corpus rather than of the algorithm.

And a correction to this document: the earlier **4.08s -> 1.13s** was attributed
to skipping the tail, and that was wrong. That run also merged the seven head
chunks into one request, which is where its speed came from. Skipping the tail
alone is the ~1.3s above.

### Why samtools makes one request where we make 28

Worth stating plainly, because it is the whole difference in philosophy.
htslib seeks to the first chunk's offset and streams **sequentially** to the
last, over one keep-alive connection — reading straight through the gaps between
chunks rather than skipping them. Its request count is ~1 and its byte count is
*higher* than ours.

We optimise for bytes: the 65000-byte gap tolerance is a rule about how much
waste is worth avoiding a request. On a link where throughput is the constraint
that is right, and on a high-latency or per-stream-throttled endpoint it is
exactly backwards, which is what the table above shows.

That leaves **concurrency against single-stream throughput** as the other live
hypothesis: one request gets ~24 MB/s, and six to twenty concurrent ones share
something much smaller. Four parallel `curl` streams also underperformed one, on
the same host, which points the same way. If that is what it is, the lever is a
concurrency cap tuned per host rather than any change to chunking — and it is
the sort of thing that is entirely different against S3.

**The range cache earns its place elsewhere, and the same run shows it.** Its
chunk map is module-global, so a repeat of the identical query costs 0.40s
against 5.4s cold — the layer is doing its job on re-reads, which is what it is
for. (That global is also a trap for anyone benchmarking this: the second
filehandle in a process inherits the first one's chunks, and a run that looks
like a 13x win from some other change is usually just this.)

## Checked against a real 300x file, not just the fixtures

`jb2bench`'s deepest fixture is a synthetic 1000x pileup in a 268MB file, and
three design choices in the per-read arrays rest on properties of the DATA that
such a file cannot show either way. `benches/giab300x.bench.ts` runs the shipped
builders against GIAB's HG002 300x novoalign BAM (600GB, hs37d5) over HTTP range
requests. Two windows, 207,260 and 100,939 reads:

- **Virtual offsets pass 2^32 by four orders of magnitude.** The largest seen was
  128,299,878,811,863 — **29,872x** over — which is why `readKeys` is a
  `Float64Array`. A `Uint32Array` would have truncated every read id on this file
  silently, and no local fixture could have caught it. It is still 70x inside a
  double's exact-integer range, so the headroom is real rather than lucky.
- **A window really does see few mate references.** 24-27 distinct, against
  207,260 reads. The synthetic fixture says 1, which is not evidence for the
  slot table; this is.
- **SA is genuinely absent**, on 0.00% of reads at every window tried, because
  novoalign emits no supplementary alignments. So the per-read SA tag walk was
  waste on real data too, not only on the fixture. **A BWA-MEM file would answer
  differently** — that is the one claim here that does not generalise, and the
  gate is on whether anything READS the array rather than on whether it is
  empty, so it holds either way.

Every read also round-trips through `readIdAt` / `readNameAt` / `nextRefAt`
against what the record itself says: 0 mismatches over 300k+ reads.

The four arrays cost **134ms** on the 207,260-read window and **44ms** after —
3.0x, or 0.65ms per 1,000 reads before. Read names are 37.5 bytes each here
against the fixture's 41.9, so the fixture was if anything flattering.

## Things checked and found already integrated

Stated so the next audit does not re-derive them.

- **The byte gate uses the forecast, not the candidate set.** `getRegionByteSize`
  reaches `chunksLikelyRead` through `estimatedBytesForRegions`, which is what
  keeps a 380 bp window on a deep ONT BAM from being reported at 5.6x the bytes
  it will actually read (`@gmod/bam` ADR 0017).
- **`getTagAlt` is reached.** `modifications-utils` duck-types it, and both
  `BamSlightlyLazyFeature` and `RegionBoundBamFeature` carry it — so the MM/Mm
  and ML/Ml lookups are one pass over the tag block rather than two, which on
  1000x short-read was 12.9% of the query spent proving absence.
- **The pool is wired everywhere it can be.** `BamAdapter` plus all nine
  `TabixIndexedFile` sites. The remaining `@gmod/bgzf-filehandle` imports in
  core and `plugins/maf` are whole-file `unzip`, which has no blocks to spread.
- **`seq` is decoded twice per read in the modification color modes, and the
  obvious fix does not pay.** `extractModifications` reads it for
  `getModPositions`, `computeReadBaseCounts` reads it for the base pileup, and
  `BamRecord.seq` is deliberately not memoized — records live in a shared chunk
  LRU and a 50 kb string per read is exactly what should not be pinned there.
  `benches/tagAndSeq.probe.ts` prices the second ask at **+14.9ms** per query on
  `200x.longread.mod.bam`, against 56ms of mismatch walking. Reading the base out
  of `NUMERIC_SEQ`'s nibbles instead is the obvious answer and measures at
  **parity** — see the `+packedSEQ` arm in `benches/readBaseCounts.bench.ts` and
  the REJECTED_IDEAS entry. What is left is sharing the one decoded string
  between the two consumers, which is a worker-pipeline change rather than a
  library one: they are in different phases of `executeRenderAlignmentData`.
- **Cancellation reaches the socket.** `withStopTokenSignal` on the chunk reads,
  refcounted aborts in `RemoteFileWithRangeCache` so one reader giving up does
  not cancel a fetch another still wants, and shared-read semantics on the
  header and index parses so an owner's abort is not reported to bystanders.
  The reference fetch was the one read on the path going without opts, fixed in
  `e047e551cc`.
