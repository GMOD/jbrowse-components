---
id: canvasfeaturegatemixin
title: CanvasFeatureGateMixin
sidebar_label: Mixin -> CanvasFeatureGateMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/shared/CanvasFeatureGateMixin.ts).

The density axis of the region-too-large gate, composed after
`MultiRegionDisplayMixin`: how the features-per-pixel number is measured and
the worker budget for it. The byte axis is entirely `RegionTooLargeMixin`'s. A
display opts in by composing this and calling `commitGateMeasurements` from
its fetch's `onComplete`.

One display composes it — `LinearBasicDisplay`'s base model. The multi-row
display has no density axis to gate on (see
MultiRowGetFeaturesRPC/rpcTypes.ts), so `shared/` here means "the canvas
plugin's rather than one display's", not "two displays compose it".

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-densitystatsperregion">**densityStatsPerRegion**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>densityStatsPerRegion: regionDataMap&lt;RegionDensityStats&gt;( 'dens…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>densityStatsPerRegion: regionDataMap&lt;RegionDensityStats&gt;(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;'densityStatsPerRegion',&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | Per-region feature counts, keyed by `displayedRegionIndex`, so the verdict is a live max at the current `bpPerPx`. Cleared on navigation. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-gateenabled">**gateEnabled**</span><br><code>boolean</code> | The byte-gate opt-in, contributed here. `types.compose` resolves a collision to the later argument, so this mixin must follow the one that declares it; `no-restricted-syntax` fails the other order. |
| <span id="getter-densitygateenabled">**densityGateEnabled**</span><br><code>boolean</code> | The density axis is on where something measures it. |
| <span id="getter-visiblefeaturedensityperpx">**visibleFeatureDensityPerPx**</span><br><code>number</code> | Density at the debounced `coarseBpPerPx`, so the verdict shares the layout cadence. Zero before the view is measured. |
| <span id="getter-maxfeaturedensity">**maxFeatureDensity**</span><br><code>number &#124; undefined</code> | The worker's density budget; undefined when the axis may not act. |
| <span id="getter-densitytoolarge">**densityTooLarge**</span><br><code>boolean</code> | The density axis of the verdict, through the same `overDensityBudget` the worker's short-circuits use. |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-observedmaxdensity">**observedMaxDensity**</span><br><code>(bpPerPx: number) =&gt; number</code> | Highest features-per-pixel across the visible regions at `bpPerPx`. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setdensitystats">**setDensityStats**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(displayedRegionIndex: number, stats: RegionDensityStats) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(displayedRegionIndex: number, stats: RegionDensityStats) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-cleargatemeasurements">**clearGateMeasurements**</span><br><code>() =&gt; void</code> |  |
| <span id="action-commitgatemeasurements">**commitGateMeasurements**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(measurements: RegionGateMeasurement[], issued: GateFetchState)…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(measurements: RegionGateMeasurement[], issued: GateFetchState) =&gt; void</code></pre></dialog></span> | Commit a batch of per-region fetch results on the density axis, judged by the tier captured at issue. The byte axis is `commitFetchBytes`. |
