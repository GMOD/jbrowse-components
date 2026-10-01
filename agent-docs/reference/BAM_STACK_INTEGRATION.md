---
name: bam-stack-integration
description: The vertical audit of BamAdapter x @gmod/bam x @gmod/bgzf-filehandle — every lever, whether the adapter reaches it, the deliberate non-integrations, and the profile showing inflate dominates. Read before adding a BAM read-path optimization.
audience: internal
kind: measurement
---

# The BAM stack, layer by layer

Three repos serve one BAM query, and each is optimized against its own
measurements. This doc audits the joins between them: what each layer offers,
what the layer above takes, and where an optimization stops short of the
consumer that would pay for it. Most apparent gaps already exist one layer down
under another name, and two apparent oversights are load-bearing.

```
plugins/alignments  BamAdapter -> BamSlightlyLazyFeature (recordClass)
        |           records are SHARED across queries; bindings go on a view
@gmod/bam           BamFile.getRecordsForRange
        |           index -> chunks -> optimizeChunks -> per-chunk SharedReadCache
@gmod/bgzf-filehandle  unzipChunkSlice(bytes, chunk, pool)
        |
@gmod/range-cache-filehandle  256 KiB chunk LRU, in-flight dedup, refcounted aborts
```

Four caches stack, each bounded in its own unit: compressed chunks in the range
cache, parsed records per merged BAM chunk, the parsed index and header, and the
sequence adapter's own reads. None is redundant — a `FastaAdapterBase` comment
records the one time a fifth was added and measured a loss.

## Where a query's time goes

`benches/readPath.profile.ts` drives the shipped path (`getRecordsForRange` with
`recordClass`, `extractFeatureArrays`, then the per-read array builders) so
`--cpu-prof` splits fetch, extract and arrays. BGZF inflate is the largest line
on short-read and long-read data alike; the per-read pass is a minority of a
query. Two consequences for sizing:

- The per-read arrays and tag walks are a few percent of a query. Seam 7 says
  the same from the network side.
- Long-read windows hold hundreds of reads, not the 50,000 spliced reads seam 5
  was swept on, so seam 5's shape finding stands but its weight does not
  transfer to an interactive pileup.

Node benches see the serial floor: `getSharedWorkerPool()` returns `undefined`
under node, so no bench in the three repos sees the inflate pool. In a browser
the pool makes redundant inflate cheaper without making it less redundant,
which is seam 2.

## What the adapter wires

Check any "we should pass X" against this table.

| Lever | Layer | Wired | Where / why not |
| --- | --- | --- | --- |
| `recordClass` | bam | yes | `BamSlightlyLazyFeature`, ADR-049 |
| `cacheBudget` | bam | yes | `decompressedBytesBudget`, ADR-064 |
| `bgzfWorkerPool` | bam | yes | `sharedBgzfWorkerPool()` |
| `onProgress`, `signal` | bam | yes | `downloadStatus` on both phases; signal forwarded |
| `estimatedBytesForRegions` | bam | yes | `getRegionByteSize`, byte gate |
| `packReference`, `forEachMismatchNumeric` | bam | yes | once per fetch; both feature classes |
| `getTagAlt` | bam | yes | duck-typed by modifications-utils |
| `maxCacheBytes` | bam | no | superseded by the shared budget |
| `cacheIdleTimeoutMs` | bam | no | library default is the intent |
| `fetchReferenceSequence` | bam | **no** | deliberate |
| `viewAsPairs` / `pairAcrossChr` | bam | **no** | deliberate |
| `renameRefSeqs` | bam | no | aliasing is resolved above the adapter |
| `getMismatches` | bam | no | allocating form; the walk is used |
| `unzipChunkSlice`, `getSharedWorkerPool` | bgzf | yes | via `@gmod/bam`; `packages/core/src/util/bgzfWorkerPool.ts` |
| `BgzfWorkerPoolHost` / `Client` | bgzf | **no** | gap, seam 1 |

## The deliberate non-integrations

Do not "fix" these.

- **`fetchReferenceSequence` / `setReference`.** `setReference` needs a region
  covering the whole read (`@gmod/bam` ADR 0020) because records are shared
  between queries (ADR 0006). `BamAdapter` uses `seqFetchSpan` + `packReference`
  + `withRegionRef`, clamped to the viewport so a chromosome-length read does not
  drag a chromosome of sequence in. A clamped region is what `setReference`
  throws on. `regionRefAliasing.test.ts` pins the `RegionBoundBamFeature` view.
- **`viewAsPairs` / `pairAcrossChr`.** This repo chains in `filterChainFeatures`
  (worker) and `attachChainFields` (main thread) over reads it already has.
  `@gmod/bam` ADR 0003 rejected memoizing `get name` on the premise that
  `fetchPairs` is the only repeat caller, so that premise depends on the option
  staying unused.
- **Filtering.** Flag, name and tag filters run in `getFeatures`, not pushed
  down (`@gmod/bam` ADR 0005); the loop already visits every record.
- **`maxCacheBytes`.** Dividing it by track count is measurably worse than
  leaving the default under `cacheBudget` (ADR-064).

## Seam 1 — per-context scoping multiplies by the RPC pool

Three read-path resources are scoped per JS context, and adapters stick per
track to one of `clamp(hardwareConcurrency - 1, 1, 5)` RPC workers
(`WebWorkerRpcDriver.getWorker`, keyed on `adapterConfigCacheKey`). Each
multiplies by the number of workers a session spreads tracks over, not by track
count. `browser-tests/percontext-probe.ts` counts it on a production build.

- **The inflate pool.** `getSharedWorkerPool()` memoizes per context, so up to
  `5 x min(hardwareConcurrency, 4)` inflate workers, each with its own grow-only
  `WebAssembly.Memory`, the root cause of the transient RPC-worker peaks.
  `@gmod/bgzf-filehandle` 6.6.0 reaps idle workers after 3 minutes and respawns
  on demand; `destroy()` cannot serve, since a destroyed pool throws out of
  `decompressBlocks` and every open reader holds one.
  `BgzfWorkerPoolHost` / `Client` / `createPoolPort` (library
  `docs/worker-pool.md`) exist for this case; no symbol is used here.
- **The range cache.** `RemoteFileWithRangeCache`'s chunk map is module-global,
  so the same reference sequence downloads once per RPC worker, and the `.fai`
  once per worker plus the main thread. No session-level sequence cache exists;
  each alignments adapter builds its own sequence sub-adapter in its worker
  (`BaseAlignmentsAdapter.getSequenceAdapter`).
- **`SharedBudget` (ADR-064)** is per context on purpose, since a worker OOMs on
  its own heap.

Why neither is wired:

- The speed argument is gone. `pool-oversub-probe.ts` at 4 cores (3 RPC x 4 = 12
  inflate workers) found no arm beating the status quo, and capping the pool to
  one worker per context was slower: per-chunk parallelism is worth more than
  avoiding oversubscription. One shared pool of four is therefore not a
  regression risk.
- The remaining argument is the grow-only wasm heaps, unmeasured. JS heap
  counters cannot see wasm memory, so measure process RSS per target. Be willing
  to close the item: untidy and free is a fine end.
- `BgzfWorkerPoolClient` copies compressed input once more per chunk; unmeasured
  here.
- The port must reach an RPC worker at boot through `makeWorker` and survive
  `LazyWorker.invalidate`. The range cache needs the same channel, so build it
  once.

Measuring needs a browser. [BGZF_WORKER_POOL.md](BGZF_WORKER_POOL.md) holds the
harness and the benchmark traps; `percontext-probe.ts`'s header holds the four
that cost a run each, chiefly that jb2bench BAMs all carry MD, so the reference
is never fetched on that corpus.

## Seam 2 — the chunk cache key slides as a query pans

`@gmod/bam` keys its parsed-chunk cache on the merged chunk's virtual-offset
span, and the merge is query-dependent, so two pans over the same bytes parse
them twice. `@gmod/bam` ADR 0019 measures and parks it. The range cache absorbs
the re-download, but the pan re-inflates and re-parses, which is most of a cold
query.

`benches/panRedundancy.probe.ts` counts bytes read across a pan against the
union of the ranges, with a `LocalFile` subclass counting `read()`. Findings:

- The cache is perfect for a repeated query and collapses once the window moves
  at all. Non-overlapping windows are still redundant, so the cause is the
  merged span sliding, not a pan re-reading its overlap.
- Redundancy is highest where absolute cost is lowest and near zero on the
  deepest data. The saving lives at moderate depth (exomes, panels,
  high-coverage WGS); quote that regime, not the shallow one.
- `benches/panRedundancyCram.probe.ts` shows CRAM is near 0% on the same windows
  because `@gmod/cram` keys on a slice, fixed at write time, not on the query.
  The waste is key design, not workload. CRAM pays far more file reads, which is
  seam 7's problem on high-latency endpoints; ADR 0019's proposal (merged
  fetch unit, raw cache unit) takes the good half.
- Serving a subset chunk out of a cached superset looks like a local fix and
  silently returns duplicated reads. Read ADR 0019 before touching
  `chunkCacheKey`.

## Seam 3 — the reference fetch was serial (closed)

`getFeatures` once awaited all of `getRecordsForRange` before `seqFetchSpan`, so
a BAM without MD (most long-read data) paid two serial round trips. The span
never needed the records: `seqFetchSpan` clamps to the queried region and
`PackedReference` carries its own `start`. The read now issues beside the
alignment fetch, and the records only decide whether to use it, gated on
`needsReference`. MD-ness is a property of the file, so one answer predicts the
next and an MD-carrying BAM never opens the gate. `seqfetch-timing-probe.ts`
and `make-tiled-fixture.sh` hold the measurement.

Traps:

- `prefetched ?? this.fetchRegionSeq(…)` evaluates its right side eagerly and
  reads sequence on every BAM's first query, defeating the gate.
  `referencePrefetch.test.ts` asserts the MD case reads nothing.
- A "% of query" figure assumes the read is serial and goes negative once it
  overlaps.
- The original fixture's 255 KB reference fits in one range-cache chunk, so a
  pan issues no reference request and the first query cannot be helped. Tile
  the contig and shift a copy of each read into each tile instead.

## Seam 4 — the SA lookup never joined the MM/Mm one

`getTagAlt` exists because `getTag('MM') ?? getTag('Mm')` walked the tag block
twice on every read of a file carrying neither. `extractFeatureArrays` still
makes two per-read tag reads (`SA`, skipped for a read with no end clip, and
MM/Mm, run only when the modification layer paints or for the first
`MOD_TYPE_SAMPLE_READS`), and `_findTag` proves absence by walking every tag,
so a plain short-read BAM pays two full walks per read.

`benches/tagAndSeq.probe.ts` (one fixture per process; see
[BENCHMARKING.md](BENCHMARKING.md)) finds the two absences cost about as much
as the whole mismatch walk, so the cost is real. A fused one-pass walk wins
1.5x on the deepest fixture and nothing on the 200x one, with no explanation
for the size-dependence after five eliminations (tag layout, memory layout, JIT
tiering, heap pressure, arm warmup).

**Do not add the API on these numbers.** The saving is ~12ms on the deepest
short-read fixture, against an API every consumer carries. An explanation for
the size-dependence, or an end-to-end render measurement, would change the
verdict. A real implementation belongs inside `BamRecord`, as an argument-count
change to the shared `tagValueEnd` cursor, not a fourth walk.

Gating the `SA` read on its consumers is closed: it was built and reverted.
Linked reads and the curved connectors read `readSuppAlignments` under their own
settings, so gating on connections dropped their off-screen segments, and the
`rpcProps` entry it needs invalidates the fetch on a draw toggle. The shipped
gate is `hasEndClip`, and the clone is skipped by shipping no array when no read
in the group has an SA tag.

## Seam 5 — a tag walk rescans an MD the record already located

`tagValueEnd` scans a `Z` value byte by byte to its terminator. On long reads MD
is the whole tag block, so any lookup that does not answer before MD pays a
~9 kB scan, and two lookups pay it twice. That is why the targeted lookup
inverts against the full decode there.

`benches/gapStrand.bench.ts` sweeps MD length on a synthesised 50,000-read set
(`jb2bench/make-mdsweep.py`). Findings:

- `get('tags')` is the only form whose cost scales with MD. The shipped targeted
  form wins in seven of eight cells; its one loss needs a kilobyte-scale MD
  and no strand tag. A walk that skips MD is flat everywhere.
- Tag order is the second variable. A walk looking for XS stops at it, so XS
  ahead of MD never scans MD; a generator that puts XS right before MD shows the
  best case as the general one.
- Folding the walks into one is not the fix: the cost is the scan of MD.

The metadata to jump MD exists: `NUMERIC_MD` memoizes `getTagRaw('MD')`, a
`subarray` view, so the next tag begins at
`md.byteOffset - byteArray.byteOffset + md.length + 1` in O(1). The alignments
render path populates that memo before any lookup because `forEachMismatch`
reads it.

For an implementer:

- It is a `@gmod/bam` change: `_findTag`, `getTagAlt` and `_computeTags` share
  `tagValueEnd`, and a consumer cannot reach the cursor.
- Read `_cachedNUMERIC_MD` only when already populated. The getter calls
  `getTagRaw('MD')`, which is the walk being avoided.
- The skip costs a comparison per tag, and short tag blocks dominate, so measure
  it inside `_findTag` rather than assume the bench holds. Keep the targeted
  lookups and teach the shared cursor the skip.

The rule: a walk should never rescan a value the record has already located.

## Seam 6 — the QNAME is decoded per read, and the record could write it

`BamRecord.name` builds a string per access, deliberately unmemoized so a cached
record does not pin it. A consumer that wants every name and rarely reads one
paid for 150k strings; the plugin now builds one block
(`alignments-core/src/readNameBlock.ts`) via `BamSlightlyLazyFeature`'s
`nameLength` / `copyNameInto`, which read the record's layout off three public
getters (`byteArray`, `b0`, `read_name_length`). That copy belongs on `BamRecord`
beside `name`.

Allocation-free is the point. A `nameBytes` `subarray` view allocates per read
and measured no better than decoding every name. Upstream must not allocate per
record.

`nextRefId` is the same seam, already handled: the plugin reads the numeric
`next_refid` and resolves a name once per contig rather than running
`refIdToName` per read. The rule: a bulk consumer should ask the record to write
into its buffer rather than request a value the record must allocate. `seq` and
`qual` return views consumed immediately; a name's consumer is a concatenation,
so a view would be a temporary.

## Seam 7 — a contiguous span fetches as many requests (remote, open)

On a remote deep BAM (GIAB HG002 300x), a 100 kb window moved ~27 MB as 28 range
requests, up to 6 in flight, at roughly a fifth of one `curl` range request's
throughput. That is seconds of wall clock, against milliseconds of worker CPU,
so do not optimize worker CPU for remote heavy files until this is understood.

Not established: the measurement is one server (NCBI FTP, not S3 or CloudFront,
which often reward concurrency), from node, not a browser over HTTP/2, which
could erase the effect. Local files are unaffected.

What the probes ruled out:

- **The range cache** adds a layer's cost, not the 5x.
- **`optimizeChunks` merging** does not move wall clock when disabled.
- **Transport-level coalescing** in `RemoteFileWithRangeCache` cannot work:
  `@gmod/bam` issues about six reads concurrently and the rest sequentially, so
  the transport never sees more than six at once. Only `@gmod/bam` knows the
  whole chunk list before the first byte.
- **Raising the 5 MB span cap** is the unswept `optimizeChunks` constant. A
  pan sweep on the local 1000x fixture shows larger caps save a few reads and
  cost 2.5x bytes, 2.8x retained memory and 3.5x wall clock, because large
  merges make every pan step a different span (seam 2). The cap stays.
- **Group prefetch in `_fetchChunkFeatures`** (plan groups of adjacent chunks)
  reached 24 requests and no wall-clock gain; reverted. If anyone rebuilds it,
  test adjacency with `<=`: a chunk's `endPosition` runs a whole BGZF block past
  `maxv`, so consecutive chunks overlap and `===` finds no groups.

What the 28 requests are: seven adjacent ~3.5 MB head chunks that hold the
query's data, plus twenty-one tiny scattered chunks that hold zero records in
range. Their first-record positions step by powers of two, the BAI bin
hierarchy: `reg2bins` returns the containing bin at all six levels and every
one contributes chunks, including chunks after the query. The linear index
prunes only from below. `chunksLikelyRead` computes the upper bound and is
deliberately a forecast only, since a long read reaching into the next window
pins that window's linear-index entry low and pruning by it would drop records.

The early stop is what can catch the tail, and it is calibrated on an assumption
deep coverage breaks. `_fetchChunkFeatures` checked `isPastQuery` once over the
first `MAX_CONCURRENT_CHUNK_READS` chunks (ADR 0010 justified this because the
stop fired inside the first batch on every fixture measured). At 300x the
query's own data is seven chunks, one more than the batch, so the stop never
fired. `@gmod/bam` now re-tests with a monotone `stopIndex`: past-ness is
monotone in chunk index, so the smallest past index is a function of the chunk
list alone. A completed-prefix check does not work, because the slow chunk
blocks the prefix while other workers drain the tail. The cost is that the
overshoot (chunks a worker took before the stop landed) is bounded by pool width
rather than deterministic, which makes `cache.test.ts`'s "a repeated query reads
no more chunks" a corpus property.

Two live hypotheses remain. htslib streams sequentially through one keep-alive
connection, reading through gaps, so it makes about one request with more bytes;
JBrowse's 65000-byte gap tolerance optimizes bytes, which is backwards on a
per-stream-throttled endpoint. And concurrency against single-stream throughput
may call for a per-host concurrency cap. Both need testing against S3 and a
browser.

The range cache's chunk map is module-global, so a second filehandle in a
process inherits the first one's chunks. A benchmark showing a large win from an
unrelated change is usually this.

## Checked against a real 300x file

`benches/giab300x.bench.ts` runs the shipped array builders over HTTP range
requests against GIAB HG002 300x (novoalign, hs37d5). Three choices rest on data
properties no synthetic fixture shows:

- Virtual offsets pass 2^32 by four orders of magnitude, so `readKeys` is a
  `Float64Array`; a `Uint32Array` truncates every read id silently.
- A window sees few distinct mate references (24-27 against 207k reads), which
  supports the slot table; the synthetic fixture says 1.
- SA is absent because novoalign emits none. A BWA-MEM file would differ, so the
  claim does not generalise; the gate is on whether anything reads the array,
  which holds either way.

## Checked and already integrated

- **The byte gate uses the forecast, not the candidate set.**
  `getRegionByteSize` reaches `chunksLikelyRead` through
  `estimatedBytesForRegions`, so a 380 bp window on a deep ONT BAM is not
  reported at several times its real bytes (`@gmod/bam` ADR 0017).
- **`getTagAlt` is reached.** Both `BamSlightlyLazyFeature` and
  `RegionBoundBamFeature` carry it, so MM/Mm and ML/Ml are one pass.
- **The pool is wired where it can be.** `BamAdapter` plus six of eight
  `TabixIndexedFile` sites (`Gff3TabixAdapter` and `GtfTabixAdapter` pass none).
  The other `@gmod/bgzf-filehandle` imports are whole-file `unzip`.
- **`seq` is decoded twice per read in modification color modes, and the obvious
  fix does not pay.** `BamRecord.seq` is deliberately unmemoized because shared
  records would pin a string per read. Reading from `NUMERIC_SEQ` nibbles
  measures at parity (`+packedSEQ` arm in `benches/readBaseCounts.bench.ts`).
  What remains is sharing one decoded string between the two consumers, a
  worker-pipeline change, since they sit in different phases of
  `executeRenderAlignmentData`.
- **Cancellation reaches the socket.** The signal reaches chunk reads;
  `RemoteFileWithRangeCache` refcounts aborts so one reader giving up does not
  cancel a shared fetch; header and index parses use shared-read semantics.
