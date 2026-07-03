---
id: linearvariantdisplay
title: LinearVariantDisplay
sidebar_label: Display -> LinearVariantDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearVariantDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearVariantDisplay.md)

## Example usage

A complete `VariantTrack` config to paste into `tracks`:

```js
{
  type: 'VariantTrack',
  trackId: 'variants',
  name: 'Variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/variants.vcf.gz',
  },
  displays: [
    {
      type: 'LinearVariantDisplay',
      displayId: 'variants-LinearVariantDisplay',
      height: 150,
    },
  ],
}
```

## Overview

GPU-accelerated variant display with custom feature widget on click.

### LinearVariantDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearvariantdisplay).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [LinearCanvasBaseDisplay](../linearcanvasbasedisplay)

**Properties:** [refName](../linearcanvasbasedisplay#property-refname),
[start](../linearcanvasbasedisplay#property-start),
[end](../linearcanvasbasedisplay#property-end),
[name](../linearcanvasbasedisplay#property-name),
[configuration](../linearcanvasbasedisplay#property-configuration),
[jexlFiltersSetting](../linearcanvasbasedisplay#property-jexlfilterssetting),
[pinnedFeatureIds](../linearcanvasbasedisplay#property-pinnedfeatureids),
[soloFeatureIds](../linearcanvasbasedisplay#property-solofeatureids),
[soloApplied](../linearcanvasbasedisplay#property-soloapplied),
[hiddenFeatureIds](../linearcanvasbasedisplay#property-hiddenfeatureids),
[featureHighlights](../linearcanvasbasedisplay#property-featurehighlights)

**Volatiles:** [rpcDataMap](../linearcanvasbasedisplay#volatile-rpcdatamap),
[densityStatsPerRegion](../linearcanvasbasedisplay#volatile-densitystatsperregion),
[featureIdUnderMouse](../linearcanvasbasedisplay#volatile-featureidundermouse),
[subfeatureIdUnderMouse](../linearcanvasbasedisplay#volatile-subfeatureidundermouse),
[hoveredRegionIndex](../linearcanvasbasedisplay#volatile-hoveredregionindex),
[mouseoverExtraInformation](../linearcanvasbasedisplay#volatile-mouseoverextrainformation),
[contextMenuInfo](../linearcanvasbasedisplay#volatile-contextmenuinfo),
[userFeatureDensityLimit](../linearcanvasbasedisplay#volatile-userfeaturedensitylimit),
[byteEstimateVisibleBp](../linearcanvasbasedisplay#volatile-byteestimatevisiblebp),
[heightBeforeExpand](../linearcanvasbasedisplay#volatile-heightbeforeexpand),
[incrementalLayout](../linearcanvasbasedisplay#volatile-incrementallayout),
[morphFromTops](../linearcanvasbasedisplay#volatile-morphfromtops),
[morphProgress](../linearcanvasbasedisplay#volatile-morphprogress),
[morphStartMs](../linearcanvasbasedisplay#volatile-morphstartms),
[morphFromMaxY](../linearcanvasbasedisplay#volatile-morphfrommaxy)

**Getters:** [conf](../linearcanvasbasedisplay#getter-conf),
[visibleFeatureDensityPerPx](../linearcanvasbasedisplay#getter-visiblefeaturedensityperpx),
[renderState](../linearcanvasbasedisplay#getter-renderstate),
[DisplayMessageComponent](../linearcanvasbasedisplay#getter-displaymessagecomponent),
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
[pinnedFeatureIdSet](../linearcanvasbasedisplay#getter-pinnedfeatureidset),
[highlightedFeatureIdSet](../linearcanvasbasedisplay#getter-highlightedfeatureidset),
[layoutPinnedFeatureIdSet](../linearcanvasbasedisplay#getter-layoutpinnedfeatureidset),
[soloFeatureIdSet](../linearcanvasbasedisplay#getter-solofeatureidset),
[hiddenFeatureIdSet](../linearcanvasbasedisplay#getter-hiddenfeatureidset),
[featureWidgetType](../linearcanvasbasedisplay#getter-featurewidgettype),
[estimatedVisibleBytes](../linearcanvasbasedisplay#getter-estimatedvisiblebytes),
[densityTooLarge](../linearcanvasbasedisplay#getter-densitytoolarge),
[tooLargeStatus](../linearcanvasbasedisplay#getter-toolargestatus),
[regionTooLarge](../linearcanvasbasedisplay#getter-regiontoolarge),
[regionTooLargeReason](../linearcanvasbasedisplay#getter-regiontoolargereason),
[laidOutDataMap](../linearcanvasbasedisplay#getter-laidoutdatamap),
[renderDataMap](../linearcanvasbasedisplay#getter-renderdatamap),
[maxY](../linearcanvasbasedisplay#getter-maxy),
[hasOverflow](../linearcanvasbasedisplay#getter-hasoverflow),
[contentHeight](../linearcanvasbasedisplay#getter-contentheight),
[scrollableHeight](../linearcanvasbasedisplay#getter-scrollableheight),
[fitHeight](../linearcanvasbasedisplay#getter-fitheight),
[canExpand](../linearcanvasbasedisplay#getter-canexpand),
[featureIdIndex](../linearcanvasbasedisplay#getter-featureidindex),
[subfeatureIdIndex](../linearcanvasbasedisplay#getter-subfeatureidindex),
[hoveredFeature](../linearcanvasbasedisplay#getter-hoveredfeature),
[hoveredSubfeature](../linearcanvasbasedisplay#getter-hoveredsubfeature),
[featureItemMap](../linearcanvasbasedisplay#getter-featureitemmap),
[highlightedFeatureIds](../linearcanvasbasedisplay#getter-highlightedfeatureids),
[flatbushIndexes](../linearcanvasbasedisplay#getter-flatbushindexes)

**Methods:**
[observedMaxDensity](../linearcanvasbasedisplay#method-observedmaxdensity),
[activeFilters](../linearcanvasbasedisplay#method-activefilters),
[rpcProps](../linearcanvasbasedisplay#method-rpcprops),
[getFeatureById](../linearcanvasbasedisplay#method-getfeaturebyid),
[searchFeatureByID](../linearcanvasbasedisplay#method-searchfeaturebyid),
[renderSvg](../linearcanvasbasedisplay#method-rendersvg),
[showSubmenuMenuItems](../linearcanvasbasedisplay#method-showsubmenumenuitems),
[contextMenuItems](../linearcanvasbasedisplay#method-contextmenuitems),
[colorBySubMenuItems](../linearcanvasbasedisplay#method-colorbysubmenuitems),
[colorMenuItems](../linearcanvasbasedisplay#method-colormenuitems),
[trackMenuItems](../linearcanvasbasedisplay#method-trackmenuitems)

**Actions:** [beginYMorph](../linearcanvasbasedisplay#action-beginymorph),
[setMorphProgress](../linearcanvasbasedisplay#action-setmorphprogress),
[endYMorph](../linearcanvasbasedisplay#action-endymorph),
[expandToFit](../linearcanvasbasedisplay#action-expandtofit),
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
[closeContextMenu](../linearcanvasbasedisplay#action-closecontextmenu),
[togglePinnedFeature](../linearcanvasbasedisplay#action-togglepinnedfeature),
[toggleSoloFeature](../linearcanvasbasedisplay#action-togglesolofeature),
[clearSolo](../linearcanvasbasedisplay#action-clearsolo),
[hideFeature](../linearcanvasbasedisplay#action-hidefeature),
[showAllHidden](../linearcanvasbasedisplay#action-showallhidden),
[setFeatureHighlights](../linearcanvasbasedisplay#action-setfeaturehighlights),
[clearFeatureHighlights](../linearcanvasbasedisplay#action-clearfeaturehighlights),
[applySolo](../linearcanvasbasedisplay#action-applysolo),
[soloFeature](../linearcanvasbasedisplay#action-solofeature),
[clearAllFeatureFilters](../linearcanvasbasedisplay#action-clearallfeaturefilters),
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
[isCacheValid](../linearcanvasbasedisplay#action-iscachevalid),
[byteSizeLimit](../linearcanvasbasedisplay#action-bytesizelimit),
[selectFeatureById](../linearcanvasbasedisplay#action-selectfeaturebyid),
[reload](../linearcanvasbasedisplay#action-reload),
[fetchNeeded](../linearcanvasbasedisplay#action-fetchneeded),
[setFeatureDensityStats](../linearcanvasbasedisplay#action-setfeaturedensitystats),
[clearStaleDensityState](../linearcanvasbasedisplay#action-clearstaledensitystate),
[resizeHeight](../linearcanvasbasedisplay#action-resizeheight),
[afterAttach](../linearcanvasbasedisplay#action-afterattach)

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

### Available via [PromotableDefaultsMixin](../promotabledefaultsmixin)

**Methods:**
[sessionDefaultChanges](../promotabledefaultsmixin#method-sessiondefaultchanges)

**Actions:**
[clearSessionDefaults](../promotabledefaultsmixin#action-clearsessiondefaults)

<details open>
<summary>LinearVariantDisplay - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                   | Signature                             |
| ------------------------ | ------------------------------------- |
| [`type`](#property-type) | `ISimpleType<"LinearVariantDisplay">` |

</details>

<details>
<summary>LinearVariantDisplay - Properties (all signatures)</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearVariantDisplay'>
// code
type: types.literal('LinearVariantDisplay')
```

</details>

<details open>
<summary>LinearVariantDisplay - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                     | Signature |
| ---------------------------------------------------------- | --------- |
| [`impactLegendDismissed`](#volatile-impactlegenddismissed) | `false`   |

</details>

<details>
<summary>LinearVariantDisplay - Volatiles (all signatures)</summary>

#### volatile: impactLegendDismissed

```ts
// type signature
type impactLegendDismissed = false
// code
impactLegendDismissed: false
```

</details>

<details open>
<summary>LinearVariantDisplay - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                           | Signature                       |
| ---------------------------------------------------------------- | ------------------------------- |
| [`featureWidgetType`](#getter-featurewidgettype)                 | `{ type: string; id: string; }` |
| [`colorsByConsequenceImpact`](#getter-colorsbyconsequenceimpact) | `boolean`                       |
| [`impactLegendItems`](#getter-impactlegenditems)                 | `LegendItem[]`                  |
| [`showImpactLegend`](#getter-showimpactlegend)                   | `boolean`                       |

</details>

<details>
<summary>LinearVariantDisplay - Getters (all signatures)</summary>

#### getter: featureWidgetType

```ts
type featureWidgetType = { type: string; id: string }
```

#### getter: colorsByConsequenceImpact

```ts
type colorsByConsequenceImpact = boolean
```

#### getter: impactLegendItems

```ts
type impactLegendItems = LegendItem[]
```

#### getter: showImpactLegend

```ts
type showImpactLegend = boolean
```

</details>

<details open>
<summary>LinearVariantDisplay - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                               | Signature                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`colorBySubMenuItems`](#method-colorbysubmenuitems) | `() => { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]` |

</details>

<details>
<summary>LinearVariantDisplay - Methods (all signatures)</summary>

#### method: colorBySubMenuItems

```ts
type colorBySubMenuItems = () => {
  label: string
  type: 'radio'
  checked: boolean
  onClick: () => void
}[]
```

</details>

<details open>
<summary>LinearVariantDisplay - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                         | Signature                |
| -------------------------------------------------------------- | ------------------------ |
| [`setImpactLegendDismissed`](#action-setimpactlegenddismissed) | `(arg: boolean) => void` |

</details>

<details>
<summary>LinearVariantDisplay - Actions (all signatures)</summary>

#### action: setImpactLegendDismissed

```ts
type setImpactLegendDismissed = (arg: boolean) => void
```

</details>
