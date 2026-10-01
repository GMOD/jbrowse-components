---
name: network-abort
description: How cancellation reaches the socket — one AbortSignal from the caller to the reader, how it crosses the worker boundary, which adapters forward it and which readers cannot take it, and the shared-fetch coalescing trap. Read before touching an adapter's read path.
kind: spec
---

# Aborting in-flight network requests

Cancellation is an `AbortSignal`. The caller holds an `AbortController`, passes
its `signal` in the RPC args, and the adapter hands the same shape to its
reader, so a cancelled navigation drops the read at the socket rather than
downloading the range and discarding it. [ADR-122](../architecture-decision-records/adr-122-cancellation-is-an-abortsignal.md)
records the decision, the stop token it replaced and the cancel-latency
measurements.

## What the socket abort saves (measured)

`RemoteFileWithRangeCache` merges a contiguous run of missing 256 KiB chunks
into one request, so a single 4 kb viewport over the 2000x BAM issues one
6.5 MiB range read. On a 4-hop pan burst throttled to 50 KiB/s, 3 of 6 range
requests aborted ~1.6 s in having transferred ~80 KiB each — ~19.5 MiB not
downloaded. The saving is `range size − (rate × time-to-cancel)`, so a fast
link saves less, but the range is large at any link speed. The same figure pays
for the `joinChunk` retry below.

## How the signal crosses the worker boundary

An `AbortSignal` does not structured-clone, so `BaseRpcDriver.call` strips it
with the `statusCallback`. `MainThreadRpcDriver` puts the caller's signal back;
`RpcClient` posts `{ abort: uid }` to the one worker running the call, and
`RpcServer` aborts the controller it keyed by that uid. `BaseRpcDriver.call`
refuses an already-aborted signal before and after `serializeArguments`, so an
abort during serialization never wakes a worker.

## Where a worker sees the abort

- **After any await, and in any per-item callback**: `checkAbortSignal(signal)`.
  `updateStatus`, `downloadStatus`, `withProgress` and `createProgressReporter`
  check for their callers.
- **A loop that never awaits never receives the abort** — the abort frame is a
  task, and awaiting a settled promise only drains microtasks.
  `createProgressReporter`'s `report()` reads the signal but does not yield.
- **A loop that can run for seconds** takes `createAbortBreakpoint(signal)`
  (`if (breakpoint.due()) await breakpoint.yield()`), which yields a task on a
  wall-clock interval. ADR-122 lists the loops of that shape.
- **A loop bounded by the byte gate or by one region's features** only checks;
  it finishes well inside the fetch it follows. Whole-file parses run under
  `cachedSetup`, which withholds the signal from shared work.
- **`@gmod/hclust` takes the signal itself**, slicing its WASM work and
  freeing the run on abort.

## Which readers take the signal

**The signal `fetch` receives is not the caller's.**
`RemoteFileWithRangeCache.fetchRange` composes it with a response deadline
(`RESPONSE_TIMEOUT_MS` in `@gmod/range-cache-filehandle`) so a stalled
connection errors instead of spinning forever. A deadline that *replaced* the
signal would take cancellation off the socket, so don't assert identity on that
path.

| Reader | Adapters |
| --- | --- |
| `@gmod/bam` | BAM |
| `@gmod/cram` (`getRecordsForRange`) | CRAM |
| `@gmod/tabix` | GFF3-tabix, GTF-tabix (via `core/util/tabix.ts`), BED-tabix, bedGraph-tabix, VCF-tabix + split-VCF (via `shared/vcfAdapterUtils`), Plink LD, indexed PIF (via `comparative-adapters/util.ts`) |
| `@gmod/bbi` | BigWig (single + multi-region), BigBed |
| `@gmod/trix` | Trix text search |
| generic-filehandle2 `read` | BgzipTaffy, BgzipMaf (the `.tai` slice) |
| `fetch` | SPARQL |

Not wired:

- `@gmod/indexedfasta` forwards a signal to the `.fai` read only; sequence reads
  take none. The fix is upstream.
- `@gmod/hic` library calls: `HicAdapter` checks the signal around them but
  does not pass it in.
- The VCF export path, by choice: it is user-initiated.

## The coalescing trap

A layer that shares one fetch between logical reads must not let one sharer's
abort cancel the request the others wait on.

- `@gmod/tabix` and `@gmod/bbi` route block reads through
  `@gmod/abortable-promise-cache`, whose `AggregateAbortController` fires only
  once every joined consumer has aborted.
- `@gmod/bam` retries its chunk-cache joins on a foreign abort
  (`_cachedChunkFeatures`).
- `RemoteFileWithRangeCache` records the owning signal on each `inFlight` chunk,
  and `joinChunk` re-issues once on a foreign abort. One bounded retry caps the
  worst case at one duplicate chunk fetch, where ref-counting would buy nothing
  more. **Only upstream tests cover the retry**
  (`@gmod/range-cache-filehandle`'s `test/rangeCache.test.ts`), so nothing in
  this repo catches a regression from here.

**Don't** send an `AbortSignal` across `postMessage`, rely on
`checkAbortSignal` alone in a loop that never awaits, or make cross-origin
isolation a requirement of anything (an embeddable library cannot ask it of its
host page, ADR-056).
