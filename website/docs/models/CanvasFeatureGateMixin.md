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
the _density_ axis — the byte axis and its worker budget (`resolvedByteLimit()`)
are entirely the base mixin's — so a display that folds the byte/density check
into its own fetch RPC (canvas-style, no pre-flight) opts in by composing this
mixin and calling `commitGateMeasurements` from its fetch. The mixin clears its
own stale per-region stats on chromosome nav (its `afterAttach`, so a composing
display can't forget the cleanup and silently mis-gate a reused
`displayedRegionIndex`). Every gating decision routes through the shared pure
helpers in `regionTooLargeUtils` (`resolveByteLimit`, `evaluateRegionTooLarge`,
both via the base mixin) so both canvas feature displays decide identically.

This is the **model-side** counterpart to `DisplayChrome`: the gate's whole job
is to feed one signal — `regionTooLarge` (on `RegionTooLargeMixin`) — which
`DisplayChrome`'s `computeDisplayPhase` reads to render the shared
`TooLargeMessage` banner (see
[DISPLAYCHROME.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/DISPLAYCHROME.md)).
A display opts into the whole banner story by composing this mixin (the
decision) and rendering `DisplayChrome` (the UI) — the same "single shared
layer, small opt-in contract" shape DisplayChrome uses for loading/error/retry.

## Members

| Member                                                           | Kind      | Defined by             | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------- | --------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [densityStatsPerRegion](#volatile-densitystatsperregion)         | Volatiles | CanvasFeatureGateMixin | per-region feature counts (keyed by displayedRegionIndex), so the density verdict is a live max over the visible regions at the current bpPerPx — never a stale fetch-time snapshot.                                                                                                                                                                                                                                                                                                                                             |
| [gateFoldedIntoFetch](#getter-gatefoldedintofetch)               | Getters   | CanvasFeatureGateMixin | Contributes the opt-in additively rather than overriding `derivedRegionTooLargeEnabled`: `MultiRegionDisplayMixin` ORs this in, so the gate stays on whichever side of `.compose()` this mixin lands.                                                                                                                                                                                                                                                                                                                            |
| [densityGateEnabled](#getter-densitygateenabled)                 | Getters   | CanvasFeatureGateMixin | Whether the density (features-per-pixel) axis applies.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [visibleFeatureDensityPerPx](#getter-visiblefeaturedensityperpx) | Getters   | CanvasFeatureGateMixin | Current density across the visible regions at the debounced coarseBpPerPx, so the verdict shares the layout cadence and doesn't flicker mid-zoom.                                                                                                                                                                                                                                                                                                                                                                                |
| [maxFeatureDensity](#getter-maxfeaturedensity)                   | Getters   | CanvasFeatureGateMixin | The density budget passed to the worker and used by the derived verdict: undefined (gate off) when nothing gates, otherwise the config.                                                                                                                                                                                                                                                                                                                                                                                          |
| [densityTooLarge](#getter-densitytoolarge)                       | Getters   | CanvasFeatureGateMixin | The density axis of `RegionTooLargeMixin`'s verdict (false in the base mixin, so byte-only displays never gate on it).                                                                                                                                                                                                                                                                                                                                                                                                           |
| [observedMaxDensity](#method-observedmaxdensity)                 | Methods   | CanvasFeatureGateMixin | Highest features-per-pixel across the visible regions at `bpPerPx`, from the cached per-region counts.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [setDensityStats](#action-setdensitystats)                       | Actions   | CanvasFeatureGateMixin |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [clearGateMeasurements](#action-cleargatemeasurements)           | Actions   | CanvasFeatureGateMixin | Drop the cached per-region density stats on chromosome navigation (displayedRegion indices get reused, so a stale entry would gate the new region against the wrong stats).                                                                                                                                                                                                                                                                                                                                                      |
| [commitGateMeasurements](#action-commitgatemeasurements)         | Actions   | CanvasFeatureGateMixin | Commit a batch of per-region fetch outcomes: record the per-region byte **max** (not sum — each region is gated against the same per-region budget, so a multi-region view where every region individually fits is never blanked by the cross-region total) and the per-region density, then publish the byte estimate to `RegionTooLargeMixin` — bytes and nothing else, since the budget it is compared against is a main-thread config read (`gateByteLimit`), the same one that produced the worker's `resolvedByteLimit()`. |

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

</details>

<details>
<summary>CanvasFeatureGateMixin - Getters</summary>

#### getter: gateFoldedIntoFetch

Contributes the opt-in additively rather than overriding
`derivedRegionTooLargeEnabled`: `MultiRegionDisplayMixin` ORs this in, so the
gate stays on whichever side of `.compose()` this mixin lands.

```ts
type gateFoldedIntoFetch = boolean
```

#### getter: densityGateEnabled

Whether the density (features-per-pixel) axis applies. Byte-only displays
override this to `false`: e.g. `LinearMultiRowFeatureDisplay` paints features
into fixed lanes, so a high total feature count is not a per-glyph render cost —
only the download (byte) budget should gate it.

```ts
type densityGateEnabled = boolean
```

#### getter: visibleFeatureDensityPerPx

Current density across the visible regions at the debounced coarseBpPerPx, so
the verdict shares the layout cadence and doesn't flicker mid-zoom.

```ts
type visibleFeatureDensityPerPx = number
```

#### getter: maxFeatureDensity

The density budget passed to the worker and used by the derived verdict:
undefined (gate off) when nothing gates, otherwise the config. Force-load
reaches this through the shared `gateActive`, so approving a track's _size_ no
longer half-disables its _density_ axis by side effect — both axes read the one
boolean now.

```ts
type maxFeatureDensity = number | undefined
```

#### getter: densityTooLarge

The density axis of `RegionTooLargeMixin`'s verdict (false in the base mixin, so
byte-only displays never gate on it).

```ts
type densityTooLarge = boolean
```

</details>

<details>
<summary>CanvasFeatureGateMixin - Methods</summary>

#### method: observedMaxDensity

Highest features-per-pixel across the visible regions at `bpPerPx`, from the
cached per-region counts.

```ts
type observedMaxDensity = (bpPerPx: number) => number
```

</details>

<details>
<summary>CanvasFeatureGateMixin - Actions</summary>

#### action: clearGateMeasurements

Drop the cached per-region density stats on chromosome navigation
(displayedRegion indices get reused, so a stale entry would gate the new region
against the wrong stats). Driven by the mixin's own `afterAttach` below — no
composing display has to wire it up. The byte estimate is dropped by
`MultiRegionDisplayMixin`'s `DisplayedRegionsChange` autorun on the same
trigger.

Measurements only. Force-load is a track-wide boolean that deliberately outlives
navigation, so there is no per-region ceiling to expire here.

```ts
type clearGateMeasurements = () => void
```

#### action: commitGateMeasurements

Commit a batch of per-region fetch outcomes: record the per-region byte **max**
(not sum — each region is gated against the same per-region budget, so a
multi-region view where every region individually fits is never blanked by the
cross-region total) and the per-region density, then publish the byte estimate
to `RegionTooLargeMixin` — bytes and nothing else, since the budget it is
compared against is a main-thread config read (`gateByteLimit`), the same one
that produced the worker's `resolvedByteLimit()`.

```ts
type commitGateMeasurements = (
  measurements: RegionGateMeasurement[],
  measuredSpanBp: number,
) => void
```

</details>

<details>
<summary>CanvasFeatureGateMixin - Actions (other undocumented members)</summary>

| Member                                                   | Type                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| <span id="action-setdensitystats">setDensityStats</span> | `(displayedRegionIndex: number, stats: RegionDensityStats) => void` |

</details>
