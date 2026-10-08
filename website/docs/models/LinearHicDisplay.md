---
id: linearhicdisplay
title: LinearHicDisplay
description: "The Hi-C contact matrix as a triangle over the view."
sidebar_label: Display -> LinearHicDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `hic` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/model.ts).

## Example usage

A `HicTrack` whose display pins the colour scale's top, so two tracks set
alike share one scale, and runs one binsize coarser than the zoom picks:

```js
{
  type: 'HicTrack',
  trackId: 'hic',
  name: 'Hi-C',
  assemblyNames: ['hg38'],
  adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
  displays: [
    {
      type: 'LinearHicDisplay',
      displayId: 'hic-LinearHicDisplay',
      color: { scale: 'log', domainMax: 500 },
      resolutionBias: 1,
    },
  ],
}
```

The Hi-C contact matrix as a triangle over the view.

The configuration slots for this model are documented on its [config schema page](../../config/linearhicdisplay).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('LinearHicDisplay')</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="property-id">[`id`](../basedisplay#property-id)</span></span>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-fileinfo">**fileInfo**</span><br><code>AdapterRead&lt;HicFileInfo&gt; &#124; undefined</code> | The file's normalizations and binsizes, stamped with the adapter config they answer. |

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
| <span id="getter-availablenormalizations">**availableNormalizations**</span><br><code>string[] &#124; undefined</code> |  |
| <span id="getter-availableresolutions">**availableResolutions**</span><br><code>number[] &#124; undefined</code> | Smallest first, so a negative `resolutionBias` is always finer. |
| <span id="getter-resolutionbias">**resolutionBias**</span><br><code>number</code> |  |
| <span id="getter-colorencoding">**colorEncoding**</span><br><code>HicColorEncoding</code> | The `color` object as it paints, through the shared reader and `count`'s preset: a linear or log ramp whose `reverse`, where unset, follows whether the scheme runs dark at its low end. The `scheme` and `domainQuantile` slots have defaults, so both are always set. |
| <span id="getter-notices">**notices**</span><br><code>string[]</code> | What the `color` object says that cannot paint as written, as the corner indicator lists it: the same lines `plotProblems` and `jbrowse validate` report. |
| <span id="getter-colorscaletype">**colorScaleType**</span><br><code>"linear" &#124; "log"</code> |  |
| <span id="getter-colorscheme">**colorScheme**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>"blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma"…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>"blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma" &#124; "purpleorange" &#124; "redblue" &#124; "redgreyblue" &#124; "reds" &#124; "viridis"</code></pre></dialog></span> |  |
| <span id="getter-colorreverse">**colorReverse**</span><br><code>boolean</code> | `color.reverse`, or where unset whether the scheme runs dark at its low end. |
| <span id="getter-colorramp">**colorRamp**</span><br><code>Uint8Array&lt;ArrayBufferLike&gt;</code> | The ramp's 256 entries: the GPU's texture, the Canvas2D fill and the legend read this one table. It reads `colorScheme` and `colorReverse` rather than the encoding, so a domain edit re-uploads no texture. |
| <span id="getter-colorquantile">**colorQuantile**</span><br><code>number</code> | `color.domainQuantile`: the quantile of the loaded counts an unset `domainMax` follows, their maximum at 1. |
| <span id="getter-colorfollowspercentile">**colorFollowsPercentile**</span><br><code>boolean</code> | Whether an unset `color.domainMax` saturates at `colorQuantile` rather than the counts' maximum. |
| <span id="getter-saturationquantile">**saturationQuantile**</span><br><code>number</code> | The quantile "Emphasize faint contacts" saturates at: `colorQuantile` while it clips, else the one ticking it writes. The worker computes this one whichever is drawn, so the toggle refetches nothing. |
| <span id="getter-showresolutioncontrols">**showResolutionControls**</span><br><code>boolean</code> |  |
| <span id="getter-selectednormalization">**selectedNormalization**</span><br><code>string</code> |  |
| <span id="getter-hasresolutions">**hasResolutions**</span><br><code>boolean</code> | Whether the binsize list has arrived; every resolution control gates on it. |
| <span id="getter-activenormalization">**activeNormalization**</span><br><code>string</code> | The normalization to request: the selection where the file has it, else the next best it does. A getter, so a file lacking the selection never marks the track edited. |
| <span id="getter-colordomain">**colorDomain**</span><br><code>[number, number]</code> | The domain the counts are coloured over, as every ramp spans one: a pinned end holds, and an open one follows the loaded counts from 0, the top at their `colorQuantile` below 1, else their maximum. |
| <span id="getter-awaitingprerequisite">**awaitingPrerequisite**</span><br><code>boolean</code> | Retry is two-stage: the contact fetch declines until the header it needs lands, and the header's arrival wakes it. `infoFetchFailure.test.ts` pins it. |
| <span id="getter-showresolutionbox">**showResolutionBox**</span><br><code>boolean</code> | Whether the resolution box is up; the chrome starts the key below it. |
| <span id="getter-legendtop">**legendTop**</span><br><code>number</code> |  |
| <span id="getter-appliednormalization">**appliedNormalization**</span><br><code>string</code> | The normalization the loaded matrix carries, which falls back per binsize (KR at 5 kb, nothing at 2.5 Mb is typical). The menu ticks this. Fetch-derived, so it stays out of `rpcProps()`. |
| <span id="getter-scaletype">**scaleType**</span><br><code>ScaleTypeCode</code> |  |
| <span id="getter-autoresolutionidx">**autoResolutionIdx**</span><br><code>number</code> | The binsize index auto mode picks: the largest at most 2 bp/px, about half a bin per pixel, else the finest. |
| <span id="getter-colorscales">**colorScales**</span><br><code>ColorScale[]</code> | The count ramp, once there is a domain to span. The ends are where the ramp paints them, and a top below the largest loaded count reads `≥`. |
| <span id="getter-effectiveresolutionidx">**effectiveResolutionIdx**</span><br><code>number</code> | The index in effect after `resolutionBias`, clamped so a bias set at another zoom cannot index out of range. |
| <span id="getter-valuelabel">**valueLabel**</span><br><code>string</code> | What the tooltip calls a bin's value. |
| <span id="getter-effectiveresolution">**effectiveResolution**</span><br><code>number &#124; undefined</code> |  |
| <span id="getter-canstepresolutionfiner">**canStepResolutionFiner**</span><br><code>boolean</code> |  |
| <span id="getter-canstepresolutioncoarser">**canStepResolutionCoarser**</span><br><code>boolean</code> |  |
| <span id="getter-renderstate">**renderState**</span><br><code>HicRenderState</code> |  |
| <span id="getter-viewsignature">**viewSignature**</span><br><code>string &#124; undefined</code> | The static blocks plus the binsize, so a pan inside them redraws and only a block entering or a binsize step refetches. Undefined until the header lands. |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-hoveredfeature">[`hoveredFeature`](../basedisplay#getter-hoveredfeature)</span>, <span id="getter-featurenoun">[`featureNoun`](../basedisplay#getter-featurenoun)</span>, <span id="getter-featurewidgettype">[`featureWidgetType`](../basedisplay#getter-featurewidgettype)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span></span>

<span data-pagefind-ignore>From [TrackHeightMixin](../trackheightmixin): <span id="getter-height">[`height`](../trackheightmixin#getter-height)</span>, <span id="getter-resizing">[`resizing`](../trackheightmixin#getter-resizing)</span>, <span id="getter-scrollcontentheight">[`scrollContentHeight`](../trackheightmixin#getter-scrollcontentheight)</span>, <span id="getter-scrollviewportheight">[`scrollViewportHeight`](../trackheightmixin#getter-scrollviewportheight)</span>, <span id="getter-scrollableheight">[`scrollableHeight`](../trackheightmixin#getter-scrollableheight)</span></span>

<span data-pagefind-ignore>From [GlobalFetchMixin](../globalfetchmixin): <span id="getter-host">[`host`](../globalfetchmixin#getter-host)</span>, <span id="getter-staticblocksignature">[`staticBlockSignature`](../globalfetchmixin#getter-staticblocksignature)</span>, <span id="getter-dynamicblocksignature">[`dynamicBlockSignature`](../globalfetchmixin#getter-dynamicblocksignature)</span>, <span id="getter-viewportempty">[`viewportEmpty`](../globalfetchmixin#getter-viewportempty)</span>, <span id="getter-canrender">[`canRender`](../globalfetchmixin#getter-canrender)</span>, <span id="getter-renderscanvas">[`rendersCanvas`](../globalfetchmixin#getter-renderscanvas)</span>, <span id="getter-paintinert">[`paintInert`](../globalfetchmixin#getter-paintinert)</span>, <span id="getter-svgready">[`svgReady`](../globalfetchmixin#getter-svgready)</span>, <span id="getter-displayphase">[`displayPhase`](../globalfetchmixin#getter-displayphase)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="getter-gateenabled">[`gateEnabled`](../regiontoolargemixin#getter-gateenabled)</span>, <span id="getter-bytegateadapterconfig">[`byteGateAdapterConfig`](../regiontoolargemixin#getter-bytegateadapterconfig)</span>, <span id="getter-configuredfetchsizelimit">[`configuredFetchSizeLimit`](../regiontoolargemixin#getter-configuredfetchsizelimit)</span>, <span id="getter-densitytoolarge">[`densityTooLarge`](../regiontoolargemixin#getter-densitytoolarge)</span>, <span id="getter-bytegateadapterpath">[`byteGateAdapterPath`](../regiontoolargemixin#getter-bytegateadapterpath)</span>, <span id="getter-adapterfetchsizelimit">[`adapterFetchSizeLimit`](../regiontoolargemixin#getter-adapterfetchsizelimit)</span>, <span id="getter-configforceload">[`configForceLoad`](../regiontoolargemixin#getter-configforceload)</span>, <span id="getter-gateviewportspanbp">[`gateViewportSpanBp`](../regiontoolargemixin#getter-gateviewportspanbp)</span>, <span id="getter-gateviewport">[`gateViewport`](../regiontoolargemixin#getter-gateviewport)</span>, <span id="getter-aboveforceloadfloor">[`aboveForceLoadFloor`](../regiontoolargemixin#getter-aboveforceloadfloor)</span>, <span id="getter-gateexempt">[`gateExempt`](../regiontoolargemixin#getter-gateexempt)</span>, <span id="getter-estimatedfetchbytes">[`estimatedFetchBytes`](../regiontoolargemixin#getter-estimatedfetchbytes)</span>, <span id="getter-gatemeasurementstale">[`gateMeasurementStale`](../regiontoolargemixin#getter-gatemeasurementstale)</span>, <span id="getter-gatebytelimit">[`gateByteLimit`](../regiontoolargemixin#getter-gatebytelimit)</span>, <span id="getter-gateactive">[`gateActive`](../regiontoolargemixin#getter-gateactive)</span>, <span id="getter-densitygateactive">[`densityGateActive`](../regiontoolargemixin#getter-densitygateactive)</span>, <span id="getter-toolargestatus">[`tooLargeStatus`](../regiontoolargemixin#getter-toolargestatus)</span>, <span id="getter-regiontoolarge">[`regionTooLarge`](../regiontoolargemixin#getter-regiontoolarge)</span>, <span id="getter-regiontoolargereason">[`regionTooLargeReason`](../regiontoolargemixin#getter-regiontoolargereason)</span>, <span id="getter-zoomcanreleasegate">[`zoomCanReleaseGate`](../regiontoolargemixin#getter-zoomcanreleasegate)</span>, <span id="getter-gateskipsmeasuredviewport">[`gateSkipsMeasuredViewport`](../regiontoolargemixin#getter-gateskipsmeasuredviewport)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="getter-paintsuperseded">[`paintSuperseded`](../renderlifecyclemixin#getter-paintsuperseded)</span>, <span id="getter-painted">[`painted`](../renderlifecyclemixin#getter-painted)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="getter-datasuperseded">[`dataSuperseded`](../keyedfetchmixin#getter-datasuperseded)</span>, <span id="getter-currentfetchkey">[`currentFetchKey`](../keyedfetchmixin#getter-currentfetchkey)</span>, <span id="getter-datacurrent">[`dataCurrent`](../keyedfetchmixin#getter-datacurrent)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-fetchinert">[`fetchInert`](../fetchmixin#getter-fetchinert)</span>, <span id="getter-awaitingdependentdata">[`awaitingDependentData`](../fetchmixin#getter-awaitingdependentdata)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span></span>

<span data-pagefind-ignore>From [LegendMixin](../legendmixin): <span id="getter-showlegend">[`showLegend`](../legendmixin#getter-showlegend)</span>, <span id="getter-legendright">[`legendRight`](../legendmixin#getter-legendright)</span>, <span id="getter-legendspec">[`legendSpec`](../legendmixin#getter-legendspec)</span>, <span id="getter-haslegendkey">[`hasLegendKey`](../legendmixin#getter-haslegendkey)</span></span>

<span data-pagefind-ignore>From [TriangleMatrixMixin](../trianglematrixmixin): <span id="getter-squashtoheight">[`squashToHeight`](../trianglematrixmixin#getter-squashtoheight)</span>, <span id="getter-matrixtop">[`matrixTop`](../trianglematrixmixin#getter-matrixtop)</span>, <span id="getter-canvaswidth">[`canvasWidth`](../trianglematrixmixin#getter-canvaswidth)</span>, <span id="getter-viewtransform">[`viewTransform`](../trianglematrixmixin#getter-viewtransform)</span>, <span id="getter-matrixregions">[`matrixRegions`](../trianglematrixmixin#getter-matrixregions)</span>, <span id="getter-matrixheight">[`matrixHeight`](../trianglematrixmixin#getter-matrixheight)</span>, <span id="getter-matrixblocks">[`matrixBlocks`](../trianglematrixmixin#getter-matrixblocks)</span>, <span id="getter-yscalar">[`yScalar`](../trianglematrixmixin#getter-yscalar)</span>, <span id="getter-triangletransform">[`triangleTransform`](../trianglematrixmixin#getter-triangletransform)</span>, <span id="getter-triangleframe">[`triangleFrame`](../trianglematrixmixin#getter-triangleframe)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-rpcprops">**rpcProps**</span><br><code>() =&gt; { normalization: string; quantile: number; }</code> | The settings that refetch. The binsize is zoom-derived, so it travels as its own argument. |
| <span id="method-hittest">**hitTest**</span><br><code>(mouseX: number, mouseY: number) =&gt; HicContactItem &#124; undefined</code> | The contact under a display-px point, through the inverse of the transform the matrix was drawn with. |
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
| <span id="action-startrenderingbackend">**startRenderingBackend**</span><br><code>(backend: HicRenderingBackend) =&gt; void</code> |  |
| <span id="action-setcolorscale">**setColorScale**</span><br><code>(scale?: "linear" &#124; "log" &#124; undefined) =&gt; void</code> | `color.scale`; undefined returns it to `count`'s linear preset. |
| <span id="action-setcolorfollowspercentile">**setColorFollowsPercentile**</span><br><code>(f: boolean) =&gt; void</code> |  |
| <span id="action-setshowresolutioncontrols">**setShowResolutionControls**</span><br><code>(f: boolean) =&gt; void</code> |  |
| <span id="action-setcolorscheme">**setColorScheme**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(scheme: "blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox"…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(scheme: "blues" &#124; "cividis" &#124; "fall" &#124; "inferno" &#124; "juicebox" &#124; "magma" &#124; "purpleorange" &#124; "redblue" &#124; "redgreyblue" &#124; "reds" &#124; "viridis") =&gt; void</code></pre></dialog></span> | The scheme, with `reverse` back to unset so it follows the scheme. |
| <span id="action-setactivenormalization">**setActiveNormalization**</span><br><code>(f: string) =&gt; void</code> |  |
| <span id="action-setfileinfo">**setFileInfo**</span><br><code>(read: AdapterRead&lt;HicFileInfo&gt;) =&gt; void</code> |  |
| <span id="action-resetresolutionbias">**resetResolutionBias**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setresolutionidx">**setResolutionIdx**</span><br><code>(idx: number) =&gt; void</code> | Lock to `availableResolutions[idx]`, clamped, stored as an offset from the auto pick so the choice keeps its meaning across zoom. |
| <span id="action-setresolution">**setResolution**</span><br><code>(binSize: number) =&gt; void</code> | Lock to a binsize the file offers; any other is ignored. |
| <span id="action-stepresolution">**stepResolution**</span><br><code>(delta: number) =&gt; void</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="action-setstatusmessage">[`setStatusMessage`](../basedisplay#action-setstatusmessage)</span>, <span id="action-seterror">[`setError`](../basedisplay#action-seterror)</span>, <span id="action-clearhoveredfeature">[`clearHoveredFeature`](../basedisplay#action-clearhoveredfeature)</span>, <span id="action-reload">[`reload`](../basedisplay#action-reload)</span>, <span id="action-applydisplaysettings">[`applyDisplaySettings`](../basedisplay#action-applydisplaysettings)</span>, <span id="action-applyplot">[`applyPlot`](../basedisplay#action-applyplot)</span></span>

<span data-pagefind-ignore>From [TrackHeightMixin](../trackheightmixin): <span id="action-setscrolltop">[`setScrollTop`](../trackheightmixin#action-setscrolltop)</span>, <span id="action-setheight">[`setHeight`](../trackheightmixin#action-setheight)</span>, <span id="action-resizeheight">[`resizeHeight`](../trackheightmixin#action-resizeheight)</span>, <span id="action-expandtocontentheight">[`expandToContentHeight`](../trackheightmixin#action-expandtocontentheight)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="action-clearbyteestimate">[`clearByteEstimate`](../regiontoolargemixin#action-clearbyteestimate)</span>, <span id="action-cleargatemeasurements">[`clearGateMeasurements`](../regiontoolargemixin#action-cleargatemeasurements)</span>, <span id="action-setforceloadtrack">[`setForceLoadTrack`](../regiontoolargemixin#action-setforceloadtrack)</span>, <span id="action-commitfetchbytes">[`commitFetchBytes`](../regiontoolargemixin#action-commitfetchbytes)</span>, <span id="action-forceload">[`forceLoad`](../regiontoolargemixin#action-forceload)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="action-markcanvasdrawn">[`markCanvasDrawn`](../renderlifecyclemixin#action-markcanvasdrawn)</span>, <span id="action-resetcanvasdrawn">[`resetCanvasDrawn`](../renderlifecyclemixin#action-resetcanvasdrawn)</span>, <span id="action-stoprenderingbackend">[`stopRenderingBackend`](../renderlifecyclemixin#action-stoprenderingbackend)</span>, <span id="action-rendernow">[`renderNow`](../renderlifecyclemixin#action-rendernow)</span>, <span id="action-setoffscreen">[`setOffScreen`](../renderlifecyclemixin#action-setoffscreen)</span>, <span id="action-setrendererror">[`setRenderError`](../renderlifecyclemixin#action-setrendererror)</span>, <span id="action-attachrenderingbackend">[`attachRenderingBackend`](../renderlifecyclemixin#action-attachrenderingbackend)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="action-commitfetchresult">[`commitFetchResult`](../keyedfetchmixin#action-commitfetchresult)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span></span>

<span data-pagefind-ignore>From [LegendMixin](../legendmixin): <span id="action-setshowlegend">[`setShowLegend`](../legendmixin#action-setshowlegend)</span>, <span id="action-dismisslegendsection">[`dismissLegendSection`](../legendmixin#action-dismisslegendsection)</span></span>

<span data-pagefind-ignore>From [TriangleMatrixMixin](../trianglematrixmixin): <span id="action-setrpcdata">[`setRpcData`](../trianglematrixmixin#action-setrpcdata)</span>, <span id="action-setsquashtoheight">[`setSquashToHeight`](../trianglematrixmixin#action-setsquashtoheight)</span></span>
