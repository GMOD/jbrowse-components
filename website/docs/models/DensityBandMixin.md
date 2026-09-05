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
| <span id="volatile-coarsetier">**coarseTier**</span><br><code>coarseTier: regionDataMap&lt;P&gt;('coarseTier')</code> | <span data-pagefind-ignore>The coarse payload by `displayedRegionIndex`, over the regions the last read was issued for. Cleared on chromosome navigation.</span> | [CoarseTierMixin](../coarsetiermixin#volatile-coarsetier) |
| <span id="volatile-coarsetierread">**coarseTierRead**</span><br><code>coarseTierRead: undefined as CoarseTierRead &#124; undefined</code> | <span data-pagefind-ignore>What the held payloads were read over — the buffered regions and the read key — so a pan or a zoom inside them re-reads nothing. Undefined until a read lands.</span> | [CoarseTierMixin](../coarsetiermixin#volatile-coarsetierread) |
| <span id="volatile-coarsetierloading">**coarseTierLoading**</span><br><code>coarseTierLoading: false</code> |  | [CoarseTierMixin](../coarsetiermixin#volatile-coarsetierloading) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-coarsetierstandsin">**coarseTierStandsIn**</span><br><code>boolean</code> |  | DensityBandMixin |
| <span id="getter-densitybandlayer">**densityBandLayer**</span><br><code>DensityBandLayer</code> |  | DensityBandMixin |
| <span id="getter-densityhover">**densityHover**</span><br><code>DensityHover &#124; undefined</code> |  | DensityBandMixin |
| <span id="getter-densitypeakreadout">**densityPeakReadout**</span><br><code>string</code> | The band's line of text with no cursor over it, which is what the SVG export writes. | DensityBandMixin |
| <span id="getter-densityreadout">**densityReadout**</span><br><code>string</code> | Blank until the first read lands, so the scrim is not captioned "no density data" for a read still in flight. | DensityBandMixin |
| <span id="getter-coarseadapterslot">**coarseAdapterSlot**</span><br><code>string</code> |  | [DensityTierMixin](../densitytiermixin#getter-coarseadapterslot) |
| <span id="getter-densitytiermode">**densityTierMode**</span><br><code>"auto" &#124; "density" &#124; "features"</code> | <span data-pagefind-ignore>The `densityTier` slot's value.</span> | [DensityTierMixin](../densitytiermixin#getter-densitytiermode) |
| <span id="getter-densitytierthresholdbpperpx">**densityTierThresholdBpPerPx**</span><br><code>number</code> |  | [DensityTierMixin](../densitytiermixin#getter-densitytierthresholdbpperpx) |
| <span id="getter-coarsetiermode">**coarseTierMode**</span><br><code>CoarseTierMode</code> |  | [DensityTierMixin](../densitytiermixin#getter-coarsetiermode) |
| <span id="getter-coarsetierpastthreshold">**coarseTierPastThreshold**</span><br><code>boolean</code> | <span data-pagefind-ignore>`auto` also swaps from the `densityTierBpPerPx` slot outward, where a track asks for the band before the region is too large to fetch.</span> | [DensityTierMixin](../densitytiermixin#getter-coarsetierpastthreshold) |
| <span id="getter-coarsereadkey">**coarseReadKey**</span><br><code>string</code> | <span data-pagefind-ignore>The bins are read at the view's bp/px, so a real zoom re-reads at the level the sidecar keeps for it and a small one reuses what is held.</span> | [DensityTierMixin](../densitytiermixin#getter-coarsereadkey) |
| <span id="getter-coarsetiergated">**coarseTierGated**</span><br><code>boolean</code> | <span data-pagefind-ignore>Overridable hook (default false): the coarse read is a feature download the byte gate has to measure. The gate then measures the coarse adapter while the tier is up, its refusal is the banner, the detail fetch stands down outright since the coarse read is the measurement pass, and the swap is by threshold alone — the verdict is about whichever tier is up, so it cannot also pick the tier. A read bounded by construction (bins per screen pixel) leaves this off.</span> | [CoarseTierMixin](../coarsetiermixin#getter-coarsetiergated) |
| <span id="getter-coarsesourceconfig">**coarseSourceConfig**</span><br><code>unknown</code> | <span data-pagefind-ignore>The coarse source's config, read off the live track config so a re-pointed adapter follows.</span> | [CoarseTierMixin](../coarsetiermixin#getter-coarsesourceconfig) |
| <span id="getter-hascoarsesource">**hasCoarseSource**</span><br><code>boolean</code> |  | [CoarseTierMixin](../coarsetiermixin#getter-hascoarsesource) |
| <span id="getter-coarsetieractive">**coarseTierActive**</span><br><code>boolean</code> | <span data-pagefind-ignore>Whether the coarse tier stands in for the detail right now.</span> | [CoarseTierMixin](../coarsetiermixin#getter-coarsetieractive) |
| <span id="getter-gatemeasurescoarse">**gateMeasuresCoarse**</span><br><code>boolean</code> | <span data-pagefind-ignore>The byte gate is measuring the coarse read rather than the detail fetch, so its verdict is about the tier on screen.</span> | [CoarseTierMixin](../coarsetiermixin#getter-gatemeasurescoarse) |
| <span id="getter-bytegateadapterpath">**byteGateAdapterPath**</span><br><code>string[]</code> | <span data-pagefind-ignore>`RegionTooLargeMixin`'s hook: measure the adapter of the fetch that is about to run, so the estimate and the budget describe one file.</span> | [CoarseTierMixin](../coarsetiermixin#getter-bytegateadapterpath) |
| <span id="getter-gaterefusesdetail">**gateRefusesDetail**</span><br><code>boolean</code> | <span data-pagefind-ignore>The gate's refusal is about the detail fetch, so that fetch owes the re-measure the gate releases through.</span> | [CoarseTierMixin](../coarsetiermixin#getter-gaterefusesdetail) |
| <span id="getter-coarsetierissuekey">**coarseTierIssueKey**</span><br><code>string</code> | <span data-pagefind-ignore>The whole key a read is held under: the coarse adapter and the display's own term.</span> | [CoarseTierMixin](../coarsetiermixin#getter-coarsetierissuekey) |
| <span id="getter-fetchsuspended">**fetchSuspended**</span><br><code>boolean</code> | <span data-pagefind-ignore>`MultiRegionDisplayMixin`'s hook, from `resolveFetchSuspended` over `coarseTierStandsIn`.</span> | [CoarseTierMixin](../coarsetiermixin#getter-fetchsuspended) |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayPhase</code> | <span data-pagefind-ignore>The foundation's phase with the too-large banner swapped for the tier — see `coarseTierDisplayPhase`.</span> | [CoarseTierMixin](../coarsetiermixin#getter-displayphase) |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | <span data-pagefind-ignore>The export gate under the same swap — see `coarseTierSvgReady`.</span> | [CoarseTierMixin](../coarsetiermixin#getter-svgready) |
| <span id="getter-drawswhentoolarge">**drawsWhenTooLarge**</span><br><code>boolean</code> | <span data-pagefind-ignore>`renderDisplaySvg`'s hook: the export paints the tier in place of the too-large note, the same swap the chrome makes on screen — unless the note is about the coarse read itself.</span> | [CoarseTierMixin](../coarsetiermixin#getter-drawswhentoolarge) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setdensityhoverpx">**setDensityHoverPx**</span><br><code>(px?: number &#124; undefined) =&gt; void</code> | Kept only while the band is up, so a pointer over features writes nothing here. | DensityBandMixin |
| <span id="action-fetchcoarsetier">**fetchCoarseTier**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(read: CoarseTierRead, ctx: FetchContext) =&gt; Promise&lt;CoarseTier…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(read: CoarseTierRead, ctx: FetchContext) =&gt; Promise&lt;CoarseTierResult&lt;FeatureDensity&gt;&gt;</code></pre></dialog></span> |  | [DensityTierMixin](../densitytiermixin#action-fetchcoarsetier) |
| <span id="action-setcoarsetier">**setCoarseTier**</span><br><code>(entries: CoarseTierEntry&lt;P&gt;[], read: CoarseTierRead) =&gt; void</code> |  | [CoarseTierMixin](../coarsetiermixin#action-setcoarsetier) |
| <span id="action-clearcoarsetier">**clearCoarseTier**</span><br><code>() =&gt; void</code> |  | [CoarseTierMixin](../coarsetiermixin#action-clearcoarsetier) |
| <span id="action-setcoarsetierloading">**setCoarseTierLoading**</span><br><code>(loading: boolean) =&gt; void</code> |  | [CoarseTierMixin](../coarsetiermixin#action-setcoarsetierloading) |
