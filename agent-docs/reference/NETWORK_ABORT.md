---
name: network-abort
description: How cancellation actually reaches the socket — the two mechanisms behind one stop token, which adapters are wired and which two readers cannot be, the shared-fetch coalescing trap, and the measured bandwidth a cancel saves. Read before touching stopToken, an adapter's read path, or proposing an abort protocol.
---

# Aborting in-flight network requests

**Mechanism landed; rollout partial.**

Cancel used to interrupt **processing**, not the **socket**: the `stopToken` was
checked at await boundaries and inside sync worker loops, so on cancel we
stopped computing and discarded the result while any HTTP read already on the
wire downloaded to completion. `BaseOptions.signal` existed but was dead —
present only for structural assignability to the gmod `Options { signal? }`
interfaces.

## What landed

Cancellation is now two mechanisms behind one token, split by what a worker can
actually observe (`packages/core/src/util/stopToken.ts` header has the full
statement):

- **Await boundaries** — `stopStopToken` records the token's id locally and
  posts it to every booted worker; `RpcServer` applies it via
  `markStopTokenStopped`, and `checkStopToken` is a set lookup. Free, exact, and
  independent of the deployment. This replaced a synchronous XHR at all ~25
  one-shot check sites, and it gives `MainThreadRpcDriver` working cancellation
  for the first time (its work shares the module instance, so it needs no
  message at all; the old string path was gated on `isWebWorker()` and was a
  silent no-op there).
- **Synchronous loops** — a loop that never yields can never be told anything,
  so this needs a *synchronous* read: the SAB atomic flag where the page is
  isolated, else the throttled blob-URL sync-XHR probe. **Both retained.** The
  blob probe was briefly deleted after `cancel-bench` measured it at zero (median
  513 ms settle either way on the 2000x BAM burst) and then restored: that
  measurement was sound but scoped to the alignments path, where every loop is
  already chunked by awaits at region granularity. `getLDMatrix.ts`'s O(n²)
  Float32Array fill is the counter-example — millions of pair computations with no
  await anywhere, where the probe is the only thing that can stop the work, and
  which that bench never exercises. Re-deleting it needs a cancel measurement on
  an await-free workload.

`stopTokenSignal(stopToken)` bridges a token to an `AbortSignal` — string tokens
off the same posted id, SAB tokens off `Atomics.waitAsync` (woken by an
`Atomics.notify` added to `stopStopToken`), no polling either way. `BaseRpcDriver.call`
also now refuses to dispatch a call whose token is already stopped, which closes
the race between a stop notification and the call it means to cancel.

`withStopTokenSignal(stopToken, signal => …)` is the shape to use at a read call
— it releases the signal however the read settles. Wired through every adapter
whose reader accepts a signal:

**The signal `fetch` receives is not the one the caller passed.**
`RemoteFileWithRangeCache.fetchRange` composes it with a response deadline
(`@gmod/range-cache-filehandle`'s `RESPONSE_TIMEOUT_MS`, the thing that makes a
stalled connection an error instead of a permanent spinner), so identity with the caller's signal is not an
invariant on that path. Composing is the whole point: a deadline that *replaced*
the signal would take cancellation back off the socket, undoing everything below.

| Reader | Adapters |
| --- | --- |
| `@gmod/bam` | BAM |
| `@gmod/tabix` | GFF3-tabix, GTF-tabix (via `core/util/tabix.ts`), BED-tabix, bedGraph-tabix, VCF-tabix + split-VCF (via `shared/vcfAdapterUtils`), Plink LD, indexed PIF (via `comparative-adapters/util.ts`) |
| `@gmod/bbi` | BigWig (single + multi-region), BigBed |

**Two readers can't be wired**, and neither is our code to fix:

- `@gmod/cram` takes a signal on `IndexOpts` (the .crai read) but **not** on
  `getRecordsForRange`, so CRAM record reads have no abort seam. Needs an
  upstream change.
- `@gmod/indexedfasta` declares `signal` in its types but never forwards it —
  0 references in the built JS. Passing one would typecheck and do nothing, which
  is worse than not passing it.

Also unwired by choice: `@gmod/hic`, and the VCF *export* path (user-initiated,
not cancel-sensitive).

The shared-fetch hazard is handled at every layer, and mostly not by us:
`@gmod/tabix` and `@gmod/bbi` both route block reads through
`@gmod/abortable-promise-cache`, whose `AggregateAbortController` fires only once
**every** joined consumer has aborted — ref-counted by construction. `@gmod/bam`
retries its chunk joins on a foreign abort. Only `RemoteFileWithRangeCache`
needed the fix described below.

## Why the uid-keyed abort protocol was not needed

An earlier version of this proposal specified a `Map<uid, AbortController>` in
`RpcServer`, an `{abort: uid}` frame, `RpcClient.abort(uid)`, and driver-side
`stopToken → uid[]` bookkeeping. Broadcasting the stopped **token id** instead
of routing per call is strictly simpler and handles more: one token is commonly
in flight on several calls at once, a worker holding nothing under that id
ignores the frame, and there is no "route the abort to the same worker the call
landed on" problem to solve. `WorkerPoolRpcDriver` registers a broadcaster and
never boots a worker just to notify it.

## The coalescing trap, and where it is handled

Two layers share one fetch between logical reads, and both had to answer "one
sharer aborted, the others did not":

- `@gmod/bam` ≥7.6.0 already retries its own chunk-cache joins when the read
  they joined aborted and theirs did not (`bamFile.js` `_cachedChunkFeatures`).
  Nothing to do.
- `RemoteFileWithRangeCache` coalesces 256 KiB chunk fetches, so one sharer's
  abort must not cancel the request the others are waiting on. Its `inFlight`
  entry records the owning signal, and `joinChunk` re-issues, once, on a foreign
  abort. Covered upstream by
  `@gmod/range-cache-filehandle`'s `test/rangeCache.test.ts`
  §"RemoteFileWithRangeCache aborted-chunk sharing", five tests, verified to
  fail without the retry. Nothing in this repo tests it, which is the thing to
  know before changing the behaviour from here.

Ref-counting was not needed: a single bounded retry makes the pathological case
one duplicate 256 KiB fetch rather than a recursion whose depth depends on how
the aborts interleave.

**Don't:** make SAB / `crossOriginIsolated` a requirement (can't guarantee
COOP/COEP from a client-side/embedded library); try to send an `AbortSignal`
across `postMessage` (doesn't clone); add a synchronous probe at an *await*
boundary (pointless — the message is already there); or remove the
`stopToken` (it is still the only thing that
interrupts *synchronous* worker loops).

## How much the socket abort is actually worth (measured)

The earlier open question here guessed the wasted-bandwidth problem might be too
small to justify the work, on the reasoning that "index reads are short". That is
backwards, because **our own chunk coalescing makes each range request large**:
`RemoteFileWithRangeCache` merges a contiguous run of missing 256 KiB chunks into
one request, so a single 4 kb viewport over the 2000x BAM issues one **6.5 MiB**
range read (26 chunks).

Measured on a 4-hop pan burst over that fixture, throttled to 50 KiB/s: 6 range
requests issued, 3 aborted ~1.6 s in having transferred only ~80 KiB each. So
each cancelled navigation abandoned ~6.5 MiB that would otherwise have been
downloaded in full and discarded — **~19.5 MiB across the burst**.

The saving is `range size − (rate × time-to-cancel)`, so it shrinks on a fast
link: at 50 Mbps sustained a 6.5 MiB read completes inside a ~1 s pan interval and
there is little left in flight to cancel. But the range size is large regardless
of link speed, so on any connection slow enough for a user to out-pace a read —
which is most of them — this is real bandwidth, not a rounding error.

That number is also what justifies the `joinChunk` retry below: the coalescing
hazard exists *because* of the signal, and a 6.5 MiB-per-cancel saving pays for a
small retry path in shared I/O code.

**Open:** CRAM and IndexedFasta need upstream signal support before they can join
(above); whether to abort on *internal* `cancelFetch` (viewport change / settings
invalidate) as well as user cancel.
