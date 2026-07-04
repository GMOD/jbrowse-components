---
id: linearmultisamplevariantmatrixdisplay
title: LinearMultiSampleVariantMatrixDisplay
sidebar_label: Display -> LinearMultiSampleVariantMatrixDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`variants` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantMatrixDisplay/model.ts).

## Overview

Multi-sample variant display rendering genotypes as a compact sample-by-site
matrix, with subpixel column alpha-scaling for anti-aliased parity.

### LinearMultiSampleVariantMatrixDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearmultisamplevariantmatrixdisplay).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [MultiSampleVariantBaseModel](../multisamplevariantbasemodel)

**Properties:** [type](../multisamplevariantbasemodel#property-type),
[configuration](../multisamplevariantbasemodel#property-configuration),
[rowHeight](../multisamplevariantbasemodel#property-rowheight),
[jexlFilters](../multisamplevariantbasemodel#property-jexlfilters),
[lineZoneHeight](../multisamplevariantbasemodel#property-linezoneheight)

**Volatiles:** [showLegend](../multisamplevariantbasemodel#volatile-showlegend),
[dismissedLegendSections](../multisamplevariantbasemodel#volatile-dismissedlegendsections),
[contextMenuFeature](../multisamplevariantbasemodel#volatile-contextmenufeature),
[sourcesVolatile](../multisamplevariantbasemodel#volatile-sourcesvolatile),
[hoveredGenotype](../multisamplevariantbasemodel#volatile-hoveredgenotype),
[cellData](../multisamplevariantbasemodel#volatile-celldata),
[loadedBpPerPx](../multisamplevariantbasemodel#volatile-loadedbpperpx),
[reloadCount](../multisamplevariantbasemodel#volatile-reloadcount),
[pendingClusterTree](../multisamplevariantbasemodel#volatile-pendingclustertree)

**Getters:**
[featuresVolatile](../multisamplevariantbasemodel#getter-featuresvolatile),
[hasPhased](../multisamplevariantbasemodel#getter-hasphased),
[hasSecondaryAlt](../multisamplevariantbasemodel#getter-hassecondaryalt),
[hasUnphased](../multisamplevariantbasemodel#getter-hasunphased),
[hasConsequence](../multisamplevariantbasemodel#getter-hasconsequence),
[sampleInfo](../multisamplevariantbasemodel#getter-sampleinfo),
[renderingMode](../multisamplevariantbasemodel#getter-renderingmode),
[colorBy](../multisamplevariantbasemodel#getter-colorby),
[featureColor](../multisamplevariantbasemodel#getter-featurecolor),
[featureWidgetType](../multisamplevariantbasemodel#getter-featurewidgettype),
[fetchSizeLimit](../multisamplevariantbasemodel#getter-fetchsizelimit),
[minorAlleleFrequencyFilter](../multisamplevariantbasemodel#getter-minorallelefrequencyfilter),
[filters](../multisamplevariantbasemodel#getter-filters),
[showSidebarLabels](../multisamplevariantbasemodel#getter-showsidebarlabels),
[showTree](../multisamplevariantbasemodel#getter-showtree),
[showBranchLength](../multisamplevariantbasemodel#getter-showbranchlength),
[referenceDrawingMode](../multisamplevariantbasemodel#getter-referencedrawingmode),
[colorByAttributes](../multisamplevariantbasemodel#getter-colorbyattributes),
[sourcesWithoutLayout](../multisamplevariantbasemodel#getter-sourceswithoutlayout),
[sourcesBase](../multisamplevariantbasemodel#getter-sourcesbase),
[sources](../multisamplevariantbasemodel#getter-sources),
[editableSources](../multisamplevariantbasemodel#getter-editablesources),
[sourceMap](../multisamplevariantbasemodel#getter-sourcemap),
[genotypeSampleIndex](../multisamplevariantbasemodel#getter-genotypesampleindex),
[availableHeight](../multisamplevariantbasemodel#getter-availableheight),
[nrow](../multisamplevariantbasemodel#getter-nrow),
[autoRowHeight](../multisamplevariantbasemodel#getter-autorowheight),
[effectiveRowHeight](../multisamplevariantbasemodel#getter-effectiverowheight),
[hierarchy](../multisamplevariantbasemodel#getter-hierarchy),
[spatialIndex](../multisamplevariantbasemodel#getter-spatialindex),
[hoveredTooltipSource](../multisamplevariantbasemodel#getter-hoveredtooltipsource),
[canDisplayLabels](../multisamplevariantbasemodel#getter-candisplaylabels),
[totalHeight](../multisamplevariantbasemodel#getter-totalheight),
[hasOverflow](../multisamplevariantbasemodel#getter-hasoverflow),
[scrollableHeight](../multisamplevariantbasemodel#getter-scrollableheight),
[featuresReady](../multisamplevariantbasemodel#getter-featuresready)

**Methods:** [rpcProps](../multisamplevariantbasemodel#method-rpcprops),
[showSubmenuItems](../multisamplevariantbasemodel#method-showsubmenuitems),
[trackMenuItems](../multisamplevariantbasemodel#method-trackmenuitems),
[contextMenuItems](../multisamplevariantbasemodel#method-contextmenuitems),
[getPortableSettings](../multisamplevariantbasemodel#method-getportablesettings),
[legendSections](../multisamplevariantbasemodel#method-legendsections)

**Actions:** [setCellData](../multisamplevariantbasemodel#action-setcelldata),
[setContextMenuFeature](../multisamplevariantbasemodel#action-setcontextmenufeature),
[setLoadedBpPerPx](../multisamplevariantbasemodel#action-setloadedbpperpx),
[fetchMetadataDescriptions](../multisamplevariantbasemodel#action-fetchmetadatadescriptions),
[setJexlFilters](../multisamplevariantbasemodel#action-setjexlfilters),
[setShowLegend](../multisamplevariantbasemodel#action-setshowlegend),
[dismissLegendSection](../multisamplevariantbasemodel#action-dismisslegendsection),
[selectFeature](../multisamplevariantbasemodel#action-selectfeature),
[setRowHeight](../multisamplevariantbasemodel#action-setrowheight),
[setHoveredGenotype](../multisamplevariantbasemodel#action-sethoveredgenotype),
[setSources](../multisamplevariantbasemodel#action-setsources),
[setColorBy](../multisamplevariantbasemodel#action-setcolorby),
[clearLayout](../multisamplevariantbasemodel#action-clearlayout),
[setMafFilter](../multisamplevariantbasemodel#action-setmaffilter),
[setShowSidebarLabels](../multisamplevariantbasemodel#action-setshowsidebarlabels),
[setShowTree](../multisamplevariantbasemodel#action-setshowtree),
[setShowBranchLength](../multisamplevariantbasemodel#action-setshowbranchlength),
[setLayoutAndPendingClusterTree](../multisamplevariantbasemodel#action-setlayoutandpendingclustertree),
[setPhasedMode](../multisamplevariantbasemodel#action-setphasedmode),
[setFitToHeight](../multisamplevariantbasemodel#action-setfittoheight),
[resizeHeight](../multisamplevariantbasemodel#action-resizeheight),
[setReferenceDrawingMode](../multisamplevariantbasemodel#action-setreferencedrawingmode),
[setFeatureColor](../multisamplevariantbasemodel#action-setfeaturecolor),
[sortByGenotype](../multisamplevariantbasemodel#action-sortbygenotype),
[setScrollTop](../multisamplevariantbasemodel#action-setscrolltop),
[clearDisplaySpecificData](../multisamplevariantbasemodel#action-cleardisplayspecificdata),
[isCacheValid](../multisamplevariantbasemodel#action-iscachevalid),
[getByteEstimateConfig](../multisamplevariantbasemodel#action-getbyteestimateconfig),
[fetchNeeded](../multisamplevariantbasemodel#action-fetchneeded),
[reload](../multisamplevariantbasemodel#action-reload)

### Available via [BaseDisplay](../basedisplay)

**Properties:** [id](../basedisplay#property-id),
[type](../basedisplay#property-type),
[rpcDriverName](../basedisplay#property-rpcdrivername)

**Volatiles:** [error](../basedisplay#volatile-error),
[statusMessage](../basedisplay#volatile-statusmessage),
[statusProgress](../basedisplay#volatile-statusprogress)

**Getters:** [parentTrack](../basedisplay#getter-parenttrack),
[parentDisplay](../basedisplay#getter-parentdisplay),
[RenderingComponent](../basedisplay#getter-renderingcomponent),
[DisplayBlurb](../basedisplay#getter-displayblurb),
[adapterConfig](../basedisplay#getter-adapterconfig),
[isMinimized](../basedisplay#getter-isminimized),
[effectiveRpcDriverName](../basedisplay#getter-effectiverpcdrivername),
[DisplayMessageComponent](../basedisplay#getter-displaymessagecomponent),
[viewMenuActions](../basedisplay#getter-viewmenuactions)

**Methods:** [renderProps](../basedisplay#method-renderprops),
[renderingProps](../basedisplay#method-renderingprops),
[trackMenuItems](../basedisplay#method-trackmenuitems),
[regionCannotBeRendered](../basedisplay#method-regioncannotberendered)

**Actions:** [setStatusMessage](../basedisplay#action-setstatusmessage),
[setError](../basedisplay#action-seterror),
[setRpcDriverName](../basedisplay#action-setrpcdrivername),
[reload](../basedisplay#action-reload)

### Available via [TrackHeightMixin](../trackheightmixin)

**Volatiles:** [scrollTop](../trackheightmixin#volatile-scrolltop)

**Getters:** [height](../trackheightmixin#getter-height)

**Actions:** [setScrollTop](../trackheightmixin#action-setscrolltop),
[setHeight](../trackheightmixin#action-setheight),
[resizeHeight](../trackheightmixin#action-resizeheight)

### Available via [MultiRegionDisplayMixin](../multiregiondisplaymixin)

**Volatiles:**
[loadedRegions](../multiregiondisplaymixin#volatile-loadedregions)

**Getters:** [isReady](../multiregiondisplaymixin#getter-isready),
[viewportWithinLoadedData](../multiregiondisplaymixin#getter-viewportwithinloadeddata),
[svgReady](../multiregiondisplaymixin#getter-svgready),
[svgReadyExtraTerminal](../multiregiondisplaymixin#getter-svgreadyextraterminal),
[renderBlocks](../multiregiondisplaymixin#getter-renderblocks),
[displayPhase](../multiregiondisplaymixin#getter-displayphase)

**Actions:**
[setLoadedRegion](../multiregiondisplaymixin#action-setloadedregion),
[clearDisplaySpecificData](../multiregiondisplaymixin#action-cleardisplayspecificdata),
[clearAllRpcData](../multiregiondisplaymixin#action-clearallrpcdata),
[reload](../multiregiondisplaymixin#action-reload),
[invalidateLoadedRegions](../multiregiondisplaymixin#action-invalidateloadedregions),
[fetchNeeded](../multiregiondisplaymixin#action-fetchneeded),
[isCacheValid](../multiregiondisplaymixin#action-iscachevalid),
[getByteEstimateConfig](../multiregiondisplaymixin#action-getbyteestimateconfig),
[fetchRegions](../multiregiondisplaymixin#action-fetchregions),
[afterAttach](../multiregiondisplaymixin#action-afterattach)

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:**
[userByteSizeLimit](../regiontoolargemixin#property-userbytesizelimit)

**Volatiles:**
[regionTooLargeState](../regiontoolargemixin#volatile-regiontoolargestate),
[regionTooLargeReasonState](../regiontoolargemixin#volatile-regiontoolargereasonstate),
[featureDensityStats](../regiontoolargemixin#volatile-featuredensitystats)

**Getters:** [regionTooLarge](../regiontoolargemixin#getter-regiontoolarge),
[regionTooLargeReason](../regiontoolargemixin#getter-regiontoolargereason)

**Methods:**
[regionCannotBeRenderedText](../regiontoolargemixin#method-regioncannotberenderedtext)

**Actions:**
[setRegionTooLarge](../regiontoolargemixin#action-setregiontoolarge),
[setFeatureDensityStats](../regiontoolargemixin#action-setfeaturedensitystats),
[setFeatureDensityStatsLimit](../regiontoolargemixin#action-setfeaturedensitystatslimit),
[reload](../regiontoolargemixin#action-reload),
[forceLoad](../regiontoolargemixin#action-forceload)

### Available via [RenderLifecycleMixin](../renderlifecyclemixin)

**Volatiles:** [canvasDrawn](../renderlifecyclemixin#volatile-canvasdrawn),
[currentRenderingBackend](../renderlifecyclemixin#volatile-currentrenderingbackend),
[renderTick](../renderlifecyclemixin#volatile-rendertick),
[autorunsInstalled](../renderlifecyclemixin#volatile-autorunsinstalled),
[renderError](../renderlifecyclemixin#volatile-rendererror)

**Actions:** [markCanvasDrawn](../renderlifecyclemixin#action-markcanvasdrawn),
[resetCanvasDrawn](../renderlifecyclemixin#action-resetcanvasdrawn),
[stopRenderingBackend](../renderlifecyclemixin#action-stoprenderingbackend),
[renderNow](../renderlifecyclemixin#action-rendernow),
[setRenderError](../renderlifecyclemixin#action-setrendererror),
[attachRenderingBackend](../renderlifecyclemixin#action-attachrenderingbackend)

### Available via [FetchMixin](../fetchmixin)

**Volatiles:** [activeStopToken](../fetchmixin#volatile-activestoptoken),
[fetchGeneration](../fetchmixin#volatile-fetchgeneration),
[error](../fetchmixin#volatile-error),
[statusMessage](../fetchmixin#volatile-statusmessage),
[statusProgress](../fetchmixin#volatile-statusprogress),
[fetchCanceled](../fetchmixin#volatile-fetchcanceled),
[regionStatuses](../fetchmixin#volatile-regionstatuses)

**Getters:** [isLoading](../fetchmixin#getter-isloading)

**Methods:** [makeStatusCallback](../fetchmixin#method-makestatuscallback),
[makeRegionStatusCallback](../fetchmixin#method-makeregionstatuscallback)

**Actions:** [setError](../fetchmixin#action-seterror),
[setStatusMessage](../fetchmixin#action-setstatusmessage),
[resetStatus](../fetchmixin#action-resetstatus),
[stopActiveFetch](../fetchmixin#action-stopactivefetch),
[setRegionStatus](../fetchmixin#action-setregionstatus),
[cancelFetch](../fetchmixin#action-cancelfetch),
[cancelFetchByUser](../fetchmixin#action-cancelfetchbyuser),
[runFetch](../fetchmixin#action-runfetch)

### Available via [TreeSidebarMixin](../treesidebarmixin)

**Properties:** [layout](../treesidebarmixin#property-layout),
[clusterTree](../treesidebarmixin#property-clustertree),
[treeAreaWidth](../treesidebarmixin#property-treeareawidth),
[subtreeFilter](../treesidebarmixin#property-subtreefilter)

**Volatiles:** [hoveredTreeNode](../treesidebarmixin#volatile-hoveredtreenode),
[treeCanvas](../treesidebarmixin#volatile-treecanvas),
[mouseoverCanvas](../treesidebarmixin#volatile-mouseovercanvas)

**Getters:** [parsedTree](../treesidebarmixin#getter-parsedtree),
[root](../treesidebarmixin#getter-root),
[treeHasBranchLengths](../treesidebarmixin#getter-treehasbranchlengths)

**Methods:** [willClearTree](../treesidebarmixin#method-willcleartree)

**Actions:** [setLayout](../treesidebarmixin#action-setlayout),
[clearLayout](../treesidebarmixin#action-clearlayout),
[setClusterTree](../treesidebarmixin#action-setclustertree),
[setLayoutAndClusterTree](../treesidebarmixin#action-setlayoutandclustertree),
[setTreeAreaWidth](../treesidebarmixin#action-settreeareawidth),
[setSubtreeFilter](../treesidebarmixin#action-setsubtreefilter),
[setHoveredTreeNode](../treesidebarmixin#action-sethoveredtreenode),
[setTreeCanvasRef](../treesidebarmixin#action-settreecanvasref),
[setMouseoverCanvasRef](../treesidebarmixin#action-setmouseovercanvasref)

<details>
<summary>LinearMultiSampleVariantMatrixDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearMultiSampleVariantMatrixDisplay'>
// code
type: types.literal('LinearMultiSampleVariantMatrixDisplay')
```

#### property: lineZoneHeight

```ts
// type signature
type lineZoneHeight = IOptionalIType<ISimpleType<number>, [undefined]>
// code
lineZoneHeight: types.stripDefault(types.number, 20)
```

</details>

<details open>
<summary>LinearMultiSampleVariantMatrixDisplay - Getters</summary>

#### getter: flipped

True when every visible region is reversed (the view is horizontally flipped).
The matrix lays columns out by genomic-ascending feature index, but a flipped
view runs the ruler right-to-left, so columns are mirrored to `numFeatures-1-i`
to keep them and the genome connector lines from crossing. Mixed
forward/reversed regions don't flip.

```ts
type flipped = boolean
```

#### getter: renderState

Per-frame render state for the GPU backend — the autorun reads this every time
any tracked observable (cellData, scrollTop, rowHeight, canvas width, …)
changes.

```ts
type renderState =
  | {
      canvasWidth: number
      canvasHeight: number
      rowHeight: number
      scrollTop: number
      flipped: boolean
    }
  | undefined
```

</details>

<details>
<summary>LinearMultiSampleVariantMatrixDisplay - Getters (other undocumented members)</summary>

#### getter: blockType

```ts
type blockType = string
```

#### getter: prefersOffset

```ts
type prefersOffset = boolean
```

</details>

<details>
<summary>LinearMultiSampleVariantMatrixDisplay - Methods</summary>

#### method: renderSvg

```ts
type renderSvg = (opts?: ExportSvgDisplayOptions | undefined) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<...> | AwaitedReactNode>
```

</details>

<details>
<summary>LinearMultiSampleVariantMatrixDisplay - Actions</summary>

#### action: setLineZoneHeight

```ts
type setLineZoneHeight = (n: number) => number
```

#### action: startRenderingBackend

```ts
type startRenderingBackend = (backend: VariantMatrixRenderingBackend) => void
```

</details>
