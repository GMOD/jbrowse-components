---
id: canvasfeaturegatemixin
title: CanvasFeatureGateMixin
sidebar_label: Mixin -> CanvasFeatureGateMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`canvas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/shared/CanvasFeatureGateMixin.ts).

## Overview

Shared byte + density region-too-large gate for canvas feature displays.

Composes on top of `RegionTooLargeMixin` (via `MultiRegionDisplayMixin`) to add
the _density_ axis and the worker-facing budgets, so a display that folds the
byte/density check into its own fetch RPC (canvas-style, no pre-flight) opts in
by composing this mixin and calling `commitGateMeasurements` from its fetch. The
mixin clears its own stale per-region stats on chromosome nav (its
`afterAttach`, so a composing display can't forget the cleanup and silently
mis-gate a reused `displayedRegionIndex`). Every gating decision routes through
the shared pure helpers in `regionTooLargeUtils` (`resolveByteLimit`,
`resolveForceLoadLimits`, `evaluateRegionTooLarge` via the base mixin) so both
canvas feature displays decide identically.

This is the **model-side** counterpart to `DisplayChrome`: the gate's whole job
is to feed one signal — `regionTooLarge` (on `RegionTooLargeMixin`) — which
`DisplayChrome`'s `computeDisplayPhase` reads to render the shared
`TooLargeMessage` banner (see `agent-docs/reference/DISPLAYCHROME.md`). A
display opts into the whole banner story by composing this mixin (the decision)
and rendering `DisplayChrome` (the UI) — the same "single shared layer, small
opt-in contract" shape DisplayChrome uses for loading/error/retry.

## Members

| Member                                                                 | Kind      | Defined by             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------- | --------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [densityStatsPerRegion](#volatile-densitystatsperregion)               | Volatiles | CanvasFeatureGateMixin | per-region feature counts (keyed by displayedRegionIndex), so the density verdict is a live max over the visible regions at the current bpPerPx — never a stale fetch-time snapshot.                                                                                                                                                                                                                                                          |
| [userFeatureDensityLimit](#volatile-userfeaturedensitylimit)           | Volatiles | CanvasFeatureGateMixin | density force-load ceiling; the density-axis counterpart to `RegionTooLargeMixin.userByteLimit`, volatile for the same reason (a force-load must not leak into a saved session).                                                                                                                                                                                                                                                              |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters   | CanvasFeatureGateMixin |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [densityGateEnabled](#getter-densitygateenabled)                       | Getters   | CanvasFeatureGateMixin | Whether the density (features-per-pixel) axis applies.                                                                                                                                                                                                                                                                                                                                                                                        |
| [adapterFetchSizeLimit](#getter-adapterfetchsizelimit)                 | Getters   | CanvasFeatureGateMixin | The adapter's own `fetchSizeLimit` slot (undefined when the adapter type has none); `resolveByteLimit` prefers it over the display config.                                                                                                                                                                                                                                                                                                    |
| [visibleFeatureDensityPerPx](#getter-visiblefeaturedensityperpx)       | Getters   | CanvasFeatureGateMixin | Current density across the visible regions at the debounced coarseBpPerPx, so the verdict shares the layout cadence and doesn't flicker mid-zoom.                                                                                                                                                                                                                                                                                             |
| [maxFeatureDensity](#getter-maxfeaturedensity)                         | Getters   | CanvasFeatureGateMixin | The density budget passed to the worker and used by the derived verdict: undefined (gate off) under a declarative/byte force-load or below AUTO_FORCE_LOAD_BP; otherwise the density force-load ceiling or the config.                                                                                                                                                                                                                        |
| [densityTooLarge](#getter-densitytoolarge)                             | Getters   | CanvasFeatureGateMixin |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters   | CanvasFeatureGateMixin | Folds the density axis into `RegionTooLargeMixin`'s byte-only verdict.                                                                                                                                                                                                                                                                                                                                                                        |
| [observedMaxDensity](#method-observedmaxdensity)                       | Methods   | CanvasFeatureGateMixin | Highest features-per-pixel across the visible regions at `bpPerPx`, from the cached per-region counts.                                                                                                                                                                                                                                                                                                                                        |
| [resolvedByteLimit](#method-resolvedbytelimit)                         | Methods   | CanvasFeatureGateMixin | The byte budget the fetch RPC enforces, short-circuiting an over-budget region before downloading features.                                                                                                                                                                                                                                                                                                                                   |
| [setDensityStats](#action-setdensitystats)                             | Actions   | CanvasFeatureGateMixin |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearGateMeasurements](#action-cleargatemeasurements)                 | Actions   | CanvasFeatureGateMixin | Drop the whole cached estimate on chromosome navigation (displayedRegion indices get reused, so a stale entry would gate the new region against the wrong stats).                                                                                                                                                                                                                                                                             |
| [commitGateMeasurements](#action-commitgatemeasurements)               | Actions   | CanvasFeatureGateMixin | Commit a batch of per-region fetch outcomes: record the per-region byte **max** (not sum — each region is gated against the same per-region budget, so a multi-region view where every region individually fits is never blanked by the cross-region total) and the per-region density, then publish the byte estimate + adapter limit to `RegionTooLargeMixin` so the banner's `resolveByteLimit` picks the same budget the worker gated on. |
| [raiseForceLoadLimits](#action-raiseforceloadlimits)                   | Actions   | CanvasFeatureGateMixin | Dual-axis force-load: clear both user ceilings, then raise exactly the one axis that's actually blocking (`resolveForceLoadLimits` — byte only when it lifts the baseline, else density).                                                                                                                                                                                                                                                     |

<details>
<summary>CanvasFeatureGateMixin - Volatiles</summary>

#### volatile: densityStatsPerRegion

per-region feature counts (keyed by displayedRegionIndex), so the density
verdict is a live max over the visible regions at the current bpPerPx — never a
stale fetch-time snapshot. Survives viewport-change clears; dropped on
chromosome nav by `clearGateMeasurements`.

```ts
// type signature
type densityStatsPerRegion = ObservableMap<number, RegionDensityStats>
// code
densityStatsPerRegion: observable.map<number, RegionDensityStats>()
```

#### volatile: userFeatureDensityLimit

density force-load ceiling; the density-axis counterpart to
`RegionTooLargeMixin.userByteLimit`, volatile for the same reason (a force-load
must not leak into a saved session).

```ts
// type signature
type userFeatureDensityLimit = number | undefined
// code
userFeatureDensityLimit: undefined as number | undefined
```

</details>

<details>
<summary>CanvasFeatureGateMixin - Getters</summary>

#### getter: densityGateEnabled

Whether the density (features-per-pixel) axis applies. Byte-only displays
override this to `false`: e.g. `LinearMultiRowFeatureDisplay` paints features
into fixed lanes, so a high total feature count is not a per-glyph render cost —
only the download (byte) budget should gate it.

```ts
type densityGateEnabled = boolean
```

#### getter: adapterFetchSizeLimit

The adapter's own `fetchSizeLimit` slot (undefined when the adapter type has
none); `resolveByteLimit` prefers it over the display config.

```ts
type adapterFetchSizeLimit = number | undefined
```

#### getter: visibleFeatureDensityPerPx

Current density across the visible regions at the debounced coarseBpPerPx, so
the verdict shares the layout cadence and doesn't flicker mid-zoom.

```ts
type visibleFeatureDensityPerPx = number
```

#### getter: maxFeatureDensity

The density budget passed to the worker and used by the derived verdict:
undefined (gate off) under a declarative/byte force-load or below
AUTO_FORCE_LOAD_BP; otherwise the density force-load ceiling or the config.

```ts
type maxFeatureDensity = number | undefined
```

#### getter: densityTooLargeForDerivedGate

Folds the density axis into `RegionTooLargeMixin`'s byte-only verdict.

```ts
type densityTooLargeForDerivedGate = boolean
```

</details>

<details>
<summary>CanvasFeatureGateMixin - Getters (other undocumented members)</summary>

| Member                                                                             | Type      |
| ---------------------------------------------------------------------------------- | --------- |
| <span id="getter-derivedregiontoolargeenabled">derivedRegionTooLargeEnabled</span> | `boolean` |
| <span id="getter-densitytoolarge">densityTooLarge</span>                           | `boolean` |

</details>

<details>
<summary>CanvasFeatureGateMixin - Methods</summary>

#### method: observedMaxDensity

Highest features-per-pixel across the visible regions at `bpPerPx`, from the
cached per-region counts.

```ts
type observedMaxDensity = (bpPerPx: number) => number
```

#### method: resolvedByteLimit

The byte budget the fetch RPC enforces, short-circuiting an over-budget region
before downloading features. Undefined (unlimited) under force-load or below the
gate floor; otherwise whatever `resolveByteLimit` picks from the three tiers
(user force-load → adapter limit → display config).

```ts
type resolvedByteLimit = () => number | undefined
```

</details>

<details>
<summary>CanvasFeatureGateMixin - Actions</summary>

#### action: clearGateMeasurements

Drop the whole cached estimate on chromosome navigation (displayedRegion indices
get reused, so a stale entry would gate the new region against the wrong stats).
Driven by the mixin's own `afterAttach` below — no composing display has to wire
it up.

```ts
type clearGateMeasurements = () => void
```

#### action: commitGateMeasurements

Commit a batch of per-region fetch outcomes: record the per-region byte **max**
(not sum — each region is gated against the same per-region budget, so a
multi-region view where every region individually fits is never blanked by the
cross-region total) and the per-region density, then publish the byte estimate +
adapter limit to `RegionTooLargeMixin` so the banner's `resolveByteLimit` picks
the same budget the worker gated on.

```ts
type commitGateMeasurements = (measurements: RegionGateMeasurement[]) => void
```

#### action: raiseForceLoadLimits

Dual-axis force-load: clear both user ceilings, then raise exactly the one axis
that's actually blocking (`resolveForceLoadLimits` — byte only when it lifts the
baseline, else density).

```ts
type raiseForceLoadLimits = (
  estimate?: { bytes?: number | undefined } | undefined,
) => void
```

</details>

<details>
<summary>CanvasFeatureGateMixin - Actions (other undocumented members)</summary>

| Member                                                   | Type                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| <span id="action-setdensitystats">setDensityStats</span> | `(displayedRegionIndex: number, stats: RegionDensityStats) => void` |

</details>
