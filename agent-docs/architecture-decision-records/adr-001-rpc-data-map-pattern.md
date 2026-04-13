# ADR-001: Keep `new Map()` reassignment pattern for volatile RPC data

## Status

Accepted

## Context

Multi-region display models (wiggle, alignments, canvas, synteny) store
per-region RPC results in a volatile `Map<number, TResult>` field called
`rpcDataMap`. Because MST volatile fields are plain JS values — not MobX
observables — direct mutation (`self.rpcDataMap.set(k, v)`) is invisible to
MobX and won't trigger reactions.

The current workaround:

```typescript
setRpcDataForRegion(regionNumber: number, data: WiggleDataResult) {
  const next = new Map(self.rpcDataMap)
  next.set(regionNumber, data)
  self.rpcDataMap = next
}
```

Reassigning the field forces MST to detect the change and notify observers.

An alternative is `observable.map()`: initialize the volatile field as a MobX
observable map so that direct `.set()` calls are tracked without needing a full
reassignment.

## Decision

Keep the `new Map()` reassignment pattern. Do not migrate to `observable.map()`.

## Reasoning

### No behavioral improvement

Every autorun/reaction that reads `rpcDataMap` across all affected display types
uses a delay (`delay: 400` in wiggle, `delay: 50–100` in canvas). With a delay,
MobX debounces the reaction — whether the map is reassigned N times or mutated
N times via `.set()`, the reaction fires exactly once, 400 ms after the last
region loads. The behavioral output is identical.

The scenario where `observable.map()` would genuinely win — a zero-delay
reaction being fired N times for N arriving regions — does not occur in the
current codebase.

### Fine-grained key tracking is unexploited

`observable.map()` lets MobX track which specific keys changed so a reaction
that only reads `rpcDataMap.get(3)` won't re-run when key 7 changes. All actual
reactions here iterate `rpcDataMap.values()` across all visible blocks, so they
re-run on any key change regardless. The finer granularity provides no benefit.

### LinearFeatureDisplay intentionally rebuilds the whole map

`LinearFeatureDisplay` accumulates results from all regions in
`applyFetchResults`, then calls `setRpcDataMap(entireMap)` in one shot.
`observable.map()` would be irrelevant for this pattern.

### Cost vs. benefit

The refactoring would touch 5+ display types with real risk of breaking subtle
MobX reactivity chains. The only concrete gain is eliminating O(N) Map copies
per data-load cycle — negligible for the region counts in practice.

## Consequences

- `setRpcDataForRegion` remains the standard action name and pattern across
  multi-region display types.
- New display types that store per-region volatile data should follow the same
  pattern.
- If a future display type introduces a zero-delay reaction over `rpcDataMap`,
  revisit this decision — that is the one scenario where `observable.map()` +
  `runInAction` batching would produce fewer reaction firings.
