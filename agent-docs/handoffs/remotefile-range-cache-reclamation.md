---
name: remotefile-range-cache-reclamation
description: RemoteFileWithRangeCache holds up to 256 MB of raw file bytes per module instance — main thread plus every RPC worker — and never reclaims on idle, which as of b4a353c163 makes it the only layer in the fetch stack without idle reclamation. What it holds, why its existing clearCache() is not a naive clear and must not be reimplemented, the three candidate designs and the worker-reachability problem that kills the obvious one, and the harness to measure with. Read before touching packages/core/src/util/io/RemoteFileWithRangeCache.ts.
---

# RemoteFileWithRangeCache never gives memory back

This came out of a memory-leak audit of BAM/CRAM/GFF/VCF retention. The root
finding of that audit — data adapters were never freed — is fixed in
`b4a353c163`. This file is the largest thing that audit did **not** fix.

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

And since `b4a353c163` the adapters that own those caches are themselves
evicted when the last track using them closes. So closing every track now
reclaims the parsed layer and leaves the raw layer sitting at its high-water
mark. This is the last floor.

## `clearCache()` already exists — do not reimplement it

`:87`. It is exported, and its **only caller is
`products/jbrowse-web/src/tests/util.tsx`**. It is not a naive `cache.clear()`
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
   place at the right moment. The open question is whether the URLs are
   reachable from there: the cache is keyed by URL, and an adapter knows its
   `FileLocation`s, but nothing currently connects the two. Worth a look before
   dismissing; it is the only option that reclaims on close rather than on a
   timer.

1 and 2 are complementary, not alternatives.

## Measure it — the harness exists

`products/jbrowse-web/browser-tests/memstress.ts`. Do not build a new one. It:

- drives volvox with randomized scrolling/zooming and **random open/close of
  BAM, CRAM and BigWig tracks** — exactly this workload
- forces GC on the main thread **and every RPC worker**, then reports the
  post-GC heap **floor** (a rising floor across rounds is a real leak; transient
  garbage collects away)
- takes `SEED=n` for a reproducible action stream, `ROUNDS=n`, `HEADLESS=0`
- already simulates the full tab-away lifecycle
  (`visibilityTransition`, `:83`) — so the option-1 design can be measured
  without new scaffolding

Run it against `b4a353c163` first to establish the post-adapter-free floor. That
number is also the outstanding validation of that commit: it proved the cache
key is deleted and a fresh adapter is constructed afterwards, but **never
measured that a heap actually shrinks.** If you are here anyway, that
measurement is cheap to take at the same time and worth reporting either way.

## Caveats on everything above

The retention numbers are the file's own documented bounds and my reading of the
code, not measurements I took. The audit was static. Treat `256 MB × workers` as
a ceiling to confirm, not a figure to quote.

## Also still open, unrelated to this file

Adapters claimed by session ids that no track owns are never released, because
the refcount in `b4a353c163` is driven by track models: `loadRefNameMap.ts:42`
and a literal `'MafSequenceWidget'` in `MafSequenceWidget.tsx:68`. These want
their own lifecycle — the assembly's sequence adapter *should* outlive any
track — rather than being swept. Small compared to this file.
