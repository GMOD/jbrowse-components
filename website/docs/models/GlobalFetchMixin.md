---
id: globalfetchmixin
title: GlobalFetchMixin
description: "The foundation for a display holding one non-regional dataset: HiC's contact matrix, the LD triangle, multi-way synteny's lanes."
sidebar_label: Mixin -> GlobalFetchMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/GlobalFetchMixin.ts).

The foundation for a display holding one non-regional dataset: HiC's contact
matrix, the LD triangle, multi-way synteny's lanes. Composes
`RegionTooLargeMixin`, `RenderLifecycleMixin` and `KeyedFetchMixin`, and adds
the host, the block signatures and the readiness getters that read the view.
It installs no autoruns: each display installs its fetch with
`installGlobalFetchAutorun`.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Volatiles

<details class="inherited-members" data-pagefind-ignore>
<summary>19 inherited volatiles from 4 models</summary>

From [KeyedFetchMixin](../keyedfetchmixin): <span id="volatile-loadedfetchkey">[`loadedFetchKey`](../keyedfetchmixin#volatile-loadedfetchkey)</span>

From [FetchMixin](../fetchmixin): <span id="volatile-activesignal">[`activeSignal`](../fetchmixin#volatile-activesignal)</span>, <span id="volatile-fetchgeneration">[`fetchGeneration`](../fetchmixin#volatile-fetchgeneration)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../fetchmixin#volatile-reloadcounter)</span>, <span id="volatile-statuswindow">[`statusWindow`](../fetchmixin#volatile-statuswindow)</span>, <span id="volatile-error">[`error`](../fetchmixin#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../fetchmixin#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../fetchmixin#volatile-statusprogress)</span>, <span id="volatile-fetchcanceled">[`fetchCanceled`](../fetchmixin#volatile-fetchcanceled)</span>, <span id="volatile-fetchrotation">[`fetchRotation`](../fetchmixin#volatile-fetchrotation)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="volatile-canvasdrawn">[`canvasDrawn`](../renderlifecyclemixin#volatile-canvasdrawn)</span>, <span id="volatile-paintcount">[`paintCount`](../renderlifecyclemixin#volatile-paintcount)</span>, <span id="volatile-currentrenderingbackend">[`currentRenderingBackend`](../renderlifecyclemixin#volatile-currentrenderingbackend)</span>, <span id="volatile-rendertick">[`renderTick`](../renderlifecyclemixin#volatile-rendertick)</span>, <span id="volatile-rendererror">[`renderError`](../renderlifecyclemixin#volatile-rendererror)</span>, <span id="volatile-offscreen">[`offScreen`](../renderlifecyclemixin#volatile-offscreen)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="volatile-forceloadtrack">[`forceLoadTrack`](../regiontoolargemixin#volatile-forceloadtrack)</span>, <span id="volatile-byteestimate">[`byteEstimate`](../regiontoolargemixin#volatile-byteestimate)</span>, <span id="volatile-gatemeasuredviewportkey">[`gateMeasuredViewportKey`](../regiontoolargemixin#volatile-gatemeasuredviewportkey)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-host">**host**</span><br><code>RegionHost</code> | The view this display reads regions, viewport and scale from; see `containingHost`. |
| <span id="getter-canvaswidthpx">**canvasWidthPx**</span><br><code>number</code> | The CSS width of this display's on-screen canvas, in px; see `trackCanvasWidthPx`. A heatmap laid out over the whole content reads the content width instead (`TriangleMatrixMixin.canvasWidth`). |
| <span id="getter-staticblocksignature">**staticBlockSignature**</span><br><code>string &#124; undefined</code> | The static-block set as a signature, `undefined` before the view is measured: what a `viewSignature` starts from. HiC appends its resolution. |
| <span id="getter-dynamicblocksignature">**dynamicBlockSignature**</span><br><code>string &#124; undefined</code> | The same over `dynamicBlocks`, for a display whose fetch window is the live viewport rather than the snapped block set (LD). |
| <span id="getter-viewportempty">**viewportEmpty**</span><br><code>boolean</code> | No content block is on screen, so there is nothing to fetch or paint; see `viewportEmpty.ts`. |
| <span id="getter-canrender">**canRender**</span><br><code>boolean</code> | `RenderLifecycleMixin`'s hook: the view has initialized. |
| <span id="getter-renderscanvas">**rendersCanvas**</span><br><code>boolean</code> | `RenderLifecycleMixin`'s hook: a display that will not fetch shows a placeholder where its canvas would be. |
| <span id="getter-paintinert">**paintInert**</span><br><code>boolean</code> | `RenderLifecycleMixin`'s `paintInert` hook; see `foundationPaintInert`. Overridable for a further inert state. |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | An SVG export can read this display's data; off-screen renderers wait on it through `awaitSvgReady(model)`. See `foundationSvgReady`. |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayPhase</code> | The display's visual state, mapped by `foundationDisplayPhase`. This family's staleness argument is the constant `true`: the last frame is genomic and draws correctly under the live view, so a pan or zoom shows no scrim beyond the `isLoading` window. |

<details class="inherited-members" data-pagefind-ignore>
<summary>33 inherited getters from 4 models</summary>

From [KeyedFetchMixin](../keyedfetchmixin): <span id="getter-viewsignature">[`viewSignature`](../keyedfetchmixin#getter-viewsignature)</span>, <span id="getter-datasuperseded">[`dataSuperseded`](../keyedfetchmixin#getter-datasuperseded)</span>, <span id="getter-currentfetchkey">[`currentFetchKey`](../keyedfetchmixin#getter-currentfetchkey)</span>, <span id="getter-datacurrent">[`dataCurrent`](../keyedfetchmixin#getter-datacurrent)</span>

From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-fetchinert">[`fetchInert`](../fetchmixin#getter-fetchinert)</span>, <span id="getter-awaitingprerequisite">[`awaitingPrerequisite`](../fetchmixin#getter-awaitingprerequisite)</span>, <span id="getter-awaitingdependentdata">[`awaitingDependentData`](../fetchmixin#getter-awaitingdependentdata)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="getter-paintsuperseded">[`paintSuperseded`](../renderlifecyclemixin#getter-paintsuperseded)</span>, <span id="getter-painted">[`painted`](../renderlifecyclemixin#getter-painted)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="getter-gateenabled">[`gateEnabled`](../regiontoolargemixin#getter-gateenabled)</span>, <span id="getter-bytegateadapterconfig">[`byteGateAdapterConfig`](../regiontoolargemixin#getter-bytegateadapterconfig)</span>, <span id="getter-densitytoolarge">[`densityTooLarge`](../regiontoolargemixin#getter-densitytoolarge)</span>, <span id="getter-bytegateadapterpath">[`byteGateAdapterPath`](../regiontoolargemixin#getter-bytegateadapterpath)</span>, <span id="getter-adapterfetchsizelimit">[`adapterFetchSizeLimit`](../regiontoolargemixin#getter-adapterfetchsizelimit)</span>, <span id="getter-gateviewportspanbp">[`gateViewportSpanBp`](../regiontoolargemixin#getter-gateviewportspanbp)</span>, <span id="getter-gateviewport">[`gateViewport`](../regiontoolargemixin#getter-gateviewport)</span>, <span id="getter-configuredfetchsizelimit">[`configuredFetchSizeLimit`](../regiontoolargemixin#getter-configuredfetchsizelimit)</span>, <span id="getter-configforceload">[`configForceLoad`](../regiontoolargemixin#getter-configforceload)</span>, <span id="getter-aboveforceloadfloor">[`aboveForceLoadFloor`](../regiontoolargemixin#getter-aboveforceloadfloor)</span>, <span id="getter-gateexempt">[`gateExempt`](../regiontoolargemixin#getter-gateexempt)</span>, <span id="getter-estimatedfetchbytes">[`estimatedFetchBytes`](../regiontoolargemixin#getter-estimatedfetchbytes)</span>, <span id="getter-gatebytelimit">[`gateByteLimit`](../regiontoolargemixin#getter-gatebytelimit)</span>, <span id="getter-gateactive">[`gateActive`](../regiontoolargemixin#getter-gateactive)</span>, <span id="getter-gatemeasurementstale">[`gateMeasurementStale`](../regiontoolargemixin#getter-gatemeasurementstale)</span>, <span id="getter-densitygateactive">[`densityGateActive`](../regiontoolargemixin#getter-densitygateactive)</span>, <span id="getter-toolargestatus">[`tooLargeStatus`](../regiontoolargemixin#getter-toolargestatus)</span>, <span id="getter-regiontoolarge">[`regionTooLarge`](../regiontoolargemixin#getter-regiontoolarge)</span>, <span id="getter-regiontoolargereason">[`regionTooLargeReason`](../regiontoolargemixin#getter-regiontoolargereason)</span>, <span id="getter-zoomcanreleasegate">[`zoomCanReleaseGate`](../regiontoolargemixin#getter-zoomcanreleasegate)</span>, <span id="getter-gateskipsmeasuredviewport">[`gateSkipsMeasuredViewport`](../regiontoolargemixin#getter-gateskipsmeasuredviewport)</span>

</details>

## Methods

<details class="inherited-members" data-pagefind-ignore>
<summary>2 inherited methods from one model</summary>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="method-gatefetchstate">[`gateFetchState`](../regiontoolargemixin#method-gatefetchstate)</span>, <span id="method-resolvedbytelimit">[`resolvedByteLimit`](../regiontoolargemixin#method-resolvedbytelimit)</span>

</details>

## Actions

<details class="inherited-members" data-pagefind-ignore>
<summary>24 inherited actions from 4 models</summary>

From [KeyedFetchMixin](../keyedfetchmixin): <span id="action-commitfetchresult">[`commitFetchResult`](../keyedfetchmixin#action-commitfetchresult)</span>, <span id="action-reload">[`reload`](../keyedfetchmixin#action-reload)</span>

From [FetchMixin](../fetchmixin): <span id="action-seterror">[`setError`](../fetchmixin#action-seterror)</span>, <span id="action-setstatusmessage">[`setStatusMessage`](../fetchmixin#action-setstatusmessage)</span>, <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="action-markcanvasdrawn">[`markCanvasDrawn`](../renderlifecyclemixin#action-markcanvasdrawn)</span>, <span id="action-resetcanvasdrawn">[`resetCanvasDrawn`](../renderlifecyclemixin#action-resetcanvasdrawn)</span>, <span id="action-stoprenderingbackend">[`stopRenderingBackend`](../renderlifecyclemixin#action-stoprenderingbackend)</span>, <span id="action-rendernow">[`renderNow`](../renderlifecyclemixin#action-rendernow)</span>, <span id="action-setoffscreen">[`setOffScreen`](../renderlifecyclemixin#action-setoffscreen)</span>, <span id="action-setrendererror">[`setRenderError`](../renderlifecyclemixin#action-setrendererror)</span>, <span id="action-attachrenderingbackend">[`attachRenderingBackend`](../renderlifecyclemixin#action-attachrenderingbackend)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="action-clearbyteestimate">[`clearByteEstimate`](../regiontoolargemixin#action-clearbyteestimate)</span>, <span id="action-cleargatemeasurements">[`clearGateMeasurements`](../regiontoolargemixin#action-cleargatemeasurements)</span>, <span id="action-setforceloadtrack">[`setForceLoadTrack`](../regiontoolargemixin#action-setforceloadtrack)</span>, <span id="action-commitfetchbytes">[`commitFetchBytes`](../regiontoolargemixin#action-commitfetchbytes)</span>, <span id="action-forceload">[`forceLoad`](../regiontoolargemixin#action-forceload)</span>

</details>
