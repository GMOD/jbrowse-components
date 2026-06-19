---
id: linearbasicdisplay
title: LinearBasicDisplay
sidebar_label: Display -> LinearBasicDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearBasicDisplay.md)

## Example usage

A complete `FeatureTrack` config (e.g. genes from a GFF3) to paste into
`tracks`. `displayMode` switches between `normal`, `compact`, `superCompact`,
`reducedRepresentation`, and `collapse`:

```js
{
  type: 'FeatureTrack',
  trackId: 'genes',
  name: 'Genes',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    uri: 'https://example.com/genes.gff3.gz',
  },
  displays: [
    {
      type: 'LinearBasicDisplay',
      displayId: 'genes-LinearBasicDisplay',
      height: 200,
      displayMode: 'compact',
    },
  ],
}
```

## Overview

GPU-accelerated feature display with gene-specific UI on top of the shared
canvas base display (`LinearCanvasBaseDisplay`). This is the GPU stack — despite
the name it does NOT extend `BaseLinearDisplay` (the legacy block stack). See
agent-docs/ARCHITECTURE.md "Display stacks".

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [LinearCanvasBaseDisplay](../linearcanvasbasedisplay)

**Properties:**
[configuration](../linearcanvasbasedisplay#property-configuration),
[jexlFiltersSetting](../linearcanvasbasedisplay#property-jexlfilterssetting)

**Volatiles:** [rpcDataMap](../linearcanvasbasedisplay#volatile-rpcdatamap),
[densityStatsPerRegion](../linearcanvasbasedisplay#volatile-densitystatsperregion),
[featureIdUnderMouse](../linearcanvasbasedisplay#volatile-featureidundermouse),
[subfeatureIdUnderMouse](../linearcanvasbasedisplay#volatile-subfeatureidundermouse),
[mouseoverExtraInformation](../linearcanvasbasedisplay#volatile-mouseoverextrainformation),
[contextMenuFeature](../linearcanvasbasedisplay#volatile-contextmenufeature),
[contextMenuInfo](../linearcanvasbasedisplay#volatile-contextmenuinfo),
[userFeatureDensityLimit](../linearcanvasbasedisplay#volatile-userfeaturedensitylimit),
[byteEstimateVisibleBp](../linearcanvasbasedisplay#volatile-byteestimatevisiblebp),
[heightBeforeExpand](../linearcanvasbasedisplay#volatile-heightbeforeexpand),
[incrementalLayout](../linearcanvasbasedisplay#volatile-incrementallayout)

**Getters:** [conf](../linearcanvasbasedisplay#getter-conf),
[visibleFeatureDensityPerPx](../linearcanvasbasedisplay#getter-visiblefeaturedensityperpx),
[renderState](../linearcanvasbasedisplay#getter-renderstate),
[DisplayMessageComponent](../linearcanvasbasedisplay#getter-displaymessagecomponent),
[showTooltipsEnabled](../linearcanvasbasedisplay#getter-showtooltipsenabled),
[showLegend](../linearcanvasbasedisplay#getter-showlegend),
[maxHeight](../linearcanvasbasedisplay#getter-maxheight),
[autoHeight](../linearcanvasbasedisplay#getter-autoheight),
[displayMode](../linearcanvasbasedisplay#getter-displaymode),
[showLabelsMode](../linearcanvasbasedisplay#getter-showlabelsmode),
[showLabels](../linearcanvasbasedisplay#getter-showlabels),
[showDescriptions](../linearcanvasbasedisplay#getter-showdescriptions),
[showOutline](../linearcanvasbasedisplay#getter-showoutline),
[featureColor](../linearcanvasbasedisplay#getter-featurecolor),
[utrColor](../linearcanvasbasedisplay#getter-utrcolor),
[colorByMode](../linearcanvasbasedisplay#getter-colorbymode),
[colorByAttribute](../linearcanvasbasedisplay#getter-colorbyattribute),
[effectiveShowDescriptions](../linearcanvasbasedisplay#getter-effectiveshowdescriptions),
[selectedFeatureId](../linearcanvasbasedisplay#getter-selectedfeatureid),
[maxFeatureDensity](../linearcanvasbasedisplay#getter-maxfeaturedensity),
[colorByCDS](../linearcanvasbasedisplay#getter-colorbycds),
[sequenceAdapter](../linearcanvasbasedisplay#getter-sequenceadapter),
[regionKeys](../linearcanvasbasedisplay#getter-regionkeys),
[reversedRegions](../linearcanvasbasedisplay#getter-reversedregions),
[featureWidgetType](../linearcanvasbasedisplay#getter-featurewidgettype),
[estimatedVisibleBytes](../linearcanvasbasedisplay#getter-estimatedvisiblebytes),
[bytesEstimateTooLarge](../linearcanvasbasedisplay#getter-bytesestimatetoolarge),
[densityTooLarge](../linearcanvasbasedisplay#getter-densitytoolarge),
[regionTooLarge](../linearcanvasbasedisplay#getter-regiontoolarge),
[regionTooLargeReason](../linearcanvasbasedisplay#getter-regiontoolargereason),
[laidOutDataMap](../linearcanvasbasedisplay#getter-laidoutdatamap),
[maxY](../linearcanvasbasedisplay#getter-maxy),
[hasOverflow](../linearcanvasbasedisplay#getter-hasoverflow),
[featureIdIndex](../linearcanvasbasedisplay#getter-featureidindex),
[subfeatureIdIndex](../linearcanvasbasedisplay#getter-subfeatureidindex),
[hoveredFeature](../linearcanvasbasedisplay#getter-hoveredfeature),
[hoveredSubfeature](../linearcanvasbasedisplay#getter-hoveredsubfeature),
[featureItemMap](../linearcanvasbasedisplay#getter-featureitemmap),
[flatbushIndexes](../linearcanvasbasedisplay#getter-flatbushindexes)

**Methods:** [activeFilters](../linearcanvasbasedisplay#method-activefilters),
[rpcProps](../linearcanvasbasedisplay#method-rpcprops),
[getFeatureById](../linearcanvasbasedisplay#method-getfeaturebyid),
[searchFeatureByID](../linearcanvasbasedisplay#method-searchfeaturebyid),
[renderSvg](../linearcanvasbasedisplay#method-rendersvg),
[showSubmenuMenuItems](../linearcanvasbasedisplay#method-showsubmenumenuitems),
[contextMenuItems](../linearcanvasbasedisplay#method-contextmenuitems),
[colorBySubMenuItems](../linearcanvasbasedisplay#method-colorbysubmenuitems),
[colorMenuItems](../linearcanvasbasedisplay#method-colormenuitems),
[trackMenuItems](../linearcanvasbasedisplay#method-trackmenuitems)

**Actions:** [expandToFit](../linearcanvasbasedisplay#action-expandtofit),
[collapseFromExpand](../linearcanvasbasedisplay#action-collapsefromexpand),
[clearHeightBeforeExpand](../linearcanvasbasedisplay#action-clearheightbeforeexpand),
[setRpcData](../linearcanvasbasedisplay#action-setrpcdata),
[setDensityStats](../linearcanvasbasedisplay#action-setdensitystats),
[clearDisplaySpecificData](../linearcanvasbasedisplay#action-cleardisplayspecificdata),
[pruneRpcDataMapToVisible](../linearcanvasbasedisplay#action-prunerpcdatamaptovisible),
[startRenderingBackend](../linearcanvasbasedisplay#action-startrenderingbackend),
[setFeatureDensityStatsLimit](../linearcanvasbasedisplay#action-setfeaturedensitystatslimit),
[setHover](../linearcanvasbasedisplay#action-sethover),
[clearHover](../linearcanvasbasedisplay#action-clearhover),
[setContextMenuFeature](../linearcanvasbasedisplay#action-setcontextmenufeature),
[setContextMenuInfo](../linearcanvasbasedisplay#action-setcontextmenuinfo),
[selectFeature](../linearcanvasbasedisplay#action-selectfeature),
[clearSelection](../linearcanvasbasedisplay#action-clearselection),
[setShowLabels](../linearcanvasbasedisplay#action-setshowlabels),
[setAutoHeight](../linearcanvasbasedisplay#action-setautoheight),
[setShowDescriptions](../linearcanvasbasedisplay#action-setshowdescriptions),
[setJexlFilters](../linearcanvasbasedisplay#action-setjexlfilters),
[setShowOutline](../linearcanvasbasedisplay#action-setshowoutline),
[setFeatureColor](../linearcanvasbasedisplay#action-setfeaturecolor),
[setUtrColor](../linearcanvasbasedisplay#action-setutrcolor),
[showContextMenuForFeature](../linearcanvasbasedisplay#action-showcontextmenuforfeature),
[openSetColorDialog](../linearcanvasbasedisplay#action-opensetcolordialog),
[openColorByAttributeDialog](../linearcanvasbasedisplay#action-opencolorbyattributedialog),
[openFilterDialog](../linearcanvasbasedisplay#action-openfilterdialog),
[fetchFullFeature](../linearcanvasbasedisplay#action-fetchfullfeature),
[selectFeatureById](../linearcanvasbasedisplay#action-selectfeaturebyid),
[isCacheValid](../linearcanvasbasedisplay#action-iscachevalid),
[getByteEstimateConfig](../linearcanvasbasedisplay#action-getbyteestimateconfig),
[selectFullFeature](../linearcanvasbasedisplay#action-selectfullfeature),
[reload](../linearcanvasbasedisplay#action-reload),
[fetchNeeded](../linearcanvasbasedisplay#action-fetchneeded),
[setFeatureDensityStats](../linearcanvasbasedisplay#action-setfeaturedensitystats),
[clearStaleDensityState](../linearcanvasbasedisplay#action-clearstaledensitystate),
[afterAttach](../linearcanvasbasedisplay#action-afterattach)

### Available via [BaseDisplay](../basedisplay)

**Properties:** [id](../basedisplay#property-id),
[type](../basedisplay#property-type),
[rpcDriverName](../basedisplay#property-rpcdrivername)

**Volatiles:** [error](../basedisplay#volatile-error),
[statusMessage](../basedisplay#volatile-statusmessage)

**Getters:** [parentTrack](../basedisplay#getter-parenttrack),
[parentDisplay](../basedisplay#getter-parentdisplay),
[RenderingComponent](../basedisplay#getter-renderingcomponent),
[DisplayBlurb](../basedisplay#getter-displayblurb),
[adapterConfig](../basedisplay#getter-adapterconfig),
[isMinimized](../basedisplay#getter-isminimized),
[effectiveRpcDriverName](../basedisplay#getter-effectiverpcdrivername),
[effectiveTrackConfig](../basedisplay#getter-effectivetrackconfig),
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

**Properties:** [heightOverride](../trackheightmixin#property-heightoverride)

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
[displayPhase](../multiregiondisplaymixin#getter-displayphase),
[loadingOverlayVisible](../multiregiondisplaymixin#getter-loadingoverlayvisible)

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

**Actions:** [setError](../fetchmixin#action-seterror),
[setStatusMessage](../fetchmixin#action-setstatusmessage),
[setRegionStatus](../fetchmixin#action-setregionstatus),
[cancelFetch](../fetchmixin#action-cancelfetch),
[cancelFetchByUser](../fetchmixin#action-cancelfetchbyuser),
[runFetch](../fetchmixin#action-runfetch)

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:**
[configOverrides](../configoverridemixin#property-configoverrides)

**Methods:** [getOverride](../configoverridemixin#method-getoverride),
[getConfWithOverride](../configoverridemixin#method-getconfwithoverride)

**Actions:** [setOverride](../configoverridemixin#action-setoverride),
[clearOverride](../configoverridemixin#action-clearoverride)

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearBasicDisplay - Getters</summary>

#### getter: subfeatureLabels

```js
// type
;'none' | 'overlay' | 'below'
```

#### getter: geneGlyphMode

```js
// type
;'auto' | 'all' | 'longestCoding'
```

#### getter: displayDirectionalChevrons

```js
// type
boolean
```

#### getter: effectiveGeneGlyphMode

```js
// type
;'auto' | 'all' | 'longestCoding'
```

#### getter: isGeneLike

```js
// type
boolean
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearBasicDisplay - Methods</summary>

#### method: rpcProps

```js
// type signature
rpcProps: () => { displayConfig: { geneGlyphMode: "auto" | "all" | "longestCoding"; subfeatureLabels: "none" | "overlay" | "below"; transcriptTypes: string[]; containerTypes: string[]; subParts: string; ... 9 more ...; labels: { ...; }; }; showOnlyGenes: boolean; maxFeatureDensity: number | undefined; colorByCDS: boolean; the...
```

#### method: showSubmenuMenuItems

```js
// type signature
showSubmenuMenuItems: () => ({ label: string; subMenu: { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]; } | { label: string; type: "checkbox"; checked: boolean; onClick: () => void; })[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuItem | { label: string; subMenu: { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]; })[]
```

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; }[]
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearBasicDisplay - Actions</summary>

#### action: setSubfeatureLabels

```js
// type signature
setSubfeatureLabels: (value: "none" | "overlay" | "below") => void
```

#### action: setGeneGlyphMode

```js
// type signature
setGeneGlyphMode: (value: "auto" | "all" | "longestCoding") => void
```

#### action: setDisplayMode

```js
// type signature
setDisplayMode: (value: DisplayMode) => void
```

#### action: setCompactness

```js
// type signature
setCompactness: (level: "normal" | "compact" | "super-compact") => void
```

#### action: setShowOnlyGenes

```js
// type signature
setShowOnlyGenes: (value: boolean) => void
```

#### action: setDisplayDirectionalChevrons

```js
// type signature
setDisplayDirectionalChevrons: (value: boolean) => void
```

</details>
