---
name: remotefile-range-cache-reclamation
description: RemoteFileWithRangeCache holds up to 256 MB of raw file bytes per module instance — main thread plus every RPC worker — and never reclaims on idle, which as of b4a353c163 makes it the only layer in the fetch stack without idle reclamation. Now measured: 100 MB retained in one worker after one track was panned and closed, and still there four minutes later. What it holds, why its existing clearCache() is not a naive clear and must not be reimplemented, the three candidate designs, and why neither memstress nor Runtime.getHeapUsage can see this layer. Read before touching packages/core/src/util/io/RemoteFileWithRangeCache.ts.
---

# RemoteFileWithRangeCache never gives memory back

This came out of a memory-leak audit of BAM/CRAM/GFF/VCF retention. The root
finding of that audit — data adapters were never freed — is fixed in
`b4a353c163`. This file is the largest thing that audit did **not** fix.

The retention below is no longer inferred from the code. It was measured on
2026-08-06 against `79080af254`; see [Measured](#measured), which supersedes the
old caveat that these were the file's own documented bounds rather than
observations.

## What it holds

`packages/core/src/util/io/RemoteFileWithRangeCache.ts`:

| | |
| --- | --- |
| `cache` (`:42`) | module-level `Map<string, Uint8Array>`, keyed `${url}:${chunkIndex}` |
| `CHUNK_SIZE` | 256 KB |
| `MAX_CACHE_ENTRIES` | 1000 |
| bound | **256 MB per module instance** |
| instances | main thread **+ each RPC worker**, each with its own module state |
| eviction | entry-count LRU, via `Map` re-insertion order in `getCached`/`putCached` |
| idle reclamation | **none** |

These are raw compressed BAM/CRAM/BGZF bytes, and they are retained after every
track is closed. With a worker pool that is N × 256 MB of floor.

**It is a well-built cache** — this is not a bug hunt. The entry count is a
*true* byte bound because `fetchRun` does `buffer.slice(...)` rather than
`subarray` specifically so that evicting a chunk actually frees (`:299-301`
says so). The problem is only that nothing ever lowers it.

## Why it matters more now than it did

Every other layer of the fetch stack gained idle reclamation:

| library | budget | idle |
| --- | --- | --- |
| `@gmod/bam` 8.3.0 | 1 GB | 3 min |
| `@gmod/tabix` 3.6.0 | 1 GB (jbrowse passes 50 MB) | 3 min |
| `@gmod/cram` 11.3.0 | 1,000,000 records | 3 min |
| this | 256 MB | **never** |

And since `b4a353c163` the adapters that own those caches are themselves evicted
when the last track using them closes — though what actually returns the parsed
bytes is still each library's own 3-minute sweep, not the close (see
[Measured](#measured)). Either way the raw layer is left sitting at its
high-water mark. This is the last floor.

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

400 × 256 KB = 100.0 MB against 102.8 MB fetched: **every byte read is still
held**, and the chunk count does not move at any of the three events that might
have reclaimed it. The cache reached 400 of its 1000 entries from one track and
one pan, so the 256 MB bound is an ordinary working number, not a pathological
one. Reproduces to the decimal across runs.

Three things this run settles that the sections below were guessing at:

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
- **The tab-away sweep would have found 100 MB waiting for it.** `visibilitychange`
  fires, `useTabVisibilityRerender` re-renders, and nothing else happens.

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

Note it is **not** re-exported from `util/io/index.ts` (`:187` exports only the
class). Deciding that export surface is part of the job.

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

**Do 2.** It is the convention every neighbouring layer already follows, it needs
no plumbing, and it is the only one that works in every realm that has the module
— worker, main thread, desktop, embedded, node — rather than only where a driver
happens to be wired up. Mirror `SharedReadCache`'s lifecycle exactly (3 min,
interval at a quarter of that, `unref` where it exists, start on first insert,
`stopSweep` when the sweep empties the cache) so the two behave alike under the
same workload, and hang a `lastTouched` on each entry rather than sweeping the
whole map off one global timestamp — a session polling one small file would
otherwise pin all 256 MB. That is a `Map<string, {bytes, lastTouched}>`, which
touches `getCached`/`putCached` and nothing else.

Then add 1 on top; the two are complementary, not alternatives. A sweep bounded
by a timer still leaves the full 256 MB alive for three minutes after a user
tabs away, and the seam already exists: `RpcServer.handler` (`:84-97`) picks the
`stopToken` frame out of the message stream ahead of the method lookup precisely
because it is out-of-band, and another field beside it costs a branch.
`registerStopTokenBroadcaster` / `WorkerHandle.notifyStopToken`
(`WorkerPoolRpcDriver.ts:93,123`) is the main-thread half.

Option 3 is the one to drop. The URLs *are* reachable — `freeAdapterResources`
holds each entry's `dataAdapter`, whose `config` walks to its `FileLocation`s —
so the question the last session left open has an answer. But the cache is keyed
by URL while the refcount is keyed by *adapter config*, and those are not the
same partition: two tracks on one BAM, or a shared sequence adapter, mean closing
one track evicts chunks another live adapter is still reading. Making it correct
needs a second refcount at URL granularity, which is more machinery than the
3-minute sweep that would have reclaimed the same bytes anyway.

## Also still open, unrelated to this file

Adapters claimed by session ids that no track owns are never released, because
the refcount in `b4a353c163` is driven by track models: `loadRefNameMap.ts:42`
and a literal `'MafSequenceWidget'` in `MafSequenceWidget.tsx:68`. These want
their own lifecycle — the assembly's sequence adapter *should* outlive any
track — rather than being swept. Small compared to this file.
