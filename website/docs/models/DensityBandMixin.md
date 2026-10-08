---
id: densitybandmixin
title: DensityBandMixin
description: "The density band: where the cursor is over it, what it draws and what it reads out. Composing DensityTierMixin rather than sitting beside it forces the order, since every getter here keys off the…"
sidebar_label: Mixin -> DensityBandMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `canvas` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/shared/DensityBandMixin.ts).

The density band: where the cursor is over it, what it draws and what it
reads out. Composing `DensityTierMixin` rather than sitting beside it forces
the order, since every getter here keys off the swap the tier decides.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-densityhoverpx">**densityHoverPx**</span><br><code>number &#124; undefined</code> | The cursor's view px, not the bp under it: a wheel zoom under a stationary cursor fires no mousemove, and the px stays true through it. |

<span data-pagefind-ignore>From [CoarseTierMixin](../coarsetiermixin): <span id="volatile-coarsetier">[`coarseTier`](../coarsetiermixin#volatile-coarsetier)</span>, <span id="volatile-coarsetierread">[`coarseTierRead`](../coarsetiermixin#volatile-coarsetierread)</span>, <span id="volatile-coarsetierloading">[`coarseTierLoading`](../coarsetiermixin#volatile-coarsetierloading)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-densitybandlayer">**densityBandLayer**</span><br><code>DensityBandLayer</code> |  |
| <span id="getter-densityhover">**densityHover**</span><br><code>DensityHover &#124; undefined</code> |  |
| <span id="getter-densitypeakreadout">**densityPeakReadout**</span><br><code>string</code> | The band's line of text with no cursor over it. The SVG export writes this text. |
| <span id="getter-densityreadout">**densityReadout**</span><br><code>string</code> | Blank until the first read lands, so the scrim is not captioned "no density data" for a read still in flight. |

<span data-pagefind-ignore>From [DensityTierMixin](../densitytiermixin): <span id="getter-coarseadapterslot">[`coarseAdapterSlot`](../densitytiermixin#getter-coarseadapterslot)</span>, <span id="getter-densitytiermode">[`densityTierMode`](../densitytiermixin#getter-densitytiermode)</span>, <span id="getter-densitytierthresholdbpperpx">[`densityTierThresholdBpPerPx`](../densitytiermixin#getter-densitytierthresholdbpperpx)</span>, <span id="getter-coarsetiermode">[`coarseTierMode`](../densitytiermixin#getter-coarsetiermode)</span>, <span id="getter-coarsetierpastthreshold">[`coarseTierPastThreshold`](../densitytiermixin#getter-coarsetierpastthreshold)</span>, <span id="getter-coarsereadkey">[`coarseReadKey`](../densitytiermixin#getter-coarsereadkey)</span></span>

<span data-pagefind-ignore>From [CoarseTierMixin](../coarsetiermixin): <span id="getter-coarsetiergated">[`coarseTierGated`](../coarsetiermixin#getter-coarsetiergated)</span>, <span id="getter-coarsetierhassomewheretodraw">[`coarseTierHasSomewhereToDraw`](../coarsetiermixin#getter-coarsetierhassomewheretodraw)</span>, <span id="getter-coarsesourceconfig">[`coarseSourceConfig`](../coarsetiermixin#getter-coarsesourceconfig)</span>, <span id="getter-hascoarsesource">[`hasCoarseSource`](../coarsetiermixin#getter-hascoarsesource)</span>, <span id="getter-coarsetieractive">[`coarseTierActive`](../coarsetiermixin#getter-coarsetieractive)</span>, <span id="getter-coarsetierstandsin">[`coarseTierStandsIn`](../coarsetiermixin#getter-coarsetierstandsin)</span>, <span id="getter-gatemeasurescoarse">[`gateMeasuresCoarse`](../coarsetiermixin#getter-gatemeasurescoarse)</span>, <span id="getter-bytegateadapterpath">[`byteGateAdapterPath`](../coarsetiermixin#getter-bytegateadapterpath)</span>, <span id="getter-gaterefusesdetail">[`gateRefusesDetail`](../coarsetiermixin#getter-gaterefusesdetail)</span>, <span id="getter-coarsetierissuekey">[`coarseTierIssueKey`](../coarsetiermixin#getter-coarsetierissuekey)</span>, <span id="getter-fetchsuspended">[`fetchSuspended`](../coarsetiermixin#getter-fetchsuspended)</span>, <span id="getter-displayphase">[`displayPhase`](../coarsetiermixin#getter-displayphase)</span>, <span id="getter-svgready">[`svgReady`](../coarsetiermixin#getter-svgready)</span>, <span id="getter-drawswhentoolarge">[`drawsWhenTooLarge`](../coarsetiermixin#getter-drawswhentoolarge)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setdensityhoverpx">**setDensityHoverPx**</span><br><code>(px?: number &#124; undefined) =&gt; void</code> | Kept only while the band is up, so a pointer over features writes nothing here. |

<span data-pagefind-ignore>From [DensityTierMixin](../densitytiermixin): <span id="action-fetchcoarsetier">[`fetchCoarseTier`](../densitytiermixin#action-fetchcoarsetier)</span></span>

<span data-pagefind-ignore>From [CoarseTierMixin](../coarsetiermixin): <span id="action-setcoarsetier">[`setCoarseTier`](../coarsetiermixin#action-setcoarsetier)</span>, <span id="action-clearcoarsetier">[`clearCoarseTier`](../coarsetiermixin#action-clearcoarsetier)</span>, <span id="action-setcoarsetierloading">[`setCoarseTierLoading`](../coarsetiermixin#action-setcoarsetierloading)</span></span>
