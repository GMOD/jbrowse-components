---
name: remotefile-range-cache-reclamation
description: RemoteFileWithRangeCache holds up to 256 MB of raw file bytes per module instance — main thread plus every RPC worker — and used to reclaim none of it. Measured at 100 MB retained in one worker after one alignments track was panned and closed, still there four minutes later; a 3-minute idle sweep now returns it. Why clearCache() is not what an idle sweep should call, why neither memstress nor Runtime.getHeapUsage can see this layer, and what is still open — the tab-hidden broadcast, and the measurement showing 256 MB of budget buys one range request over 1 MB because @gmod/bam's parsed cache absorbs every revisit. Read before touching packages/core/src/util/io/RemoteFileWithRangeCache.ts.
---

# RemoteFileWithRangeCache and the floor it used to keep

This came out of a memory-leak audit of BAM/CRAM/GFF/VCF retention. The root
finding of that audit — data adapters were never freed — is fixed in
`b4a353c163`. This file is the largest thing that audit did **not** fix.

**The idle sweep has landed** — `sweepIdleCache`, three minutes, matching the
convention. The retention this file describes is now measured on both sides of
it, and what is left open is the tab-hidden broadcast (option 1) and the
question underneath it in [Still open](#still-open).

## What it holds

`packages/core/src/util/io/RemoteFileWithRangeCache.ts`:

| | |
| --- | --- |
| `cache` | module-level `Map<string, CacheEntry>`, keyed `${url}:${chunkIndex}` |
| `CHUNK_SIZE` | 256 KB |
| `MAX_CACHE_ENTRIES` | 1000 |
| bound | **256 MB per module instance** |
| instances | main thread **+ each RPC worker**, each with its own module state |
| eviction | entry-count LRU, via `Map` re-insertion order in `getCached`/`putCached` |
| idle reclamation | 3 min per entry, `sweepIdleCache` — **was none** |

These are raw compressed BAM/CRAM/BGZF bytes. They used to be retained after
every track closed, which with a worker pool was N × 256 MB of floor.

**It is a well-built cache** — this was never a bug hunt. The entry count is a
*true* byte bound because `fetchRun` does `buffer.slice(...)` rather than
`subarray` specifically so that evicting a chunk actually frees. The problem was
only that nothing ever lowered it.

## Why it mattered

Every other layer of the fetch stack had already gained idle reclamation:

| library | budget | idle |
| --- | --- | --- |
| `@gmod/bam` 8.3.0 | 1 GB | 3 min |
| `@gmod/tabix` 3.6.0 | 1 GB (jbrowse passes 50 MB) | 3 min |
| `@gmod/cram` 11.3.0 | 1,000,000 records | 3 min |
| this | 256 MB | 3 min — **was never** |

And since `b4a353c163` the adapters that own those caches are themselves evicted
when the last track using them closes — though what actually returns the parsed
bytes is still each library's own 3-minute sweep, not the close (see
[Measured](#measured)). The raw layer was the one left sitting at its high-water
mark, and was the last floor.

`sizeCache` (`:47`) is also never reclaimed, but it holds one number per URL and
is not worth designing around; a sweep should keep it. Nothing else here grows
without bound — `inFlight` entries delete themselves when their chunk settles,
and `queue` drains through `runNext`.

## Measured

`products/jbrowse-web/browser-tests/rangecache-probe.ts`, one worker, one
`AlignmentsTrack` on a 105 MB BAM (`test_data/jb2bench_link`), panned across 20
non-overlapping 12 kb windows of a 250 kb contig — 102.8 MB pulled over the wire:

| after | `getHeapUsage` | snapshot total | 256 KB chunks |
| --- | --- | --- | --- |
| track open, before panning | 6.4 MB | 12.0 MB | 1 — 0.3 MB |
| panning | 295.8 MB | 1236.9 MB | 400 — **100.0 MB** |
| **closing the track** | 295.8 MB | — | — |
| tab hidden (`visibilitychange`) | 295.8 MB | — | — |
| 4 minutes idle | 7.3 MB | 214.7 MB | 400 — **100.0 MB** |

400 × 256 KB = 100.0 MB against 102.8 MB fetched: **every byte read was still
held**, and the chunk count did not move at any of the three events that might
have reclaimed it. The cache reached 400 of its 1000 entries from one track and
one pan, so the 256 MB bound is an ordinary working number, not a pathological
one. Reproduces to the decimal across runs.

With the sweep, the same run ends at **0 chunks / 0.0 MB** and a worker snapshot
of 115.8 MB rather than 214.7 MB. Every row above it is unchanged — 400 chunks
at the peak, still 400 immediately after the close — so the sweep costs nothing
during use and returns the whole floor once nobody is reading.

Three things these runs settle:

- **Closing the track reclaims nothing at the time it happens.** Not 100 MB, not
  1 MB — the worker is byte-identical before and after. What eventually falls is
  the *parsed* layer, three minutes later, and it falls to `@gmod/bam`'s own idle
  sweep rather than to `b4a353c163`. `SharedReadCache` runs that sweep on a
  `setInterval` whose callback closes over the cache, and a pending timer is a GC
  root, so dropping the `adapterCache` key leaves the BamFile reachable *through
  its own sweep timer* until the sweep empties the cache and calls `stopSweep`.
  Deleting the key is the whole reclamation only for a library that holds no
  timer. This is worth a line in `dataAdapterCache.ts`, whose comment currently
  says the instance "become[s] unreachable and [is] collected normally".
- **`memstress.ts` cannot measure this, for two independent reasons.** Its floor
  metric is `Runtime.getHeapUsage`, which does not count external ArrayBuffers —
  the row above where it reports 7.3 MB is holding 214.7 MB, 100 MB of it these
  chunks. And volvox is a few MB of data end to end, so even a correct instrument
  would have nothing to see. The 29.7 MB rising floor a 15-round `SEED=42` run
  does report is largely the worker pool growing 3 → 5 across the run, a booted
  worker being 6-9 MB here. Use the probe for this layer; the only instrument
  that sees it is a heap snapshot.
- **A tab-away sweep would still find 100 MB waiting for it**, for the three
  minutes before the idle sweep gets there. `visibilitychange` fires,
  `useTabVisibilityRerender` re-renders, and nothing else happens. That is what
  option 1 below is for.

The probe needs a `test_data/jb2bench_link` you assemble by hand (gitignored, see
`mem_config.json` there) and a built `products/jbrowse-web`. It streams the
snapshot rather than `JSON.parse`-ing it — a 300 MB heap serializes past V8's
maximum string length, which is what `memsticky.ts`'s `snapshotTotal` would hit
here.

## `clearCache()` already exists — do not reimplement it

`:87`. It is exported, and its only callers are test setup —
`products/jbrowse-web/src/tests/util.tsx:195` and
`BreakpointSplitViewInit.test.tsx:43`. It is not a naive `cache.clear()`
and three of its four jobs are load-bearing:

1. resets `sizeCache` alongside `cache` — see the comment at `:43-46` for why
   per-instance size state does not work
2. replaces `inFlight`, relying on `fetchRun`'s owner check (`:310-315`) so a
   leaked fetch settling later removes its own entry from the *new* map only if
   it is still the owner
3. **resumes queued waiters rather than dropping them** (`:99-107`) — a dropped
   resolver strands its `limitConcurrency` caller with no resolve and no reject,
   which is a hang, not a cancellation

Route any new reclamation through `clearCache()`, or through a new function in
this file that preserves all three. Do not clear the `Map` from outside.

An idle sweep, though, wants **none** of the three, and that is the point worth
carrying: it should clear `cache` and nothing else. `inFlight` entries and
`queue` waiters are by definition *active* — an idle sweep has no business
touching them — and `sizeCache` is a URL-keyed number that costs a round trip to
re-derive and nothing to keep. Clearing `cache` alone is already safe at any
moment, including mid-fetch, because `getCachedRange` holds a strong local
reference to every chunk it will assemble from (`:411-418` says why); eviction
under an await was designed for. So a sweep is a *narrower* function than
`clearCache()`, not a variant of it.

Neither it nor `sweepIdleCache` is re-exported from `util/io/index.ts` (`:187`
exports only the class). That was the deliberate answer to the export-surface
question: `util/io` is plugin-facing ABI, and nothing outside this module needs
either — the sweep drives itself, and a future broadcaster imports from the file.

## The design question, and the trap

The obvious answer is `visibilitychange` → `clearCache()`, mirroring what
`@gmod/shared-read-cache`'s `sweepIdle()` is for. **It does not work as stated**,
and this is the thing to understand before writing code:

> Most of the memory is in the workers, and **a worker has no `document`.**
> There is no `visibilitychange` there.

So a tab-hidden sweep has to be *broadcast*. Three options, roughly in order of
how much they buy:

1. **Broadcast a sweep to every booted worker.** There is already a pattern for
   exactly this: `registerStopTokenBroadcaster` / `WorkerHandle.notifyStopToken`
   (`WorkerPoolRpcDriver.ts:93,123`) pushes a message to every worker without an
   RPC round trip per worker. Cheapest correct mechanism; reuse it rather than
   inventing one.
2. **Idle sweep inside the module**, matching the 3-minute convention above.
   Self-contained, needs no plumbing, and is consistent with every other layer.
   Watch the timer: `unref` it, and stop it when the cache empties, or it will
   show up as jest's "a worker process has failed to exit gracefully".
3. **Per-URL eviction when an adapter is freed.** The most precise — the
   `CoreFreeResources` path added in `b4a353c163` already runs in the right
   place at the right moment.

**2 is done.** It was the convention every neighbouring layer already follows, it
needed no plumbing, and it is the only one that works in every realm that has the
module — worker, main thread, desktop, embedded, node — rather than only where a
driver happens to be wired up. It mirrors `SharedReadCache`'s lifecycle (3 min,
interval at a quarter of that, `unref` where it exists, start on first insert,
`stopSweep` when the sweep empties the cache), and hangs a `lastTouched` on each
entry rather than sweeping the whole map off one global timestamp — a session
polling one small file would otherwise pin all 256 MB.

One thing that made it cheaper than expected: Chrome's intensive throttling of
hidden pages does not reach the copies that matter, because worker timers are not
throttled and the workers are where the bytes are.

## Still open

**Option 1, the tab-hidden broadcast.** A sweep bounded by a timer still leaves
the full 256 MB alive for three minutes after a user tabs away, and the seam
already exists: `RpcServer.handler` (`:84-97`) picks the
`stopToken` frame out of the message stream ahead of the method lookup precisely
because it is out-of-band, and another field beside it costs a branch.
`registerStopTokenBroadcaster` / `WorkerHandle.notifyStopToken`
(`WorkerPoolRpcDriver.ts:93,123`) is the main-thread half.

Option 3 is dropped. The URLs *are* reachable — `freeAdapterResources` holds each
entry's `dataAdapter`, whose `config` walks to its `FileLocation`s — so the
question the last session left open has an answer. But the cache is keyed by URL
while the refcount is keyed by *adapter config*, and those are not the same
partition: two tracks on one BAM, or a shared sequence adapter, mean closing one
track evicts chunks another live adapter is still reading. Making it correct
needs a second refcount at URL granularity, which is more machinery than the
3-minute sweep that reclaims the same bytes anyway.

**The budget does not earn its size, and the timeout is probably too short.**
This came out of asking whether jbrowse should own the whole cache stack,
`@gmod/bam`'s included. It should not — that library has consumers outside
jbrowse, the two caches key on different things (byte offsets vs bgzf chunk
identity) and size in different units (entries of compressed bytes vs
decompressed bytes), and this module is not BAM-specific: CRAM, tabix, bigwig,
2bit and every plain fetch sit on it. But the question underneath was worth
measuring, and `rangecache-budget.ts` measures it — twelve 12 kb windows forward,
the same twelve in reverse, counting bytes on the wire per pass:

| `MAX_CACHE_ENTRIES` | A cold forward | B warm reverse | C forward, 4 min idle |
| --- | --- | --- | --- |
| 1000 (256 MB) | 73.5 MB / 25 req | **0.0 MB / 0 req** | 73.5 MB / 23 req |
| 4 (1 MB) | 74.8 MB / 26 req | **0.0 MB / 0 req** | not comparable, ran `SKIP_IDLE=1` |

Cutting this cache from 256 MB to 1 MB cost **one extra range request and 1.3 MB**
on a full cold pan, and nothing at all on the revisit. `@gmod/bam` caches parsed
features by bgzf chunk, so a re-read it has already parsed is answered upstairs
and never reaches this filehandle — column B is that, exactly. The raw layer is
left earning its keep only on index blocks and on 256 KB blocks straddling two
bgzf chunks, which is the ~2% in column A. Untested for bigwig, tabix and CRAM,
whose layers above cache differently; the BAM number should not be generalized
without re-running this against them.

Column C is the other half, and it is about the sweep rather than the budget.
73.5 MB re-downloaded after four minutes away — where before the sweep it would
have been zero, since the raw cache never expired and only re-parsing was needed.
That is the trade the 3-minute timeout makes, and three minutes is arguably the
wrong number *for this layer*: raw compressed bytes are the cheapest retention in
the stack per unit of avoided network — 73.5 MB of them covers a pan whose parsed
form dominates a worker snapshot an order of magnitude larger. So the two knobs
want to move in opposite directions, which the current code does not express:
**a smaller cap with a longer idle timeout**. A 64 MB cap held for 15-30 minutes
would cost a quarter of today's ceiling and turn "come back after ten minutes"
from a 73.5 MB re-download into a re-parse. Not done: it changes shipped
behaviour on a judgement about memory against re-download, and wants the bigwig
and CRAM numbers first.

## Also still open, unrelated to this file

Adapters claimed by session ids that no track owns are never released, because
the refcount in `b4a353c163` is driven by track models: `loadRefNameMap.ts:42`
and a literal `'MafSequenceWidget'` in `MafSequenceWidget.tsx:68`. These want
their own lifecycle — the assembly's sequence adapter *should* outlive any
track — rather than being swept. Small compared to this file.
