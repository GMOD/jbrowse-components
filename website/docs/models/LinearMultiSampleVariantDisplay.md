---
id: linearmultisamplevariantdisplay
title: LinearMultiSampleVariantDisplay
sidebar_label: Display -> LinearMultiSampleVariantDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearMultiSampleVariantDisplay.md)

## Overview

Multi-sample variant display drawing one genotype row per sample, with a
per-cell feature widget on click.

### LinearMultiSampleVariantDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearmultisamplevariantdisplay).

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

<details open>
<summary>LinearMultiSampleVariantDisplay - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                   | Signature                                        |
| ------------------------ | ------------------------------------------------ |
| [`type`](#property-type) | `ISimpleType<"LinearMultiSampleVariantDisplay">` |

</details>

<details>
<summary>LinearMultiSampleVariantDisplay - Properties (all signatures)</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearMultiSampleVariantDisplay'>
// code
type: types.literal('LinearMultiSampleVariantDisplay')
```

</details>

<details open>
<summary>LinearMultiSampleVariantDisplay - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                         | Signature                                                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`visibleRegions`](#getter-visibleregions)     | `{ refName: string; start: number; end: number; assemblyName: string; reversed: boolean \| undefined; displayedRegionIndex: number; screenStartPx: number; screenEndPx: number; }[]` |
| [`renderState`](#getter-renderstate)           | `{ canvasWidth: number; canvasHeight: number; rowHeight: number; scrollTop: number; } \| undefined`                                                                                  |
| [`prefersOffset`](#getter-prefersoffset)       | `boolean`                                                                                                                                                                            |
| [`perRegionCellMap`](#getter-perregioncellmap) | `Map<number, VariantUploadData>`                                                                                                                                                     |
| [`flatbushIndices`](#getter-flatbushindices)   | `Map<number, Flatbush>`                                                                                                                                                              |

</details>

<details>
<summary>LinearMultiSampleVariantDisplay - Getters (all signatures)</summary>

#### getter: visibleRegions

```ts
type visibleRegions = {
  refName: string
  start: number
  end: number
  assemblyName: string
  reversed: boolean | undefined
  displayedRegionIndex: number
  screenStartPx: number
  screenEndPx: number
}[]
```

#### getter: renderState

```ts
type renderState =
  | {
      canvasWidth: number
      canvasHeight: number
      rowHeight: number
      scrollTop: number
    }
  | undefined
```

#### getter: prefersOffset

```ts
type prefersOffset = boolean
```

#### getter: perRegionCellMap

```ts
type perRegionCellMap = Map<number, VariantUploadData>
```

#### getter: flatbushIndices

```ts
type flatbushIndices = Map<number, Flatbush>
```

</details>

<details open>
<summary>LinearMultiSampleVariantDisplay - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                         | Signature                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`renderSvg`](#method-rendersvg)               | `(opts?: ExportSvgDisplayOptions \| undefined) => Promise<ReactElement<unknown, string \| JSXElementConstructor<any>> \| Iterable<...> \| AwaitedReactNode>` |
| [`showSubmenuItems`](#method-showsubmenuitems) | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| CustomMenuItem \| { ...; })[]`                 |

</details>

<details>
<summary>LinearMultiSampleVariantDisplay - Methods (all signatures)</summary>

#### method: renderSvg

```ts
type renderSvg = (opts?: ExportSvgDisplayOptions | undefined) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<...> | AwaitedReactNode>
```

#### method: showSubmenuItems

```ts
type showSubmenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | CustomMenuItem | { ...; })[]
```

</details>

<details open>
<summary>LinearMultiSampleVariantDisplay - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                   | Signature                                    |
| -------------------------------------------------------- | -------------------------------------------- |
| [`startRenderingBackend`](#action-startrenderingbackend) | `(backend: VariantRenderingBackend) => void` |

</details>

<details>
<summary>LinearMultiSampleVariantDisplay - Actions (all signatures)</summary>

#### action: startRenderingBackend

```ts
type startRenderingBackend = (backend: VariantRenderingBackend) => void
```

</details>
