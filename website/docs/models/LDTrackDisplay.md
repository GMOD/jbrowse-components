---
id: ldtrackdisplay
title: LDTrackDisplay
description: "A linkage disequilibrium matrix read from a pre-computed file, drawn as a triangle over the view."
sidebar_label: Display -> LDTrackDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/model.ts).

A linkage disequilibrium matrix read from a pre-computed file, drawn as a
triangle over the view.

The configuration slots for this model are documented on its [config schema page](../../config/ldtrackdisplay).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('LDTrackDisplay')</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="property-id">[`id`](../basedisplay#property-id)</span></span>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-focalsnplocus">**focalSnpLocus**</span><br><code>string &#124; undefined</code> | Key (`refName:start:id`) of the SNP whose row and column are emphasized. A key rather than an index, so it survives a refetch. |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="volatile-error">[`error`](../basedisplay#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../basedisplay#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../basedisplay#volatile-statusprogress)</span></span>

<span data-pagefind-ignore>From [TrackHeightMixin](../trackheightmixin): <span id="volatile-scrolltop">[`scrollTop`](../trackheightmixin#volatile-scrolltop)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="volatile-forceloadtrack">[`forceLoadTrack`](../regiontoolargemixin#volatile-forceloadtrack)</span>, <span id="volatile-byteestimate">[`byteEstimate`](../regiontoolargemixin#volatile-byteestimate)</span>, <span id="volatile-gatemeasuredviewportkey">[`gateMeasuredViewportKey`](../regiontoolargemixin#volatile-gatemeasuredviewportkey)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="volatile-canvasdrawn">[`canvasDrawn`](../renderlifecyclemixin#volatile-canvasdrawn)</span>, <span id="volatile-paintcount">[`paintCount`](../renderlifecyclemixin#volatile-paintcount)</span>, <span id="volatile-currentrenderingbackend">[`currentRenderingBackend`](../renderlifecyclemixin#volatile-currentrenderingbackend)</span>, <span id="volatile-rendertick">[`renderTick`](../renderlifecyclemixin#volatile-rendertick)</span>, <span id="volatile-autorunsinstalled">[`autorunsInstalled`](../renderlifecyclemixin#volatile-autorunsinstalled)</span>, <span id="volatile-rendererror">[`renderError`](../renderlifecyclemixin#volatile-rendererror)</span>, <span id="volatile-offscreen">[`offScreen`](../renderlifecyclemixin#volatile-offscreen)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="volatile-loadedfetchkey">[`loadedFetchKey`](../keyedfetchmixin#volatile-loadedfetchkey)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="volatile-activesignal">[`activeSignal`](../fetchmixin#volatile-activesignal)</span>, <span id="volatile-fetchgeneration">[`fetchGeneration`](../fetchmixin#volatile-fetchgeneration)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../fetchmixin#volatile-reloadcounter)</span>, <span id="volatile-statuswindow">[`statusWindow`](../fetchmixin#volatile-statuswindow)</span>, <span id="volatile-fetchcanceled">[`fetchCanceled`](../fetchmixin#volatile-fetchcanceled)</span>, <span id="volatile-fetchrotation">[`fetchRotation`](../fetchmixin#volatile-fetchrotation)</span></span>

<span data-pagefind-ignore>From [LegendMixin](../legendmixin): <span id="volatile-dismissedlegendsections">[`dismissedLegendSections`](../legendmixin#volatile-dismissedlegendsections)</span></span>

<span data-pagefind-ignore>From [TriangleMatrixMixin](../trianglematrixmixin): <span id="volatile-rpcdata">[`rpcData`](../trianglematrixmixin#volatile-rpcdata)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { rubberbandClickMenuItems(clickOffset: BpOffset): MenuItem[]; highlightMenuItems(_highlight: HighlightType): MenuItem[]; } &amp; { flyTo: (centerBp: number, windowWidthBp: number) =&gt; void; flyToCenter(coord: number, refName: string, displayedRegionIndex?: number &#124; undefined): void; flyToFit(centerBp: number, fitWidthBp: number): void; } &amp; { afterCreate(): void; afterAttach(): void; } &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> |  |
| <span id="getter-prefersoffset">**prefersOffset**</span><br><code>boolean</code> |  |
| <span id="getter-linezoneheight">**lineZoneHeight**</span><br><code>number</code> |  |
| <span id="getter-colorfield">**colorField**</span><br><code>LDMetric</code> | `color.field`, the statistic the fetch asks the file for. |
| <span id="getter-maxvariantseparation">**maxVariantSeparation**</span><br><code>number</code> |  |
| <span id="getter-showverticalguides">**showVerticalGuides**</span><br><code>boolean</code> |  |
| <span id="getter-showlabels">**showLabels**</span><br><code>boolean</code> |  |
| <span id="getter-tickheight">**tickHeight**</span><br><code>number</code> |  |
| <span id="getter-variantlayout">**variantLayout**</span><br><code>"columns" &#124; "genomic"</code> |  |
| <span id="getter-snps">**snps**</span><br><code>LDSnp[]</code> | The loaded SNPs in screen order along the column axis. |
| <span id="getter-cellwidth">**cellWidth**</span><br><code>number</code> | The column width the payload was laid out at. |
| <span id="getter-viewsignature">**viewSignature**</span><br><code>string &#124; undefined</code> | The dynamic blocks: the SNP set is the viewport's, so a pan refetches while the stale triangle draws under the live transform. |
| <span id="getter-effectiveldmetric">**effectiveLdMetric**</span><br><code>LDMetric</code> | The metric the loaded values are: a file with one column serves it whichever is asked for. |
| <span id="getter-effectiveusegenomicpositions">**effectiveUseGenomicPositions**</span><br><code>boolean</code> | Whether the loaded matrix is at genomic positions: a multi-region view falls back to uniform columns. |
| <span id="getter-r2available">**r2Available**</span><br><code>boolean</code> |  |
| <span id="getter-dprimeavailable">**dprimeAvailable**</span><br><code>boolean</code> |  |
| <span id="getter-loadedldwindow">**loadedLDWindow**</span><br><code>number &#124; undefined</code> | The pair window the loaded matrix was computed at, or undefined for the whole triangle. The status bar names it, since a pair past it is not drawn and reads as no linkage. |
| <span id="getter-focalsnpindex">**focalSnpIndex**</span><br><code>number</code> | Index of the focal SNP in `snps`, or -1. |
| <span id="getter-colorencoding">**colorEncoding**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ContinuousRef &amp; { scheme: "blues" &#124; "blueyellowred" &#124; "cividis"…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ContinuousRef &amp; { scheme: "blues" &#124; "blueyellowred" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma" &#124; "purpleorange" &#124; "redblue" &#124; "redgreyblue" &#124; "reds" &#124; "viridis"; }</code></pre></dialog></span> | The `color` object under the preset of the loaded metric, so a stale triangle during a metric switch keeps its hue. Both presets name a scheme, so the encoding always carries one. |
| <span id="getter-notices">**notices**</span><br><code>string[]</code> | What the `color` object says that cannot paint as written; the corner indicator lists the same lines `plotProblems` and `jbrowse validate` report. |
| <span id="getter-colorscheme">**colorScheme**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>"blues" &#124; "blueyellowred" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "j…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>"blues" &#124; "blueyellowred" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma" &#124; "purpleorange" &#124; "redblue" &#124; "redgreyblue" &#124; "reds" &#124; "viridis"</code></pre></dialog></span> |  |
| <span id="getter-colorreverse">**colorReverse**</span><br><code>boolean</code> | `color.reverse`, or where unset whether the scheme runs dark at its low end. |
| <span id="getter-colordomain">**colorDomain**</span><br><code>[number, number]</code> | The domain the statistic is colored over: each pinned end holds, and an open one is the statistic's own 0 or 1. |
| <span id="getter-colorramp">**colorRamp**</span><br><code>Uint8Array&lt;ArrayBufferLike&gt;</code> | The ramp's 256 entries, read by the GPU texture, the Canvas2D fill and the legend. Reads `colorScheme` and `colorReverse` rather than the encoding, so a domain edit re-uploads no texture. |
| <span id="getter-colorscales">**colorScales**</span><br><code>ColorScale[]</code> | The ramp the cells paint through, titled by the loaded metric. An end pinned inside the statistic's 0 to 1 reads `≤` or `≥`. |
| <span id="getter-renderstate">**renderState**</span><br><code>LDRenderState</code> |  |
| <span id="getter-matrixtop">**matrixTop**</span><br><code>number</code> | The band above the matrix: the connector lines in columns, the labels at genomic positions when they are on, else nothing. |
| <span id="getter-connectorlinecoords">**connectorLineCoords**</span><br><code>ConnectorCoord[]</code> | Each column tied to its SNP's genomic x, for the connector lines. |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-hoveredfeature">[`hoveredFeature`](../basedisplay#getter-hoveredfeature)</span>, <span id="getter-featurenoun">[`featureNoun`](../basedisplay#getter-featurenoun)</span>, <span id="getter-featurewidgettype">[`featureWidgetType`](../basedisplay#getter-featurewidgettype)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span></span>

<span data-pagefind-ignore>From [TrackHeightMixin](../trackheightmixin): <span id="getter-height">[`height`](../trackheightmixin#getter-height)</span>, <span id="getter-resizing">[`resizing`](../trackheightmixin#getter-resizing)</span>, <span id="getter-scrollcontentheight">[`scrollContentHeight`](../trackheightmixin#getter-scrollcontentheight)</span>, <span id="getter-scrollviewportheight">[`scrollViewportHeight`](../trackheightmixin#getter-scrollviewportheight)</span>, <span id="getter-scrollableheight">[`scrollableHeight`](../trackheightmixin#getter-scrollableheight)</span></span>

<span data-pagefind-ignore>From [GlobalFetchMixin](../globalfetchmixin): <span id="getter-host">[`host`](../globalfetchmixin#getter-host)</span>, <span id="getter-staticblocksignature">[`staticBlockSignature`](../globalfetchmixin#getter-staticblocksignature)</span>, <span id="getter-dynamicblocksignature">[`dynamicBlockSignature`](../globalfetchmixin#getter-dynamicblocksignature)</span>, <span id="getter-viewportempty">[`viewportEmpty`](../globalfetchmixin#getter-viewportempty)</span>, <span id="getter-canrender">[`canRender`](../globalfetchmixin#getter-canrender)</span>, <span id="getter-renderscanvas">[`rendersCanvas`](../globalfetchmixin#getter-renderscanvas)</span>, <span id="getter-paintinert">[`paintInert`](../globalfetchmixin#getter-paintinert)</span>, <span id="getter-svgready">[`svgReady`](../globalfetchmixin#getter-svgready)</span>, <span id="getter-displayphase">[`displayPhase`](../globalfetchmixin#getter-displayphase)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="getter-gateenabled">[`gateEnabled`](../regiontoolargemixin#getter-gateenabled)</span>, <span id="getter-bytegateadapterconfig">[`byteGateAdapterConfig`](../regiontoolargemixin#getter-bytegateadapterconfig)</span>, <span id="getter-configuredfetchsizelimit">[`configuredFetchSizeLimit`](../regiontoolargemixin#getter-configuredfetchsizelimit)</span>, <span id="getter-densitytoolarge">[`densityTooLarge`](../regiontoolargemixin#getter-densitytoolarge)</span>, <span id="getter-bytegateadapterpath">[`byteGateAdapterPath`](../regiontoolargemixin#getter-bytegateadapterpath)</span>, <span id="getter-adapterfetchsizelimit">[`adapterFetchSizeLimit`](../regiontoolargemixin#getter-adapterfetchsizelimit)</span>, <span id="getter-configforceload">[`configForceLoad`](../regiontoolargemixin#getter-configforceload)</span>, <span id="getter-gateviewportspanbp">[`gateViewportSpanBp`](../regiontoolargemixin#getter-gateviewportspanbp)</span>, <span id="getter-gateviewport">[`gateViewport`](../regiontoolargemixin#getter-gateviewport)</span>, <span id="getter-aboveforceloadfloor">[`aboveForceLoadFloor`](../regiontoolargemixin#getter-aboveforceloadfloor)</span>, <span id="getter-gateexempt">[`gateExempt`](../regiontoolargemixin#getter-gateexempt)</span>, <span id="getter-estimatedfetchbytes">[`estimatedFetchBytes`](../regiontoolargemixin#getter-estimatedfetchbytes)</span>, <span id="getter-gatemeasurementstale">[`gateMeasurementStale`](../regiontoolargemixin#getter-gatemeasurementstale)</span>, <span id="getter-gatebytelimit">[`gateByteLimit`](../regiontoolargemixin#getter-gatebytelimit)</span>, <span id="getter-gateactive">[`gateActive`](../regiontoolargemixin#getter-gateactive)</span>, <span id="getter-densitygateactive">[`densityGateActive`](../regiontoolargemixin#getter-densitygateactive)</span>, <span id="getter-toolargestatus">[`tooLargeStatus`](../regiontoolargemixin#getter-toolargestatus)</span>, <span id="getter-regiontoolarge">[`regionTooLarge`](../regiontoolargemixin#getter-regiontoolarge)</span>, <span id="getter-regiontoolargereason">[`regionTooLargeReason`](../regiontoolargemixin#getter-regiontoolargereason)</span>, <span id="getter-zoomcanreleasegate">[`zoomCanReleaseGate`](../regiontoolargemixin#getter-zoomcanreleasegate)</span>, <span id="getter-gateskipsmeasuredviewport">[`gateSkipsMeasuredViewport`](../regiontoolargemixin#getter-gateskipsmeasuredviewport)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="getter-paintsuperseded">[`paintSuperseded`](../renderlifecyclemixin#getter-paintsuperseded)</span>, <span id="getter-painted">[`painted`](../renderlifecyclemixin#getter-painted)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="getter-datasuperseded">[`dataSuperseded`](../keyedfetchmixin#getter-datasuperseded)</span>, <span id="getter-currentfetchkey">[`currentFetchKey`](../keyedfetchmixin#getter-currentfetchkey)</span>, <span id="getter-datacurrent">[`dataCurrent`](../keyedfetchmixin#getter-datacurrent)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-fetchinert">[`fetchInert`](../fetchmixin#getter-fetchinert)</span>, <span id="getter-awaitingprerequisite">[`awaitingPrerequisite`](../fetchmixin#getter-awaitingprerequisite)</span>, <span id="getter-awaitingdependentdata">[`awaitingDependentData`](../fetchmixin#getter-awaitingdependentdata)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span></span>

<span data-pagefind-ignore>From [LegendMixin](../legendmixin): <span id="getter-showlegend">[`showLegend`](../legendmixin#getter-showlegend)</span>, <span id="getter-legendtop">[`legendTop`](../legendmixin#getter-legendtop)</span>, <span id="getter-legendright">[`legendRight`](../legendmixin#getter-legendright)</span>, <span id="getter-legendspec">[`legendSpec`](../legendmixin#getter-legendspec)</span>, <span id="getter-haslegendkey">[`hasLegendKey`](../legendmixin#getter-haslegendkey)</span></span>

<span data-pagefind-ignore>From [TriangleMatrixMixin](../trianglematrixmixin): <span id="getter-squashtoheight">[`squashToHeight`](../trianglematrixmixin#getter-squashtoheight)</span>, <span id="getter-canvaswidth">[`canvasWidth`](../trianglematrixmixin#getter-canvaswidth)</span>, <span id="getter-viewtransform">[`viewTransform`](../trianglematrixmixin#getter-viewtransform)</span>, <span id="getter-matrixregions">[`matrixRegions`](../trianglematrixmixin#getter-matrixregions)</span>, <span id="getter-matrixheight">[`matrixHeight`](../trianglematrixmixin#getter-matrixheight)</span>, <span id="getter-matrixblocks">[`matrixBlocks`](../trianglematrixmixin#getter-matrixblocks)</span>, <span id="getter-yscalar">[`yScalar`](../trianglematrixmixin#getter-yscalar)</span>, <span id="getter-triangletransform">[`triangleTransform`](../trianglematrixmixin#getter-triangletransform)</span>, <span id="getter-triangleframe">[`triangleFrame`](../trianglematrixmixin#getter-triangleframe)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-rpcprops">**rpcProps**</span><br><code>() =&gt; LDRpcProps</code> |  |
| <span id="method-columnx">**columnX**</span><br><code>(column: number) =&gt; number</code> | Viewport x of a fractional column index: `i + 0.5` is column i's apex. Uses the payload's own column width, so it follows the live transform through a zoom's refetch. |
| <span id="method-locusviewportx">**locusViewportX**</span><br><code>(refName: string, coord: number) =&gt; number &#124; undefined</code> | Viewport x of a locus, or undefined when it has none. |
| <span id="method-hittest">**hitTest**</span><br><code>(mouseX: number, mouseY: number) =&gt; LDCellHit &#124; undefined</code> | The computed cell under a display-px point: a pair outside the band, or one no estimator filled, is not drawn and not hit. |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |
| <span id="method-rendersvg">**renderSvg**</span><br><code>(opts: ExportSvgDisplayOptions) =&gt; Promise&lt;ReactNode&gt;</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="method-renderingprops">[`renderingProps`](../basedisplay#method-renderingprops)</span>, <span id="method-liftplot">[`liftPlot`](../basedisplay#method-liftplot)</span>, <span id="method-plotproblems">[`plotProblems`](../basedisplay#method-plotproblems)</span>, <span id="method-plotwrites">[`plotWrites`](../basedisplay#method-plotwrites)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="method-resolvedbytelimit">[`resolvedByteLimit`](../regiontoolargemixin#method-resolvedbytelimit)</span>, <span id="method-gatefetchstate">[`gateFetchState`](../regiontoolargemixin#method-gatefetchstate)</span></span>

<span data-pagefind-ignore>From [LegendMixin](../legendmixin): <span id="method-svglegendwidth">[`svgLegendWidth`](../legendmixin#method-svglegendwidth)</span>, <span id="method-colorscalesin">[`colorScalesIn`](../legendmixin#method-colorscalesin)</span>, <span id="method-legendspecin">[`legendSpecIn`](../legendmixin#method-legendspecin)</span></span>

<span data-pagefind-ignore>From [TriangleMatrixMixin](../trianglematrixmixin): <span id="method-celltoscreen">[`cellToScreen`](../trianglematrixmixin#method-celltoscreen)</span>, <span id="method-screentocell">[`screenToCell`](../trianglematrixmixin#method-screentocell)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setfocalsnp">**setFocalSnp**</span><br><code>(snp: LDSnp &#124; undefined) =&gt; void</code> |  |
| <span id="action-setlinezoneheight">**setLineZoneHeight**</span><br><code>(n: number) =&gt; void</code> |  |
| <span id="action-setldmetric">**setLDMetric**</span><br><code>(metric: LDMetric) =&gt; void</code> | `color.field`, the statistic the cells are, which refetches. |
| <span id="action-setshowverticalguides">**setShowVerticalGuides**</span><br><code>(show: boolean) =&gt; void</code> |  |
| <span id="action-setshowlabels">**setShowLabels**</span><br><code>(show: boolean) =&gt; void</code> |  |
| <span id="action-setvariantlayout">**setVariantLayout**</span><br><code>(value: "columns" &#124; "genomic") =&gt; void</code> |  |
| <span id="action-setcolorscheme">**setColorScheme**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(scheme: "blues" &#124; "blueyellowred" &#124; "cividis" &#124; "fall" &#124; "infe…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(scheme: "blues" &#124; "blueyellowred" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma" &#124; "purpleorange" &#124; "redblue" &#124; "redgreyblue" &#124; "reds" &#124; "viridis") =&gt; void</code></pre></dialog></span> | The scheme, with `reverse` back to unset so it follows the scheme. The painted metric's own preset writes `scheme` unset, so it keeps following the metric. |
| <span id="action-startrenderingbackend">**startRenderingBackend**</span><br><code>(backend: LDRenderingBackend) =&gt; void</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="action-setstatusmessage">[`setStatusMessage`](../basedisplay#action-setstatusmessage)</span>, <span id="action-seterror">[`setError`](../basedisplay#action-seterror)</span>, <span id="action-clearhoveredfeature">[`clearHoveredFeature`](../basedisplay#action-clearhoveredfeature)</span>, <span id="action-reload">[`reload`](../basedisplay#action-reload)</span>, <span id="action-applydisplaysettings">[`applyDisplaySettings`](../basedisplay#action-applydisplaysettings)</span>, <span id="action-applyplot">[`applyPlot`](../basedisplay#action-applyplot)</span></span>

<span data-pagefind-ignore>From [TrackHeightMixin](../trackheightmixin): <span id="action-setscrolltop">[`setScrollTop`](../trackheightmixin#action-setscrolltop)</span>, <span id="action-setheight">[`setHeight`](../trackheightmixin#action-setheight)</span>, <span id="action-resizeheight">[`resizeHeight`](../trackheightmixin#action-resizeheight)</span>, <span id="action-expandtocontentheight">[`expandToContentHeight`](../trackheightmixin#action-expandtocontentheight)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="action-clearbyteestimate">[`clearByteEstimate`](../regiontoolargemixin#action-clearbyteestimate)</span>, <span id="action-cleargatemeasurements">[`clearGateMeasurements`](../regiontoolargemixin#action-cleargatemeasurements)</span>, <span id="action-setforceloadtrack">[`setForceLoadTrack`](../regiontoolargemixin#action-setforceloadtrack)</span>, <span id="action-commitfetchbytes">[`commitFetchBytes`](../regiontoolargemixin#action-commitfetchbytes)</span>, <span id="action-forceload">[`forceLoad`](../regiontoolargemixin#action-forceload)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="action-markcanvasdrawn">[`markCanvasDrawn`](../renderlifecyclemixin#action-markcanvasdrawn)</span>, <span id="action-resetcanvasdrawn">[`resetCanvasDrawn`](../renderlifecyclemixin#action-resetcanvasdrawn)</span>, <span id="action-stoprenderingbackend">[`stopRenderingBackend`](../renderlifecyclemixin#action-stoprenderingbackend)</span>, <span id="action-rendernow">[`renderNow`](../renderlifecyclemixin#action-rendernow)</span>, <span id="action-setoffscreen">[`setOffScreen`](../renderlifecyclemixin#action-setoffscreen)</span>, <span id="action-setrendererror">[`setRenderError`](../renderlifecyclemixin#action-setrendererror)</span>, <span id="action-attachrenderingbackend">[`attachRenderingBackend`](../renderlifecyclemixin#action-attachrenderingbackend)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="action-commitfetchresult">[`commitFetchResult`](../keyedfetchmixin#action-commitfetchresult)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span></span>

<span data-pagefind-ignore>From [LegendMixin](../legendmixin): <span id="action-setshowlegend">[`setShowLegend`](../legendmixin#action-setshowlegend)</span>, <span id="action-dismisslegendsection">[`dismissLegendSection`](../legendmixin#action-dismisslegendsection)</span></span>

<span data-pagefind-ignore>From [TriangleMatrixMixin](../trianglematrixmixin): <span id="action-setrpcdata">[`setRpcData`](../trianglematrixmixin#action-setrpcdata)</span>, <span id="action-setsquashtoheight">[`setSquashToHeight`](../trianglematrixmixin#action-setsquashtoheight)</span></span>
