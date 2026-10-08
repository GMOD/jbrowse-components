---
id: globalfetchmixin
title: GlobalFetchMixin
description: "The foundation for a display holding a single global (non-regional) dataset: HiC's contact matrix, the LD triangle, multi-way synteny's lanes."
sidebar_label: Mixin -> GlobalFetchMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/GlobalFetchMixin.ts).

**The** foundation for a display holding a single global (non-regional)
dataset: HiC's contact matrix, the LD triangle, multi-way synteny's lanes.

Composes:
  - RegionTooLargeMixin (regionTooLarge, force-load, …)
  - RenderLifecycleMixin (attachRenderingBackend, renderNow, renderError, …)
  - KeyedFetchMixin (FetchMixin's runFetch, cancelFetch, isLoading, error,
                     statusMessage, fetchGeneration, plus the
                     `currentFetchKey` / `loadedFetchKey` freshness pair
                     the comparative family composes too)

What is left here is what only an LGV display can say: the hosting
`RegionHost`, the static-block signature every `viewSignature` in this family
starts from, and the readiness getters that read the view — `viewportEmpty`,
`canRender`, `paintInert`, `svgReady`, `displayPhase`.

Installs no autoruns — each display owns its fetch trigger, sharing the
`installGlobalFetchAutorun` skeleton, to which it supplies only its own
`prepare` / `run` / `commit` phases.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Volatiles

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="volatile-forceloadtrack">[`forceLoadTrack`](../regiontoolargemixin#volatile-forceloadtrack)</span>, <span id="volatile-byteestimate">[`byteEstimate`](../regiontoolargemixin#volatile-byteestimate)</span>, <span id="volatile-gatemeasuredviewportkey">[`gateMeasuredViewportKey`](../regiontoolargemixin#volatile-gatemeasuredviewportkey)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="volatile-canvasdrawn">[`canvasDrawn`](../renderlifecyclemixin#volatile-canvasdrawn)</span>, <span id="volatile-paintcount">[`paintCount`](../renderlifecyclemixin#volatile-paintcount)</span>, <span id="volatile-currentrenderingbackend">[`currentRenderingBackend`](../renderlifecyclemixin#volatile-currentrenderingbackend)</span>, <span id="volatile-rendertick">[`renderTick`](../renderlifecyclemixin#volatile-rendertick)</span>, <span id="volatile-autorunsinstalled">[`autorunsInstalled`](../renderlifecyclemixin#volatile-autorunsinstalled)</span>, <span id="volatile-rendererror">[`renderError`](../renderlifecyclemixin#volatile-rendererror)</span>, <span id="volatile-offscreen">[`offScreen`](../renderlifecyclemixin#volatile-offscreen)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="volatile-loadedfetchkey">[`loadedFetchKey`](../keyedfetchmixin#volatile-loadedfetchkey)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="volatile-activesignal">[`activeSignal`](../fetchmixin#volatile-activesignal)</span>, <span id="volatile-fetchgeneration">[`fetchGeneration`](../fetchmixin#volatile-fetchgeneration)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../fetchmixin#volatile-reloadcounter)</span>, <span id="volatile-statuswindow">[`statusWindow`](../fetchmixin#volatile-statuswindow)</span>, <span id="volatile-error">[`error`](../fetchmixin#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../fetchmixin#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../fetchmixin#volatile-statusprogress)</span>, <span id="volatile-fetchcanceled">[`fetchCanceled`](../fetchmixin#volatile-fetchcanceled)</span>, <span id="volatile-fetchrotation">[`fetchRotation`](../fetchmixin#volatile-fetchrotation)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-host">**host**</span><br><code>RegionHost</code> | The hosting view as the `RegionHost` contract — see `containingHost` for the cast it owns, why the name is `host` and not `view`, and why both foundations still declare the name over one body. |
| <span id="getter-staticblocksignature">**staticBlockSignature**</span><br><code>string &#124; undefined</code> | The static-block set as a signature, or `undefined` before the view is measured — the building block every `viewSignature` in this family starts from. Arc and multi-way synteny are exactly this; HiC appends its resolution. Declared here so the initialized gate is spelled once. |
| <span id="getter-dynamicblocksignature">**dynamicBlockSignature**</span><br><code>string &#124; undefined</code> | The same over `dynamicBlocks`, for a display whose fetch window is the live viewport rather than the snapped block set (LD). |
| <span id="getter-viewportempty">**viewportEmpty**</span><br><code>boolean</code> | No content block is on screen, so this display has nothing to fetch and nothing to paint — see `viewportEmpty.ts` for the one viewport that reaches it, how narrow that is, and why the state still has to be terminal rather than a permanent scrim. Both foundations declare it over that one expression, the same way they each declare `host` and `paintInert`. |
| <span id="getter-canrender">**canRender**</span><br><code>boolean</code> | Overrides `RenderLifecycleMixin`'s default-true hook with the LGV precondition both foundations share — see `foundationCanRender`. |
| <span id="getter-renderscanvas">**rendersCanvas**</span><br><code>boolean</code> | Fills `RenderLifecycleMixin`'s hook off `fetchInert`: a display that will never fetch here shows a placeholder where its canvas would be, so `painted` and the pre-first-paint scrim term stop waiting on a paint that cannot come. Sequence and LD each carried this as a second override beside `fetchInert`, always its negation. |
| <span id="getter-paintinert">**paintInert**</span><br><code>boolean</code> | Fills `RenderLifecycleMixin`'s `paintInert` hook — see there for why a failed fetch has to read as finished to the consumers outside the display, and `foundationPaintInert` for the second such state and why both fetch families answer it through one function. Overridable, as the hook is: a display with a third inert state of its own says so here. |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | Policy single-sourced in `computeSvgReady`; this family supplies only the freshness half, which `foundationSvgReady` reads as `dataCurrent` or the vacuous currency of `viewportEmpty`. Note it requires the dataset to actually be current, NOT merely "not currently fetching": the fetch trigger is a debounced `afterAttach` autorun, so at export time `isLoading` can still be false with no data yet — a `displayPhase !== 'loading'` test would then capture an empty render. Never gates on `canvasDrawn`, which an off-screen export never sets. Off-screen renderers gate on it via `awaitSvgReady(model)`. |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayPhase</code> | The display's mutually-exclusive visual state, mapped in `foundationDisplayPhase` — every foundation calls it and supplies only its staleness argument, so a term added to `computeActivityPhase` reaches all of them without being wired twice.<br><br>This family's argument is the constant `true`, deliberately: a global display keeps the last frame up through a refetch (worker output is genomic, so the stale frame draws correctly under the live view transform), so a pan or zoom shows no scrim beyond the `isLoading` window. The pre-first-paint scrim it *does* want — the gap between mount and `isLoading` going true, which on HiC is the `CoreGetInfo` round trip its first fetch waits on — is `computeActivityPhase`'s shared `rendersCanvas && !canvasDrawn` term, not anything this family spells out. |

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="getter-gateenabled">[`gateEnabled`](../regiontoolargemixin#getter-gateenabled)</span>, <span id="getter-bytegateadapterconfig">[`byteGateAdapterConfig`](../regiontoolargemixin#getter-bytegateadapterconfig)</span>, <span id="getter-configuredfetchsizelimit">[`configuredFetchSizeLimit`](../regiontoolargemixin#getter-configuredfetchsizelimit)</span>, <span id="getter-densitytoolarge">[`densityTooLarge`](../regiontoolargemixin#getter-densitytoolarge)</span>, <span id="getter-bytegateadapterpath">[`byteGateAdapterPath`](../regiontoolargemixin#getter-bytegateadapterpath)</span>, <span id="getter-adapterfetchsizelimit">[`adapterFetchSizeLimit`](../regiontoolargemixin#getter-adapterfetchsizelimit)</span>, <span id="getter-configforceload">[`configForceLoad`](../regiontoolargemixin#getter-configforceload)</span>, <span id="getter-gateviewportspanbp">[`gateViewportSpanBp`](../regiontoolargemixin#getter-gateviewportspanbp)</span>, <span id="getter-gateviewport">[`gateViewport`](../regiontoolargemixin#getter-gateviewport)</span>, <span id="getter-aboveforceloadfloor">[`aboveForceLoadFloor`](../regiontoolargemixin#getter-aboveforceloadfloor)</span>, <span id="getter-gateexempt">[`gateExempt`](../regiontoolargemixin#getter-gateexempt)</span>, <span id="getter-estimatedfetchbytes">[`estimatedFetchBytes`](../regiontoolargemixin#getter-estimatedfetchbytes)</span>, <span id="getter-gatemeasurementstale">[`gateMeasurementStale`](../regiontoolargemixin#getter-gatemeasurementstale)</span>, <span id="getter-gatebytelimit">[`gateByteLimit`](../regiontoolargemixin#getter-gatebytelimit)</span>, <span id="getter-gateactive">[`gateActive`](../regiontoolargemixin#getter-gateactive)</span>, <span id="getter-densitygateactive">[`densityGateActive`](../regiontoolargemixin#getter-densitygateactive)</span>, <span id="getter-toolargestatus">[`tooLargeStatus`](../regiontoolargemixin#getter-toolargestatus)</span>, <span id="getter-regiontoolarge">[`regionTooLarge`](../regiontoolargemixin#getter-regiontoolarge)</span>, <span id="getter-regiontoolargereason">[`regionTooLargeReason`](../regiontoolargemixin#getter-regiontoolargereason)</span>, <span id="getter-zoomcanreleasegate">[`zoomCanReleaseGate`](../regiontoolargemixin#getter-zoomcanreleasegate)</span>, <span id="getter-gateskipsmeasuredviewport">[`gateSkipsMeasuredViewport`](../regiontoolargemixin#getter-gateskipsmeasuredviewport)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="getter-paintsuperseded">[`paintSuperseded`](../renderlifecyclemixin#getter-paintsuperseded)</span>, <span id="getter-painted">[`painted`](../renderlifecyclemixin#getter-painted)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="getter-viewsignature">[`viewSignature`](../keyedfetchmixin#getter-viewsignature)</span>, <span id="getter-datasuperseded">[`dataSuperseded`](../keyedfetchmixin#getter-datasuperseded)</span>, <span id="getter-currentfetchkey">[`currentFetchKey`](../keyedfetchmixin#getter-currentfetchkey)</span>, <span id="getter-datacurrent">[`dataCurrent`](../keyedfetchmixin#getter-datacurrent)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-fetchinert">[`fetchInert`](../fetchmixin#getter-fetchinert)</span>, <span id="getter-awaitingprerequisite">[`awaitingPrerequisite`](../fetchmixin#getter-awaitingprerequisite)</span>, <span id="getter-awaitingdependentdata">[`awaitingDependentData`](../fetchmixin#getter-awaitingdependentdata)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span></span>

## Methods

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="method-resolvedbytelimit">[`resolvedByteLimit`](../regiontoolargemixin#method-resolvedbytelimit)</span>, <span id="method-gatefetchstate">[`gateFetchState`](../regiontoolargemixin#method-gatefetchstate)</span></span>

## Actions

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="action-clearbyteestimate">[`clearByteEstimate`](../regiontoolargemixin#action-clearbyteestimate)</span>, <span id="action-cleargatemeasurements">[`clearGateMeasurements`](../regiontoolargemixin#action-cleargatemeasurements)</span>, <span id="action-setforceloadtrack">[`setForceLoadTrack`](../regiontoolargemixin#action-setforceloadtrack)</span>, <span id="action-commitfetchbytes">[`commitFetchBytes`](../regiontoolargemixin#action-commitfetchbytes)</span>, <span id="action-forceload">[`forceLoad`](../regiontoolargemixin#action-forceload)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="action-markcanvasdrawn">[`markCanvasDrawn`](../renderlifecyclemixin#action-markcanvasdrawn)</span>, <span id="action-resetcanvasdrawn">[`resetCanvasDrawn`](../renderlifecyclemixin#action-resetcanvasdrawn)</span>, <span id="action-stoprenderingbackend">[`stopRenderingBackend`](../renderlifecyclemixin#action-stoprenderingbackend)</span>, <span id="action-rendernow">[`renderNow`](../renderlifecyclemixin#action-rendernow)</span>, <span id="action-setoffscreen">[`setOffScreen`](../renderlifecyclemixin#action-setoffscreen)</span>, <span id="action-setrendererror">[`setRenderError`](../renderlifecyclemixin#action-setrendererror)</span>, <span id="action-attachrenderingbackend">[`attachRenderingBackend`](../renderlifecyclemixin#action-attachrenderingbackend)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="action-commitfetchresult">[`commitFetchResult`](../keyedfetchmixin#action-commitfetchresult)</span>, <span id="action-reload">[`reload`](../keyedfetchmixin#action-reload)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="action-seterror">[`setError`](../fetchmixin#action-seterror)</span>, <span id="action-setstatusmessage">[`setStatusMessage`](../fetchmixin#action-setstatusmessage)</span>, <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span></span>
