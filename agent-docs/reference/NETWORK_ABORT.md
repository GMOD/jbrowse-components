---
name: network-abort
description: How cancellation reaches the socket — one AbortSignal from the caller to the reader, how it crosses the worker boundary, which adapters forward it and which two readers cannot take it, and the shared-fetch coalescing trap. Read before touching an adapter's read path.
kind: spec
---

# Aborting in-flight network requests

Cancellation is an `AbortSignal`. The caller holds an `AbortController`, passes
its `signal` in the RPC args, and the adapter hands the same shape to its
reader, so a cancelled navigation drops the read at the socket rather than
downloading a range to completion and discarding it. ADR-122 has the history
and the measurements.

## How the signal crosses the worker boundary

An `AbortSignal` is not structured-cloneable, so `BaseRpcDriver.call` strips it
from the args with the `statusCallback` and hands both to the transport:

- `MainThreadRpcDriver` puts the caller's own signal back into the args.
- `WebWorkerRpcDriver` posts the call with `abortable: true`; `RpcServer` runs
  the method under an `AbortController` of its own keyed by the call's uid, and
  `RpcClient` listens on the caller's signal and posts `{ abort: uid }` to the
  worker that took the call. The listener goes when the call settles, so an
  abort after that posts nothing.

Routing per call rather than broadcasting per token is what a signal's identity
buys: the abort goes to the one worker running the call, and a worker holding no
controller under that uid ignores the frame.

`BaseRpcDriver.call` refuses a call whose signal is already aborted, and checks
again after `serializeArguments` (the one long await on the way out, where the
refName map is resolved), so an abort landing during serialization never wakes
a worker.

## Where a worker sees the abort

- **After any await, and in any per-item callback**: `checkAbortSignal(signal)`,
  a `signal.aborted` read. `updateStatus`, `downloadStatus` and `withProgress`
  take the signal and check on both sides of their await; `createProgressReporter`
  checks it on every `report()`.
- **A loop that never awaits** never receives the abort — a posted message is a
  task, and an `await` on a settled promise only drains microtasks.
  `createProgressReporter`'s `report()` reads the signal but does not yield, so
  it does not change that.
- **A loop that can run for seconds** takes `createAbortBreakpoint(signal)` and
  yields a task every ~50 ms of wall time
  (`if (breakpoint.due()) await breakpoint.yield()`): the genotype and
  phased-genotype matrix fills, the wiggle score matrix, the GC window, and the
  dotplot and synteny position loops, whose feature count is the whole
  alignment file at whole-genome zoom.
- **A loop bounded by the byte gate or by one region's features** only checks.
  It finishes in milliseconds to a few hundred, well inside the fetch it
  follows: canvas layout, multi-row packing, alignments processing, variant
  cells, `encodeFeatures` (1M features in ~250–475 ms,
  `measurements/mark-encoding-jexl-channel.json`), the Hi-C contact pack
  (auto-resolution bounds bins to the view width) and the diagonalize passes.
  Whole-file parses (`parseLineByLine`, `paf_chain2paf`) run under
  `cachedSetup`, which withholds the signal from shared work.
- **`@gmod/hclust` takes the signal itself.** It runs its WASM work in 50 ms
  slices, yields a task between them, and frees the run on abort.

## Which readers take the signal

**The signal `fetch` receives is not the one the caller passed.**
`RemoteFileWithRangeCache.fetchRange` composes it with a response deadline
(`@gmod/range-cache-filehandle`'s `RESPONSE_TIMEOUT_MS`, the thing that makes a
stalled connection an error instead of a permanent spinner), so identity with
the caller's signal is not an invariant on that path. Composing is the whole
point: a deadline that *replaced* the signal would take cancellation back off
the socket.

| Reader | Adapters |
| --- | --- |
| `@gmod/bam` | BAM |
| `@gmod/tabix` | GFF3-tabix, GTF-tabix (via `core/util/tabix.ts`), BED-tabix, bedGraph-tabix, VCF-tabix + split-VCF (via `shared/vcfAdapterUtils`), Plink LD, indexed PIF (via `comparative-adapters/util.ts`) |
| `@gmod/bbi` | BigWig (single + multi-region), BigBed |
| `@gmod/trix` | Trix text search |
| generic-filehandle2 `read` | BgzipTaffy, BgzipMaf (the `.tai` slice) |
| `fetch` | SPARQL |

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

**Don't:** try to send an `AbortSignal` across `postMessage` (it does not
clone — the uid-keyed abort frame is how it crosses); make a loop that never
awaits rely on `checkAbortSignal` alone (the abort is a task, and only a yield
delivers it); or make cross-origin isolation a requirement of anything (an
embeddable library cannot ask that of its host page, ADR-056).

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
(above).
