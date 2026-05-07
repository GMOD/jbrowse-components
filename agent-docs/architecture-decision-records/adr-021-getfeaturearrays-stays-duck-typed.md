# ADR-021: Wiggle adapter fast path stays duck-typed; bicolor split lives at the executor

## Status

Accepted

## Context

Wiggle adapters expose two paths to the executor:

- **Slow:** `adapter.getFeatures(region, opts)` returns an RxJS `Observable<Feature>`.
  The executor collects it via `firstValueFrom(... .pipe(toArray()))`, then walks
  the array converting each `Feature` into typed arrays.
- **Fast:** `adapter.getFeatureArrays(region, opts)` returns a `RawFeatureArrays`
  struct (`{ starts, ends, scores, minScores, maxScores, count }`) directly.
  Avoids the per-feature object allocation/iteration entirely.

`BigWigAdapter` implements the fast path because the BigWig zoom-bin format is
already typed-array-shaped on disk. `MultiWiggleAdapter` exposes a sibling
method `getMultiSourceFeatureArrays(region, opts)` that fans out to its inner
adapters, returning `{ source, raw }[]` — uses each inner adapter's fast path
when available, falls back to `getFeatures` per inner.

`executeRenderWiggleData` and `executeRenderMultiWiggleData` select the path
via duck-type predicates (`'getFeatureArrays' in adapter`,
`'getMultiSourceFeatureArrays' in adapter`). A type predicate narrows the
adapter so the call site is type-safe.

A proposal was raised to formalize the fast path as a named adapter capability —
`adapterCapabilities: ['hasFeatureArrays']` — checked via
`pluginManager.getAdapterType(...).adapterCapabilities.includes(...)`,
mirroring how `hasResolution` is declared on `BigWigAdapter` and read by
`LinearWiggleDisplay/model.ts`.

## Decisions

### 1. Keep the duck-type check; do not introduce a `hasFeatureArrays` capability

Reasoning:

- **No correctness gap.** The slow path is correct, just slower. A new adapter
  that omits `getFeatureArrays` produces equivalent output via the Observable
  + `processFeatures` fallback. There is no silent *behavior* regression; only
  a perf one.
- **The duck-type is already self-checking.** The `hasFeatureArrays` type
  predicate ties the runtime check to the method's actual signature. Removing
  or renaming the method on `BigWigAdapter` is a TypeScript error at the call
  site. A capability string is just a string — it can drift from reality
  (declared but not implemented, or vice versa) without any compiler help.
- **Capabilities are most useful for cross-plugin reads.** `hasResolution` is
  read by display models to gate UI behavior. Fast-path selection is internal
  to the worker and never crosses the model/UI boundary — there is no consumer
  who would benefit from reading it as a capability.

### 2. `bicolorPivot` lives at the executor, not in adapter opts

Earlier `BigWigAdapter.getFeatureArrays` took `bicolorPivot` in its opts and
ran the pos/neg split inline as part of the fetch — the inline split saved one
pass over the data. This was a layering violation: `bicolorPivot` is a display
choice (which pos/neg color split the user picked) and adapters had no business
knowing about it.

The split is now run by the executor via `processFeaturesFromArrays(raw, pivot)`
immediately after the fetch — same single pass, same perf, but `bicolorPivot`
no longer leaks into adapter API opts. Adapters return `RawFeatureArrays`;
display-side transformations stay on the executor side.

### 3. `MultiWiggleAdapter.getMultiSourceFeatureArrays` returns raw, not pre-split

Same reasoning as (2). The multi adapter's job is to fan out to inner adapters
and aggregate per-source — not to know about the bicolor split. It returns
`{ source, raw: RawFeatureArrays }[]`. The executor splits per source.

### 4. `MultiWiggleAdapter` *does* take the fast path

Earlier `executeRenderMultiWiggleData` always went through the slow Observable
path even when every inner adapter was a `BigWigAdapter`. Now it dispatches
to `getMultiSourceFeatureArrays`, which uses each inner adapter's fast path
when available. This was the highest-value piece of work in this area —
single-source BigWig already had the fast path; multi-source was the gap.

## Resulting API surface

The wiggle adapter contract is now symmetric:

- `getFeatures(region, opts) → Observable<Feature>` (slow, universal)
- `getFeatureArrays?(region, opts) → RawFeatureArrays` (fast, optional)

Plus `MultiWiggleAdapter` exposes:

- `getMultiSourceFeatureArrays(region, opts) → { source, raw }[]` (fans out to inner adapters)

The executor handles `bicolorPivot` and the pos/neg split via
`processFeaturesFromArrays(raw, pivot)`. Adapters never see display options.

## When to revisit

Promote to a declared capability if **any** of:

- A second adapter (Zarr, TileDB, custom binary BigWig variant, etc.) ships
  `getFeatureArrays`. At that point the discoverability argument has real
  weight, and a capability declaration prevents copy-paste omissions.
- A model-side or UI-side consumer needs to know whether the fast path is in
  use (e.g. to gate a UI affordance, vary cache invalidation strategy, or
  surface a perf indicator).

Until then, `'getFeatureArrays' in adapter` plus type predicate is sufficient.

## Rejected alternative

Add `'hasFeatureArrays'` to `BigWigAdapter.capabilities`, replace the
duck-type check with a capability lookup, add a unit test for the fallback.
Rejected as marginal-value cleanup: it trades a compiler-checked predicate
for an unchecked string with no current consumer that benefits.
