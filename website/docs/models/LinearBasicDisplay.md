---
id: linearbasicdisplay
title: LinearBasicDisplay
sidebar_label: Display -> LinearBasicDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`canvas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/model.ts).

## Example usage

A complete `FeatureTrack` config (e.g. genes from a GFF3) to paste into
`tracks`. `displayMode` sets the feature height preset (`normal`, `compact`, or
`superCompact`):

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

## Members

| Member                                                                 | Kind    | Description |
| ---------------------------------------------------------------------- | ------- | ----------- |
| [subfeatureLabels](#getter-subfeaturelabels)                           | Getters |             |
| [geneGlyphMode](#getter-geneglyphmode)                                 | Getters |             |
| [displayDirectionalChevrons](#getter-displaydirectionalchevrons)       | Getters |             |
| [effectiveGeneGlyphMode](#getter-effectivegeneglyphmode)               | Getters |             |
| [showGeneGlyphControl](#getter-showgeneglyphcontrol)                   | Getters |             |
| [isGeneLike](#getter-isgenelike)                                       | Getters |             |
| [rpcProps](#method-rpcprops)                                           | Methods |             |
| [showSubmenuMenuItems](#method-showsubmenumenuitems)                   | Methods |             |
| [trackMenuItems](#method-trackmenuitems)                               | Methods |             |
| [contextMenuItems](#method-contextmenuitems)                           | Methods |             |
| [setSubfeatureLabels](#action-setsubfeaturelabels)                     | Actions |             |
| [setGeneGlyphMode](#action-setgeneglyphmode)                           | Actions |             |
| [setCompactness](#action-setcompactness)                               | Actions |             |
| [setShowOnlyGenes](#action-setshowonlygenes)                           | Actions |             |
| [setDisplayDirectionalChevrons](#action-setdisplaydirectionalchevrons) | Actions |             |

### LinearBasicDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearbasicdisplay).

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
[mouseoverExtraInformation](../linearcanvasbasedisplay#volatile-mouseoverextrainformation),
[contextMenuInfo](../linearcanvasbasedisplay#volatile-contextmenuinfo),
[userFeatureDensityLimit](../linearcanvasbasedisplay#volatile-userfeaturedensitylimit),
[byteEstimateVisibleBp](../linearcanvasbasedisplay#volatile-byteestimatevisiblebp),
[incrementalLayout](../linearcanvasbasedisplay#volatile-incrementallayout),
[incrementalLayoutLabelsOnly](../linearcanvasbasedisplay#volatile-incrementallayoutlabelsonly),
[incrementalLayoutBodiesOnly](../linearcanvasbasedisplay#volatile-incrementallayoutbodiesonly),
[incrementalLayoutDecimated](../linearcanvasbasedisplay#volatile-incrementallayoutdecimated),
[morphFromTops](../linearcanvasbasedisplay#volatile-morphfromtops),
[morphProgress](../linearcanvasbasedisplay#volatile-morphprogress),
[morphStartMs](../linearcanvasbasedisplay#volatile-morphstartms),
[morphFromMaxY](../linearcanvasbasedisplay#volatile-morphfrommaxy)

**Getters:** [conf](../linearcanvasbasedisplay#getter-conf),
[visibleFeatureDensityPerPx](../linearcanvasbasedisplay#getter-visiblefeaturedensityperpx),
[renderState](../linearcanvasbasedisplay#getter-renderstate),
[DisplayMessageComponent](../linearcanvasbasedisplay#getter-displaymessagecomponent),
[maxHeight](../linearcanvasbasedisplay#getter-maxheight),
[displayMode](../linearcanvasbasedisplay#getter-displaymode),
[labelFontSize](../linearcanvasbasedisplay#getter-labelfontsize),
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
[resolvedHighlights](../linearcanvasbasedisplay#getter-resolvedhighlights),
[highlightedFeatureIdSet](../linearcanvasbasedisplay#getter-highlightedfeatureidset),
[layoutPinnedFeatureIdSet](../linearcanvasbasedisplay#getter-layoutpinnedfeatureidset),
[soloFeatureIdSet](../linearcanvasbasedisplay#getter-solofeatureidset),
[featureWidgetType](../linearcanvasbasedisplay#getter-featurewidgettype),
[estimatedVisibleBytes](../linearcanvasbasedisplay#getter-estimatedvisiblebytes),
[densityTooLarge](../linearcanvasbasedisplay#getter-densitytoolarge),
[tooLargeStatus](../linearcanvasbasedisplay#getter-toolargestatus),
[regionTooLarge](../linearcanvasbasedisplay#getter-regiontoolarge),
[regionTooLargeReason](../linearcanvasbasedisplay#getter-regiontoolargereason),
[layoutInputs](../linearcanvasbasedisplay#getter-layoutinputs),
[baseLaidOutDataMap](../linearcanvasbasedisplay#getter-baselaidoutdatamap),
[fitLabelsOnlyLayout](../linearcanvasbasedisplay#getter-fitlabelsonlylayout),
[fitDecimatedLayout](../linearcanvasbasedisplay#getter-fitdecimatedlayout),
[fitBodiesOnlyLayout](../linearcanvasbasedisplay#getter-fitbodiesonlylayout),
[fitBodyPx](../linearcanvasbasedisplay#getter-fitbodypx),
[fitMinScale](../linearcanvasbasedisplay#getter-fitminscale),
[fitMaxScale](../linearcanvasbasedisplay#getter-fitmaxscale),
[fitStage](../linearcanvasbasedisplay#getter-fitstage),
[fitScale](../linearcanvasbasedisplay#getter-fitscale),
[laidOutDataMap](../linearcanvasbasedisplay#getter-laidoutdatamap),
[renderedShowDescriptions](../linearcanvasbasedisplay#getter-renderedshowdescriptions),
[renderedShowLabels](../linearcanvasbasedisplay#getter-renderedshowlabels),
[renderDataMap](../linearcanvasbasedisplay#getter-renderdatamap),
[settledMaxY](../linearcanvasbasedisplay#getter-settledmaxy),
[maxY](../linearcanvasbasedisplay#getter-maxy),
[hasOverflow](../linearcanvasbasedisplay#getter-hasoverflow),
[contentHeight](../linearcanvasbasedisplay#getter-contentheight),
[scrollableHeight](../linearcanvasbasedisplay#getter-scrollableheight),
[fitHeight](../linearcanvasbasedisplay#getter-fitheight),
[grownHeight](../linearcanvasbasedisplay#getter-grownheight),
[height](../linearcanvasbasedisplay#getter-height),
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
[fitLayoutAt](../linearcanvasbasedisplay#method-fitlayoutat),
[getFeatureById](../linearcanvasbasedisplay#method-getfeaturebyid),
[searchFeatureByID](../linearcanvasbasedisplay#method-searchfeaturebyid),
[renderSvg](../linearcanvasbasedisplay#method-rendersvg),
[showSubmenuMenuItems](../linearcanvasbasedisplay#method-showsubmenumenuitems),
[contextMenuItems](../linearcanvasbasedisplay#method-contextmenuitems),
[colorBySubMenuItems](../linearcanvasbasedisplay#method-colorbysubmenuitems),
[colorMenuItems](../linearcanvasbasedisplay#method-colormenuitems),
[featureHeightMenuItems](../linearcanvasbasedisplay#method-featureheightmenuitems),
[trackMenuItems](../linearcanvasbasedisplay#method-trackmenuitems)

**Actions:** [beginYMorph](../linearcanvasbasedisplay#action-beginymorph),
[setMorphProgress](../linearcanvasbasedisplay#action-setmorphprogress),
[endYMorph](../linearcanvasbasedisplay#action-endymorph),
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
[addFeatureHighlightForItem](../linearcanvasbasedisplay#action-addfeaturehighlightforitem),
[removeFeatureHighlightsForItem](../linearcanvasbasedisplay#action-removefeaturehighlightsforitem),
[clearFeatureHighlights](../linearcanvasbasedisplay#action-clearfeaturehighlights),
[applySolo](../linearcanvasbasedisplay#action-applysolo),
[soloFeature](../linearcanvasbasedisplay#action-solofeature),
[clearAllFeatureFilters](../linearcanvasbasedisplay#action-clearallfeaturefilters),
[selectFeature](../linearcanvasbasedisplay#action-selectfeature),
[clearSelection](../linearcanvasbasedisplay#action-clearselection),
[setShowLabels](../linearcanvasbasedisplay#action-setshowlabels),
[setShowDescriptions](../linearcanvasbasedisplay#action-setshowdescriptions),
[setJexlFilters](../linearcanvasbasedisplay#action-setjexlfilters),
[setShowOutline](../linearcanvasbasedisplay#action-setshowoutline),
[setFeatureColor](../linearcanvasbasedisplay#action-setfeaturecolor),
[setUtrColor](../linearcanvasbasedisplay#action-setutrcolor),
[openContextMenu](../linearcanvasbasedisplay#action-opencontextmenu),
[setDisplayMode](../linearcanvasbasedisplay#action-setdisplaymode),
[setHeightMode](../linearcanvasbasedisplay#action-setheightmode),
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

**Methods:** [renderingProps](../basedisplay#method-renderingprops),
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

### Available via [HeightModeMixin](../heightmodemixin)

**Getters:** [heightMode](../heightmodemixin#getter-heightmode),
[fitTargetHeight](../heightmodemixin#getter-fittargetheight),
[autoHeight](../heightmodemixin#getter-autoheight),
[fitHeightToDisplay](../heightmodemixin#getter-fitheighttodisplay)

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
[regionStatuses](../fetchmixin#volatile-regionstatuses),
[lastStatusMs](../fetchmixin#volatile-laststatusms)

**Getters:** [isLoading](../fetchmixin#getter-isloading)

**Methods:** [makeStatusCallback](../fetchmixin#method-makestatuscallback),
[makeRegionStatusCallback](../fetchmixin#method-makeregionstatuscallback)

**Actions:** [setError](../fetchmixin#action-seterror),
[setStatusMessage](../fetchmixin#action-setstatusmessage),
[throttleStatus](../fetchmixin#action-throttlestatus),
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

<details>
<summary>LinearBasicDisplay - Getters</summary>

#### getter: subfeatureLabels

```ts
type subfeatureLabels = 'none' | 'overlay' | 'below'
```

#### getter: geneGlyphMode

```ts
type geneGlyphMode = any
```

#### getter: displayDirectionalChevrons

```ts
type displayDirectionalChevrons = boolean
```

#### getter: effectiveGeneGlyphMode

```ts
type effectiveGeneGlyphMode = 'auto' | 'all' | 'longestCoding'
```

#### getter: showGeneGlyphControl

```ts
type showGeneGlyphControl = boolean
```

#### getter: isGeneLike

```ts
type isGeneLike = boolean
```

</details>

<details>
<summary>LinearBasicDisplay - Methods</summary>

#### method: rpcProps

```ts
type rpcProps = () => { displayConfig: { geneGlyphMode: "auto" | "all" | "longestCoding"; subfeatureLabels: "none" | "overlay" | "below"; transcriptTypes: string[]; containerTypes: string[]; subParts: string; ... 9 more ...; labels: { ...; }; }; ... 5 more ...; theme: SerializableThemeArgs | undefined; }
```

#### method: showSubmenuMenuItems

```ts
type showSubmenuMenuItems = () => (CheckboxMenuItem | { label: string; subMenu: { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]; } | { label: string; type: "checkbox"; checked: any; onClick: () => void; } | { ...; })[]
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | CustomMenuItem | { ...; })[]
```

#### method: contextMenuItems

```ts
type contextMenuItems = () => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; subMenu?: undefined; } | { ...; } | { ...; })[]
```

</details>

<details>
<summary>LinearBasicDisplay - Actions</summary>

#### action: setSubfeatureLabels

```ts
type setSubfeatureLabels = (value: 'none' | 'overlay' | 'below') => void
```

#### action: setGeneGlyphMode

```ts
type setGeneGlyphMode = (value: 'auto' | 'all' | 'longestCoding') => void
```

#### action: setCompactness

```ts
type setCompactness = (level: 'normal' | 'compact' | 'super-compact') => void
```

#### action: setShowOnlyGenes

```ts
type setShowOnlyGenes = (value: boolean) => void
```

#### action: setDisplayDirectionalChevrons

```ts
type setDisplayDirectionalChevrons = (value: boolean) => void
```

</details>
