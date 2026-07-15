# ADR-008: Strict-equality `bpPerPx` cache check for wiggle

## Status

Accepted

## Context

BigWig files store data at discrete zoom levels. The worker picks one
via `@gmod/bbi` `getView`: finest tier where
`reductionLevel <= 2 * basesPerPx`. Cached bins are granular to
fetch-time `bpPerPx`.

Wiggle's previous `isCacheValid` used a 2× threshold against a scalar
`loadedBpPerPx`: `view.bpPerPx >= loadedBpPerPx / 2`. Failure mode in
whole-genome views:

1. Load genome at X. All chroms fetched at X, `loadedBpPerPx = X`.
2. Zoom into chr 10 at Y (Y < X/2). Only chr 10 visible, so `needed =
   [chr10]`. Chr 10 refetched at Y with narrow bounds.
   `loadedBpPerPx = Y`. Other chroms' wide bounds from step 1 stay in
   `loadedRegions`.
3. Zoom back to genome at X. `X >= Y/2` → cache "valid". Other chroms'
   bounds still cover the viewport → skipped. Chr 10's narrow bounds
   are invalid → refetched at `loadedBpPerPx = Y` (finer). Result:
   chr 10 rendered at a finer bigwig zoom level than the rest.

Root cause: `loadedBpPerPx` claimed "all loaded regions are at this
resolution", but partial-batch fetches silently broke that invariant.
The 2× threshold then allowed further partial refetches at the drifted
resolution.

## Decision

Strict equality:

```ts
isCacheValid(_displayedRegionIndex: number) {
  if (self.loadedBpPerPx === undefined) {
    return true
  }
  const view = getContainingView(self) as LGV
  return view.bpPerPx === self.loadedBpPerPx
}
```

Any `bpPerPx` change invalidates every visible region;
`FetchVisibleRegions` queues them all into one coordinated batch at the
new `bpPerPx`. Off-screen regions with stale entries are caught by the
same check when they come back into view.

## Rejected alternatives

**Per-region `loadedBpPerPx`.** More accurate, but the policy needed to
prevent cross-region drift reduces to "invalidate every region whose
stored `bpPerPx !== view.bpPerPx`" — equivalent to strict equality with
one scalar.

**Adapter-declared validity range.** Worker returns `bpPerPxRange =
[reductionLevels[i-1]/2, reductionLevels[i]/2]` with each chunk;
same-tier zooms skip refetch entirely. Theoretically optimal, but
requires an adapter-contract change and a payload field. The
`@gmod/bbi` block cache and `RemoteFileWithRangeCache` 256 KiB chunks
already make same-tier refetches cheap at the network layer — the real
cost of strict equality is RPC round-trip, not bytes. Revisit if that
becomes a measured bottleneck.

**Dedicated `view.bpPerPx` invalidation autorun.** Adds a second
300 ms-debounced autorun cascading into `FetchVisibleRegions` — ~600 ms
latency and fragile tick ordering. Strict equality drives everything
through the single existing autorun.

## Consequences

- Every zoom change refetches every visible region. `FetchVisibleRegions`'s
  300 ms debounce coalesces smooth zoom into one refetch after the
  gesture settles. The mixin's `isLoading` guard caps in-flight batches
  at one; a zoom-during-zoom produces at most one redundant batch before
  converging.
- No flicker: `FetchVisibleRegions` leaves `rpcDataMap` populated,
  `setRpcData` overwrites entries in place. See "Refresh without
  blanking" in `ARCHITECTURE.md`.

## Revisit if

- Per-zoom refetch is a measured bottleneck → adopt adapter-declared
  ranges. Strict equality degrades cleanly: swap scalar for range,
  swap `===` for `in [min, max]`.
- A new plugin reuses this mixin with continuous (non-tiered)
  resolution — strict equality over-invalidates, ranges become
  necessary.
