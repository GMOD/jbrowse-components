---
id: densitybandmixin
title: DensityBandMixin
sidebar_label: Mixin -> DensityBandMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/shared/DensityBandMixin.ts).

The density band: where the cursor is over it, what it draws, what it reads
out, and the three foundation getters the band stands in for the too-large
banner in.

Composes `DensityTierMixin` rather than sitting beside it, because the swap
it decides is what every getter here keys off — a display taking the band
takes the tier, in that order, and cannot compose them the wrong way round.
A display with its own stand-in for the banner takes the tier alone, which is
what `LinearAlignmentsDisplay` does.

Composed after the fetch foundation, whose `displayPhase` / `svgReady` it
post-processes — `types.compose` resolves a collision to the later argument.

The two displays drawing a band compose it: `LinearBasicDisplay`'s base model
and `LinearMultiRowFeatureDisplay`, which had the block written out line for
line.

Members a composed model contributes are listed here too, so these tables are the whole surface.

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-densityhover">**densityHover**</span><br><code>densityHover: undefined as DensityHover &#124; undefined</code> | Where the cursor is over the density band, for its readout. | DensityBandMixin |
| <span id="volatile-densitybins">**densityBins**</span><br><code>densityBins: regionDataMap&lt;FeatureDensity&gt;('densityBins')</code> | <span data-pagefind-ignore>Features per bin by `displayedRegionIndex`, at the zoom bucket the last read was issued for. Cleared on chromosome navigation.</span> | [DensityTierMixin](../densitytiermixin#volatile-densitybins) |
| <span id="volatile-densitybinsread">**densityBinsRead**</span><br><code>densityBinsRead: undefined as DensityRead &#124; undefined</code> | <span data-pagefind-ignore>What the held bins were read over: the buffered regions, the zoom bucket and the adapter, so a pan or a zoom inside them re-reads nothing. Undefined until a read lands.</span> | [DensityTierMixin](../densitytiermixin#volatile-densitybinsread) |
| <span id="volatile-densityloading">**densityLoading**</span><br><code>densityLoading: false</code> |  | [DensityTierMixin](../densitytiermixin#volatile-densityloading) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-densitybandactive">**densityBandActive**</span><br><code>boolean</code> | Whether the band stands in for the features here — the tier's own decision, plus the view geometry the draw is mapped through. | DensityBandMixin |
| <span id="getter-densitybandlayer">**densityBandLayer**</span><br><code>DensityBandLayer</code> |  | DensityBandMixin |
| <span id="getter-densityreadout">**densityReadout**</span><br><code>string</code> | The band's line of text: its peak, and the source's value under the cursor while there is one. | DensityBandMixin |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayPhase</code> | The foundation's phase with the too-large banner swapped for the band — see `densityBandDisplayPhase`. | DensityBandMixin |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | The export gate with the same swap — see `densityBandSvgReady`. | DensityBandMixin |
| <span id="getter-drawswhentoolarge">**drawsWhenTooLarge**</span><br><code>boolean</code> | `renderDisplaySvg`'s hook: the export paints the band in place of the too-large note, the same swap the chrome makes on screen. | DensityBandMixin |
| <span id="getter-densitysourceconfig">**densitySourceConfig**</span><br><code>unknown</code> | <span data-pagefind-ignore>The `densityAdapter` slot of the adapter the gate measures, read off the live track config so a tiered display's swap follows it.</span> | [DensityTierMixin](../densitytiermixin#getter-densitysourceconfig) |
| <span id="getter-densitytiermode">**densityTierMode**</span><br><code>"auto" &#124; "density" &#124; "features"</code> |  | [DensityTierMixin](../densitytiermixin#getter-densitytiermode) |
| <span id="getter-densitytierthresholdbpperpx">**densityTierThresholdBpPerPx**</span><br><code>number</code> |  | [DensityTierMixin](../densitytiermixin#getter-densitytierthresholdbpperpx) |
| <span id="getter-densitybinskey">**densityBinsKey**</span><br><code>string &#124; undefined</code> | <span data-pagefind-ignore>The key of the read the held bins came from, which the fetch skeleton compares an issue against; undefined until a read lands.</span> | [DensityTierMixin](../densitytiermixin#getter-densitybinskey) |
| <span id="getter-hasdensitysource">**hasDensitySource**</span><br><code>boolean</code> |  | [DensityTierMixin](../densitytiermixin#getter-hasdensitysource) |
| <span id="getter-densitytieractive">**densityTierActive**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether the band stands in for features right now.</span> | [DensityTierMixin](../densitytiermixin#getter-densitytieractive) |
| <span id="getter-fetchsuspended">**fetchSuspended**</span><br><code>boolean</code> | <span data-pagefind-ignore>`MultiRegionDisplayMixin`'s hook, from `resolveFetchSuspended` over the tier's verdict. A display whose band needs somewhere to draw (alignments, whose coverage band can be hidden) overrides it with that term.</span> | [DensityTierMixin](../densitytiermixin#getter-fetchsuspended) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setdensityhoverpx">**setDensityHoverPx**</span><br><code>(px?: number &#124; undefined) =&gt; void</code> | The cursor's view px over the band, or nothing when it leaves. | DensityBandMixin |
| <span id="action-setdensitybins">**setDensityBins**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(entries: { displayedRegionIndex: number; bins: FeatureDensity;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(entries: { displayedRegionIndex: number; bins: FeatureDensity; }[], read: DensityRead) =&gt; void</code></pre></dialog></span> |  | [DensityTierMixin](../densitytiermixin#action-setdensitybins) |
| <span id="action-cleardensitybins">**clearDensityBins**</span><br><code>() =&gt; void</code> |  | [DensityTierMixin](../densitytiermixin#action-cleardensitybins) |
| <span id="action-setdensityloading">**setDensityLoading**</span><br><code>(loading: boolean) =&gt; void</code> |  | [DensityTierMixin](../densitytiermixin#action-setdensityloading) |
