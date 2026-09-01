---
id: densitytiermixin
title: DensityTierMixin
sidebar_label: Mixin -> DensityTierMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/DensityTierMixin.ts).

The density tier: where the region-too-large gate refuses the features, a
display with a density source draws features per bin in the banner's place.
The verdict stays exactly what `RegionTooLargeMixin` derives — the feature
fetch still stops at the gate — and this mixin adds the swap decision, the
bins and the small read that fills them, through the shared fetch skeleton
on its own rotation so the primary fetch's cancel never reaches it. Composed
after `RegionTooLargeMixin`; the display decides how the bins are drawn.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-densitybins">**densityBins**</span><br><code>densityBins: regionDataMap&lt;FeatureDensity&gt;('densityBins')</code> | Features per bin by `displayedRegionIndex`, at the zoom bucket the last read was issued for. Cleared on chromosome navigation. |
| <span id="volatile-densitybinskey">**densityBinsKey**</span><br><code>densityBinsKey: undefined as string &#124; undefined</code> | The issue key of the bins held, which the read compares against. |
| <span id="volatile-densitybinsread">**densityBinsRead**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>densityBinsRead: undefined as &#124; { regions: BufferedVisibleRegio…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>densityBinsRead: undefined as&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#124; {&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;regions: BufferedVisibleRegion[]&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;bucket: number&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;adapterKey: string&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;}&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#124; undefined</code></pre></dialog></span> | What the held bins were read over: the buffered regions, the zoom bucket and the adapter, so a pan or a zoom inside them re-reads nothing. |
| <span id="volatile-densityloading">**densityLoading**</span><br><code>densityLoading: false</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-densitysourceconfig">**densitySourceConfig**</span><br><code>unknown</code> | The `densityAdapter` slot of the adapter the gate measures, read off the live track config so a tiered display's swap follows it. |
| <span id="getter-densitytiermode">**densityTierMode**</span><br><code>"auto" &#124; "density" &#124; "features"</code> |  |
| <span id="getter-densitytierthresholdbpperpx">**densityTierThresholdBpPerPx**</span><br><code>number</code> |  |
| <span id="getter-hasdensitysource">**hasDensitySource**</span><br><code>boolean</code> |  |
| <span id="getter-densitytieractive">**densityTierActive**</span><br><code>boolean</code> | Whether the band stands in for features right now. |
| <span id="getter-fetchsuspended">**fetchSuspended**</span><br><code>boolean</code> | `FetchMixin`'s hook, from `resolveFetchSuspended` over the tier's verdict. A display whose band needs somewhere to draw (alignments, whose coverage band can be hidden) overrides it with that term. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setdensitybins">**setDensityBins**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(entries: {…}[], key: string, read?: { regions: BufferedVisible…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(entries: {…}[], key: string, read?: { regions: BufferedVisibleRegion[]; bucket: number; adapterKey: string; } &#124; undefined) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-cleardensitybins">**clearDensityBins**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setdensityloading">**setDensityLoading**</span><br><code>(loading: boolean) =&gt; void</code> |  |
