---
status: Accepted
summary: "RemoteFileWithRangeCache sweeps on idle rather than never, at fifteen minutes rather than the parsed caches' three, because it is the cheap layer and the one that still helps after they have expired; its 256 MB stays, because the workload that made it look oversized never pushed the layer above it past its own budget"
---

# ADR-059: The raw chunk cache is the long-tail layer

## Status

Accepted (2026-08). Measured, and both measurements are re-runnable:
`products/jbrowse-web/browser-tests/rangecache-probe.ts` (what is retained) and
`rangecache-budget.ts` (what the retention buys). Both need a hand-assembled
`test_data/jb2bench_link`; see the `mem_config.json` there.

## Context

`RemoteFileWithRangeCache` (`@gmod/range-cache-filehandle`, re-exported from
`packages/core/src/util/io/`) caches raw byte ranges in 256 KB chunks,
module-level, capped by entry count — so the main thread and every RPC worker
hold their own. Above it, every indexed format's library keeps a
second cache of *parsed* results: `@gmod/bam`, `@gmod/cram` and `@gmod/tabix` all
take a `cacheIdleTimeoutMs` and sweep themselves after three minutes.

This layer had no idle reclamation at all. Closing a track did not lower it,
`b4a353c163`'s adapter eviction did not lower it, and neither did hiding the tab.
One `AlignmentsTrack` on a 105 MB BAM, panned across twenty 12 kb windows of a
250 kb contig, left **400 chunks — 100.0 MB against 102.8 MB fetched** resident in
its worker, and they were still there after the track closed and after four
minutes idle. Times a worker pool, that was the last permanent floor in the fetch
stack.

Two facts shaped what to do about it rather than just adding a three-minute sweep
to match the neighbours.

**The parsed caches absorb everything while they are alive.** Panning twelve
windows and then panning back issues **zero requests and zero bytes** on the
second pass: a region `@gmod/bam` has already parsed never reaches this
filehandle. So while the layer above is holding, this one contributes nothing.

**It is roughly an order of magnitude cheaper.** The same pan that this layer
holds as 73.5 MB of compressed bytes dominates a worker heap snapshot at over a
gigabyte in parsed form. Per unit of genomic coverage, raw bytes are the cheapest
thing in the stack to keep.

Put together: this cache's distinct value is entirely in the window *after* the
parsed caches give up — and it was configured to expire at the same moment they
did, which is the one moment it stops being redundant and starts being the only
thing between a re-read and the network.

## Decision

**Sweep per entry on idle, at fifteen minutes — longer than the layers above,
not equal to them. Keep the 256 MB cap.**

The sweep mirrors `@gmod/shared-read-cache`'s lifecycle: a `lastTouched` per
entry, an interval at a quarter of the timeout, `unref`'d where that exists,
started by the first insert and stopped by the sweep that empties the cache.

It runs on an interval rather than lazily inside `getCached` because reclamation
that only happens on access never fires for precisely the reader who has walked
away — the same reason `lru-cache` needs `ttlAutopurge` on top of a TTL. Chrome's
intensive throttling of hidden pages does not blunt it where it matters: worker
timers are not throttled, and the workers hold the bytes.

`sweepIdleCache` is deliberately **narrower than `clearCache`**, and this is the
part most likely to be "fixed" wrongly later. It clears `cache` and nothing else.
`inFlight` entries and `queue` waiters are by definition active; `sizeCache` is
one number per URL that costs a round trip to re-derive. Evicting under a live
read is already safe by construction, because `getCachedRange` captures every
chunk it will assemble from into a local map before its first await — that was
true before this ADR and is what makes a sweep a two-line function instead of a
coordination problem. Neither function is exported from `util/io`'s plugin-facing
ABI; the sweep drives itself.

## Consequences

Measured on the same workload, before and after: **400 chunks / 100.0 MB retained
becomes 0**, and the worker's heap snapshot after close-and-idle falls from
214.7 MB to 115.8 MB. Every earlier row is unchanged — 400 chunks at the peak,
still 400 immediately after the close — so nothing is refetched during use and
only the resting floor returns.

The cost is a re-download for a reader who comes back after the timeout, and it
is not small. Panning twelve windows, then idling four minutes, then panning the
same twelve again:

| timeout | cold forward | warm reverse | forward after 4 min idle |
| --- | --- | --- | --- |
| 3 min | 73.5 MB / 25 req | 0.0 MB / 0 req | **73.5 MB / 23 req** |
| 15 min | 73.5 MB / 25 req | 0.0 MB / 0 req | **0.0 MB / 0 req** |

Fifteen minutes is what makes the ordinary step-away a re-parse rather than a
re-download, at no cost to either of the other columns. It is a fifth of an hour
of holding, against the *forever* this replaced.

### Why the 256 MB cap stays

On the twelve-window workload, cutting `MAX_CACHE_ENTRIES` from 1000 to 4 — 256 MB
to 1 MB — cost **one extra range request and 1.3 MB** on a full cold pan, and
nothing at all on the revisit. That reads like an argument to shrink it, and it is
not, because of the regime it was taken in: `@gmod/bam`'s parsed cache has a 1 GB
budget and never evicted during that run, which is exactly why the revisit was
free. On the data this browser is pointed at it does evict — a single 1000x track
panned across a 250 kb contig already peaks past that gigabyte — and from then on
a re-read falls through to here with nothing else behind it.

So the measurement does not say the cap is too big. It says the workload never
left the regime where the cap is irrelevant. Shrinking it would trade nothing
measurable for a cliff on exactly the large data this cache exists for.

Not measured: bigwig, whose `@gmod/bbi` layer caches differently. The BAM numbers
above should not be generalized to it.

### What was rejected

**Merging this layer with `@gmod/bam`'s.** The zero-request revisit is the parsed
cache doing its job correctly, not redundancy to collapse. The two key on
different things (byte offsets vs bgzf chunk identity) and size in different units
(entries of compressed bytes vs decompressed bytes), `@gmod/bam` has consumers
outside jbrowse, and this module is not BAM-specific — CRAM, tabix, bigwig, 2bit
and every plain fetch sit on it.

**Broadcasting a sweep to every worker on `visibilitychange`.** A worker has no
`document`, so a tab-hidden sweep has to be pushed; the seam exists
(`RpcServer.handler` already picks an out-of-band `stopToken` frame out of the
message stream, and `registerStopTokenBroadcaster` is the main-thread half). It
was worth building when this cache held 256 MB per worker *permanently*. Against a
working idle sweep it buys releasing that memory somewhat earlier, for a second
reclamation path to keep correct. Reconsider only if the idle sweep proves
insufficient in practice.

**Per-URL eviction when an adapter is freed.** The URLs are reachable —
`freeAdapterResources` holds each entry's `dataAdapter`, whose config walks to its
`FileLocation`s — but the cache is keyed by URL while the adapter refcount is keyed
by adapter config, and those are not the same partition. Two tracks on one BAM, or
a shared sequence adapter, would mean one track closing evicts chunks another live
adapter is still reading. Correctness needs a second refcount at URL granularity,
for reclamation the sweep already performs.

## Re-running the measurements

Both probes read `test_data/jb2bench_link/mem_config.json`, and that directory is
gitignored — hundreds of MB of BAM/CRAM, generated rather than downloaded. The
setup lives here rather than in a README inside it, because a README inside an
ignored directory is only readable by someone who already has the directory.

Hard-link (don't symlink — `serve-handler` 404s a symlinked file) from a
[jb2bench](https://github.com/cmdcolin/jb2bench) data directory:

```
mkdir -p test_data/jb2bench_link && cd test_data/jb2bench_link
for f in hg19mod.fa hg19mod.fa.fai 1000x.shortread.bam 1000x.shortread.bam.bai \
         1000x.longread.bam 1000x.longread.bam.bai; do ln ../../../jb2bench/data/$f .; done
```

Then a `mem_config.json` beside them with an `hg19mod` assembly
(`IndexedFastaAdapter` over that fa/fai — one contig, `chr22_mask`, 250001 bp) and
an `AlignmentsTrack` per BAM whose `BamAdapter` carries
`"fetchSizeLimit": 20000000`, so a 12 kb window of 1000x coverage loads instead of
banner-ing. Build `products/jbrowse-web` first; the probes serve `build/`.

`rangecache-probe.ts` answers what is retained (`IDLE_MINUTES` must exceed the
timeout plus a sweep interval, hence its default of 19). `rangecache-budget.ts`
answers what the retention buys, and takes `LABEL` so two runs against two builds
can be told apart.

## A trap for anyone measuring this again

`Runtime.getHeapUsage` — what `memstress.ts` reports as its floor — **does not
count external ArrayBuffers**, which is where 256 KB chunks live. In the run
above it reported 7.3 MB for a worker holding 214.7 MB. Only a heap snapshot sees
this layer. `memstress` is also pointed at volvox, a few MB of data end to end, so
even a correct instrument would find nothing there. Use the two probes named at
the top; both stream the snapshot rather than `JSON.parse`-ing it, because a
300 MB heap serializes past V8's maximum string length.

Related: `b4a353c163` freed the adapters that own the parsed caches, and the
comment in `dataAdapterCache.ts` explains why deleting that key does not collect
them promptly — `SharedReadCache`'s sweep interval is a GC root, so an evicted
`BamFile` stays reachable through its own timer for three minutes. That is why
closing a track appears to reclaim nothing.
