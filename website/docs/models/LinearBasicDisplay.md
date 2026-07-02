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

### LinearBasicDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearbasicdisplay).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [LinearCanvasBaseDisplay](../linearcanvasbasedisplay)

**Properties:**
[configuration](../linearcanvasbasedisplay#property-configuration),
[jexlFiltersSetting](../linearcanvasbasedisplay#property-jexlfilterssetting),
[pinnedFeatureIds](../linearcanvasbasedisplay#property-pinnedfeatureids)

**Volatiles:** [rpcDataMap](../linearcanvasbasedisplay#volatile-rpcdatamap),
[densityStatsPerRegion](../linearcanvasbasedisplay#volatile-densitystatsperregion),
[featureIdUnderMouse](../linearcanvasbasedisplay#volatile-featureidundermouse),
[subfeatureIdUnderMouse](../linearcanvasbasedisplay#volatile-subfeatureidundermouse),
[hoveredRegionIndex](../linearcanvasbasedisplay#volatile-hoveredregionindex),
[mouseoverExtraInformation](../linearcanvasbasedisplay#volatile-mouseoverextrainformation),
[contextMenuInfo](../linearcanvasbasedisplay#volatile-contextmenuinfo),
[soloFeatureIds](../linearcanvasbasedisplay#volatile-solofeatureids),
[soloApplied](../linearcanvasbasedisplay#volatile-soloapplied),
[hiddenFeatureIds](../linearcanvasbasedisplay#volatile-hiddenfeatureids),
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
[statusMessage](../basedisplay#volatile-statusmessage)

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

<details open>
<summary>LinearBasicDisplay - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                       | Signature |
| ---------------------------------------------------------------------------- | --------- |
| [`isoformCollapseNoticeDismissed`](#volatile-isoformcollapsenoticedismissed) | `false`   |

</details>

<details>
<summary>LinearBasicDisplay - Volatiles (all signatures)</summary>

#### volatile: isoformCollapseNoticeDismissed

```ts
// type signature
type isoformCollapseNoticeDismissed = false
// code
isoformCollapseNoticeDismissed: false
```

</details>

<details open>
<summary>LinearBasicDisplay - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                             | Signature                            |
| ------------------------------------------------------------------ | ------------------------------------ |
| [`subfeatureLabels`](#getter-subfeaturelabels)                     | `any`                                |
| [`geneGlyphMode`](#getter-geneglyphmode)                           | `any`                                |
| [`displayDirectionalChevrons`](#getter-displaydirectionalchevrons) | `any`                                |
| [`isDisplayModeDefault`](#getter-isdisplaymodedefault)             | `boolean`                            |
| [`effectiveGeneGlyphMode`](#getter-effectivegeneglyphmode)         | `"auto" \| "all" \| "longestCoding"` |
| [`showIsoformCollapseNotice`](#getter-showisoformcollapsenotice)   | `boolean`                            |
| [`isGeneLike`](#getter-isgenelike)                                 | `boolean`                            |

</details>

<details>
<summary>LinearBasicDisplay - Getters (all signatures)</summary>

#### getter: subfeatureLabels

```ts
type subfeatureLabels = any
```

#### getter: geneGlyphMode

```ts
type geneGlyphMode = any
```

#### getter: displayDirectionalChevrons

```ts
type displayDirectionalChevrons = any
```

#### getter: isDisplayModeDefault

```ts
type isDisplayModeDefault = boolean
```

#### getter: effectiveGeneGlyphMode

```ts
type effectiveGeneGlyphMode = 'auto' | 'all' | 'longestCoding'
```

#### getter: showIsoformCollapseNotice

```ts
type showIsoformCollapseNotice = boolean
```

#### getter: isGeneLike

```ts
type isGeneLike = boolean
```

</details>

<details open>
<summary>LinearBasicDisplay - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                 | Signature                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`rpcProps`](#method-rpcprops)                         | `() => { displayConfig: { geneGlyphMode: "auto" \| "all" \| "longestCoding"; subfeatureLabels: "none" \| "overlay" \| "below"; transcriptTypes: string[]; containerTypes: string[]; subParts: string; ... 9 more ...; labels: { ...; }; }; ... 5 more ...; theme: SerializableThemeArgs \| undefined; }` |
| [`showSubmenuMenuItems`](#method-showsubmenumenuitems) | `() => ({ label: string; subMenu: { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]; } \| { label: string; type: "checkbox"; checked: any; onClick: () => void; })[]`                                                                                                           |
| [`trackMenuItems`](#method-trackmenuitems)             | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| { ...; })[]`                                                                                                                                                                               |
| [`contextMenuItems`](#method-contextmenuitems)         | `() => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; subMenu?: undefined; } \| { ...; })[]`                                                                                                                                       |

</details>

<details>
<summary>LinearBasicDisplay - Methods (all signatures)</summary>

#### method: rpcProps

```ts
type rpcProps = () => { displayConfig: { geneGlyphMode: "auto" | "all" | "longestCoding"; subfeatureLabels: "none" | "overlay" | "below"; transcriptTypes: string[]; containerTypes: string[]; subParts: string; ... 9 more ...; labels: { ...; }; }; ... 5 more ...; theme: SerializableThemeArgs | undefined; }
```

#### method: showSubmenuMenuItems

```ts
type showSubmenuMenuItems = () => (
  | {
      label: string
      subMenu: {
        label: string
        type: 'radio'
        checked: boolean
        onClick: () => void
      }[]
    }
  | { label: string; type: 'checkbox'; checked: any; onClick: () => void }
)[]
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

#### method: contextMenuItems

```ts
type contextMenuItems = () => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; subMenu?: undefined; } | { ...; })[]
```

</details>

<details open>
<summary>LinearBasicDisplay - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                   | Signature                                                   |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| [`setSubfeatureLabels`](#action-setsubfeaturelabels)                     | `(value: "none" \| "overlay" \| "below") => void`           |
| [`setGeneGlyphMode`](#action-setgeneglyphmode)                           | `(value: "auto" \| "all" \| "longestCoding") => void`       |
| [`setDisplayMode`](#action-setdisplaymode)                               | `(value: DisplayMode) => void`                              |
| [`setCompactness`](#action-setcompactness)                               | `(level: "normal" \| "compact" \| "super-compact") => void` |
| [`toggleDisplayModeDefault`](#action-toggledisplaymodedefault)           | `() => void`                                                |
| [`setShowOnlyGenes`](#action-setshowonlygenes)                           | `(value: boolean) => void`                                  |
| [`setDisplayDirectionalChevrons`](#action-setdisplaydirectionalchevrons) | `(value: boolean) => void`                                  |
| [`dismissIsoformCollapseNotice`](#action-dismissisoformcollapsenotice)   | `() => void`                                                |

</details>

<details>
<summary>LinearBasicDisplay - Actions (all signatures)</summary>

#### action: setSubfeatureLabels

```ts
type setSubfeatureLabels = (value: 'none' | 'overlay' | 'below') => void
```

#### action: setGeneGlyphMode

```ts
type setGeneGlyphMode = (value: 'auto' | 'all' | 'longestCoding') => void
```

#### action: setDisplayMode

```ts
type setDisplayMode = (value: DisplayMode) => void
```

#### action: setCompactness

```ts
type setCompactness = (level: 'normal' | 'compact' | 'super-compact') => void
```

#### action: toggleDisplayModeDefault

```ts
type toggleDisplayModeDefault = () => void
```

#### action: setShowOnlyGenes

```ts
type setShowOnlyGenes = (value: boolean) => void
```

#### action: setDisplayDirectionalChevrons

```ts
type setDisplayDirectionalChevrons = (value: boolean) => void
```

#### action: dismissIsoformCollapseNotice

```ts
type dismissIsoformCollapseNotice = () => void
```

</details>
