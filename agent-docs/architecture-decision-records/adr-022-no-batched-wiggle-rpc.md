# ADR-022: No batched wiggle RPC; per-region parallel dispatch is the right shape

## Status

Accepted

## Context

`LinearWiggleDisplay.fetchNeeded` dispatches one `RenderWiggleData` RPC call
per region needing fetch:

```ts
await Promise.all(
  needed.map(r => rpcManager.call(sessionId, 'RenderWiggleData', { region: r.region, ... })),
)
```

A previous TODO entry proposed adding an optional `RenderWiggleDataBatch` RPC
method that takes `regions: Region[]` and returns a map of
`displayedRegionIndex → WiggleDataResult`. The framing was that the per-region
fan-out is "wasteful" because chromosome navigation can invalidate many regions
simultaneously, producing N parallel RPC dispatches.

## Decision

**Do not add a batched RPC.** Keep per-region parallel dispatch. The TODO entry
was removed.

## Reasoning

The "fan-out as overhead" framing reverses cause and effect. jbrowse uses a
worker pool (typically ~4 workers via `workerpool`). Per-region parallel dispatch
is *what enables parallelism across workers*. Batching collapses that into one
worker.

Walk through chromosome navigation with 8 invalidated regions and a 4-worker
pool:

- **Per-region (today):** 8 RPC calls fan out across the worker pool. 4 process
  in parallel, 4 queue. End-to-end ≈ `2 × per_region_work`.
- **Naive batch (proposed):** 1 RPC with 8 regions goes to one worker, which
  loops sequentially. End-to-end ≈ `8 × per_region_work`. **Strictly worse.**
- **Smart batch (split N regions across M workers):** Same as per-region
  parallel. Couldn't beat it. And requires the RPC layer to know the worker
  pool size, which it abstracts away on purpose.

The marginal overhead of N RPC calls vs 1 batched call is `(N-1) ×
(postMessage + adapter cache lookup)`:

- `postMessage` of typed arrays is zero-copy (transferable). Args are tiny
  POJOs (region + numeric opts). Cost is microseconds per call.
- `getAdapter` is cached per session. After the first call: O(1) lookup.

So the batch saving is microseconds per region; the parallelism cost is
proportional to per-region work. The trade is bad in every realistic scenario.

## When this would change

Only revisit if **all** of these become true simultaneously:

- The worker pool shrinks to one worker (it doesn't).
- Per-call setup cost grows substantially relative to per-region work (e.g., a
  new adapter type with expensive per-call initialization that can't be
  amortized via caching).
- We have profile evidence that RPC dispatch is dominating end-to-end latency
  during chromosome navigation.

None of these apply. Don't pre-emptively add the API.

## Related

- ADR-021 covers the per-region fast path (`getFeatureArrays`) which is the
  actual lever for reducing per-region work — orthogonal to dispatch shape.
