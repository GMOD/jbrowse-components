---
status: Accepted
summary: "No batched wiggle RPC; per-region parallel dispatch is the right shape"
---

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

The "fan-out as overhead" framing reverses cause and effect. Per-region parallel
dispatch is *what overlaps the I/O*, and batching collapses that into one
sequential loop.

**Get the mechanism right first**, because the obvious mental model is wrong. All
of one track's per-region calls land on the **same** worker:
`WorkerPoolRpcDriver.getWorker(sessionId)` assigns a sticky worker per session id,
and a track's session id is `adapterConfigCacheKey(adapter)`
(`BaseTrackModel.rpcSessionId`). The stickiness is deliberate — it is what lets
the calls share one cached adapter instance. Pool size is
`clamp(hardwareConcurrency - 1, 1, 5)`, and the pool spreads *tracks*, not one
track's regions. (Corrected 2026-07-24: this ADR previously claimed the fan-out
spread across the pool, "4 in parallel, 4 queue", via a `workerpool` dependency
that does not exist. The decision held, the reasoning didn't.)

So the win is concurrency *within* one worker, not across workers. Walk through
chromosome navigation with 8 invalidated regions on one track:

- **Per-region (today):** 8 concurrent calls to one worker. They interleave at
  every `await`, so the 8 range requests are in flight together and network
  latency — which dominates — is paid roughly once. CPU parse still serializes.
- **Naive batch (proposed):** 1 RPC with 8 regions, looping sequentially. Each
  region's fetch latency is paid in series. End-to-end ≈ `8 × per_region_latency`.
  **Strictly worse**, and worse for the reason that actually matters.
- **Smart batch (fetch all 8 in parallel inside one call, then parse):** converges
  on what per-region dispatch already does, with a new API to maintain and a
  coarser cancellation unit (one stop token for 8 regions instead of 8).

The residual cost is that **parse** of the 8 regions is single-threaded, since
they share a worker — a real limit, tracked in
[ARCHITECTURAL_LIMITS.md](../reference/ARCHITECTURAL_LIMITS.md) §"Worker
assignment is sticky per adapter". Batching does not improve it (same thread, plus
serialized I/O). The only lever is sharding a track across workers, at the cost of
duplicated adapter caches.

The marginal overhead of N RPC calls vs 1 batched call is `(N-1) ×
(postMessage + adapter cache lookup)`:

- `postMessage` of typed arrays is zero-copy (transferable). Args are tiny
  POJOs (region + numeric opts). Cost is microseconds per call.
- `getAdapter` is cached per session. After the first call: O(1) lookup.

So the batch saving is microseconds per region, and the cost is serialized fetch
latency proportional to region count. The trade is bad in every realistic
scenario.

## When this would change

Only revisit if **all** of these become true simultaneously:

- Per-region fetches stop overlapping (e.g. an adapter that holds a lock across
  its whole read, serializing concurrent calls on the shared worker anyway).
- Per-call setup cost grows substantially relative to per-region work (e.g., a
  new adapter type with expensive per-call initialization that can't be
  amortized via caching).
- We have profile evidence that RPC dispatch is dominating end-to-end latency
  during chromosome navigation.

None of these apply. Don't pre-emptively add the API.

## Related

- ADR-021 covers the per-region fast path (`getFeatureArrays`) which is the
  actual lever for reducing per-region work — orthogonal to dispatch shape.
