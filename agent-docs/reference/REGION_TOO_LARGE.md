---
name: region-too-large
description: The byte/density gate that raises the "region too large" banner and holds off the fetch — the derived getter, the shared verdict primitives, and how canvas folds the byte check into its feature RPC. Read when touching fetch gating or the too-large banner.
---

# The region-too-large gate

## TL;DR

**What it does:** you load `chr1:1-1,000,000`. Before fetching, we ask the
adapter roughly how many bytes that region would download. Over the limit → skip
the fetch, show the "region too large" banner. Under → fetch normally. For tabix
the estimate is just an index lookup (a byte range in the file), so it's free.

There's a second gate on the same banner: canvas also blocks regions with too
many *features* to draw, even when the byte count is fine. Same machinery,
different axis (`densityTooLarge`).

**Why there are two byte numbers:** once loaded, panning/zooming changes the span
you'd fetch. Instead of re-asking the adapter every time, we keep the one
estimate we captured and rescale it — bytes scale with span, so half the bp is
half the bytes. `regionTooLarge` is a derived getter that redoes this rescale on
every read, so the banner clears itself once you've zoomed in enough.

- **`estimatedBytesForVisibleSpan`** — rescaled to the span in view now. **Gate on this.**
- **`estimatedBytesForMeasuredSpan`** — the frozen number from when we captured
  it. Gating on this is the classic bug: it never shrinks, so the banner never
  clears.

**Two footguns:**

- Gating is **opt-in** via `derivedRegionTooLargeEnabled` (defaults to false).
  `MultiRegionDisplayMixin` derives it from `getByteEstimateConfig() !== null`;
  LD/arc/canvas set it explicitly. Displays that don't opt in never gate.
- **`CanvasFeatureGateMixin()` must compose *after* `MultiRegionDisplayMixin()`.**
  Both define `derivedRegionTooLargeEnabled` and the later one wins. Swap the
  order and the whole gate silently switches off — no error, no type failure.

**The rest:**

- Canvas doesn't do a separate estimate RPC. It folds the byte check **inside**
  its feature RPC (via the adapter's `getRegionByteSize`), so an over-budget
  region short-circuits before downloading any features.
- Force-load ("show me this anyway") is **volatile** — never saved to a session.
  `resolveForceLoadLimits` raises whichever axis actually tripped. The durable
  escape hatch is the `forceLoad` config slot.
- `alwaysRender` exempts adapters that summarize at screen resolution (BigWig,
  MultiWiggle, HiC, sequence) — they can never be "too large".

| Code | Path |
| --- | --- |
| `RegionTooLargeMixin` (derived gate) | `plugins/linear-genome-view/src/shared/RegionTooLargeMixin.tsx` |
| Shared verdict primitives | `plugins/linear-genome-view/src/shared/regionTooLargeUtils.ts` |
| Pre-flight estimate RPC | `packages/core/src/rpc/methods/CoreGetRegionByteEstimate.ts` |
| `CanvasFeatureGateMixin` (density axis) | `plugins/canvas/src/shared/CanvasFeatureGateMixin.ts` |

Both footguns above have tests: `regionTooLargeUtils.test.ts`, plus a
"composition order keeps the derived gate enabled" test in
`plugins/canvas/src/LinearBasicDisplay/fetchAutorun.test.ts` and
`plugins/canvas/src/LinearMultiRowFeatureDisplay/derivedRegionTooLarge.test.ts`.

For the wider picture and the five fetch autoruns that consult the verdict, see
[ARCHITECTURE.md § Data fetching pipeline](../ARCHITECTURE.md#data-fetching-pipeline).
`DisplayChrome` turns this one signal into the banner UI; see
[DISPLAYCHROME.md](DISPLAYCHROME.md).

## How the verdict is built

Four steps, all on `RegionTooLargeMixin`:

- `setByteEstimate(estimate)` stores the estimate together with the span it
  covers (`measuredSpanBp = view.visibleBp`). Storing the span is what makes
  the rest of this work.
- `estimatedBytesForVisibleSpan` rescales that estimate to the span visible now
  (`bytes × visibleBp / measuredSpanBp`). It returns `undefined` until
  `view.initialized`, because `visibleBp` reads `view.width`, which throws
  before the view is measured, and a bare getter must never throw.
- `tooLargeStatus` hands the rescaled estimate and
  `densityTooLargeForDerivedGate` to `evaluateRegionTooLarge`. `regionTooLarge`
  and `regionTooLargeReason` are thin readers over it.
- `fetchRegions` checks `self.regionTooLarge` immediately after
  `setByteEstimate`, which works because the estimate was just captured at the
  current viewport. When a later zoom-in flips the verdict to false,
  `FetchVisibleRegions` notices and re-fires on its own.

The estimate deliberately survives `clearAllRpcData()`, so an ordinary viewport
change doesn't flicker the banner. Only chromosome navigation drops it, since
`displayedRegionIndex` values are reused across chromosomes and a stale estimate
would gate the new region against the previous chromosome's numbers.

Two smaller wires: `onRegionTooLarge()` fires on the false→true transition
(alignments overrides it to clear its hover), and `regionCannotBeRenderedText()`
reads through `regionTooLarge` so the banner and the SVG-export text agree.

## Opt-in hooks

Most displays override none of these.

**`derivedRegionTooLargeEnabled`** defaults to false, meaning the display never
gates on size. `MultiRegionDisplayMixin` derives it from
`getByteEstimateConfig() !== null` — the same config that switches on the
pre-flight `CoreGetRegionByteEstimate` RPC. Requesting the estimate and gating
on it are therefore one decision, not two, so alignments, maf and
multi-sample-variant can't drift into fetching estimates nothing reads, or
gating on estimates nobody fetched. LD, arc and canvas obtain the estimate
their own way and set the flag directly. Where it stays false (wiggle,
Manhattan, sequence, synteny) `regionTooLarge` is a literal false, the LGV-only
getters below it are never evaluated, and a non-LGV consumer of the mixin never
reads `view.visibleBp`.

**`configuredFetchSizeLimit`** and **`configForceLoad`** read the
`fetchSizeLimit` and `forceLoad` slots from `baseLinearDisplayConfigSchema`,
which every gated display extends. Overridable, but nothing overrides them
today.

**`densityTooLargeForDerivedGate`** supplies a second gating axis. Canvas folds
its feature-density gate in here; byte-only displays leave it false.

## Canvas folds the byte check into its fetch RPC

Canvas opts out of the pre-flight entirely — `getByteEstimateConfig` returns
`null`, because a second estimate RPC racing the per-region feature fetch is
exactly the two-call coordination this codebase avoids. Instead
`executeRenderFeatureData` and `executeMultiRowGetFeatures` call the adapter's
`getRegionByteSize`, an index-only estimate that downloads no features
(`undefined` by default on `BaseFeatureDataAdapter`, overridden by the tabix
adapters). An over-budget region short-circuits there, before `getFeaturesArray`
runs, and comes back as `{ regionTooLarge, bytes }`.

That makes the byte gate symmetric with the density gate, which already
short-circuits inside the RPC and returns `{ regionTooLarge, featureCount }`.
The payoff shows on a whole-genome fan-out: one cheap index read per chromosome
instead of downloading every chromosome's features.

`commitGateMeasurements` records the maximum per-region byte count, not the sum,
because every region is gated against the same per-region budget — a
multi-region view where each region individually fits should never be blanked
just because the regions add up. It publishes the adapter's `fetchSizeLimit`
alongside the estimate, which is how the banner's `resolveByteLimit` ends up
picking the same budget the worker gated on.

### `CanvasFeatureGateMixin`

Composed on top of `RegionTooLargeMixin` by both canvas feature displays:
`LinearBasicDisplay` and `LinearVariantDisplay` through `baseModel`, plus
`LinearMultiRowFeatureDisplay`. It contributes the density axis
(`densityStatsPerRegion`, `observedMaxDensity`, `densityTooLarge` feeding
`densityTooLargeForDerivedGate`), the budgets the worker needs
(`resolvedByteLimit()` and `maxFeatureDensity`), and the dual-axis
`raiseForceLoadLimits`. Overriding `densityGateEnabled` to false drops the
density axis for a display that paints into fixed lanes, such as multi-row,
leaving byte-only gating.

**Composition order matters and nothing type-checks it.** The base computes
`derivedRegionTooLargeEnabled` from `getByteEstimateConfig()`, which canvas never
overrides and which therefore returns null, so the base version is false. The
gate works only because the mixin's hardcoded `true` wins by composing later.

A display opts in by composing the mixin, calling `commitGateMeasurements` from
its fetch, and overriding `isCacheValid` to require committed data. That last
part matters because a too-large region is marked loaded but stores nothing, so
without the override it would never refetch once the gate released. The mixin's
own `afterAttach` clears stale stats on chromosome navigation, so a composing
display can't forget it and mis-gate a reused `displayedRegionIndex`.
`baseModel` keeps only what is genuinely its own: the per-region
`RenderFeatureData` fetch and `applyFetchResults`, its peptide-aware
`isCacheValid`, and `pruneRpcDataMapToVisible`, which trims
`densityStatsPerRegion` alongside `rpcDataMap`.

While `regionTooLarge` holds, `laidOutDataMap` returns empty, so the GPU upload
pushes nothing and there's no stale-feature flash.

## Force-load

`userByteLimit` and `userFeatureDensityLimit` are both volatile, never
persisted: clicking force-load is a transient "show me this now" action that must
not leak a raised gate into a saved or shared session. The durable escape hatch
is the declarative `forceLoad` config slot.

A dual-axis display has to pick which axis to raise, and it picks by which gate
actually tripped — not by whether a byte estimate happens to exist. That matters
because tabix adapters report an index-byte estimate even when the rejection was
about density: a dense-but-small region still carries a small `bytes` value, and
adopting it as `userByteLimit` would install a ceiling below the config or
adapter default, then wrongly gate later regions that really are large.

`raiseForceLoadLimits` (the button's action, overridden by
`CanvasFeatureGateMixin`) defers to `resolveForceLoadLimits`, the single place
that decides:

- Raise the **byte** limit only when the raised value exceeds the baseline
  `resolveByteLimit` — that means the byte gate was the real blocker.
- Otherwise raise the **density** axis, past the highest *observed* density.

It reads observed density rather than the current `maxFeatureDensity`, which
already folds in any earlier force-load and would compound across attempts.

## Shared primitives (`shared/regionTooLargeUtils.ts`)

The derived gate and canvas's in-RPC short-circuit differ only in how they
measure. The verdict, the threshold, and the banner text live here so the two
paths can't drift apart.

- `resolveByteLimit({ userByteLimit, adapterFetchSizeLimit, configFetchSizeLimit })`
  is the one place a byte budget gets resolved, highest-priority first. Those
  three arguments are the only byte-budget *inputs* in the system; the resolved
  *output* is `resolvedByteLimit()` on the canvas gate, and the same value
  travels to the worker as the `byteLimit` RPC arg. A non-positive adapter limit
  means "no opinion" and is skipped, guarding both a `0` and a negative
  sentinel.
- `rescaleByteEstimateToVisibleSpan`, `forceLoadByteLimit` and `raiseLimitPast`
  hold the scaling math and the shared `FORCE_LOAD_HEADROOM`.
- `bytesTooLargeReason(bytes)` and `TOO_MANY_FEATURES_REASON` are the only two
  banner strings.
- `evaluateRegionTooLarge({ visibleBp, estimatedBytesForVisibleSpan, byteLimit, densityTooLarge, alwaysRender })`
  produces the verdict and its reason, applying its checks in order:
  - `alwaysRender` wins first and never gates.
  - Below `AUTO_FORCE_LOAD_BP` (20,000 bp) nothing gates.
  - Otherwise over-byte-limit gates before density.

  `densityTooLarge` is opt-in, so byte-only displays never gate on it.

`alwaysRender` is the escape hatch for self-summarizing adapters. Adapters that
cap what they return at screen resolution (BigWig, MultiWiggle, HiC, the
sequence adapters) report it from `getMultiRegionByteEstimate`, so no
region is ever too large for them however wide the view gets. BigMaf
deliberately does not, since it returns full alignment rows rather than a
screen-reduced summary. `tooLargeStatus` also passes `configForceLoad` in
through `alwaysRender`, so the declarative force-load short-circuits the verdict
exactly as a self-summarizing adapter does.
