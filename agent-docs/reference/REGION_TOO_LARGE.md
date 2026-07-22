---
name: region-too-large
description: The byte/density gate that raises the "region too large" banner and holds off the fetch: the derived getter, the shared verdict primitives, and how canvas folds the byte check into its feature RPC. Read when touching fetch gating or the too-large banner.
---

# The region-too-large gate

`regionTooLarge` raises the banner and holds off the fetch. It is a derived
getter on `RegionTooLargeMixin`, computed fresh from the cached byte estimate
scaled to the current viewport. Because it is derived rather than a flag, it
releases itself when you zoom in, and it doesn't flicker while you pan.

For the wider picture and the five fetch autoruns that consult it, see
[ARCHITECTURE.md § Data fetching pipeline](../ARCHITECTURE.md#data-fetching-pipeline).
`DisplayChrome` turns this one signal into the banner UI; see DISPLAYCHROME.md.

## How the verdict is built

Four steps, all on `RegionTooLargeMixin`:

- `setFeatureDensityStats(stats)` stores the byte estimate together with the span
  it was measured at (`byteEstimateVisibleBp = view.visibleBp`). Storing the span
  is what makes the rest of this work.
- `estimatedVisibleBytes` rescales that estimate to whatever span is visible now
  (`bytes × visibleBp / byteEstimateVisibleBp`). Always gate on this, never on
  raw `bytes`: a raw byte count doesn't shrink when you zoom in, so the banner
  would never clear. The getter returns `undefined` until `view.initialized`,
  since `visibleBp` reads `view.width` and that throws before the view is
  measured, and a bare getter must never throw.
- `tooLargeStatus` hands the scaled estimate and `densityTooLargeForDerivedGate`
  to `evaluateRegionTooLarge`. `regionTooLarge` and `regionTooLargeReason` are
  thin readers over it.
- `fetchRegions` checks `self.regionTooLarge` immediately after
  `setFeatureDensityStats`. That works because the estimate was just captured at
  the current viewport, so the derived verdict already accounts for it. When a
  zoom-in later flips the verdict to false, `FetchVisibleRegions` notices and
  re-fires on its own.

The estimate deliberately survives `clearAllRpcData()`, so an ordinary viewport
change doesn't make the banner flicker. Only chromosome navigation drops it,
because `displayedRegionIndex` values are reused across chromosomes and a stale
estimate would gate the new region against the previous chromosome's numbers.

Two smaller wires: `onRegionTooLarge()` fires when the verdict goes from false to
true (alignments overrides it to clear its hover), and
`regionCannotBeRenderedText()` reads through `regionTooLarge` so the banner and
the SVG-export text always agree.

## Opt-in hooks

Most displays override none of these.

**`derivedRegionTooLargeEnabled`** defaults to false, which means the display
never gates on size at all. `MultiRegionDisplayMixin` computes it from
`getByteEstimateConfig() !== null`, so any display using the pre-flight estimate
(alignments, maf, multi-sample-variant) is gated by the very config that declares
that estimate, and the two cannot fall out of sync. Displays that capture the
estimate some other way turn it on explicitly: LD, arc, and canvas. Where it
stays false (wiggle, Manhattan, sequence, synteny), `regionTooLarge` is a literal
false and the LGV-only getters below it are never evaluated, so a non-LGV
consumer of the mixin never ends up reading `view.visibleBp`.

**`configuredFetchSizeLimit`** and **`configForceLoad`** read the
`fetchSizeLimit` and `forceLoad` slots from `baseLinearDisplayConfigSchema`,
which every gated display extends. They're overridable, but nothing overrides
them today.

**`densityTooLargeForDerivedGate`** supplies a second gating axis if the display
has one. Canvas folds its feature-density gate in here; byte-only displays leave
it false.

## Canvas folds the byte check into its fetch RPC

Canvas opts out of the pre-flight entirely: `getByteEstimateConfig` returns
`null`. A second estimate RPC racing the per-region feature fetch is exactly the
two-call coordination this codebase avoids. Instead, `executeRenderFeatureData`
and `executeMultiRowGetFeatures` call the adapter's `getRegionByteSize`, which is
an index-only estimate that downloads no features. It's `undefined` by default on
`BaseFeatureDataAdapter` and overridden by the tabix adapters. An over-budget
region short-circuits there, before `getFeaturesArray` ever runs, and comes back
as `{ regionTooLarge, bytes }`.

That makes the byte gate symmetric with the density gate, which already
short-circuits inside the RPC and returns `{ regionTooLarge, featureCount }`. The
payoff shows up on a whole-genome fan-out, which costs one cheap index read per
chromosome instead of downloading every chromosome's features.

`commitFeatureGateStats` records the maximum per-region byte count, not the sum.
Every region is gated against the same per-region budget, so a multi-region view
where each region individually fits should never be blanked just because the
regions add up. It publishes the adapter's `fetchSizeLimit` alongside the
estimate, which is how the banner's `resolveByteLimit` ends up picking the same
budget the worker gated on.

### `CanvasFeatureGateMixin`

Lives at `plugins/canvas/src/shared/CanvasFeatureGateMixin.ts` and is composed on
top of `RegionTooLargeMixin` by both canvas feature displays: `LinearBasicDisplay`
and `LinearVariantDisplay` through `baseModel`, plus
`LinearMultiRowFeatureDisplay`. It contributes the density axis
(`densityStatsPerRegion`, `observedMaxDensity`, `densityTooLarge` feeding
`densityTooLargeForDerivedGate`), the budgets the worker needs (`byteSizeLimit()`
and `maxFeatureDensity`), and the dual-axis `setFeatureDensityStatsLimit`. Setting
`densityGateDisabled` turns the density axis off for a display that paints into
fixed lanes, such as multi-row, leaving byte-only gating.

**Composition order matters and nothing type-checks it.**
`CanvasFeatureGateMixin()` must come after `MultiRegionDisplayMixin()`. Both
define `derivedRegionTooLargeEnabled`; the base computes it from
`getByteEstimateConfig()`, which canvas never overrides and which therefore
returns null, so the base version evaluates to false. The gate works only because
the mixin's hardcoded `true` wins by being composed later. Swap the two lines and
the entire byte and density gate silently switches off, with no error and no type
failure. Both canvas test suites carry a "composition order keeps the derived
gate enabled" test to catch that.

A display opts in by composing the mixin, calling `commitFeatureGateStats` from
its fetch, and overriding `isCacheValid` to require committed data. That last
part matters because a too-large region is marked loaded but stores nothing, and
without the override it would never refetch once the gate released. Clearing
stale stats on chromosome navigation is handled by the mixin's own `afterAttach`,
so a composing display can't forget it and mis-gate a reused
`displayedRegionIndex`. `baseModel` keeps only what is genuinely its own: the
per-region `RenderFeatureData` fetch and `applyFetchResults`, its peptide-aware
`isCacheValid`, and `pruneRpcDataMapToVisible`, which trims
`densityStatsPerRegion` alongside `rpcDataMap`.

While `regionTooLarge` holds, `laidOutDataMap` returns empty, so the GPU upload
pushes nothing and there's no stale-feature flash.

## Force-load

`userByteSizeLimit` and `userFeatureDensityLimit` are both volatile, never
persisted. Clicking force-load is a transient "show me this now" action, and it
must not leak a raised gate into a saved or shared session. The durable escape
hatch is the declarative `forceLoad` config slot.

A dual-axis display has to decide which axis to raise, and it has to decide by
which gate actually tripped, not by whether a byte estimate happens to exist.
Tabix adapters report an index-byte estimate even when the rejection was about
density, so a region that is dense but small in bytes still carries a small
`bytes` value. Adopting that as `userByteSizeLimit` would install a ceiling below
the config or adapter default and then wrongly gate later regions that really are
large. `resolveForceLoadLimits` is the single place that decides: take the raised
byte limit only when it exceeds the baseline `resolveByteLimit`, meaning the byte
gate genuinely was the blocker; otherwise raise the density axis past the highest
observed density. Note it uses the observed density rather than the current
`maxFeatureDensity`, which already folds in any earlier force-load and would
compound across attempts.

## Shared primitives (`shared/featureDensityUtils.ts`)

The derived gate and canvas's in-RPC short-circuit differ only in how they
measure. The verdict, the threshold, and the banner text all live here so the two
paths can't drift apart.

- `resolveByteLimit({ userByteSizeLimit, adapterFetchSizeLimit, configFetchSizeLimit })`
  is the one place a byte budget gets resolved. A non-positive adapter limit
  means "no opinion" and is skipped, which guards both a `0` and a negative
  sentinel.
- `scaleByteEstimate`, `scaledForceLoadByteLimit`, and `raiseLimitPast` hold the
  scaling math and the shared `FORCE_LOAD_HEADROOM`.
- `bytesTooLargeReason(bytes)` and `TOO_MANY_FEATURES_REASON` are the only two
  banner strings.
- `evaluateRegionTooLarge({ visibleBp, bytes, byteLimit, densityTooLarge, alwaysRender })`
  produces the verdict and its reason. `alwaysRender` is checked first and never
  gates; below `AUTO_FORCE_LOAD_BP` nothing gates; after that, being over the byte
  limit takes precedence over density. `densityTooLarge` is opt-in, so byte-only
  displays never gate on it.

`alwaysRender` is the escape hatch for self-summarizing adapters. Adapters that
cap what they return at screen resolution (BigWig, MultiWiggle, HiC, and the
sequence adapters) report it from `getMultiRegionFeatureDensityStats`, so no
region is ever too large for them no matter how wide the view gets. BigMaf
deliberately does not, since it returns full alignment rows rather than a
screen-reduced summary.
