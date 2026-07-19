---
name: region-too-large
description: The byte/density gate that raises the "region too large" banner and holds off the fetch — the derived getter, the shared verdict primitives, and how canvas folds the byte check into its feature RPC. Read when touching fetch gating or the too-large banner.
---

# The region-too-large gate

`regionTooLarge` raises the "region too large" banner and holds off the fetch.
It's a **derived** getter on `RegionTooLargeMixin` — a pure function of the
cached byte estimate scaled to the current viewport — so it self-releases on
zoom-in without an imperative clear and doesn't flicker on pan. The old
`setRegionTooLarge` volatile-flag path was removed once every byte-gated display
went derived; the mixin now owns the whole gate, and displays opt in through
hooks rather than shadowing the getter per display.

Overview and the five fetch autoruns that consult this gate:
[ARCHITECTURE.md § Data fetching pipeline](../ARCHITECTURE.md#data-fetching-pipeline).

## The byte gate, and why canvas folds it into the fetch

**Canvas opts out of the pre-flight** (`getByteEstimateConfig` returns `null`).
A second estimate RPC racing the per-region feature fetch is exactly the
two-call coordination we avoid. Instead canvas folds the byte check into the
feature-fetch RPC: `executeRenderFeatureData` calls the adapter's
`getRegionByteSize` (an index-only estimate, no feature download — default
`undefined` on `BaseFeatureDataAdapter`, overridden by tabix adapters) and
short-circuits an over-budget region *before* `getFeaturesArray`, returning
`{ regionTooLarge, bytes }`.

This makes the byte gate symmetric with the density gate, which already
short-circuits in-RPC returning `{ regionTooLarge, featureCount }`. A
whole-genome fan-out then costs one cheap index read per chromosome instead of
downloading every chromosome's features.

`applyFetchResults` records the per-region `bytes` **max**, not the sum, into
`featureDensityStats` (along with the adapter's `fetchSizeLimit`, so the banner's
`resolveByteLimit` picks the same budget the worker gated on). Each region is
gated against the same per-region budget, so a multi-region view where every
region individually fits is never blanked just because the cross-region total
exceeds one region's budget. The budget comes from the display's
`byteSizeLimit()`, which routes through the shared `resolveByteLimit`
(`userByteSizeLimit ?? adapterFetchSizeLimit ?? configFetchSizeLimit`, only in
the force-load zone) — so an adapter-declared `fetchSizeLimit` (e.g. on a
`VcfTabixAdapter` feature track) is honored here exactly as it is on the
pre-flight path, rather than being overridden by the display config.

A dual-axis display's force-load has to pick which axis to raise — byte or
density — and it must do so by which gate actually tripped, NOT by whether a byte
estimate exists. Tabix adapters report an index-byte estimate alongside a
*density* rejection, so a dense-but-byte-small region carries a small `bytes`;
adopting it as `userByteSizeLimit` would install a ceiling *below* the
config/adapter default and wrongly gate later, larger-byte regions. This decision
is single-sourced in `resolveForceLoadLimits` (`featureDensityUtils.ts`), shared
by every canvas dual-axis gate through `CanvasFeatureGateMixin`
(`LinearBasicDisplay`/`LinearVariantDisplay` and `LinearMultiRowFeatureDisplay`):
only adopt the raised byte limit when it exceeds the baseline
`resolveByteLimit` (i.e. the byte gate was really the blocker); otherwise raise
the density axis. Both `userByteSizeLimit` and `userFeatureDensityLimit` are
**volatile**, not persisted — a force-load is a transient "show me this now"
action and must not leak a raised/disabled gate into a saved or shared session
(the declarative `forceLoad` config slot is the durable escape hatch).

## The shared dual-axis gate: `CanvasFeatureGateMixin`

Canvas feature displays that fold the byte/density check into their own fetch RPC
(no pre-flight) share the whole model-side gate via `CanvasFeatureGateMixin`
(`plugins/canvas/src/shared/CanvasFeatureGateMixin.ts`) — composed on top of
`RegionTooLargeMixin` to add the density axis (`densityStatsPerRegion`,
`observedMaxDensity`, `densityTooLarge` → `densityTooLargeForDerivedGate`), the
worker budgets (`byteSizeLimit()`, `maxFeatureDensity`), and the dual-axis
`setFeatureDensityStatsLimit`. A display opts in by composing it and calling
`commitFeatureGateStats` from its fetch + `clearFeatureGateStats` on chromosome
nav (and overriding `isCacheValid` to require committed data — a too-large region
is marked loaded but stores none — so the region refetches when the gate
releases). Both canvas feature displays compose it: `LinearBasicDisplay` /
`LinearVariantDisplay` (via the shared `baseModel`) and
`LinearMultiRowFeatureDisplay`. `baseModel` keeps only the parts genuinely its
own — the per-region `RenderFeatureData` fetch/`applyFetchResults`, its
peptide-aware `isCacheValid`, and `pruneRpcDataMapToVisible` (which trims the
mixin's `densityStatsPerRegion` alongside `rpcDataMap`) — and calls
`commitFeatureGateStats` / `clearFeatureGateStats` for everything else. This mixin
is the model-side sibling of `DisplayChrome` (the view-side chrome): the mixin
decides `regionTooLarge`, `DisplayChrome`'s `computeDisplayPhase` renders the
banner from it (see DISPLAYCHROME.md).

## The derived gate: opt-in hooks

A byte-gated display opts in through hooks on `RegionTooLargeMixin`. In practice
most displays override none of them:

- `derivedRegionTooLargeEnabled` → `true`. `MultiRegionDisplayMixin` derives this
  from `getByteEstimateConfig() !== null`, so a pre-flight display (alignments,
  maf, multi-sample-variant) is gated automatically by the same config that
  declares its estimate — the two can't desync (this replaced a dev-time
  "config set but gate off" `console.error`). Displays that capture the estimate
  outside the pre-flight set it explicitly: LD (its own `performLDFetch`), arc
  (`fetchArcFeatures`, via `ArcFetchModel`), and canvas (folds the byte check into
  its feature RPC, via `CanvasFeatureGateMixin` / `LinearBasicDisplay`). Left
  false (wiggle, Manhattan, sequence, synteny, HiC), `regionTooLarge` is a literal
  `false` and the LGV-only `tooLargeStatus` getters below are never evaluated — so
  a non-byte or non-LGV consumer of the mixin never reads `view.visibleBp`.
- `configuredFetchSizeLimit` / `configForceLoad` default to
  `getConf(self, 'fetchSizeLimit')` / `getConf(self, 'forceLoad')` — the mixin
  reads its own budget and declarative-force-load off the config (both slots live
  on `baseLinearDisplayConfigSchema`, which every derived display extends, and
  they're only read once `derivedRegionTooLargeEnabled` is true). A display with a
  bespoke source can still override them, but none currently do.
- `densityTooLargeForDerivedGate` → a second gating axis, if any. Canvas folds
  its feature-density gate in here; byte-only displays (alignments, maf, LD, arc,
  multi-sample-variant) leave it false.

## How the verdict is built

All in `RegionTooLargeMixin`:

- `setFeatureDensityStats(stats)` commits the estimate AND records the span it was
  measured at (`byteEstimateVisibleBp = view.visibleBp`). The estimate arrives
  from the `fetchRegions` pre-flight (maf/alignments/multi-sample-variant, via
  `getByteEstimateConfig` → `checkByteEstimate`) or, for canvas, from
  `applyFetchResults` folding the byte check into the feature RPC (per-region
  `bytes` **max**, not sum, so a multi-region view where each region fits isn't
  blanked by the cross-region total).
- `estimatedVisibleBytes` rescales the captured estimate to the current span
  (`bytes × view.visibleBp / byteEstimateVisibleBp`), so the byte gate is a pure
  function of the view and self-releases on zoom-in. Gate on this, never raw
  `bytes` — a raw read never shrinks on zoom-in, so the banner would never clear.
  Guarded on `view.initialized`: a bare getter must never throw, and `visibleBp`
  reads `view.width`, which throws pre-init.
- `tooLargeStatus` feeds the scaled estimate + `densityTooLargeForDerivedGate` to
  the shared `evaluateRegionTooLarge` verdict; `regionTooLarge` /
  `regionTooLargeReason` read it.
- `fetchRegions` short-circuits on `self.regionTooLarge` immediately after
  `setFeatureDensityStats` — the capture span *is* the current viewport, so the
  derived verdict already reflects the just-captured estimate. No imperative flag,
  and `FetchVisibleRegions` re-fires (it reads `regionTooLarge`) the moment a
  zoom-in flips it false, opening the gate.

The estimate survives `clearAllRpcData()` (it isn't in `clearDisplaySpecificData`),
so a viewport-change clear doesn't flicker the banner — `ClearBlockingStateOnViewportChange`
no longer touches `regionTooLarge` at all (self-release replaces it). Only
chromosome navigation drops the estimate, via each display's
`onDisplayedRegionsChange(self, () => self.setFeatureDensityStats(undefined))` —
`displayedRegionIndex` is reused across chromosomes, so a stale estimate would
gate the new region against the wrong stats. (Canvas also clears its
`densityStatsPerRegion` there; `laidOutDataMap` returns empty while
`regionTooLarge`, so the GPU upload pushes nothing — no stale-feature flash.)

`regionTooLarge` becoming true fires the overridable `onRegionTooLarge()` hook
(via the `ClearHoverOnRegionTooLarge` autorun); alignments overrides it to clear
its hover, since the banner replaces the pileup.
`regionCannotBeRenderedText()` reads through `self.regionTooLarge`, so the banner
UI and SVG-export text stay in agreement.

## Shared decision primitives

The derived gate and canvas's in-RPC byte short-circuit diverge only in *how*
they measure bytes/density. The verdict, threshold, and banner text are unified
in `shared/featureDensityUtils.ts` so they can't drift:

- `resolveByteLimit({ userByteSizeLimit, adapterFetchSizeLimit, configFetchSizeLimit })`
  — the one byte-budget resolution. A non-positive adapter limit means "no
  opinion" and is skipped (guards both `0` and a negative sentinel).
- `bytesTooLargeReason(bytes)` / `TOO_MANY_FEATURES_REASON` — the one source for
  the two banner strings.
- `evaluateRegionTooLarge({ visibleBp, bytes, byteLimit, densityTooLarge, alwaysRender })`
  — the canonical verdict + reason. An `alwaysRender` adapter never gates
  (checked first); below `AUTO_FORCE_LOAD_BP` nothing gates; else bytes-over-limit
  takes precedence over density. `densityTooLarge` is **opt-in**, so byte-only
  displays (alignments, LD) pass only bytes and never gate on density.
  `alwaysRender` is the self-summarizing-adapter escape hatch: adapters that cap
  returned data at screen resolution (BigWig, HiC, BigMaf, MultiWiggle) report
  `{ alwaysRender: true }` from `getMultiRegionFeatureDensityStats`, so no region is ever too
  large no matter how wide the view.
