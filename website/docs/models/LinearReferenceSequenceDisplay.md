---
id: linearreferencesequencedisplay
title: LinearReferenceSequenceDisplay
description: "base model BaseDisplay + TrackHeightMixin + MultiRegionDisplayMixin"
sidebar_label: Display -> LinearReferenceSequenceDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `sequence` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/LinearReferenceSequenceDisplay/model.ts).

## Example usage

A complete `ReferenceSequenceTrack` config to paste into `tracks` (an
assembly's `sequence` track takes the same shape). `showForward`,
`showReverse`, and `showTranslation` toggle the strand/translation rows:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'refseq',
  name: 'Reference sequence',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
  displays: [
    {
      type: 'LinearReferenceSequenceDisplay',
      displayId: 'refseq-LinearReferenceSequenceDisplay',
      showTranslation: false,
    },
  ],
}
```

base model `BaseDisplay` + `TrackHeightMixin` + `MultiRegionDisplayMixin`

The configuration slots for this model are documented on its [config schema page](../../config/linearreferencesequencedisplay).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('LinearReferenceSequenceDisplay')</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="property-id">[`id`](../basedisplay#property-id)</span></span>

## Volatiles

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="volatile-error">[`error`](../basedisplay#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../basedisplay#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../basedisplay#volatile-statusprogress)</span></span>

<span data-pagefind-ignore>From [TrackHeightMixin](../trackheightmixin): <span id="volatile-scrolltop">[`scrollTop`](../trackheightmixin#volatile-scrolltop)</span>, <span id="volatile-hostheight">[`hostHeight`](../trackheightmixin#volatile-hostheight)</span></span>

<span data-pagefind-ignore>From [MultiRegionDisplayMixin](../multiregiondisplaymixin): <span id="volatile-loadedregions">[`loadedRegions`](../multiregiondisplaymixin#volatile-loadedregions)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="volatile-forceloadtrack">[`forceLoadTrack`](../regiontoolargemixin#volatile-forceloadtrack)</span>, <span id="volatile-byteestimate">[`byteEstimate`](../regiontoolargemixin#volatile-byteestimate)</span>, <span id="volatile-gatemeasuredviewportkey">[`gateMeasuredViewportKey`](../regiontoolargemixin#volatile-gatemeasuredviewportkey)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="volatile-canvasdrawn">[`canvasDrawn`](../renderlifecyclemixin#volatile-canvasdrawn)</span>, <span id="volatile-paintcount">[`paintCount`](../renderlifecyclemixin#volatile-paintcount)</span>, <span id="volatile-currentrenderingbackend">[`currentRenderingBackend`](../renderlifecyclemixin#volatile-currentrenderingbackend)</span>, <span id="volatile-rendertick">[`renderTick`](../renderlifecyclemixin#volatile-rendertick)</span>, <span id="volatile-autorunsinstalled">[`autorunsInstalled`](../renderlifecyclemixin#volatile-autorunsinstalled)</span>, <span id="volatile-rendererror">[`renderError`](../renderlifecyclemixin#volatile-rendererror)</span>, <span id="volatile-offscreen">[`offScreen`](../renderlifecyclemixin#volatile-offscreen)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="volatile-activesignal">[`activeSignal`](../fetchmixin#volatile-activesignal)</span>, <span id="volatile-fetchgeneration">[`fetchGeneration`](../fetchmixin#volatile-fetchgeneration)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../fetchmixin#volatile-reloadcounter)</span>, <span id="volatile-statuswindow">[`statusWindow`](../fetchmixin#volatile-statuswindow)</span>, <span id="volatile-fetchcanceled">[`fetchCanceled`](../fetchmixin#volatile-fetchcanceled)</span>, <span id="volatile-fetchrotation">[`fetchRotation`](../fetchmixin#volatile-fetchrotation)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-sequencedata">**sequenceData**</span><br><code>ReadonlyMap&lt;number, SequenceRegionData&gt;</code> | The fetched sequence, keyed by displayedRegionIndex — the foundation's per-region store, narrowed. |
| <span id="getter-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { rubberbandClickMenuItems(clickOffset: BpOffset): MenuItem[]; highlightMenuItems(_highlight: HighlightType): MenuItem[]; } &amp; { flyTo: (centerBp: number, windowWidthBp: number) =&gt; void; flyToCenter(coord: number, refName: string, displayedRegionIndex?: number &#124; undefined): void; flyToFit(centerBp: number, fitWidthBp: number): void; } &amp; { afterCreate(): void; afterAttach(): void; } &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> |  |
| <span id="getter-showforward">**showForward**</span><br><code>boolean</code> |  |
| <span id="getter-showreverse">**showReverse**</span><br><code>boolean</code> |  |
| <span id="getter-showtranslation">**showTranslation**</span><br><code>boolean</code> |  |
| <span id="getter-sequencetype">**sequenceType**</span><br><code>string</code> |  |
| <span id="getter-colorpalette">**colorPalette**</span><br><code>ColorPalette</code> | Theme-derived fill and text color for every cell this display paints |
| <span id="getter-isdna">**isDna**</span><br><code>boolean</code> | the reverse-complement and translation rows are DNA-only |
| <span id="getter-effectiveshowreverse">**effectiveShowReverse**</span><br><code>boolean</code> |  |
| <span id="getter-effectiveshowtranslation">**effectiveShowTranslation**</span><br><code>boolean</code> |  |
| <span id="getter-rowvisibility">**rowVisibility**</span><br><code>RowVisibility</code> | Which rows the stack is showing, as the one value `rowLayout` takes |
| <span id="getter-cellencoding">**cellEncoding**</span><br><code>CellEncoding</code> | What the cells' encode reads beyond the sequence itself |
| <span id="getter-zoomedout">**zoomedOut**</span><br><code>boolean</code> | the view is too zoomed out to show individual bases |
| <span id="getter-placeholdermessage">**placeholderMessage**</span><br><code>string &#124; undefined</code> | The message shown where the canvas would go: zoomed past base resolution, or every row toggled off (which would otherwise collapse the track to 0px). Undefined when the sequence paints. |
| <span id="getter-fetchinert">**fetchInert**</span><br><code>boolean</code> | A shown message means no paint is coming. See FetchMixin.fetchInert. |
| <span id="getter-numrows">**numRows**</span><br><code>number</code> |  |
| <span id="getter-sequenceheight">**sequenceHeight**</span><br><code>number</code> |  |
| <span id="getter-computedheight">**computedHeight**</span><br><code>number</code> | fits the visible rows, or 50px while a message shows |
| <span id="getter-height">**height**</span><br><code>number</code> | a manual resize if set, else `computedHeight` |
| <span id="getter-rowheight">**rowHeight**</span><br><code>number</code> |  |
| <span id="getter-renderstate">**renderState**</span><br><code>SequenceRenderState</code> | everything the marks and the letters need to paint a frame |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-hoveredfeature">[`hoveredFeature`](../basedisplay#getter-hoveredfeature)</span>, <span id="getter-featurenoun">[`featureNoun`](../basedisplay#getter-featurenoun)</span>, <span id="getter-featurewidgettype">[`featureWidgetType`](../basedisplay#getter-featurewidgettype)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span></span>

<span data-pagefind-ignore>From [TrackHeightMixin](../trackheightmixin): <span id="getter-configuredheight">[`configuredHeight`](../trackheightmixin#getter-configuredheight)</span>, <span id="getter-allottedheight">[`allottedHeight`](../trackheightmixin#getter-allottedheight)</span>, <span id="getter-resizing">[`resizing`](../trackheightmixin#getter-resizing)</span>, <span id="getter-scrollcontentheight">[`scrollContentHeight`](../trackheightmixin#getter-scrollcontentheight)</span>, <span id="getter-scrollviewportheight">[`scrollViewportHeight`](../trackheightmixin#getter-scrollviewportheight)</span>, <span id="getter-scrollableheight">[`scrollableHeight`](../trackheightmixin#getter-scrollableheight)</span></span>

<span data-pagefind-ignore>From [MultiRegionDisplayMixin](../multiregiondisplaymixin): <span id="getter-host">[`host`](../multiregiondisplaymixin#getter-host)</span>, <span id="getter-canvaswidthpx">[`canvasWidthPx`](../multiregiondisplaymixin#getter-canvaswidthpx)</span>, <span id="getter-settledsubpixelbinbp">[`settledSubPixelBinBp`](../multiregiondisplaymixin#getter-settledsubpixelbinbp)</span>, <span id="getter-canrender">[`canRender`](../multiregiondisplaymixin#getter-canrender)</span>, <span id="getter-renderscanvas">[`rendersCanvas`](../multiregiondisplaymixin#getter-renderscanvas)</span>, <span id="getter-trackvisibleregions">[`trackVisibleRegions`](../multiregiondisplaymixin#getter-trackvisibleregions)</span>, <span id="getter-viewportwithinloadeddata">[`viewportWithinLoadedData`](../multiregiondisplaymixin#getter-viewportwithinloadeddata)</span>, <span id="getter-viewportempty">[`viewportEmpty`](../multiregiondisplaymixin#getter-viewportempty)</span>, <span id="getter-fetchsuspended">[`fetchSuspended`](../multiregiondisplaymixin#getter-fetchsuspended)</span>, <span id="getter-layoutready">[`layoutReady`](../multiregiondisplaymixin#getter-layoutready)</span>, <span id="getter-datasuperseded">[`dataSuperseded`](../multiregiondisplaymixin#getter-datasuperseded)</span>, <span id="getter-renderblocks">[`renderBlocks`](../multiregiondisplaymixin#getter-renderblocks)</span>, <span id="getter-fetchinputs">[`fetchInputs`](../multiregiondisplaymixin#getter-fetchinputs)</span>, <span id="getter-regionpayloads">[`regionPayloads`](../multiregiondisplaymixin#getter-regionpayloads)</span>, <span id="getter-hasregiondata">[`hasRegionData`](../multiregiondisplaymixin#getter-hasregiondata)</span>, <span id="getter-stalesettingsdrawn">[`staleSettingsDrawn`](../multiregiondisplaymixin#getter-stalesettingsdrawn)</span>, <span id="getter-datacurrent">[`dataCurrent`](../multiregiondisplaymixin#getter-datacurrent)</span>, <span id="getter-loadedassembly">[`loadedAssembly`](../multiregiondisplaymixin#getter-loadedassembly)</span>, <span id="getter-phaseviewportcurrent">[`phaseViewportCurrent`](../multiregiondisplaymixin#getter-phaseviewportcurrent)</span>, <span id="getter-svgready">[`svgReady`](../multiregiondisplaymixin#getter-svgready)</span>, <span id="getter-paintinert">[`paintInert`](../multiregiondisplaymixin#getter-paintinert)</span>, <span id="getter-paintsuperseded">[`paintSuperseded`](../multiregiondisplaymixin#getter-paintsuperseded)</span>, <span id="getter-displayphase">[`displayPhase`](../multiregiondisplaymixin#getter-displayphase)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="getter-gateenabled">[`gateEnabled`](../regiontoolargemixin#getter-gateenabled)</span>, <span id="getter-bytegateadapterconfig">[`byteGateAdapterConfig`](../regiontoolargemixin#getter-bytegateadapterconfig)</span>, <span id="getter-configuredfetchsizelimit">[`configuredFetchSizeLimit`](../regiontoolargemixin#getter-configuredfetchsizelimit)</span>, <span id="getter-densitytoolarge">[`densityTooLarge`](../regiontoolargemixin#getter-densitytoolarge)</span>, <span id="getter-bytegateadapterpath">[`byteGateAdapterPath`](../regiontoolargemixin#getter-bytegateadapterpath)</span>, <span id="getter-adapterfetchsizelimit">[`adapterFetchSizeLimit`](../regiontoolargemixin#getter-adapterfetchsizelimit)</span>, <span id="getter-configforceload">[`configForceLoad`](../regiontoolargemixin#getter-configforceload)</span>, <span id="getter-gateviewportspanbp">[`gateViewportSpanBp`](../regiontoolargemixin#getter-gateviewportspanbp)</span>, <span id="getter-gateviewport">[`gateViewport`](../regiontoolargemixin#getter-gateviewport)</span>, <span id="getter-aboveforceloadfloor">[`aboveForceLoadFloor`](../regiontoolargemixin#getter-aboveforceloadfloor)</span>, <span id="getter-gateexempt">[`gateExempt`](../regiontoolargemixin#getter-gateexempt)</span>, <span id="getter-estimatedfetchbytes">[`estimatedFetchBytes`](../regiontoolargemixin#getter-estimatedfetchbytes)</span>, <span id="getter-gatemeasurementstale">[`gateMeasurementStale`](../regiontoolargemixin#getter-gatemeasurementstale)</span>, <span id="getter-gatebytelimit">[`gateByteLimit`](../regiontoolargemixin#getter-gatebytelimit)</span>, <span id="getter-gateactive">[`gateActive`](../regiontoolargemixin#getter-gateactive)</span>, <span id="getter-densitygateactive">[`densityGateActive`](../regiontoolargemixin#getter-densitygateactive)</span>, <span id="getter-toolargestatus">[`tooLargeStatus`](../regiontoolargemixin#getter-toolargestatus)</span>, <span id="getter-regiontoolarge">[`regionTooLarge`](../regiontoolargemixin#getter-regiontoolarge)</span>, <span id="getter-regiontoolargereason">[`regionTooLargeReason`](../regiontoolargemixin#getter-regiontoolargereason)</span>, <span id="getter-zoomcanreleasegate">[`zoomCanReleaseGate`](../regiontoolargemixin#getter-zoomcanreleasegate)</span>, <span id="getter-gateskipsmeasuredviewport">[`gateSkipsMeasuredViewport`](../regiontoolargemixin#getter-gateskipsmeasuredviewport)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="getter-painted">[`painted`](../renderlifecyclemixin#getter-painted)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-awaitingprerequisite">[`awaitingPrerequisite`](../fetchmixin#getter-awaitingprerequisite)</span>, <span id="getter-awaitingdependentdata">[`awaitingDependentData`](../fetchmixin#getter-awaitingdependentdata)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-colorpalettein">**colorPaletteIn**</span><br><code>(palette: JBrowsePalette) =&gt; ColorPalette</code> | `colorPalette` in another palette: the SVG export's, whose theme need not be the session's. |
| <span id="method-hoverat">**hoverAt**</span><br><code>(offsetX: number, offsetY: number) =&gt; SequenceHover &#124; undefined</code> | Resolve the genomic position, reference base, and codon/amino-acid under a cursor at track-relative pixel `(offsetX, offsetY)`. Drives the hover tooltip; returns undefined when no sequence is painted, off a fetched region, or between rows. |
| <span id="method-rendersvg">**renderSvg**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(opts?: ExportSvgDisplayOptions &#124; undefined) =&gt; Promise&lt;ReactEl…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(opts?: ExportSvgDisplayOptions &#124; undefined) =&gt; Promise&lt;ReactElement&lt;unknown, string &#124; JSXElementConstructor&lt;any&gt;&gt; &#124; Iterable&lt;ReactNode&gt; &#124; AwaitedReactNode&gt;</code></pre></dialog></span> |  |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="method-renderingprops">[`renderingProps`](../basedisplay#method-renderingprops)</span>, <span id="method-liftplot">[`liftPlot`](../basedisplay#method-liftplot)</span>, <span id="method-plotproblems">[`plotProblems`](../basedisplay#method-plotproblems)</span>, <span id="method-plotwrites">[`plotWrites`](../basedisplay#method-plotwrites)</span></span>

<span data-pagefind-ignore>From [MultiRegionDisplayMixin](../multiregiondisplaymixin): <span id="method-regionhasdata">[`regionHasData`](../multiregiondisplaymixin#method-regionhasdata)</span>, <span id="method-iscachevalid">[`isCacheValid`](../multiregiondisplaymixin#method-iscachevalid)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="method-resolvedbytelimit">[`resolvedByteLimit`](../regiontoolargemixin#method-resolvedbytelimit)</span>, <span id="method-gatefetchstate">[`gateFetchState`](../regiontoolargemixin#method-gatefetchstate)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-toggleshowforward">**toggleShowForward**</span><br><code>() =&gt; void</code> |  |
| <span id="action-toggleshowreverse">**toggleShowReverse**</span><br><code>() =&gt; void</code> |  |
| <span id="action-toggleshowtranslation">**toggleShowTranslation**</span><br><code>() =&gt; void</code> |  |
| <span id="action-startrenderingbackend">**startRenderingBackend**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(backend: PerRegionRenderingBackend&lt;SequenceCells, SequenceRend…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(backend: PerRegionRenderingBackend&lt;SequenceCells, SequenceRenderState, RenderBlock, SequenceCells&gt;) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-fetchneeded">**fetchNeeded**</span><br><code>(needed: IndexedRegion[]) =&gt; Promise&lt;void&gt;</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="action-setstatusmessage">[`setStatusMessage`](../basedisplay#action-setstatusmessage)</span>, <span id="action-seterror">[`setError`](../basedisplay#action-seterror)</span>, <span id="action-clearhoveredfeature">[`clearHoveredFeature`](../basedisplay#action-clearhoveredfeature)</span>, <span id="action-reload">[`reload`](../basedisplay#action-reload)</span>, <span id="action-applydisplaysettings">[`applyDisplaySettings`](../basedisplay#action-applydisplaysettings)</span>, <span id="action-applyplot">[`applyPlot`](../basedisplay#action-applyplot)</span></span>

<span data-pagefind-ignore>From [TrackHeightMixin](../trackheightmixin): <span id="action-setscrolltop">[`setScrollTop`](../trackheightmixin#action-setscrolltop)</span>, <span id="action-sethostheight">[`setHostHeight`](../trackheightmixin#action-sethostheight)</span>, <span id="action-setheight">[`setHeight`](../trackheightmixin#action-setheight)</span>, <span id="action-resizeheight">[`resizeHeight`](../trackheightmixin#action-resizeheight)</span>, <span id="action-expandtocontentheight">[`expandToContentHeight`](../trackheightmixin#action-expandtocontentheight)</span></span>

<span data-pagefind-ignore>From [MultiRegionDisplayMixin](../multiregiondisplaymixin): <span id="action-setloadedregion">[`setLoadedRegion`](../multiregiondisplaymixin#action-setloadedregion)</span>, <span id="action-evictregionstore">[`evictRegionStore`](../multiregiondisplaymixin#action-evictregionstore)</span>, <span id="action-droploadedregion">[`dropLoadedRegion`](../multiregiondisplaymixin#action-droploadedregion)</span>, <span id="action-cleardisplayspecificdata">[`clearDisplaySpecificData`](../multiregiondisplaymixin#action-cleardisplayspecificdata)</span>, <span id="action-clearsettingsbakeddata">[`clearSettingsBakedData`](../multiregiondisplaymixin#action-clearsettingsbakeddata)</span>, <span id="action-clearallrpcdata">[`clearAllRpcData`](../multiregiondisplaymixin#action-clearallrpcdata)</span>, <span id="action-invalidatesettings">[`invalidateSettings`](../multiregiondisplaymixin#action-invalidatesettings)</span>, <span id="action-fetchregions">[`fetchRegions`](../multiregiondisplaymixin#action-fetchregions)</span>, <span id="action-afterattach">[`afterAttach`](../multiregiondisplaymixin#action-afterattach)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="action-clearbyteestimate">[`clearByteEstimate`](../regiontoolargemixin#action-clearbyteestimate)</span>, <span id="action-cleargatemeasurements">[`clearGateMeasurements`](../regiontoolargemixin#action-cleargatemeasurements)</span>, <span id="action-setforceloadtrack">[`setForceLoadTrack`](../regiontoolargemixin#action-setforceloadtrack)</span>, <span id="action-commitfetchbytes">[`commitFetchBytes`](../regiontoolargemixin#action-commitfetchbytes)</span>, <span id="action-forceload">[`forceLoad`](../regiontoolargemixin#action-forceload)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="action-markcanvasdrawn">[`markCanvasDrawn`](../renderlifecyclemixin#action-markcanvasdrawn)</span>, <span id="action-resetcanvasdrawn">[`resetCanvasDrawn`](../renderlifecyclemixin#action-resetcanvasdrawn)</span>, <span id="action-stoprenderingbackend">[`stopRenderingBackend`](../renderlifecyclemixin#action-stoprenderingbackend)</span>, <span id="action-rendernow">[`renderNow`](../renderlifecyclemixin#action-rendernow)</span>, <span id="action-setoffscreen">[`setOffScreen`](../renderlifecyclemixin#action-setoffscreen)</span>, <span id="action-setrendererror">[`setRenderError`](../renderlifecyclemixin#action-setrendererror)</span>, <span id="action-attachrenderingbackend">[`attachRenderingBackend`](../renderlifecyclemixin#action-attachrenderingbackend)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span></span>
