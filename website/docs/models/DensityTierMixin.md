---
id: densitytiermixin
title: DensityTierMixin
description: "The density tier: CoarseTierMixin with the adapter's densityAdapter sidecar as the source, the two slots as the mode and the threshold, the zoom bucket as the read key and CoreGetFeatureDensity…"
sidebar_label: Mixin -> DensityTierMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/DensityTierMixin.ts).

The density tier: `CoarseTierMixin` with the adapter's `densityAdapter`
sidecar as the source, the two slots as the mode and the threshold, the zoom
bucket as the read key and `CoreGetFeatureDensity` as the read. Where the
region-too-large gate refuses the features, a display with a density source
draws features per bin in the banner's place; the display decides how the
bins are drawn.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Volatiles

<span data-pagefind-ignore>From [CoarseTierMixin](../coarsetiermixin): <span id="volatile-coarsetier">[`coarseTier`](../coarsetiermixin#volatile-coarsetier)</span>, <span id="volatile-coarsetierread">[`coarseTierRead`](../coarsetiermixin#volatile-coarsetierread)</span>, <span id="volatile-coarsetierloading">[`coarseTierLoading`](../coarsetiermixin#volatile-coarsetierloading)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-coarseadapterslot">**coarseAdapterSlot**</span><br><code>string</code> |  |
| <span id="getter-densitytiermode">**densityTierMode**</span><br><code>"auto" &#124; "density" &#124; "features"</code> | The `densityTier` slot's value. |
| <span id="getter-densitytierthresholdbpperpx">**densityTierThresholdBpPerPx**</span><br><code>number</code> |  |
| <span id="getter-coarsetiermode">**coarseTierMode**</span><br><code>CoarseTierMode</code> |  |
| <span id="getter-coarsetierpastthreshold">**coarseTierPastThreshold**</span><br><code>boolean</code> | `auto` also swaps from the `densityTierBpPerPx` slot outward, where a track asks for the band before the region is too large to fetch. |
| <span id="getter-coarsereadkey">**coarseReadKey**</span><br><code>string</code> | The bins are read at the view's bp/px, so a real zoom re-reads at the level the sidecar keeps for it and a small one reuses what is held. |

<span data-pagefind-ignore>From [CoarseTierMixin](../coarsetiermixin): <span id="getter-coarsetiergated">[`coarseTierGated`](../coarsetiermixin#getter-coarsetiergated)</span>, <span id="getter-coarsetierhassomewheretodraw">[`coarseTierHasSomewhereToDraw`](../coarsetiermixin#getter-coarsetierhassomewheretodraw)</span>, <span id="getter-coarsesourceconfig">[`coarseSourceConfig`](../coarsetiermixin#getter-coarsesourceconfig)</span>, <span id="getter-hascoarsesource">[`hasCoarseSource`](../coarsetiermixin#getter-hascoarsesource)</span>, <span id="getter-coarsetieractive">[`coarseTierActive`](../coarsetiermixin#getter-coarsetieractive)</span>, <span id="getter-coarsetierstandsin">[`coarseTierStandsIn`](../coarsetiermixin#getter-coarsetierstandsin)</span>, <span id="getter-gatemeasurescoarse">[`gateMeasuresCoarse`](../coarsetiermixin#getter-gatemeasurescoarse)</span>, <span id="getter-bytegateadapterpath">[`byteGateAdapterPath`](../coarsetiermixin#getter-bytegateadapterpath)</span>, <span id="getter-gaterefusesdetail">[`gateRefusesDetail`](../coarsetiermixin#getter-gaterefusesdetail)</span>, <span id="getter-coarsetierissuekey">[`coarseTierIssueKey`](../coarsetiermixin#getter-coarsetierissuekey)</span>, <span id="getter-fetchsuspended">[`fetchSuspended`](../coarsetiermixin#getter-fetchsuspended)</span>, <span id="getter-displayphase">[`displayPhase`](../coarsetiermixin#getter-displayphase)</span>, <span id="getter-svgready">[`svgReady`](../coarsetiermixin#getter-svgready)</span>, <span id="getter-drawswhentoolarge">[`drawsWhenTooLarge`](../coarsetiermixin#getter-drawswhentoolarge)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-fetchcoarsetier">**fetchCoarseTier**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(read: CoarseTierRead, ctx: FetchContext) =&gt; Promise&lt;CoarseTier…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(read: CoarseTierRead, ctx: FetchContext) =&gt; Promise&lt;CoarseTierResult&lt;FeatureDensity&gt;&gt;</code></pre></dialog></span> |  |

<span data-pagefind-ignore>From [CoarseTierMixin](../coarsetiermixin): <span id="action-setcoarsetier">[`setCoarseTier`](../coarsetiermixin#action-setcoarsetier)</span>, <span id="action-clearcoarsetier">[`clearCoarseTier`](../coarsetiermixin#action-clearcoarsetier)</span>, <span id="action-setcoarsetierloading">[`setCoarseTierLoading`](../coarsetiermixin#action-setcoarsetierloading)</span></span>
