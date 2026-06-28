---
id: lgvsyntenydisplay
title: LGVSyntenyDisplay
sidebar_label: Display -> LGVSyntenyDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LGVSyntenyDisplay.md)

## Example usage

Shows a `SyntenyTrack`'s alignments in a plain linear view (rather than the
two-row synteny view). Same track config as a synteny track — just pick this
display type:

```js
{
  type: 'SyntenyTrack',
  trackId: 'hg38_vs_mm10',
  name: 'hg38 vs mm10',
  assemblyNames: ['hg38', 'mm10'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/hg38_vs_mm10.paf',
    queryAssembly: 'hg38',
    targetAssembly: 'mm10',
  },
  displays: [
    {
      type: 'LGVSyntenyDisplay',
      displayId: 'hg38_vs_mm10-LGVSyntenyDisplay',
    },
  ],
}
```

## Overview

displays location of "synteny" feature in a plain LGV, allowing linking out to
external synteny views

### LGVSyntenyDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/lgvsyntenydisplay).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [LinearAlignmentsDisplay](../linearalignmentsdisplay)

**Properties:** [type](../linearalignmentsdisplay#property-type),
[configuration](../linearalignmentsdisplay#property-configuration),
[linkedReads](../linearalignmentsdisplay#property-linkedreads),
[showBezierConnections](../linearalignmentsdisplay#property-showbezierconnections),
[showCoverage](../linearalignmentsdisplay#property-showcoverage),
[showPileup](../linearalignmentsdisplay#property-showpileup),
[coverageHeight](../linearalignmentsdisplay#property-coverageheight),
[showMismatches](../linearalignmentsdisplay#property-showmismatches),
[showInterbaseIndicators](../linearalignmentsdisplay#property-showinterbaseindicators),
[drawSingletons](../linearalignmentsdisplay#property-drawsingletons),
[drawProperPairs](../linearalignmentsdisplay#property-drawproperpairs),
[flipStrandLongReadChains](../linearalignmentsdisplay#property-flipstrandlongreadchains),
[colorSupplementaryChains](../linearalignmentsdisplay#property-colorsupplementarychains),
[drawInter](../linearalignmentsdisplay#property-drawinter),
[drawLongRange](../linearalignmentsdisplay#property-drawlongrange),
[arcColorByType](../linearalignmentsdisplay#property-arccolorbytype),
[readConnections](../linearalignmentsdisplay#property-readconnections),
[readConnectionsDown](../linearalignmentsdisplay#property-readconnectionsdown),
[showSashimiArcs](../linearalignmentsdisplay#property-showsashimiarcs),
[sashimiArcsMode](../linearalignmentsdisplay#property-sashimiarcsmode),
[minSashimiScore](../linearalignmentsdisplay#property-minsashimiscore),
[sashimiArcsHeight](../linearalignmentsdisplay#property-sashimiarcsheight),
[readConnectionsHeight](../linearalignmentsdisplay#property-readconnectionsheight),
[showSoftClipping](../linearalignmentsdisplay#property-showsoftclipping)

**Volatiles:**
[featureIdUnderMouse](../linearalignmentsdisplay#volatile-featureidundermouse),
[mouseoverExtraInformation](../linearalignmentsdisplay#volatile-mouseoverextrainformation),
[contextMenuFeature](../linearalignmentsdisplay#volatile-contextmenufeature),
[contextMenuCoord](../linearalignmentsdisplay#volatile-contextmenucoord),
[contextMenuCigarHit](../linearalignmentsdisplay#volatile-contextmenucigarhit),
[contextMenuIndicatorHit](../linearalignmentsdisplay#volatile-contextmenuindicatorhit),
[contextMenuRefName](../linearalignmentsdisplay#volatile-contextmenurefname),
[rpcDataMap](../linearalignmentsdisplay#volatile-rpcdatamap),
[scrollTop](../linearalignmentsdisplay#volatile-scrolltop),
[collapsedGroups](../linearalignmentsdisplay#volatile-collapsedgroups),
[groupMaxHeightOverrides](../linearalignmentsdisplay#volatile-groupmaxheightoverrides),
[highlightedChainIds](../linearalignmentsdisplay#volatile-highlightedchainids),
[selectedChainIds](../linearalignmentsdisplay#volatile-selectedchainids),
[colorTagMap](../linearalignmentsdisplay#volatile-colortagmap),
[visibleModifications](../linearalignmentsdisplay#volatile-visiblemodifications),
[modificationsReady](../linearalignmentsdisplay#volatile-modificationsready),
[overCigarItem](../linearalignmentsdisplay#volatile-overcigaritem),
[hoverCoverageBand](../linearalignmentsdisplay#volatile-hovercoverageband)

**Getters:** [isChainMode](../linearalignmentsdisplay#getter-ischainmode),
[showLinkedReadLines](../linearalignmentsdisplay#getter-showlinkedreadlines),
[scaleType](../linearalignmentsdisplay#getter-scaletype),
[autoscaleType](../linearalignmentsdisplay#getter-autoscaletype),
[minScore](../linearalignmentsdisplay#getter-minscore),
[maxScore](../linearalignmentsdisplay#getter-maxscore),
[minScoreBound](../linearalignmentsdisplay#getter-minscorebound),
[maxScoreBound](../linearalignmentsdisplay#getter-maxscorebound),
[numStdDev](../linearalignmentsdisplay#getter-numstddev),
[featureWidgetType](../linearalignmentsdisplay#getter-featurewidgettype),
[selectedFeatureId](../linearalignmentsdisplay#getter-selectedfeatureid),
[TooltipComponent](../linearalignmentsdisplay#getter-tooltipcomponent),
[visibleModificationTypes](../linearalignmentsdisplay#getter-visiblemodificationtypes),
[colorBy](../linearalignmentsdisplay#getter-colorby),
[filterBy](../linearalignmentsdisplay#getter-filterby),
[featureHeight](../linearalignmentsdisplay#getter-featureheight),
[featureSpacing](../linearalignmentsdisplay#getter-featurespacing),
[maxHeight](../linearalignmentsdisplay#getter-maxheight),
[showSashimiLabels](../linearalignmentsdisplay#getter-showsashimilabels),
[chainIdMap](../linearalignmentsdisplay#getter-chainidmap),
[mismatchAlpha](../linearalignmentsdisplay#getter-mismatchalpha),
[showLowFreqMismatches](../linearalignmentsdisplay#getter-showlowfreqmismatches),
[showLegend](../linearalignmentsdisplay#getter-showlegend),
[sortedBy](../linearalignmentsdisplay#getter-sortedby),
[groupBy](../linearalignmentsdisplay#getter-groupby),
[prefersOffset](../linearalignmentsdisplay#getter-prefersoffset),
[coverageIsLog](../linearalignmentsdisplay#getter-coverageislog),
[coverageStats](../linearalignmentsdisplay#getter-coveragestats),
[coverageDomain](../linearalignmentsdisplay#getter-coveragedomain),
[coverageTicks](../linearalignmentsdisplay#getter-coverageticks),
[colorLegendCategories](../linearalignmentsdisplay#getter-colorlegendcategories),
[colorPalette](../linearalignmentsdisplay#getter-colorpalette),
[belowCoverageBandsInput](../linearalignmentsdisplay#getter-belowcoveragebandsinput),
[laidOutByGroup](../linearalignmentsdisplay#getter-laidoutbygroup),
[groupOrder](../linearalignmentsdisplay#getter-grouporder),
[laidOutPileupMap](../linearalignmentsdisplay#getter-laidoutpileupmap),
[sourceSections](../linearalignmentsdisplay#getter-sourcesections),
[maxY](../linearalignmentsdisplay#getter-maxy),
[pileupTruncated](../linearalignmentsdisplay#getter-pileuptruncated),
[rawDataByGroup](../linearalignmentsdisplay#getter-rawdatabygroup),
[arcsByGroup](../linearalignmentsdisplay#getter-arcsbygroup),
[modificationThreshold](../linearalignmentsdisplay#getter-modificationthreshold),
[colorSchemeIndex](../linearalignmentsdisplay#getter-colorschemeindex),
[showModifications](../linearalignmentsdisplay#getter-showmodifications),
[showPerBaseQuality](../linearalignmentsdisplay#getter-showperbasequality),
[showPerBaseLetter](../linearalignmentsdisplay#getter-showperbaseletter),
[totalPileupHeight](../linearalignmentsdisplay#getter-totalpileupheight),
[readIdIndexMap](../linearalignmentsdisplay#getter-readidindexmap),
[readConnectionsLineWidth](../linearalignmentsdisplay#getter-readconnectionslinewidth),
[belowCoverageBands](../linearalignmentsdisplay#getter-belowcoveragebands),
[coverageDisplayHeight](../linearalignmentsdisplay#getter-coveragedisplayheight),
[sections](../linearalignmentsdisplay#getter-sections),
[renderSections](../linearalignmentsdisplay#getter-rendersections),
[sashimiSections](../linearalignmentsdisplay#getter-sashimisections),
[isGrouped](../linearalignmentsdisplay#getter-isgrouped),
[scrollModel](../linearalignmentsdisplay#getter-scrollmodel),
[pileupViewportHeight](../linearalignmentsdisplay#getter-pileupviewportheight),
[pileupContentHeight](../linearalignmentsdisplay#getter-pileupcontentheight),
[scalebarOverlapLeft](../linearalignmentsdisplay#getter-scalebaroverlapleft),
[showOutline](../linearalignmentsdisplay#getter-showoutline),
[visibleLabels](../linearalignmentsdisplay#getter-visiblelabels),
[highlightBoxes](../linearalignmentsdisplay#getter-highlightboxes),
[scrollableHeight](../linearalignmentsdisplay#getter-scrollableheight),
[sortTag](../linearalignmentsdisplay#getter-sorttag),
[renderState](../linearalignmentsdisplay#getter-renderstate),
[arcsYDomainBp](../linearalignmentsdisplay#getter-arcsydomainbp),
[insertSizeTicks](../linearalignmentsdisplay#getter-insertsizeticks),
[featureUnderMouse](../linearalignmentsdisplay#getter-featureundermouse)

**Methods:**
[isGroupCollapsed](../linearalignmentsdisplay#method-isgroupcollapsed),
[hasGroupHeightOverride](../linearalignmentsdisplay#method-hasgroupheightoverride),
[legendItems](../linearalignmentsdisplay#method-legenditems),
[groupLaidOutMap](../linearalignmentsdisplay#method-grouplaidoutmap),
[isGroupTruncated](../linearalignmentsdisplay#method-isgrouptruncated),
[findFeatureInRpcData](../linearalignmentsdisplay#method-findfeatureinrpcdata),
[searchFeatureByID](../linearalignmentsdisplay#method-searchfeaturebyid),
[getFeatureInfoById](../linearalignmentsdisplay#method-getfeatureinfobyid),
[rpcProps](../linearalignmentsdisplay#method-rpcprops),
[trackMenuItems](../linearalignmentsdisplay#method-trackmenuitems),
[contextMenuItems](../linearalignmentsdisplay#method-contextmenuitems)

**Actions:**
[clearMouseoverState](../linearalignmentsdisplay#action-clearmouseoverstate),
[setError](../linearalignmentsdisplay#action-seterror),
[setRegionTooLarge](../linearalignmentsdisplay#action-setregiontoolarge),
[setRpcData](../linearalignmentsdisplay#action-setrpcdata),
[clearDisplaySpecificData](../linearalignmentsdisplay#action-cleardisplayspecificdata),
[setOverCigarItem](../linearalignmentsdisplay#action-setovercigaritem),
[setScrollTop](../linearalignmentsdisplay#action-setscrolltop),
[setHighlightedChainIds](../linearalignmentsdisplay#action-sethighlightedchainids),
[clearHighlights](../linearalignmentsdisplay#action-clearhighlights),
[clearSelection](../linearalignmentsdisplay#action-clearselection),
[setSelectedChainIds](../linearalignmentsdisplay#action-setselectedchainids),
[setColorScheme](../linearalignmentsdisplay#action-setcolorscheme),
[updateColorTagMap](../linearalignmentsdisplay#action-updatecolortagmap),
[setFilterBy](../linearalignmentsdisplay#action-setfilterby),
[setShowOutline](../linearalignmentsdisplay#action-setshowoutline),
[toggleSoftClipping](../linearalignmentsdisplay#action-togglesoftclipping),
[toggleMismatchAlpha](../linearalignmentsdisplay#action-togglemismatchalpha),
[toggleShowLowFreqMismatches](../linearalignmentsdisplay#action-toggleshowlowfreqmismatches),
[setSortedBy](../linearalignmentsdisplay#action-setsortedby),
[setSortedByAtPosition](../linearalignmentsdisplay#action-setsortedbyatposition),
[clearSortedBy](../linearalignmentsdisplay#action-clearsortedby),
[setGroupBy](../linearalignmentsdisplay#action-setgroupby),
[toggleGroupCollapsed](../linearalignmentsdisplay#action-togglegroupcollapsed),
[toggleGroupExpanded](../linearalignmentsdisplay#action-togglegroupexpanded),
[resizeGroupHeight](../linearalignmentsdisplay#action-resizegroupheight),
[setScaleType](../linearalignmentsdisplay#action-setscaletype),
[setAutoscale](../linearalignmentsdisplay#action-setautoscale),
[setMinScore](../linearalignmentsdisplay#action-setminscore),
[setMaxScore](../linearalignmentsdisplay#action-setmaxscore),
[setFeatureHeight](../linearalignmentsdisplay#action-setfeatureheight),
[setFeatureSpacing](../linearalignmentsdisplay#action-setfeaturespacing),
[setMaxHeight](../linearalignmentsdisplay#action-setmaxheight),
[setCompactness](../linearalignmentsdisplay#action-setcompactness),
[setShowSashimiArcs](../linearalignmentsdisplay#action-setshowsashimiarcs),
[setReadConnections](../linearalignmentsdisplay#action-setreadconnections),
[setReadConnectionsDown](../linearalignmentsdisplay#action-setreadconnectionsdown),
[setShowCoverage](../linearalignmentsdisplay#action-setshowcoverage),
[setShowPileup](../linearalignmentsdisplay#action-setshowpileup),
[setCoverageHeight](../linearalignmentsdisplay#action-setcoverageheight),
[setReadConnectionsHeight](../linearalignmentsdisplay#action-setreadconnectionsheight),
[setSashimiArcsHeight](../linearalignmentsdisplay#action-setsashimiarcsheight),
[setMinSashimiScore](../linearalignmentsdisplay#action-setminsashimiscore),
[setSashimiArcsMode](../linearalignmentsdisplay#action-setsashimiarcsmode),
[setShowSashimiLabels](../linearalignmentsdisplay#action-setshowsashimilabels),
[setReadConnectionsLineWidth](../linearalignmentsdisplay#action-setreadconnectionslinewidth),
[setDrawInter](../linearalignmentsdisplay#action-setdrawinter),
[setDrawLongRange](../linearalignmentsdisplay#action-setdrawlongrange),
[setColorByType](../linearalignmentsdisplay#action-setcolorbytype),
[setShowMismatches](../linearalignmentsdisplay#action-setshowmismatches),
[setShowLegend](../linearalignmentsdisplay#action-setshowlegend),
[setDrawSingletons](../linearalignmentsdisplay#action-setdrawsingletons),
[setDrawProperPairs](../linearalignmentsdisplay#action-setdrawproperpairs),
[setShowInterbaseIndicators](../linearalignmentsdisplay#action-setshowinterbaseindicators),
[setFlipStrandLongReadChains](../linearalignmentsdisplay#action-setflipstrandlongreadchains),
[setColorSupplementaryChains](../linearalignmentsdisplay#action-setcolorsupplementarychains),
[setLinkedReads](../linearalignmentsdisplay#action-setlinkedreads),
[setShowBezierConnections](../linearalignmentsdisplay#action-setshowbezierconnections),
[updateVisibleModifications](../linearalignmentsdisplay#action-updatevisiblemodifications),
[setModificationsReady](../linearalignmentsdisplay#action-setmodificationsready),
[setFeatureIdUnderMouse](../linearalignmentsdisplay#action-setfeatureidundermouse),
[setMouseoverExtraInformation](../linearalignmentsdisplay#action-setmouseoverextrainformation),
[setHoverState](../linearalignmentsdisplay#action-sethoverstate),
[setContextMenuFeature](../linearalignmentsdisplay#action-setcontextmenufeature),
[setContextMenuCoord](../linearalignmentsdisplay#action-setcontextmenucoord),
[setContextMenuCigarHit](../linearalignmentsdisplay#action-setcontextmenucigarhit),
[setContextMenuIndicatorHit](../linearalignmentsdisplay#action-setcontextmenuindicatorhit),
[clearContextMenu](../linearalignmentsdisplay#action-clearcontextmenu),
[setContextMenuRefName](../linearalignmentsdisplay#action-setcontextmenurefname),
[selectFeature](../linearalignmentsdisplay#action-selectfeature),
[startRenderingBackend](../linearalignmentsdisplay#action-startrenderingbackend),
[selectFeatureById](../linearalignmentsdisplay#action-selectfeaturebyid),
[setContextMenuFeatureById](../linearalignmentsdisplay#action-setcontextmenufeaturebyid),
[getByteEstimateConfig](../linearalignmentsdisplay#action-getbyteestimateconfig),
[fetchNeeded](../linearalignmentsdisplay#action-fetchneeded),
[renderSvg](../linearalignmentsdisplay#action-rendersvg)

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
<summary>LGVSyntenyDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LGVSyntenyDisplay'>
// code
type: types.literal('LGVSyntenyDisplay')
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(schema)
```

</details>

<details open>
<summary>LGVSyntenyDisplay - Getters</summary>

#### getter: featureWidgetType

```ts
type featureWidgetType = { type: string; id: string }
```

</details>

<details open>
<summary>LGVSyntenyDisplay - Methods</summary>

#### method: contextMenuItems

```ts
type contextMenuItems = () => (
  | {
      label: string
      icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & {
        muiName: string
      }
      onClick: () => void
    }
  | { label: string; onClick: () => void; icon?: undefined }
)[]
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => ({ label: string; type: "subMenu"; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; subMenu: MenuItem[]; } | { ...; } | { ...; })[]
```

</details>

<details open>
<summary>LGVSyntenyDisplay - Actions</summary>

#### action: selectFeature

```ts
type selectFeature = (feature: Feature) => void
```

</details>
