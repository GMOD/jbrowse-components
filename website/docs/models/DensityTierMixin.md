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
| <span id="volatile-densitybinsread">**densityBinsRead**</span><br><code>densityBinsRead: undefined as DensityRead &#124; undefined</code> | What the held bins were read over: the buffered regions, the zoom bucket and the adapter, so a pan or a zoom inside them re-reads nothing. Undefined until a read lands. |
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
| <span id="getter-densitybandactive">**densityBandActive**</span><br><code>boolean</code> | Overridable hook (default: the tier's verdict) — whether the band is standing in for the features on screen right now. A display whose band needs somewhere to draw narrows it: canvas adds the view geometry the draw is mapped through, alignments the coverage band that can be hidden. |
| <span id="getter-fetchsuspended">**fetchSuspended**</span><br><code>boolean</code> | `MultiRegionDisplayMixin`'s hook, from `resolveFetchSuspended` over the tier's verdict. A display whose band needs somewhere to draw (alignments, whose coverage band can be hidden) overrides it with that term. |
| <span id="getter-drawswhentoolarge">**drawsWhenTooLarge**</span><br><code>boolean</code> | `renderDisplaySvg`'s hook: the export paints the band in place of the too-large note, the same swap the chrome makes on screen. Here rather than beside each display's phase getters, which is where it was and where alignments forgot it — `awaitSvgReady` waited out the bins and `SvgChrome` then wrote the note over them. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setdensitybins">**setDensityBins**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(entries: { displayedRegionIndex: number; bins: FeatureDensity;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(entries: { displayedRegionIndex: number; bins: FeatureDensity; }[], read: DensityRead) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-cleardensitybins">**clearDensityBins**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setdensityloading">**setDensityLoading**</span><br><code>(loading: boolean) =&gt; void</code> |  |
