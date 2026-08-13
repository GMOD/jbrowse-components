---
name: bam-stack-integration
description: The vertical audit of BamAdapter x @gmod/bam x @gmod/bgzf-filehandle — every lever the two libraries expose, whether the adapter reaches it, the four non-integrations that are deliberate, and the four seams that remain. Read before adding a BAM read-path optimization, so you extend the stack rather than duplicate a layer of it. CRAM_STACK_INTEGRATION.md is the companion for the other format.
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
packages/core       RemoteFileWithRangeCache / CachedFilehandle
                    256 KiB chunk LRU, in-flight dedup, refcounted aborts
```

Four caches stack, each bounded in its own unit and each with a documented
reason to exist at that level: 256 KiB compressed chunks in core, decompressed
+ parsed records per merged BAM chunk in `@gmod/bam`, the parsed index and
header as one-entry shared reads, and the sequence adapter's own reads at the
bottom of the reference fetch. Nothing between them is redundant — a
`FastaAdapterBase` comment records the one time a fifth was added and measured
a loss.

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
  multiplication to its worst case — 4 cores under `taskset`, 12 inflate
  workers, ~4x oversubscribed — and no arm beat the status quo; cutting the
  inflate workers to 3 was slower in every batch. Per-chunk parallelism is worth
  more than avoiding oversubscription. The remaining argument is the 20
  grow-only wasm heaps, which is unmeasured and which JS heap counters cannot
  see. Weigh that before building the channel, and be willing to close the item
  instead: untidy and free is a fine place for this to end.
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
them and the other is the same shape. `benches/tagAndSeq.probe.ts` sizes it
against the mismatch walk, which is the work that actually renders the pileup;
min of 25 rotated rounds, control 0.94-1.03x:

| fixture | reads | SA | MM/Mm | both | fused | mismatch walk |
| --- | --: | --: | --: | --: | --: | --: |
| 1000x.shortread | 153,677 | 18.5ms | 21.0ms | 36.1ms | 23.1ms | 41.3ms |
| 200x.shortread | 31,133 | 3.6ms | 4.2ms | 7.5ms | 10.1ms | 8.5ms |
| 200x.longread | 335 | 2.5ms | 2.6ms | 4.7ms | 3.0ms | 55.7ms |
| 200x.longread.mod | 335 | 3.3ms | 3.5ms | 6.9ms | 3.6ms | 56.1ms |

**Read the short-read row.** Proving two absences costs 36.1ms against 41.3ms of
mismatch walking — 87% of the render work, to answer nothing. A single pass
matching three names is 1.57x better there, and 1.55-1.91x on long reads where
the absolute numbers are small. `fused` is a hand-rolled three-name walk in the
probe, not an API: what it would take is an N-name lookup in `@gmod/bam`
alongside `getTagAlt`, and the probe exists to decide whether that is worth
adding.

Two cautions before building it. The 200x short-read row went the **wrong way**
(0.75x) and reproduced, while the 1000x row of the same data shape went 1.57x —
so the win is not uniform in read count and wants explaining before it is
claimed. And the fused walk in the probe reaches private fields; a real
implementation lives inside `BamRecord`, where `tagValueEnd` is already the
shared cursor `_findTag`, `getTagAlt` and `_computeTags` walk with, so it should
be an argument-count change rather than a fourth copy of the walk.

The consumer-side alternative is to stop reading `SA` unconditionally — it feeds
`readSuppAlignments`, which only the arc overlay reads. That means a new
`rpcProps` entry, which invalidates the fetch when it toggles, so it is a worse
trade than it looks; noted so the next reader does not have to rediscover why.

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
