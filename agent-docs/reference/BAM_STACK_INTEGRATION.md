---
name: bam-stack-integration
description: Which @gmod/bam and @gmod/bgzf-filehandle levers does BamAdapter wire, which non-integrations are deliberate, and which read-path seams were measured? Read before adding a BAM read-path optimization.
audience: internal
kind: measurement
---

# The BAM stack, layer by layer

Three repos serve one BAM query: `BamAdapter` (`plugins/alignments`), `@gmod/bam`,
`@gmod/bgzf-filehandle` over `@gmod/range-cache-filehandle`. Each is optimized
against its own measurements, and most apparent gaps between them already exist
one layer down under another name. BGZF inflate is the largest line of a query;
the per-read arrays and tag walks are a few percent. `benches/readPath.profile.ts`
splits fetch, extract and arrays under `--cpu-prof`. Node benches see the serial
floor, since `getSharedWorkerPool()` returns `undefined` under node.

## What the adapter wires

Check any "we should pass X" against this table.

| Lever | Wired | Where / why not |
| --- | --- | --- |
| `recordClass` | yes | `BamSlightlyLazyFeature`, ADR-049 |
| `cacheBudget` | yes | `decompressedBytesBudget`, ADR-064 |
| `bgzfWorkerPool` | yes | `sharedBgzfWorkerPool()` |
| `estimatedBytesForRegions` | yes | `getRegionByteSize`, byte gate |
| `packReference`, `forEachMismatchNumeric`, `getTagAlt` | yes | both feature classes |
| `maxCacheBytes`, `cacheIdleTimeoutMs` | no | the shared budget and library default are the intent |
| `fetchReferenceSequence`, `viewAsPairs` / `pairAcrossChr` | **no** | deliberate, below |
| `BgzfWorkerPoolHost` / `Client` | **no** | gap, seam 1 |

## The deliberate non-integrations

Do not "fix" these.

- **`fetchReferenceSequence` / `setReference`.** `setReference` needs a region
  covering the whole read (`@gmod/bam` ADR 0020) because records are shared
  between queries (ADR 0006). `BamAdapter` uses `seqFetchSpan` + `packReference`
  + `withRegionRef`, clamped to the viewport so a chromosome-length read does not
  drag a chromosome of sequence in. `regionRefAliasing.test.ts` pins the
  `RegionBoundBamFeature` view.
- **`viewAsPairs` / `pairAcrossChr`.** This repo chains in `filterChainFeatures`
  (worker) and `attachChainFields` (main thread). `@gmod/bam` ADR 0003 rejected
  memoizing `get name` on the premise that `fetchPairs` is the only repeat
  caller, so that premise depends on the option staying unused.
- **Filtering** runs in `getFeatures`, not pushed down (`@gmod/bam` ADR 0005).
- **`maxCacheBytes`.** Dividing it by track count measures worse than the default
  under `cacheBudget` (ADR-064).

## Seam 1 — per-context scoping multiplies by the RPC pool

Adapters stick per track to one of `clamp(hardwareConcurrency - 1, 1, 5)` RPC
workers (`WebWorkerRpcDriver.getWorker`), so per-context resources multiply by
worker count, not track count. `browser-tests/percontext-probe.ts` counts it.

- **The inflate pool** (`getSharedWorkerPool()`) is per context, each worker with
  a grow-only `WebAssembly.Memory`. `@gmod/bgzf-filehandle` reaps idle workers
  after 3 minutes. `destroy()` cannot serve: a destroyed pool throws out of
  `decompressBlocks`, and every open reader holds one. `BgzfWorkerPoolHost` /
  `Client` / `createPoolPort` exist for sharing; no symbol is used here.
- **The range cache** chunk map is module-global, so the same reference sequence
  downloads once per RPC worker. A benchmark showing a large win from an
  unrelated change is usually this.
- **`SharedBudget` (ADR-064)** is per context on purpose: a worker OOMs on its
  own heap.

Why sharing is not wired: `pool-oversub-probe.ts` found no arm beating the status
quo, and capping to one worker per context was slower, so the speed argument is
gone. The remaining argument is the wasm heaps, which JS heap counters cannot
see; measure process RSS per target, and be willing to close the item. A shared
port must reach an RPC worker at boot through `makeWorker` and survive
`LazyWorker.invalidate`. [BGZF_WORKER_POOL.md](BGZF_WORKER_POOL.md) holds the
harness and traps.

## Seam 2 — the chunk cache key slides as a query pans

`@gmod/bam` keys its parsed-chunk cache on the merged chunk's virtual-offset
span, and the merge is query-dependent, so two pans over the same bytes parse
them twice (`@gmod/bam` ADR 0019 measures and parks it). The cache is perfect
for a repeated query and collapses once the window moves at all, even for
non-overlapping windows. `benches/panRedundancy.probe.ts` counts it; quote the
moderate-depth regime, where the saving lives. CRAM is near 0% because
`@gmod/cram` keys on a slice fixed at write time.

**Serving a subset chunk out of a cached superset looks like a local fix and
silently returns duplicated reads.** Read ADR 0019 before touching
`chunkCacheKey`.

## Seam 3 — the reference fetch was serial (closed)

`getFeatures` issues the reference read beside the alignment fetch; the records
only decide whether to use it, gated on `needsReference`. Traps:

- `prefetched ?? this.fetchRegionSeq(…)` evaluates its right side eagerly and
  reads sequence on every BAM's first query, defeating the gate.
  `referencePrefetch.test.ts` asserts the MD case reads nothing.
- A "% of query" figure assumes the read is serial and goes negative once it
  overlaps.
- A reference that fits in one range-cache chunk issues no request on a pan;
  `make-tiled-fixture.sh` tiles the contig.

## Seam 4 — the SA lookup never joined the MM/Mm one

`extractFeatureArrays` makes two per-read tag reads (`SA`, MM/Mm), and `_findTag`
proves absence by walking every tag. A fused one-pass walk wins 1.5x on the
deepest fixture and nothing on the 200x one, unexplained after five eliminations
(`benches/tagAndSeq.probe.ts`).

**Do not add the API on these numbers**: the saving is ~12ms on the deepest
fixture against an API every consumer carries. A real implementation belongs
inside `BamRecord` as an argument-count change to the shared `tagValueEnd`
cursor, not a fourth walk.

Gating the `SA` read on its consumers was built and reverted: linked reads and
curved connectors read `readSuppAlignments` under their own settings, and the
`rpcProps` entry it needs invalidates the fetch on a draw toggle. The shipped
gate is `hasEndClip`.

## Seam 5 — a tag walk rescans an MD the record already located

`tagValueEnd` scans a `Z` value byte by byte, and on long reads MD is the whole
tag block, so any lookup that does not answer before MD pays the scan. The
metadata to jump MD exists (`NUMERIC_MD` memoizes `getTagRaw('MD')`), and the
render path populates it before any lookup. The fix is in `@gmod/bam`
(`_findTag`, `getTagAlt`, `_computeTags` share `tagValueEnd`):

- Read `_cachedNUMERIC_MD` only when already populated; the getter runs the walk
  being avoided.
- Measure inside `_findTag`: the skip costs a comparison per tag, and short tag
  blocks dominate. `benches/gapStrand.bench.ts` sweeps MD length.
- Folding the walks into one is not the fix.

Rule: a walk should never rescan a value the record has already located.

## Seam 6 — the QNAME is decoded per read, and the record could write it

`BamRecord.name` is deliberately unmemoized so a cached record does not pin it.
The plugin builds one block (`alignments-core/src/readNameBlock.ts`) via
`BamSlightlyLazyFeature`'s `nameLength` / `copyNameInto`, which read the layout
off public getters; that copy belongs on `BamRecord` beside `name`. A `nameBytes`
`subarray` view allocates per read and measured no better than decoding.

Rule: a bulk consumer should ask the record to write into its buffer, not request
a value the record must allocate.

## Seam 7 — a contiguous span fetches as many requests (remote, open)

On a remote deep BAM (GIAB HG002 300x), a 100 kb window moved ~27 MB as 28 range
requests at roughly a fifth of one `curl` range request's throughput: seconds of
wall clock against milliseconds of worker CPU. Do not optimize worker CPU for
remote heavy files until this is understood. One server (NCBI FTP), from node;
S3 or CloudFront over HTTP/2 may erase it.

Ruled out:

- **The range cache** and **`optimizeChunks` merging**: no wall-clock effect.
- **Transport-level coalescing** in `RemoteFileWithRangeCache`: `@gmod/bam` issues
  about six reads concurrently, so the transport never sees the chunk list.
- **Raising the 5 MB span cap**: larger caps cost 2.5x bytes, 2.8x memory and
  3.5x wall clock, because large merges make every pan step a different span
  (seam 2).
- **Group prefetch in `_fetchChunkFeatures`**: no wall-clock gain; reverted. Test
  adjacency with `<=`, since a chunk's `endPosition` runs a block past `maxv`.

The 28 requests are seven adjacent head chunks holding the data plus twenty-one
scattered chunks holding none: `reg2bins` returns the containing bin at all six
BAI levels, including chunks after the query. `chunksLikelyRead` computes the
upper bound and is deliberately a forecast only, since a long read reaching into
the next window pins that window's linear-index entry low. `@gmod/bam` re-tests
the early stop with a monotone `stopIndex`; a completed-prefix check does not
work because the slow chunk blocks the prefix.

## Checked against a real 300x file

`benches/giab300x.bench.ts` found: virtual offsets pass 2^32, so `readKeys` is a
`Float64Array` (a `Uint32Array` truncates every read id silently); a window sees
few distinct mate references, supporting the slot table; novoalign emits no SA,
so the SA claim does not generalise.

## Checked and already integrated

- **The byte gate uses the forecast, not the candidate set**
  (`@gmod/bam` ADR 0017).
- **`seq` is decoded twice per read in modification color modes, and the obvious
  fix does not pay**: reading `NUMERIC_SEQ` nibbles measures at parity. What
  remains is sharing one decoded string between consumers in different phases of
  `executeRenderAlignmentData`.
