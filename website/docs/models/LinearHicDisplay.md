---
id: linearhicdisplay
title: LinearHicDisplay
description: "The Hi-C contact matrix as a triangle over the view."
sidebar_label: Display -> LinearHicDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `hic` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/model.ts).

The Hi-C contact matrix as a triangle over the view.

## Example usage

A `HicTrack` whose display pins the color scale's top, so two tracks set
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
      encoding: {
        color: { scale: { type: 'symlog', domainMax: 500 } },
      },
      data: { resolution: -1 },
    },
  ],
}
```

The configuration slots for this model are documented on its [config schema page](../../config/linearhicdisplay).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('LinearHicDisplay')</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited property from one model</summary>

From [BaseDisplay](../basedisplay): <span id="property-id">[`id`](../basedisplay#property-id)</span>

</details>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-fileinfo">**fileInfo**</span><br><code>AdapterRead&lt;HicHeader&gt; &#124; undefined</code> | The file's normalizations and binsizes, stamped with the adapter config they answer. |

<details class="inherited-members" data-pagefind-ignore>
<summary>25 inherited volatiles from 8 models</summary>

From [PointerHoverMixin](../pointerhovermixin): <span id="volatile-pointer">[`pointer`](../pointerhovermixin#volatile-pointer)</span>

From [TriangleMatrixMixin](../trianglematrixmixin): <span id="volatile-rpcdata">[`rpcData`](../trianglematrixmixin#volatile-rpcdata)</span>

From [LegendMixin](../legendmixin): <span id="volatile-dismissedlegendsections">[`dismissedLegendSections`](../legendmixin#volatile-dismissedlegendsections)</span>

From [KeyedFetchMixin](../keyedfetchmixin): <span id="volatile-loadedfetchkey">[`loadedFetchKey`](../keyedfetchmixin#volatile-loadedfetchkey)</span>

From [FetchMixin](../fetchmixin): <span id="volatile-activesignal">[`activeSignal`](../fetchmixin#volatile-activesignal)</span>, <span id="volatile-fetchgeneration">[`fetchGeneration`](../fetchmixin#volatile-fetchgeneration)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../fetchmixin#volatile-reloadcounter)</span>, <span id="volatile-statuswindow">[`statusWindow`](../fetchmixin#volatile-statuswindow)</span>, <span id="volatile-error">[`error`](../fetchmixin#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../fetchmixin#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../fetchmixin#volatile-statusprogress)</span>, <span id="volatile-fetchcanceled">[`fetchCanceled`](../fetchmixin#volatile-fetchcanceled)</span>, <span id="volatile-fetchrotation">[`fetchRotation`](../fetchmixin#volatile-fetchrotation)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="volatile-canvasdrawn">[`canvasDrawn`](../renderlifecyclemixin#volatile-canvasdrawn)</span>, <span id="volatile-paintcount">[`paintCount`](../renderlifecyclemixin#volatile-paintcount)</span>, <span id="volatile-currentrenderingbackend">[`currentRenderingBackend`](../renderlifecyclemixin#volatile-currentrenderingbackend)</span>, <span id="volatile-rendertick">[`renderTick`](../renderlifecyclemixin#volatile-rendertick)</span>, <span id="volatile-autorunsinstalled">[`autorunsInstalled`](../renderlifecyclemixin#volatile-autorunsinstalled)</span>, <span id="volatile-rendererror">[`renderError`](../renderlifecyclemixin#volatile-rendererror)</span>, <span id="volatile-offscreen">[`offScreen`](../renderlifecyclemixin#volatile-offscreen)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="volatile-forceloadtrack">[`forceLoadTrack`](../regiontoolargemixin#volatile-forceloadtrack)</span>, <span id="volatile-byteestimate">[`byteEstimate`](../regiontoolargemixin#volatile-byteestimate)</span>, <span id="volatile-gatemeasuredviewportkey">[`gateMeasuredViewportKey`](../regiontoolargemixin#volatile-gatemeasuredviewportkey)</span>

From [TrackHeightMixin](../trackheightmixin): <span id="volatile-scrolltop">[`scrollTop`](../trackheightmixin#volatile-scrolltop)</span>, <span id="volatile-hostheight">[`hostHeight`](../trackheightmixin#volatile-hostheight)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-availablenormalizations">**availableNormalizations**</span><br><code>string[] &#124; undefined</code> |  |
| <span id="getter-availableresolutions">**availableResolutions**</span><br><code>number[] &#124; undefined</code> | Smallest first, so a positive `data.resolution` is always finer. |
| <span id="getter-hascontrol">**hasControl**</span><br><code>boolean</code> | Whether the adapter names a control, which observed/control needs. |
| <span id="getter-resolutionsteps">**resolutionSteps**</span><br><code>number</code> | `data.resolution`: binsizes finer than the zoom's pick. |
| <span id="getter-colorquantile">**colorQuantile**</span><br><code>number</code> | `encoding.color.scale.domainQuantile`: the quantile of the loaded counts an unset `domainMax` follows, their maximum at 1. |
| <span id="getter-colorfollowspercentile">**colorFollowsPercentile**</span><br><code>boolean</code> | Whether an unset `encoding.color.scale.domainMax` saturates at `colorQuantile` rather than the counts' maximum. |
| <span id="getter-saturationquantile">**saturationQuantile**</span><br><code>number</code> | The quantile "Emphasize faint contacts" saturates at: `colorQuantile` while it clips, else the one ticking it writes. Each fetch asks the worker for this one whichever is drawn, so the toggle reselects nothing. |
| <span id="getter-selectednormalization">**selectedNormalization**</span><br><code>string</code> | `data.normalization`, the one asked for. |
| <span id="getter-colorfield">**colorField**</span><br><code>"observed" &#124; "observed/control" &#124; "observed/expected"</code> | `encoding.color.field`, what the fetch asks the worker to put in each cell. |
| <span id="getter-countfloors">**countFloors**</span><br><code>HicCountFloors</code> | The `filter` list's floors on a cell's counts, which the worker applies before the ratio. |
| <span id="getter-paintedcolorfield">**paintedColorField**</span><br><code>"observed" &#124; "observed/control" &#124; "observed/expected"</code> | The field the loaded cells are: observed/expected falls back to the counts where the file has no expected values at the binsize. |
| <span id="getter-hasresolutions">**hasResolutions**</span><br><code>boolean</code> | Whether the binsize list has arrived; every resolution control gates on it. |
| <span id="getter-activenormalization">**activeNormalization**</span><br><code>string</code> | The normalization to request: the selection where the file has it, else the next best it does. A getter, so a file lacking the selection never marks the track edited. |
| <span id="getter-loadedquantilescore">**loadedQuantileScore**</span><br><code>number</code> | The loaded counts' `saturationQuantile`: the worker's answer, or after an edit a selection over the loaded matrix, so a new percentile refetches nothing. The next fetch asks the worker for the new one. |
| <span id="getter-colorextent">**colorExtent**</span><br><code>readonly [number, number]</code> | What an open end of the color domain follows: the loaded values from 0, which is where a count's extent starts, to their `colorQuantile` below 1, else their maximum. |
| <span id="getter-awaitingprerequisite">**awaitingPrerequisite**</span><br><code>boolean</code> | Retry is two-stage: the contact fetch declines until the header it needs lands, and the header's arrival wakes it. `infoFetchFailure.test.ts` pins it. |
| <span id="getter-appliednormalization">**appliedNormalization**</span><br><code>string</code> | The normalization the loaded matrix has, which falls back per binsize (KR at 5 kb, nothing at 2.5 Mb is typical). The menu ticks this. Fetch-derived, so it stays out of `rpcProps()`. |
| <span id="getter-paintedfieldname">**paintedFieldName**</span><br><code>{ name: string; isCount: boolean; }</code> | The painted field's name for the key and the tooltip. |
| <span id="getter-autoresolutionidx">**autoResolutionIdx**</span><br><code>number</code> | The binsize index auto mode picks: the largest at most 2 bp/px, about half a bin per pixel, else the finest. |
| <span id="getter-colorscales">**colorScales**</span><br><code>ColorScale[]</code> | The value ramp. A top below the largest loaded value reads `≥`. The title names the loaded binsize, so a figure carries it, unless `encoding.color.legend.title` replaces it. |
| <span id="getter-effectiveresolutionidx">**effectiveResolutionIdx**</span><br><code>number</code> | The index in effect after `resolutionSteps`, clamped so steps set at another zoom cannot index out of range. |
| <span id="getter-valuelabel">**valueLabel**</span><br><code>string</code> | What the tooltip calls a bin's value. |
| <span id="getter-effectiveresolution">**effectiveResolution**</span><br><code>number &#124; undefined</code> |  |
| <span id="getter-canstepresolutionfiner">**canStepResolutionFiner**</span><br><code>boolean</code> |  |
| <span id="getter-canstepresolutioncoarser">**canStepResolutionCoarser**</span><br><code>boolean</code> |  |
| <span id="getter-renderstate">**renderState**</span><br><code>HicRenderState</code> |  |
| <span id="getter-viewsignature">**viewSignature**</span><br><code>string &#124; undefined</code> | The static blocks plus the binsize, so a pan inside them redraws and only a block entering or a binsize step refetches. Undefined until the header lands. |

<details class="inherited-members" data-pagefind-ignore>
<summary>88 inherited getters from 11 models</summary>

From [PointerHoverMixin](../pointerhovermixin): <span id="getter-hoveredfeature">[`hoveredFeature`](../pointerhovermixin#getter-hoveredfeature)</span>

From [TriangleMatrixMixin](../trianglematrixmixin): <span id="getter-heightmode">[`heightMode`](../trianglematrixmixin#getter-heightmode)</span>, <span id="getter-matrixtop">[`matrixTop`](../trianglematrixmixin#getter-matrixtop)</span>, <span id="getter-canvaswidth">[`canvasWidth`](../trianglematrixmixin#getter-canvaswidth)</span>, <span id="getter-viewtransform">[`viewTransform`](../trianglematrixmixin#getter-viewtransform)</span>, <span id="getter-matrixregions">[`matrixRegions`](../trianglematrixmixin#getter-matrixregions)</span>, <span id="getter-matrixheight">[`matrixHeight`](../trianglematrixmixin#getter-matrixheight)</span>, <span id="getter-matrixblocks">[`matrixBlocks`](../trianglematrixmixin#getter-matrixblocks)</span>, <span id="getter-yscalar">[`yScalar`](../trianglematrixmixin#getter-yscalar)</span>, <span id="getter-triangletransform">[`triangleTransform`](../trianglematrixmixin#getter-triangletransform)</span>, <span id="getter-triangleframe">[`triangleFrame`](../trianglematrixmixin#getter-triangleframe)</span>

From [MatrixRampMixin](../matrixrampmixin): <span id="getter-colorencoding">[`colorEncoding`](../matrixrampmixin#getter-colorencoding)</span>, <span id="getter-colorscaletype">[`colorScaleType`](../matrixrampmixin#getter-colorscaletype)</span>, <span id="getter-colorscheme">[`colorScheme`](../matrixrampmixin#getter-colorscheme)</span>, <span id="getter-colorreverse">[`colorReverse`](../matrixrampmixin#getter-colorreverse)</span>, <span id="getter-colorramp">[`colorRamp`](../matrixrampmixin#getter-colorramp)</span>, <span id="getter-colorscale">[`colorScale`](../matrixrampmixin#getter-colorscale)</span>, <span id="getter-colordomain">[`colorDomain`](../matrixrampmixin#getter-colordomain)</span>, <span id="getter-colormidnorm">[`colorMidNorm`](../matrixrampmixin#getter-colormidnorm)</span>, <span id="getter-matrixcolor">[`matrixColor`](../matrixrampmixin#getter-matrixcolor)</span>, <span id="getter-colorfieldtitle">[`colorFieldTitle`](../matrixrampmixin#getter-colorfieldtitle)</span>

From [LegendMixin](../legendmixin): <span id="getter-showlegend">[`showLegend`](../legendmixin#getter-showlegend)</span>, <span id="getter-legendright">[`legendRight`](../legendmixin#getter-legendright)</span>, <span id="getter-legendspec">[`legendSpec`](../legendmixin#getter-legendspec)</span>, <span id="getter-haslegendkey">[`hasLegendKey`](../legendmixin#getter-haslegendkey)</span>

From [GlobalFetchMixin](../globalfetchmixin): <span id="getter-host">[`host`](../globalfetchmixin#getter-host)</span>, <span id="getter-canvaswidthpx">[`canvasWidthPx`](../globalfetchmixin#getter-canvaswidthpx)</span>, <span id="getter-staticblocksignature">[`staticBlockSignature`](../globalfetchmixin#getter-staticblocksignature)</span>, <span id="getter-dynamicblocksignature">[`dynamicBlockSignature`](../globalfetchmixin#getter-dynamicblocksignature)</span>, <span id="getter-viewportempty">[`viewportEmpty`](../globalfetchmixin#getter-viewportempty)</span>, <span id="getter-canrender">[`canRender`](../globalfetchmixin#getter-canrender)</span>, <span id="getter-renderscanvas">[`rendersCanvas`](../globalfetchmixin#getter-renderscanvas)</span>, <span id="getter-paintinert">[`paintInert`](../globalfetchmixin#getter-paintinert)</span>, <span id="getter-svgready">[`svgReady`](../globalfetchmixin#getter-svgready)</span>, <span id="getter-displayphase">[`displayPhase`](../globalfetchmixin#getter-displayphase)</span>

From [KeyedFetchMixin](../keyedfetchmixin): <span id="getter-datasuperseded">[`dataSuperseded`](../keyedfetchmixin#getter-datasuperseded)</span>, <span id="getter-currentfetchkey">[`currentFetchKey`](../keyedfetchmixin#getter-currentfetchkey)</span>, <span id="getter-datacurrent">[`dataCurrent`](../keyedfetchmixin#getter-datacurrent)</span>

From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-fetchinert">[`fetchInert`](../fetchmixin#getter-fetchinert)</span>, <span id="getter-awaitingdependentdata">[`awaitingDependentData`](../fetchmixin#getter-awaitingdependentdata)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="getter-paintsuperseded">[`paintSuperseded`](../renderlifecyclemixin#getter-paintsuperseded)</span>, <span id="getter-painted">[`painted`](../renderlifecyclemixin#getter-painted)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="getter-gateenabled">[`gateEnabled`](../regiontoolargemixin#getter-gateenabled)</span>, <span id="getter-bytegateadapterconfig">[`byteGateAdapterConfig`](../regiontoolargemixin#getter-bytegateadapterconfig)</span>, <span id="getter-configuredfetchsizelimit">[`configuredFetchSizeLimit`](../regiontoolargemixin#getter-configuredfetchsizelimit)</span>, <span id="getter-densitytoolarge">[`densityTooLarge`](../regiontoolargemixin#getter-densitytoolarge)</span>, <span id="getter-bytegateadapterpath">[`byteGateAdapterPath`](../regiontoolargemixin#getter-bytegateadapterpath)</span>, <span id="getter-adapterfetchsizelimit">[`adapterFetchSizeLimit`](../regiontoolargemixin#getter-adapterfetchsizelimit)</span>, <span id="getter-configforceload">[`configForceLoad`](../regiontoolargemixin#getter-configforceload)</span>, <span id="getter-gateviewportspanbp">[`gateViewportSpanBp`](../regiontoolargemixin#getter-gateviewportspanbp)</span>, <span id="getter-gateviewport">[`gateViewport`](../regiontoolargemixin#getter-gateviewport)</span>, <span id="getter-aboveforceloadfloor">[`aboveForceLoadFloor`](../regiontoolargemixin#getter-aboveforceloadfloor)</span>, <span id="getter-gateexempt">[`gateExempt`](../regiontoolargemixin#getter-gateexempt)</span>, <span id="getter-estimatedfetchbytes">[`estimatedFetchBytes`](../regiontoolargemixin#getter-estimatedfetchbytes)</span>, <span id="getter-gatemeasurementstale">[`gateMeasurementStale`](../regiontoolargemixin#getter-gatemeasurementstale)</span>, <span id="getter-gatebytelimit">[`gateByteLimit`](../regiontoolargemixin#getter-gatebytelimit)</span>, <span id="getter-gateactive">[`gateActive`](../regiontoolargemixin#getter-gateactive)</span>, <span id="getter-densitygateactive">[`densityGateActive`](../regiontoolargemixin#getter-densitygateactive)</span>, <span id="getter-toolargestatus">[`tooLargeStatus`](../regiontoolargemixin#getter-toolargestatus)</span>, <span id="getter-regiontoolarge">[`regionTooLarge`](../regiontoolargemixin#getter-regiontoolarge)</span>, <span id="getter-regiontoolargereason">[`regionTooLargeReason`](../regiontoolargemixin#getter-regiontoolargereason)</span>, <span id="getter-zoomcanreleasegate">[`zoomCanReleaseGate`](../regiontoolargemixin#getter-zoomcanreleasegate)</span>, <span id="getter-gateskipsmeasuredviewport">[`gateSkipsMeasuredViewport`](../regiontoolargemixin#getter-gateskipsmeasuredviewport)</span>

From [TrackHeightMixin](../trackheightmixin): <span id="getter-configuredheight">[`configuredHeight`](../trackheightmixin#getter-configuredheight)</span>, <span id="getter-allottedheight">[`allottedHeight`](../trackheightmixin#getter-allottedheight)</span>, <span id="getter-height">[`height`](../trackheightmixin#getter-height)</span>, <span id="getter-resizing">[`resizing`](../trackheightmixin#getter-resizing)</span>, <span id="getter-scrollcontentheight">[`scrollContentHeight`](../trackheightmixin#getter-scrollcontentheight)</span>, <span id="getter-scrollviewportheight">[`scrollViewportHeight`](../trackheightmixin#getter-scrollviewportheight)</span>, <span id="getter-scrollableheight">[`scrollableHeight`](../trackheightmixin#getter-scrollableheight)</span>

From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-featurenoun">[`featureNoun`](../basedisplay#getter-featurenoun)</span>, <span id="getter-featurewidgettype">[`featureWidgetType`](../basedisplay#getter-featurewidgettype)</span>, <span id="getter-livenotices">[`liveNotices`](../basedisplay#getter-livenotices)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-confignotices">[`configNotices`](../basedisplay#getter-confignotices)</span>, <span id="getter-notices">[`notices`](../basedisplay#getter-notices)</span>, <span id="getter-cornernotices">[`cornerNotices`](../basedisplay#getter-cornernotices)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span>

</details>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-rpcprops">**rpcProps**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; { normalization: string; field: HicColorField; floors: Hi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; { normalization: string; field: HicColorField; floors: HicCountFloors; }</code></pre></dialog></span> | The settings that refetch. The binsize is zoom-derived and the quantile reselects on the main thread, so both ride as call arguments. |
| <span id="method-hittest">**hitTest**</span><br><code>(mouseX: number, mouseY: number) =&gt; HicContactItem &#124; undefined</code> | The contact under a display-px point, through the inverse of the transform the matrix was drawn with. |
| <span id="method-hoverhitat">**hoverHitAt**</span><br><code>(mouseX: number, mouseY: number) =&gt; HicContactItem &#124; undefined</code> | No contact while the matrix loads: a global display replaces its whole frame, so the cells it holds are on their way out. |
| <span id="method-configproblemsof">**configProblemsOf**</span><br><code>(conf: AnyConfigurationModel) =&gt; string[]</code> | The schema's rules, then the `filter` entries the worker cannot apply. |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |
| <span id="method-rendersvg">**renderSvg**</span><br><code>(opts: ExportSvgDisplayOptions) =&gt; Promise&lt;ReactNode&gt;</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>11 inherited methods from 5 models</summary>

From [TriangleMatrixMixin](../trianglematrixmixin): <span id="method-celltoscreen">[`cellToScreen`](../trianglematrixmixin#method-celltoscreen)</span>, <span id="method-screentocell">[`screenToCell`](../trianglematrixmixin#method-screentocell)</span>

From [MatrixRampMixin](../matrixrampmixin): <span id="method-rampcolorscales">[`rampColorScales`](../matrixrampmixin#method-rampcolorscales)</span>

From [LegendMixin](../legendmixin): <span id="method-colorscalesin">[`colorScalesIn`](../legendmixin#method-colorscalesin)</span>, <span id="method-legendspecin">[`legendSpecIn`](../legendmixin#method-legendspecin)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="method-resolvedbytelimit">[`resolvedByteLimit`](../regiontoolargemixin#method-resolvedbytelimit)</span>, <span id="method-gatefetchstate">[`gateFetchState`](../regiontoolargemixin#method-gatefetchstate)</span>

From [BaseDisplay](../basedisplay): <span id="method-renderingprops">[`renderingProps`](../basedisplay#method-renderingprops)</span>, <span id="method-liftplot">[`liftPlot`](../basedisplay#method-liftplot)</span>, <span id="method-plotproblems">[`plotProblems`](../basedisplay#method-plotproblems)</span>, <span id="method-plotwrites">[`plotWrites`](../basedisplay#method-plotwrites)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-startrenderingbackend">**startRenderingBackend**</span><br><code>(backend: HicRenderingBackend) =&gt; void</code> |  |
| <span id="action-setcolorfield">**setColorField**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(field: "observed" &#124; "observed/control" &#124; "observed/expected")…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(field: "observed" &#124; "observed/control" &#124; "observed/expected") =&gt; void</code></pre></dialog></span> | What the cells show; a new field starts from its own preset, so a count's scheme or pinned top does not carry onto a ratio. |
| <span id="action-setlogscale">**setLogScale**</span><br><code>(log: boolean) =&gt; void</code> | The Log scale toggle: `encoding.color.scale.type` symlog, which keeps every nonzero count visible, or unset for `observed`'s linear preset. |
| <span id="action-setcolorfollowspercentile">**setColorFollowsPercentile**</span><br><code>(f: boolean) =&gt; void</code> |  |
| <span id="action-setselectednormalization">**setSelectedNormalization**</span><br><code>(f: string) =&gt; void</code> |  |
| <span id="action-setfileinfo">**setFileInfo**</span><br><code>(read: AdapterRead&lt;HicHeader&gt;) =&gt; void</code> |  |
| <span id="action-resetresolution">**resetResolution**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setresolutionidx">**setResolutionIdx**</span><br><code>(idx: number) =&gt; void</code> | Lock to `availableResolutions[idx]`, clamped, stored as an offset from the auto pick so the choice keeps its meaning across zoom. |
| <span id="action-setresolution">**setResolution**</span><br><code>(binSize: number) =&gt; void</code> | Lock to a binsize the file offers; any other is ignored. |
| <span id="action-stepresolution">**stepResolution**</span><br><code>(delta: number) =&gt; void</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>38 inherited actions from 10 models</summary>

From [PointerHoverMixin](../pointerhovermixin): <span id="action-setpointer">[`setPointer`](../pointerhovermixin#action-setpointer)</span>

From [TriangleMatrixMixin](../trianglematrixmixin): <span id="action-setrpcdata">[`setRpcData`](../trianglematrixmixin#action-setrpcdata)</span>, <span id="action-setheightmode">[`setHeightMode`](../trianglematrixmixin#action-setheightmode)</span>

From [MatrixRampMixin](../matrixrampmixin): <span id="action-setcolorscheme">[`setColorScheme`](../matrixrampmixin#action-setcolorscheme)</span>

From [LegendMixin](../legendmixin): <span id="action-setshowlegend">[`setShowLegend`](../legendmixin#action-setshowlegend)</span>, <span id="action-dismisslegendsection">[`dismissLegendSection`](../legendmixin#action-dismisslegendsection)</span>

From [KeyedFetchMixin](../keyedfetchmixin): <span id="action-commitfetchresult">[`commitFetchResult`](../keyedfetchmixin#action-commitfetchresult)</span>, <span id="action-reload">[`reload`](../keyedfetchmixin#action-reload)</span>

From [FetchMixin](../fetchmixin): <span id="action-seterror">[`setError`](../fetchmixin#action-seterror)</span>, <span id="action-setstatusmessage">[`setStatusMessage`](../fetchmixin#action-setstatusmessage)</span>, <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="action-markcanvasdrawn">[`markCanvasDrawn`](../renderlifecyclemixin#action-markcanvasdrawn)</span>, <span id="action-resetcanvasdrawn">[`resetCanvasDrawn`](../renderlifecyclemixin#action-resetcanvasdrawn)</span>, <span id="action-stoprenderingbackend">[`stopRenderingBackend`](../renderlifecyclemixin#action-stoprenderingbackend)</span>, <span id="action-rendernow">[`renderNow`](../renderlifecyclemixin#action-rendernow)</span>, <span id="action-setoffscreen">[`setOffScreen`](../renderlifecyclemixin#action-setoffscreen)</span>, <span id="action-setrendererror">[`setRenderError`](../renderlifecyclemixin#action-setrendererror)</span>, <span id="action-attachrenderingbackend">[`attachRenderingBackend`](../renderlifecyclemixin#action-attachrenderingbackend)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="action-clearbyteestimate">[`clearByteEstimate`](../regiontoolargemixin#action-clearbyteestimate)</span>, <span id="action-cleargatemeasurements">[`clearGateMeasurements`](../regiontoolargemixin#action-cleargatemeasurements)</span>, <span id="action-setforceloadtrack">[`setForceLoadTrack`](../regiontoolargemixin#action-setforceloadtrack)</span>, <span id="action-commitfetchbytes">[`commitFetchBytes`](../regiontoolargemixin#action-commitfetchbytes)</span>, <span id="action-forceload">[`forceLoad`](../regiontoolargemixin#action-forceload)</span>

From [TrackHeightMixin](../trackheightmixin): <span id="action-setscrolltop">[`setScrollTop`](../trackheightmixin#action-setscrolltop)</span>, <span id="action-sethostheight">[`setHostHeight`](../trackheightmixin#action-sethostheight)</span>, <span id="action-setheight">[`setHeight`](../trackheightmixin#action-setheight)</span>, <span id="action-resizeheight">[`resizeHeight`](../trackheightmixin#action-resizeheight)</span>, <span id="action-expandtocontentheight">[`expandToContentHeight`](../trackheightmixin#action-expandtocontentheight)</span>

From [BaseDisplay](../basedisplay): <span id="action-clearhoveredfeature">[`clearHoveredFeature`](../basedisplay#action-clearhoveredfeature)</span>, <span id="action-applydisplaysettings">[`applyDisplaySettings`](../basedisplay#action-applydisplaysettings)</span>, <span id="action-applyplot">[`applyPlot`](../basedisplay#action-applyplot)</span>

</details>
