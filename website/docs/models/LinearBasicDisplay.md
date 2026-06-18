---
id: linearbasicdisplay
title: LinearBasicDisplay
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

**Properties:** configuration

**Volatiles:** rpcDataMap, densityStatsPerRegion, featureIdUnderMouse,
subfeatureIdUnderMouse, mouseoverExtraInformation, contextMenuFeature,
contextMenuInfo, userFeatureDensityLimit, byteEstimateVisibleBp,
heightBeforeExpand, incrementalLayout

**Getters:** conf, visibleFeatureDensityPerPx, renderState,
DisplayMessageComponent, showTooltipsEnabled, showLegend, maxHeight, autoHeight,
displayMode, showLabelsMode, showLabels, showDescriptions, showOutline,
featureColor, utrColor, colorByMode, colorByAttribute,
effectiveShowDescriptions, selectedFeatureId, maxFeatureDensity, colorByCDS,
sequenceAdapter, regionKeys, reversedRegions, featureWidgetType,
estimatedVisibleBytes, bytesEstimateTooLarge, densityTooLarge, regionTooLarge,
regionTooLargeReason, laidOutDataMap, maxY, hasOverflow, featureIdIndex,
subfeatureIdIndex, hoveredFeature, hoveredSubfeature, featureItemMap,
flatbushIndexes

**Methods:** rpcProps, getFeatureById, searchFeatureByID, renderSvg,
showSubmenuMenuItems, contextMenuItems, colorBySubMenuItems, colorMenuItems,
trackMenuItems

**Actions:** expandToFit, collapseFromExpand, clearHeightBeforeExpand,
setRpcData, setDensityStats, clearDisplaySpecificData, pruneRpcDataMapToVisible,
startRenderingBackend, setFeatureDensityStatsLimit, setHover, clearHover,
setContextMenuFeature, setContextMenuInfo, selectFeature, clearSelection,
setShowLabels, setAutoHeight, setShowDescriptions, setShowOutline,
setFeatureColor, setUtrColor, showContextMenuForFeature, openSetColorDialog,
openColorByAttributeDialog, fetchFullFeature, selectFeatureById, isCacheValid,
getByteEstimateConfig, selectFullFeature, reload, fetchNeeded,
setFeatureDensityStats, clearStaleDensityState, afterAttach

### Available via [BaseDisplay](../basedisplay)

**Properties:** id, type, rpcDriverName

**Volatiles:** error, statusMessage

**Getters:** parentTrack, parentDisplay, RenderingComponent, DisplayBlurb,
adapterConfig, isMinimized, effectiveRpcDriverName, effectiveTrackConfig,
DisplayMessageComponent, viewMenuActions

**Methods:** renderProps, renderingProps, trackMenuItems, regionCannotBeRendered

**Actions:** setStatusMessage, setError, setRpcDriverName, reload

### Available via [TrackHeightMixin](../trackheightmixin)

**Properties:** heightOverride

**Volatiles:** scrollTop

**Getters:** height

**Actions:** setScrollTop, setHeight, resizeHeight

### Available via [MultiRegionDisplayMixin](../multiregiondisplaymixin)

**Volatiles:** loadedRegions

**Getters:** isReady, viewportWithinLoadedData, renderBlocks, displayPhase,
loadingOverlayVisible

**Actions:** setLoadedRegion, clearDisplaySpecificData, clearAllRpcData, reload,
invalidateLoadedRegions, fetchNeeded, isCacheValid, getByteEstimateConfig,
fetchRegions, afterAttach

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:** userByteSizeLimit

**Volatiles:** regionTooLargeState, regionTooLargeReasonState,
featureDensityStats

**Getters:** regionTooLarge, regionTooLargeReason

**Methods:** regionCannotBeRenderedText

**Actions:** setRegionTooLarge, setFeatureDensityStats,
setFeatureDensityStatsLimit, reload, forceLoad

### Available via [RenderLifecycleMixin](../renderlifecyclemixin)

**Volatiles:** canvasDrawn, currentRenderingBackend, renderTick,
autorunsInstalled, renderError

**Actions:** markCanvasDrawn, resetCanvasDrawn, stopRenderingBackend, renderNow,
setRenderError, attachRenderingBackend

### Available via [FetchMixin](../fetchmixin)

**Volatiles:** activeStopToken, fetchGeneration, error, statusMessage

**Getters:** isLoading

**Actions:** setError, setStatusMessage, cancelFetch, runFetch

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:** configOverrides

**Methods:** getOverride, getConfWithOverride

**Actions:** setOverride, clearOverride

### LinearBasicDisplay - Getters

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

### LinearBasicDisplay - Methods

#### method: rpcProps

```js
// type signature
rpcProps: () => { displayConfig: { geneGlyphMode: "auto" | "all" | "longestCoding"; subfeatureLabels: "none" | "overlay" | "below"; transcriptTypes: string[]; containerTypes: string[]; subParts: string; ... 7 more ...; labels: { ...; }; }; showOnlyGenes: boolean; maxFeatureDensity: number | undefined; colorByCDS: boolean; the...
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

### LinearBasicDisplay - Actions

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
