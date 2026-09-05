---
id: densitybandmixin
title: DensityBandMixin
sidebar_label: Mixin -> DensityBandMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/shared/DensityBandMixin.ts).

The density band: where the cursor is over it, what it draws and what it
reads out. Composing `DensityTierMixin` rather than sitting beside it forces
the order, since every getter here keys off the swap the tier decides.

Members a composed model contributes are listed here too, so these tables are the whole surface.

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-densityhoverpx">**densityHoverPx**</span><br><code>densityHoverPx: undefined as number &#124; undefined</code> | The cursor's view px, not the bp under it: a wheel zoom under a stationary cursor fires no mousemove, and the px stays true through it. | DensityBandMixin |
| <span id="volatile-densitybins">**densityBins**</span><br><code>densityBins: regionDataMap&lt;FeatureDensity&gt;('densityBins')</code> | <span data-pagefind-ignore>Features per bin by `displayedRegionIndex`, at the zoom bucket the last read was issued for. Cleared on chromosome navigation.</span> | [DensityTierMixin](../densitytiermixin#volatile-densitybins) |
| <span id="volatile-densitybinsread">**densityBinsRead**</span><br><code>densityBinsRead: undefined as DensityRead &#124; undefined</code> | <span data-pagefind-ignore>What the held bins were read over: the buffered regions, the zoom bucket and the adapter, so a pan or a zoom inside them re-reads nothing. Undefined until a read lands.</span> | [DensityTierMixin](../densitytiermixin#volatile-densitybinsread) |
| <span id="volatile-densityloading">**densityLoading**</span><br><code>densityLoading: false</code> |  | [DensityTierMixin](../densitytiermixin#volatile-densityloading) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-densitybandactive">**densityBandActive**</span><br><code>boolean</code> |  | DensityBandMixin |
| <span id="getter-densitybandlayer">**densityBandLayer**</span><br><code>DensityBandLayer</code> |  | DensityBandMixin |
| <span id="getter-densityhover">**densityHover**</span><br><code>DensityHover &#124; undefined</code> |  | DensityBandMixin |
| <span id="getter-densitypeakreadout">**densityPeakReadout**</span><br><code>string</code> | The band's line of text with no cursor over it, which is what the SVG export writes. | DensityBandMixin |
| <span id="getter-densityreadout">**densityReadout**</span><br><code>string</code> | Blank until the first read lands, so the scrim is not captioned "no density data" for a read still in flight. | DensityBandMixin |
| <span id="getter-densitysourceconfig">**densitySourceConfig**</span><br><code>unknown</code> | <span data-pagefind-ignore>The `densityAdapter` slot of the adapter the gate measures, read off the live track config so a tiered display's swap follows it.</span> | [DensityTierMixin](../densitytiermixin#getter-densitysourceconfig) |
| <span id="getter-densitytiermode">**densityTierMode**</span><br><code>"auto" &#124; "density" &#124; "features"</code> |  | [DensityTierMixin](../densitytiermixin#getter-densitytiermode) |
| <span id="getter-densitytierthresholdbpperpx">**densityTierThresholdBpPerPx**</span><br><code>number</code> |  | [DensityTierMixin](../densitytiermixin#getter-densitytierthresholdbpperpx) |
| <span id="getter-hasdensitysource">**hasDensitySource**</span><br><code>boolean</code> |  | [DensityTierMixin](../densitytiermixin#getter-hasdensitysource) |
| <span id="getter-densitytieractive">**densityTierActive**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether the band stands in for features right now.</span> | [DensityTierMixin](../densitytiermixin#getter-densitytieractive) |
| <span id="getter-fetchsuspended">**fetchSuspended**</span><br><code>boolean</code> | <span data-pagefind-ignore>`MultiRegionDisplayMixin`'s hook, from `resolveFetchSuspended` over `densityBandActive`.</span> | [DensityTierMixin](../densitytiermixin#getter-fetchsuspended) |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayPhase</code> | <span data-pagefind-ignore>The foundation's phase with the too-large banner swapped for the band — see `densityBandDisplayPhase`. Composed after the foundation, so this getter is the one `types.compose` keeps.</span> | [DensityTierMixin](../densitytiermixin#getter-displayphase) |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | <span data-pagefind-ignore>The export gate under the same swap — see `densityBandSvgReady`.</span> | [DensityTierMixin](../densitytiermixin#getter-svgready) |
| <span id="getter-drawswhentoolarge">**drawsWhenTooLarge**</span><br><code>boolean</code> | <span data-pagefind-ignore>`renderDisplaySvg`'s hook: the export paints the band in place of the too-large note, the same swap the chrome makes on screen. Here rather than beside each display's phase getters, which is where it was and where alignments forgot it — `awaitSvgReady` waited out the bins and `SvgChrome` then wrote the note over them.</span> | [DensityTierMixin](../densitytiermixin#getter-drawswhentoolarge) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setdensityhoverpx">**setDensityHoverPx**</span><br><code>(px?: number &#124; undefined) =&gt; void</code> | Kept only while the band is up, so a pointer over features writes nothing here. | DensityBandMixin |
| <span id="action-setdensitybins">**setDensityBins**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(entries: { displayedRegionIndex: number; bins: FeatureDensity;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(entries: { displayedRegionIndex: number; bins: FeatureDensity; }[], read: DensityRead) =&gt; void</code></pre></dialog></span> |  | [DensityTierMixin](../densitytiermixin#action-setdensitybins) |
| <span id="action-cleardensitybins">**clearDensityBins**</span><br><code>() =&gt; void</code> |  | [DensityTierMixin](../densitytiermixin#action-cleardensitybins) |
| <span id="action-setdensityloading">**setDensityLoading**</span><br><code>(loading: boolean) =&gt; void</code> |  | [DensityTierMixin](../densitytiermixin#action-setdensityloading) |
