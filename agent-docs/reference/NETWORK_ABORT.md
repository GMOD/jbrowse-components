---
name: network-abort
description: How cancellation reaches the socket — one AbortSignal from the caller to the reader, how it crosses the worker boundary, which readers cannot take it, and the shared-fetch coalescing trap. Read before touching an adapter's read path.
kind: spec
---

# Aborting in-flight network requests

Cancellation is an `AbortSignal`: the caller's `AbortController` signal rides the RPC args
and the adapter hands it to its reader, so a cancelled navigation drops the read at the
socket. [ADR-122](../architecture-decision-records/adr-122-cancellation-is-an-abortsignal.md)
records the decision, the stop token it replaced and the cancel-latency measurements.
`RemoteFileWithRangeCache` merges a run of neighbouring 256 KiB chunks into one large range
request, so the socket abort saves most of a big range at any link speed.

## Crossing the worker boundary

An `AbortSignal` does not structured-clone, so `BaseRpcDriver.call` strips it.
`MainThreadRpcDriver` restores it; `RpcClient` posts `{ abort: uid }` to the worker running
the call and `RpcServer` aborts the controller keyed by that uid. `BaseRpcDriver.call`
refuses an already-aborted signal before and after `serializeArguments`.

## Where a worker sees the abort

- After any await and in any per-item callback: `checkAbortSignal(signal)`.
- **A loop that never awaits never receives the abort.** The abort frame is a task, and
  awaiting a settled promise only drains microtasks. `createProgressReporter`'s `report()`
  reads the signal but does not yield.
- A loop that can run for seconds takes `createAbortBreakpoint(signal)`
  (`if (breakpoint.due()) await breakpoint.yield()`). ADR-122 lists the loops of that shape.
- Whole-file parses run under `cachedSetup`, whose shared signal aborts only after its
  last waiter aborts and none rejoins within `ABANDONED_SETUP_GRACE_MS`. A signal-less
  caller pins the setup.

## Which readers take the signal

**The signal `fetch` receives is not the caller's.** `RemoteFileWithRangeCache.fetchRange`
composes it with a response deadline (`RESPONSE_TIMEOUT_MS` in
`@gmod/range-cache-filehandle`). A deadline that replaced the signal would take
cancellation off the socket, so don't assert identity on that path.

Not wired:

- `@gmod/indexedfasta` forwards a signal to the `.fai` read only; sequence reads take none.
  The fix is upstream.
- `@gmod/hic` library calls: `HicAdapter` checks the signal around them but does not pass it in.
- The VCF export path, by choice: it is user-initiated.

Measured saving: a 4 kb viewport over the 2000x BAM issues one 6.5 MiB range read.
On a 4-hop pan burst throttled to 50 KiB/s, 3 of 6 requests aborted about 1.6 s in
having transferred ~80 KiB each, so ~19.5 MiB never downloaded.

## The coalescing trap

A layer that shares one fetch between logical reads must not let one sharer's abort cancel
the request the others wait on.

- `@gmod/tabix` and `@gmod/bbi` use `@gmod/abortable-promise-cache`, whose
  `AggregateAbortController` fires only once every joined consumer has aborted.
- `@gmod/bam` retries its chunk-cache joins on a foreign abort (`_cachedChunkFeatures`).
- `RemoteFileWithRangeCache` records the owning signal on each `inFlight` chunk and
  `joinChunk` re-issues once on a foreign abort. **Only upstream tests cover the retry**
  (`@gmod/range-cache-filehandle`'s `test/rangeCache.test.ts`).

**Don't** send an `AbortSignal` across `postMessage`, rely on `checkAbortSignal` alone in a
loop that never awaits, or make cross-origin isolation a requirement of anything (an
embeddable library cannot ask it of its host page, ADR-056).
