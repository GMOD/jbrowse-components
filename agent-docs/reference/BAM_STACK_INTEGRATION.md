---
name: bam-stack-integration
description: The vertical audit of BamAdapter x @gmod/bam x @gmod/bgzf-filehandle — every lever the two libraries expose, whether the adapter reaches it, the four non-integrations that are deliberate, and the three seams that remain. Read before adding a BAM read-path optimization, so you extend the stack rather than duplicate a layer of it.
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
| `destroySharedWorkerPool` | bgzf | **no** | **gap — see seam 1** |

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
~997 MB down to 7 MB after GC). Nothing calls `destroySharedWorkerPool`, so
those heaps outlive the last bgzip track.

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

- Sharing one pool trades 20 inflate workers for 4. That is right when one
  track is loading and wrong when five are, which is exactly when a reader
  notices. The right shape is probably one shared pool sized to
  `hardwareConcurrency`, but 4 is the library's default and has never been
  measured above it.
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

## Seam 3 — the reference fetch is serial, and its span is knowable up front

`getFeatures` awaits the whole of `getRecordsForRange` before it can call
`seqFetchSpan`, and only then issues the sequence read. On a BAM whose reads
carry no MD — minimap2 and bwa both leave it off unless asked, so most long-read
data — every query pays the two round trips end to end.

The span does not need the records. `seqFetchSpan` clamps its answer to
`[regionStart, regionEnd)`, so the queried region is already an upper bound on
what it can return, and `PackedReference` carries its own `start` — a reference
packed for the whole region locates any read in itself, and the walk windows to
the viewport regardless. So the fetch could be issued concurrently with
`getRecordsForRange` and the records used only to decide whether to *use* it.

The cost of doing that unconditionally is a wasted sequence fetch on every BAM
that does carry MD. The cheap guard is that MD-ness is a property of the file
rather than of the query — one query's answer predicts the next one's — so a
sticky per-adapter flag set the first time `seqFetchSpan` returns non-null gets
the win on the files that need it and costs nothing on the files that do not.

Not built, and not measured. The thing to measure is the sequence read's share
of a cold MD-less query, against a `RemoteFileWithRangeCache` that may already
be serving it from a chunk the reference sequence track pulled in.

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
- **Cancellation reaches the socket.** `withStopTokenSignal` on the chunk reads,
  refcounted aborts in `RemoteFileWithRangeCache` so one reader giving up does
  not cancel a fetch another still wants, and shared-read semantics on the
  header and index parses so an owner's abort is not reported to bystanders.
  The reference fetch was the one read on the path going without opts, fixed in
  `e047e551cc`.
