---
id: canvasfeaturegatemixin
title: CanvasFeatureGateMixin
sidebar_label: Mixin -> CanvasFeatureGateMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`canvas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/shared/CanvasFeatureGateMixin.ts).

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

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-densitystatsperregion">**densityStatsPerRegion**</span><br><details><summary><code>densityStatsPerRegion: observable.map&lt;number, RegionDensityStat…</code></summary><pre><code>densityStatsPerRegion: observable.map&lt;number, RegionDensityStats&gt;()</code></pre></details> | per-region feature counts (keyed by displayedRegionIndex), so the density verdict is a live max over the visible regions at the current bpPerPx — never a stale fetch-time snapshot. Survives viewport-change clears; dropped on chromosome nav by `clearGateMeasurements`. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-gatefoldedintofetch">**gateFoldedIntoFetch**</span><br><code>boolean</code> | Contributes the opt-in additively rather than overriding `derivedRegionTooLargeEnabled`: `MultiRegionDisplayMixin` ORs this in, so the gate stays on whichever side of `.compose()` this mixin lands. |
| <span id="getter-densitygateenabled">**densityGateEnabled**</span><br><code>boolean</code> | Whether the density (features-per-pixel) axis applies. Byte-only displays override this to `false`: e.g. `LinearMultiRowFeatureDisplay` paints features into fixed lanes, so a high total feature count is not a per-glyph render cost — only the download (byte) budget should gate it. |
| <span id="getter-visiblefeaturedensityperpx">**visibleFeatureDensityPerPx**</span><br><code>number</code> | Current density across the visible regions at the debounced coarseBpPerPx, so the verdict shares the layout cadence and doesn't flicker mid-zoom. |
| <span id="getter-maxfeaturedensity">**maxFeatureDensity**</span><br><code>number &#124; undefined</code> | The density budget passed to the worker and used by the derived verdict: undefined (gate off) when nothing gates, otherwise the config. Force-load reaches this through the shared `gateActive`, so approving a track's *size* no longer half-disables its *density* axis by side effect — both axes read the one boolean now. |
| <span id="getter-densitytoolarge">**densityTooLarge**</span><br><code>boolean</code> | The density axis of `RegionTooLargeMixin`'s verdict (false in the base mixin, so byte-only displays never gate on it). |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-observedmaxdensity">**observedMaxDensity**</span><br><code>(bpPerPx: number) =&gt; number</code> | Highest features-per-pixel across the visible regions at `bpPerPx`, from the cached per-region counts. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setdensitystats">**setDensityStats**</span><br><details><summary><code>(displayedRegionIndex: number, stats: RegionDensityStats) =&gt; vo…</code></summary><pre><code>(displayedRegionIndex: number, stats: RegionDensityStats) =&gt; void</code></pre></details> |  |
| <span id="action-cleargatemeasurements">**clearGateMeasurements**</span><br><code>() =&gt; void</code> | Drop the cached per-region density stats on chromosome navigation (displayedRegion indices get reused, so a stale entry would gate the new region against the wrong stats). Driven by the mixin's own `afterAttach` below — no composing display has to wire it up. The byte estimate is dropped by `MultiRegionDisplayMixin`'s `DisplayedRegionsChange` autorun on the same trigger.<br><br>Measurements only. Force-load is a track-wide boolean that deliberately outlives navigation, so there is no per-region ceiling to expire here. |
| <span id="action-commitgatemeasurements">**commitGateMeasurements**</span><br><details><summary><code>(measurements: RegionGateMeasurement[], measuredSpanBp: number)…</code></summary><pre><code>(measurements: RegionGateMeasurement[], measuredSpanBp: number) =&gt; void</code></pre></details> | Commit a batch of per-region fetch outcomes: record the per-region byte **max** (not sum — each region is gated against the same per-region budget, so a multi-region view where every region individually fits is never blanked by the cross-region total) and the per-region density, then publish the byte estimate to `RegionTooLargeMixin` — bytes and nothing else, since the budget it is compared against is a main-thread config read (`gateByteLimit`), the same one that produced the worker's `resolvedByteLimit()`. |
