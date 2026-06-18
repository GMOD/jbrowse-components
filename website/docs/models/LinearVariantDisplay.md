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

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [LinearCanvasBaseDisplay](../linearcanvasbasedisplay)

**Properties:** configuration, jexlFiltersSetting

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

**Methods:** activeFilters, rpcProps, getFeatureById, searchFeatureByID,
renderSvg, showSubmenuMenuItems, contextMenuItems, colorBySubMenuItems,
colorMenuItems, trackMenuItems

**Actions:** expandToFit, collapseFromExpand, clearHeightBeforeExpand,
setRpcData, setDensityStats, clearDisplaySpecificData, pruneRpcDataMapToVisible,
startRenderingBackend, setFeatureDensityStatsLimit, setHover, clearHover,
setContextMenuFeature, setContextMenuInfo, selectFeature, clearSelection,
setShowLabels, setAutoHeight, setShowDescriptions, setJexlFilters,
setShowOutline, setFeatureColor, setUtrColor, showContextMenuForFeature,
openSetColorDialog, openColorByAttributeDialog, openFilterDialog,
fetchFullFeature, selectFeatureById, isCacheValid, getByteEstimateConfig,
selectFullFeature, reload, fetchNeeded, setFeatureDensityStats,
clearStaleDensityState, afterAttach

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

**Volatiles:** activeStopToken, fetchGeneration, error, statusMessage,
statusProgress, regionStatuses

**Getters:** isLoading

**Actions:** setError, setStatusMessage, setRegionStatus, cancelFetch, runFetch

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:** configOverrides

**Methods:** getOverride, getConfWithOverride

**Actions:** setOverride, clearOverride

### LinearVariantDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearVariantDisplay">
// code
type: types.literal('LinearVariantDisplay')
```

### LinearVariantDisplay - Getters

#### getter: featureWidgetType

```js
// type
{
  type: string
  id: string
}
```

### LinearVariantDisplay - Methods

#### method: colorMenuItems

```js
// type signature
colorMenuItems: () => { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; subMenu: { label: string; type: "radio"; checked: boolean; onClick: () => void; }[]; }[]
```
