---
id: canvasfeaturegatemixin
title: CanvasFeatureGateMixin
sidebar_label: Mixin -> CanvasFeatureGateMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`canvas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/shared/CanvasFeatureGateMixin.ts).

Shared density region-too-large gate for canvas feature displays.

Composes on top of `RegionTooLargeMixin` (via `MultiRegionDisplayMixin`) to add
the _density_ axis — the byte axis, its worker budget (`resolvedByteLimit()`)
and its commit are entirely the base mixin's — so a display whose fetch RPC
counts features as well as measuring bytes opts in by composing this mixin and
calling `commitGateMeasurements` from its fetch. The mixin clears its own stale
per-region stats on chromosome nav (its `afterAttach`, so a composing display
can't forget the cleanup and silently mis-gate a reused `displayedRegionIndex`).
Every gating decision routes through the shared pure helpers in
`regionTooLargeUtils` (`resolveByteLimit`, `evaluateRegionTooLarge`, both via
the base mixin) so both canvas feature displays decide identically.

This is the **model-side** counterpart to `DisplayChrome`: the gate's whole job
is to feed one signal — `regionTooLarge` (on `RegionTooLargeMixin`) — which
`DisplayChrome`'s `computeDisplayPhase` reads to render the shared
`TooLargeMessage` banner (see
[DISPLAYCHROME.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/DISPLAYCHROME.md)).
A display opts into the whole banner story by composing this mixin (the
decision) and rendering `DisplayChrome` (the UI) — the same "single shared
layer, small opt-in contract" shape DisplayChrome uses for loading/error/retry.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-densitystatsperregion">**densityStatsPerRegion**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>densityStatsPerRegion: regionDataMap&lt;RegionDensityStats&gt;( 'dens…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>densityStatsPerRegion: regionDataMap&lt;RegionDensityStats&gt;(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;'densityStatsPerRegion',&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | per-region feature counts (keyed by displayedRegionIndex), so the density verdict is a live max over the visible regions at the current bpPerPx — never a stale fetch-time snapshot. Survives viewport-change clears; dropped on chromosome nav by `clearGateMeasurements`. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-gateenabled">**gateEnabled**</span><br><code>boolean</code> | The byte-gate opt-in, contributed by composing this mixin. It overrides `RegionTooLargeMixin`'s `false`, so this mixin has to be composed AFTER the one that declares it — `types.compose` resolves a member collision to the later argument, and the wrong order hands the opt-in back to the default with no banner and no error. `no-restricted-syntax` fails that order and says why. |
| <span id="getter-densitygateenabled">**densityGateEnabled**</span><br><code>boolean</code> | The density axis is on where something measures it, and this mixin is the only thing that does — `densityTooLarge` below is the measurement, this is the switch, and they belong together. `RegionTooLargeMixin` defaults it false so the byte-only displays don't claim an axis they have no number for.<br><br>Contributed the same way as `gateEnabled` above, and it fails the same way in the wrong compose order — the base's `false` wins and the density axis is silently off. `no-restricted-syntax` fails a `CanvasFeatureGateMixin()` written before `MultiRegionDisplayMixin()` in one `types.compose` and says why, so neither opt-in needs a getter read back at attach to notice. |
| <span id="getter-visiblefeaturedensityperpx">**visibleFeatureDensityPerPx**</span><br><code>number</code> | Current density across the visible regions at the debounced coarseBpPerPx, so the verdict shares the layout cadence and doesn't flicker mid-zoom. |
| <span id="getter-maxfeaturedensity">**maxFeatureDensity**</span><br><code>number &#124; undefined</code> | The density budget passed to the worker and used by the derived verdict: undefined (gate off) when the axis can't gate, otherwise the config. Every term for that — the opt-in, force-load, the `AUTO_FORCE_LOAD_BP` floor — is inside `densityGateActive`, so approving a track's *size* no longer half-disables its *density* axis by side effect and none of them is restated here. It used to ask twice, `!densityGateEnabled \|\| !densityGateActive`, because the first hook lived on this mixin where the second one couldn't see it; both are `RegionTooLargeMixin`'s now. |
| <span id="getter-densitytoolarge">**densityTooLarge**</span><br><code>boolean</code> | The density axis of `RegionTooLargeMixin`'s verdict (false in the base mixin, so byte-only displays never gate on it).<br><br>The comparison is `overDensityBudget`, the same one the worker's two short-circuits make — the number was already shared (`featuresPerPx`) and the comparison was not, which left the banner free to disagree with the decision that produced it at exactly the boundary. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-observedmaxdensity">**observedMaxDensity**</span><br><code>(bpPerPx: number) =&gt; number</code> | Highest features-per-pixel across the visible regions at `bpPerPx`, from the cached per-region counts. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setdensitystats">**setDensityStats**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(displayedRegionIndex: number, stats: RegionDensityStats) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(displayedRegionIndex: number, stats: RegionDensityStats) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-cleargatemeasurements">**clearGateMeasurements**</span><br><code>() =&gt; void</code> | Drop the cached per-region density stats on chromosome navigation (displayedRegion indices get reused, so a stale entry would gate the new region against the wrong stats). Driven by the mixin's own `afterAttach` below — no composing display has to wire it up. The byte estimate is dropped by `MultiRegionDisplayMixin`'s `DisplayedRegionsChange` autorun on the same trigger.<br><br>Measurements only. Force-load is a track-wide boolean that deliberately outlives navigation, so there is no per-region ceiling to expire here. |
| <span id="action-commitgatemeasurements">**commitGateMeasurements**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(measurements: RegionGateMeasurement[], issued: GateFetchState)…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(measurements: RegionGateMeasurement[], issued: GateFetchState) =&gt; void</code></pre></dialog></span> | Commit a batch of per-region fetch outcomes on the **density** axis alone. The byte axis is `RegionTooLargeMixin.commitFetchBytes`, which the fan-out helper calls for every display whose RPC carries a `byteLimit` — this mixin owns only the number nothing else measures. |
