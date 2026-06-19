---
id: wigglecommonmixin
title: WiggleCommonMixin
sidebar_label: Mixin -> WiggleCommonMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/WiggleCommonMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/WiggleCommonMixin.md)

## Overview

Extends WiggleScoreConfigMixin with rpcDataMap, autoscale domain, and cache
reset. Used by LinearWiggleDisplay and MultiLinearWiggleDisplay. Displays that
own a different rpcDataMap type should compose WiggleScoreConfigMixin directly
instead.

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [WiggleScoreConfigMixin](../wigglescoreconfigmixin)

**Properties:** resolution, displayCrossHatches

**Volatiles:** loadedBpPerPx

**Getters:** scalebarOverlapLeft, posColor, negColor, bicolorPivot, scaleType,
autoscaleType, numStdDev, scatterPointSize, summaryScoreMode, renderingType,
minScore, maxScore, minScoreBound, maxScoreBound, hasResolution

**Actions:** toggleCrossHatches, setResolution, setLoadedBpPerPx, setScaleType,
setColor, setMinScore, setMaxScore, setRenderingType, setSummaryScoreMode,
setAutoscale, isCacheValid

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:** configOverrides

**Methods:** getOverride, getConfWithOverride

**Actions:** setOverride, clearOverride

### WiggleCommonMixin - Volatiles

#### volatile: rpcDataMap

```js
// type signature
ObservableMap<number, WiggleDataResult>
// code
rpcDataMap: observable.map<number, WiggleDataResult>()
```

### WiggleCommonMixin - Getters

#### getter: visibleScoreRange

```js
// type
;[number, number] | undefined
```

#### getter: domain

```js
// type
;[number, number] | undefined
```

### WiggleCommonMixin - Actions

#### action: clearDisplaySpecificData

```js
// type signature
clearDisplaySpecificData: () => void
```
