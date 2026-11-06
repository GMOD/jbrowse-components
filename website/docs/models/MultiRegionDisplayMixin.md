---
id: multiregiondisplaymixin
title: MultiRegionDisplayMixin
description: "Per-region fetch lifecycle for LGV-based GPU displays."
sidebar_label: Mixin -> MultiRegionDisplayMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/MultiRegionDisplayMixin.ts).

Per-region fetch lifecycle for LGV-based GPU displays. Installs the fetch
autoruns in `afterAttach` and exposes overridable hooks (`fetchNeeded`,
`rpcProps`, `zoomFetchArgs`, `regionHasData`, `gateEnabled`) plus
the `fetchRegions` / `loadedRegions` machinery.

`rpcProps()` and `zoomFetchArgs()` are what the display's RPC is sent, and
the foundation stamps both beside every region a fetch loads. They differ in
what a move shows: an `rpcProps` move supersedes the in-flight fetch and
scrims the held data, while a `zoomFetchArgs` move lets the held regions draw
until the refetch lands, so a value that swings with zoom goes in
`zoomFetchArgs`. A zoom rule that is no worker argument, such as a payload
answering only the zoom it was fetched at, is a `regionHasData` answer. The
mixin looks both up rather than declaring them, so a display keeps its narrow
return types through MST's `.views()` chain.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-loadedregions">**loadedRegions**</span><br><code>ObservableMap&lt;number, LoadedRegion&gt;</code> | The per-region store, keyed by `displayedRegionIndex`: the span a fetch asked for, the `fetchInputs` it was issued under and the `payload` it brought back, written as one record by `ctx.commitRegion`. Displays read payloads through `regionPayloads`. |

<details class="inherited-members" data-pagefind-ignore>
<summary>19 inherited volatiles from 3 models</summary>

From [FetchMixin](../fetchmixin): <span id="volatile-activesignal">[`activeSignal`](../fetchmixin#volatile-activesignal)</span>, <span id="volatile-fetchgeneration">[`fetchGeneration`](../fetchmixin#volatile-fetchgeneration)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../fetchmixin#volatile-reloadcounter)</span>, <span id="volatile-statuswindow">[`statusWindow`](../fetchmixin#volatile-statuswindow)</span>, <span id="volatile-error">[`error`](../fetchmixin#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../fetchmixin#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../fetchmixin#volatile-statusprogress)</span>, <span id="volatile-fetchcanceled">[`fetchCanceled`](../fetchmixin#volatile-fetchcanceled)</span>, <span id="volatile-fetchrotation">[`fetchRotation`](../fetchmixin#volatile-fetchrotation)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="volatile-canvasdrawn">[`canvasDrawn`](../renderlifecyclemixin#volatile-canvasdrawn)</span>, <span id="volatile-paintcount">[`paintCount`](../renderlifecyclemixin#volatile-paintcount)</span>, <span id="volatile-currentrenderingbackend">[`currentRenderingBackend`](../renderlifecyclemixin#volatile-currentrenderingbackend)</span>, <span id="volatile-rendertick">[`renderTick`](../renderlifecyclemixin#volatile-rendertick)</span>, <span id="volatile-autorunsinstalled">[`autorunsInstalled`](../renderlifecyclemixin#volatile-autorunsinstalled)</span>, <span id="volatile-rendererror">[`renderError`](../renderlifecyclemixin#volatile-rendererror)</span>, <span id="volatile-offscreen">[`offScreen`](../renderlifecyclemixin#volatile-offscreen)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="volatile-forceloadtrack">[`forceLoadTrack`](../regiontoolargemixin#volatile-forceloadtrack)</span>, <span id="volatile-byteestimate">[`byteEstimate`](../regiontoolargemixin#volatile-byteestimate)</span>, <span id="volatile-gatemeasuredviewportkey">[`gateMeasuredViewportKey`](../regiontoolargemixin#volatile-gatemeasuredviewportkey)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-host">**host**</span><br><code>RegionHost</code> | The view this display reads regions, viewport and scale from; see `containingHost`. |
| <span id="getter-canvaswidthpx">**canvasWidthPx**</span><br><code>number</code> | The CSS width of this display's on-screen canvas, in px; see `trackCanvasWidthPx`. |
| <span id="getter-settledsubpixelbinbp">**settledSubPixelBinBp**</span><br><code>number</code> | Genomic bp one cell of a per-base pass stands for at the settled zoom: `subPixelBinBp` off the host's throttled `coarseBpPerPx`, and 1 until the view initializes. A per-base encode or fetch reads this rather than the live zoom so a wheel tick does not redo every region. |
| <span id="getter-canrender">**canRender**</span><br><code>boolean</code> | `RenderLifecycleMixin`'s hook: the view has initialized. |
| <span id="getter-renderscanvas">**rendersCanvas**</span><br><code>boolean</code> | `RenderLifecycleMixin`'s hook: a display that will not fetch shows a placeholder where its canvas would be. |
| <span id="getter-trackvisibleregions">**trackVisibleRegions**</span><br><code>VisibleRegion[]</code> | The visible blocks on the track's own assemblies, the ones this display fetches and is judged against. A view of several genomes leaves a single-genome track's other regions blank. |
| <span id="getter-viewportwithinloadeddata">**viewportWithinLoadedData**</span><br><code>boolean</code> | Every visible block lies within a fetched region, so the viewport shows loaded data rather than the fringe a pan or zoom-out leaves. Spatial only: whether held data is still what a fetch would bring back is `isCacheValid`, which the export gate reads and the scrim must not, or the overlay would rise on every zoom. |
| <span id="getter-viewportempty">**viewportEmpty**</span><br><code>boolean</code> | No content block is on screen, so there is nothing to fetch or paint; see `viewportEmpty.ts`. |
| <span id="getter-fetchsuspended">**fetchSuspended**</span><br><code>boolean</code> | Overridable hook (default false), read by the fetch plan: the display draws a stand-in and wants no fetch meanwhile, as `CoarseTierMixin` does while MAF's summary tier stands in. Not `fetchInert`, which also drops the scrim and ends the export wait while the stand-in still has to load. |
| <span id="getter-layoutready">**layoutReady**</span><br><code>boolean</code> | Overridable hook (default false): a searchable feature layout exists. A display with `searchFeatureByID` must override it, so callers can tell "laid out, but off-display" from "no layout yet". False by default so a missing override drops overlays rather than pinning them to an edge. |
| <span id="getter-datasuperseded">**dataSuperseded**</span><br><code>boolean</code> | Overridable hook (default false): the held data covers the viewport but a fetch input has moved past it in a way the key cannot see, so it is about to be refetched. Both the export gate (`dataCurrent`) and the scrim (`displayPhase`) read it. Only an inevitable change belongs here, since a true that never clears hangs the export; and never restate the stamp-versus-`zoomFetchArgs` compare, which `isCacheValid` already makes. Cases and rules: DISPLAY_KIT.md, "`dataSuperseded` covers what `fetchInputs` cannot state". |
| <span id="getter-renderblocks">**renderBlocks**</span><br><code>RenderBlock[]</code> | The blocks the canvas draws; one displayed region may make several, sharing a GPU buffer under different scissor clips. Override to return [] to suppress drawing, which clears the canvas. |
| <span id="getter-fetchinputs">**fetchInputs**</span><br><code>FetchInputs</code> | What a fetch issued now would stamp on a region: the settings tier (`settingsFetchInputs`) and the zoom tier (`zoomFetchArgs()`). `fetchRegions` captures it at issue; `isCacheValid` compares against it. |
| <span id="getter-regionpayloads">**regionPayloads**</span><br><code>ReadonlyMap&lt;number, unknown&gt;</code> | The store's payloads, keyed by `displayedRegionIndex`. A display narrows it once (`get rpcDataMap() { return self.regionPayloads as ReadonlyMap<number, MyResult> }`). The Map keeps its identity between store changes only while something observes it; the render lifecycle's upload autorun does for every display that draws (DISPLAY_KIT.md, "A hit test's index needs an observer"). |
| <span id="getter-hasregiondata">**hasRegionData**</span><br><code>boolean</code> | At least one region's payload is in the store. The first-paint gate reads it, so a frame before any data cannot flip `canvasDrawn`. |
| <span id="getter-stalesettingsdrawn">**staleSettingsDrawn**</span><br><code>boolean</code> | A visible block's data was fetched under settings that have since moved, and is drawn until its refetch lands: the scrim's third staleness term. It compares the settings tier alone, so a zoom never raises it. |
| <span id="getter-datacurrent">**dataCurrent**</span><br><code>boolean</code> | The held data is what a fetch now would bring back for every visible block: covered, non-empty, `isCacheValid` per block, and not `dataSuperseded`. The export gate reads it; the scrim does not take `isCacheValid`, which would raise it on every zoom. It cannot latch, because the planner reads the same `isCacheValid` tracked and refetches any block it fails. |
| <span id="getter-loadedassembly">**loadedAssembly**</span><br><code><a href="../assembly">Assembly</a> &#124; undefined</code> | The assembly the loaded data is on, read off the first loaded region, and `undefined` until its refName aliases load: before then `getCanonicalRefName2` and `refNameToIndex` answer wrongly rather than throw, so the caller writes its fallback. |
| <span id="getter-phaseviewportcurrent">**phaseViewportCurrent**</span><br><code>boolean</code> | The loading scrim's staleness argument: spatial coverage, not `dataSuperseded`, not `staleSettingsDrawn`. `displayPhase` and `coarseTierDisplayPhase` both read it. |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | An SVG export can read this display's data; off-screen renderers wait on it through `awaitSvgReady(model)`. See `foundationSvgReady`. |
| <span id="getter-paintinert">**paintInert**</span><br><code>boolean</code> | `RenderLifecycleMixin`'s `paintInert` hook; see `foundationPaintInert`. Overridable for a further inert state. |
| <span id="getter-paintsuperseded">**paintSuperseded**</span><br><code>boolean</code> | `RenderLifecycleMixin`'s hook: `painted` reads pending over a canvas drawn under the previous settings until the refetch lands. |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayPhase</code> | The display's visual state, mapped by `foundationDisplayPhase` from this family's staleness argument, `phaseViewportCurrent`, passed as a thunk so a display that is not loading skips the viewport reads. Customize it through `fetchInert`, never by overriding it. |

<details class="inherited-members" data-pagefind-ignore>
<summary>28 inherited getters from 3 models</summary>

From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-fetchinert">[`fetchInert`](../fetchmixin#getter-fetchinert)</span>, <span id="getter-awaitingprerequisite">[`awaitingPrerequisite`](../fetchmixin#getter-awaitingprerequisite)</span>, <span id="getter-awaitingdependentdata">[`awaitingDependentData`](../fetchmixin#getter-awaitingdependentdata)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="getter-painted">[`painted`](../renderlifecyclemixin#getter-painted)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="getter-gateenabled">[`gateEnabled`](../regiontoolargemixin#getter-gateenabled)</span>, <span id="getter-bytegateadapterconfig">[`byteGateAdapterConfig`](../regiontoolargemixin#getter-bytegateadapterconfig)</span>, <span id="getter-densitytoolarge">[`densityTooLarge`](../regiontoolargemixin#getter-densitytoolarge)</span>, <span id="getter-bytegateadapterpath">[`byteGateAdapterPath`](../regiontoolargemixin#getter-bytegateadapterpath)</span>, <span id="getter-adapterfetchsizelimit">[`adapterFetchSizeLimit`](../regiontoolargemixin#getter-adapterfetchsizelimit)</span>, <span id="getter-gateviewportspanbp">[`gateViewportSpanBp`](../regiontoolargemixin#getter-gateviewportspanbp)</span>, <span id="getter-gateviewport">[`gateViewport`](../regiontoolargemixin#getter-gateviewport)</span>, <span id="getter-configuredfetchsizelimit">[`configuredFetchSizeLimit`](../regiontoolargemixin#getter-configuredfetchsizelimit)</span>, <span id="getter-configforceload">[`configForceLoad`](../regiontoolargemixin#getter-configforceload)</span>, <span id="getter-aboveforceloadfloor">[`aboveForceLoadFloor`](../regiontoolargemixin#getter-aboveforceloadfloor)</span>, <span id="getter-gateexempt">[`gateExempt`](../regiontoolargemixin#getter-gateexempt)</span>, <span id="getter-estimatedfetchbytes">[`estimatedFetchBytes`](../regiontoolargemixin#getter-estimatedfetchbytes)</span>, <span id="getter-gatebytelimit">[`gateByteLimit`](../regiontoolargemixin#getter-gatebytelimit)</span>, <span id="getter-gateactive">[`gateActive`](../regiontoolargemixin#getter-gateactive)</span>, <span id="getter-gatemeasurementstale">[`gateMeasurementStale`](../regiontoolargemixin#getter-gatemeasurementstale)</span>, <span id="getter-densitygateactive">[`densityGateActive`](../regiontoolargemixin#getter-densitygateactive)</span>, <span id="getter-toolargestatus">[`tooLargeStatus`](../regiontoolargemixin#getter-toolargestatus)</span>, <span id="getter-regiontoolarge">[`regionTooLarge`](../regiontoolargemixin#getter-regiontoolarge)</span>, <span id="getter-regiontoolargereason">[`regionTooLargeReason`](../regiontoolargemixin#getter-regiontoolargereason)</span>, <span id="getter-zoomcanreleasegate">[`zoomCanReleaseGate`](../regiontoolargemixin#getter-zoomcanreleasegate)</span>, <span id="getter-gateskipsmeasuredviewport">[`gateSkipsMeasuredViewport`](../regiontoolargemixin#getter-gateskipsmeasuredviewport)</span>

</details>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-regionhasdata">**regionHasData**</span><br><code>(displayedRegionIndex: number) =&gt; boolean</code> | Overridable hook: whether the display can draw what this region holds at the view's zoom. The default checks the stored payload against its `zoomRange` where the adapter declared one (`BaseFeatureDataAdapter.getZoomRange`). Override it where several held payloads compete, as MAF's summary and detail tiers do. A view, so its reads are dependencies of `FetchVisibleRegions`. |
| <span id="method-iscachevalid">**isCacheValid**</span><br><code>(displayedRegionIndex: number) =&gt; boolean</code> | Whether the data held for a region still answers the current view: `regionHasData`, and the region's stamp equal to `fetchInputs`. Not a hook; a display states its rule through `zoomFetchArgs` and `regionHasData`. |

<details class="inherited-members" data-pagefind-ignore>
<summary>2 inherited methods from one model</summary>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="method-gatefetchstate">[`gateFetchState`](../regiontoolargemixin#method-gatefetchstate)</span>, <span id="method-resolvedbytelimit">[`resolvedByteLimit`](../regiontoolargemixin#method-resolvedbytelimit)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setloadedregion">**setLoadedRegion**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(displayedRegionIndex: number, region: Region, payload: {} &#124; un…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(displayedRegionIndex: number, region: Region, payload: {} &#124; undefined, fetchInputs?: FetchInputs) =&gt; void</code></pre></dialog></span> | The raw write behind `ctx.commitRegion`, for tests staging a loaded display; a fetch commits through the context, which takes no span (see RegionFetchContext). It replaces the whole record, so the payload is named on every call. `fetchInputs` defaults to the key now, which is wrong for a caller resuming after an await. |
| <span id="action-evictregionstore">**evictRegionStore**</span><br><code>(keep: ReadonlySet&lt;number&gt;) =&gt; void</code> | Once the store is over `MAX_STORED_REGIONS`, drop entries outside `keep` (the buffered viewport), oldest first. |
| <span id="action-droploadedregion">**dropLoadedRegion**</span><br><code>(displayedRegionIndex: number) =&gt; void</code> | Forget one region, as `evictRegionStore` does past its cap. Tests use it to stage an evicted region. |
| <span id="action-cleardisplayspecificdata">**clearDisplaySpecificData**</span><br><code>() =&gt; void</code> | Overridable hook (no-op base): drop what this display holds beside the store. Called by `clearAllRpcData`: on a displayed-regions change, a viewport move past an error or cancel, and `reload()`. |
| <span id="action-clearsettingsbakeddata">**clearSettingsBakedData**</span><br><code>() =&gt; void</code> | Overridable hook (no-op base): drop what is wrong, not merely stale, under a changed setting, such as a payload whose shape the setting decides. Called by `invalidateSettings`; everything else stays drawn under the scrim until the refetch lands (ADR-006). |
| <span id="action-clearallrpcdata">**clearAllRpcData**</span><br><code>() =&gt; void</code> | Full reset: cancel the fetch and clear the error, `loadedRegions`, display-specific data and the canvas-drawn flag. The too-large verdict is derived, so it needs no clear. |
| <span id="action-invalidatesettings">**invalidateSettings**</span><br><code>() =&gt; void</code> | `SettingsInvalidate`'s reset: supersede the in-flight fetch, clear a blocking error or cancel, and drop settings-baked data. `loadedRegions` stays, drawn under the scrim, since every held region already fails `isCacheValid` and is refetched. |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | `FetchMixin.reload` plus the full reset. An override chains to it, or the retry contract check goes off for that display. |
| <span id="action-fetchneeded">**fetchNeeded**</span><br><code>(_needed: IndexedRegion[]) =&gt; void</code> | Overridable hook (no-op base): call one of the runners in `fetchEachRegion.ts`: `fetchEachRegion` (one RPC per region), `fetchAllRegions` (one per genome) or `fetchRegionsBatched` (one RPC, one payload for all). |
| <span id="action-fetchvisibleregions">**fetchVisibleRegions**</span><br><code>() =&gt; void</code> | Fetch what `FetchVisibleRegions` would, now rather than after its debounce: for a `reload()` that should not wait on a click. |
| <span id="action-fetchregions">**fetchRegions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(needed: IndexedRegion[], work: (ctx: RegionFetchContext) =&gt; Pr…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(needed: IndexedRegion[], work: (ctx: RegionFetchContext) =&gt; Promise&lt;void&gt;) =&gt; Promise&lt;void&gt;</code></pre></dialog></span> | Run a per-region fetch, called by the runners in `fetchEachRegion.ts`. `work` calls `ctx.commitRegion` as it stores each payload, which marks the region loaded under the span this fetch issued and the `fetchInputs` captured here at issue, never re-read after the await. |
| <span id="action-afterattach">**afterAttach**</span><br><code>() =&gt; void</code> | Installs the fetch-lifecycle autoruns (DisplayedRegionsChange, FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange). |

<details class="inherited-members" data-pagefind-ignore>
<summary>22 inherited actions from 3 models</summary>

From [FetchMixin](../fetchmixin): <span id="action-seterror">[`setError`](../fetchmixin#action-seterror)</span>, <span id="action-setstatusmessage">[`setStatusMessage`](../fetchmixin#action-setstatusmessage)</span>, <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="action-markcanvasdrawn">[`markCanvasDrawn`](../renderlifecyclemixin#action-markcanvasdrawn)</span>, <span id="action-resetcanvasdrawn">[`resetCanvasDrawn`](../renderlifecyclemixin#action-resetcanvasdrawn)</span>, <span id="action-stoprenderingbackend">[`stopRenderingBackend`](../renderlifecyclemixin#action-stoprenderingbackend)</span>, <span id="action-rendernow">[`renderNow`](../renderlifecyclemixin#action-rendernow)</span>, <span id="action-setoffscreen">[`setOffScreen`](../renderlifecyclemixin#action-setoffscreen)</span>, <span id="action-setrendererror">[`setRenderError`](../renderlifecyclemixin#action-setrendererror)</span>, <span id="action-attachrenderingbackend">[`attachRenderingBackend`](../renderlifecyclemixin#action-attachrenderingbackend)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="action-clearbyteestimate">[`clearByteEstimate`](../regiontoolargemixin#action-clearbyteestimate)</span>, <span id="action-cleargatemeasurements">[`clearGateMeasurements`](../regiontoolargemixin#action-cleargatemeasurements)</span>, <span id="action-setforceloadtrack">[`setForceLoadTrack`](../regiontoolargemixin#action-setforceloadtrack)</span>, <span id="action-commitfetchbytes">[`commitFetchBytes`](../regiontoolargemixin#action-commitfetchbytes)</span>, <span id="action-forceload">[`forceLoad`](../regiontoolargemixin#action-forceload)</span>

</details>
