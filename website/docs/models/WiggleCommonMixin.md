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

**Properties:** [resolution](../wigglescoreconfigmixin#property-resolution),
[displayCrossHatches](../wigglescoreconfigmixin#property-displaycrosshatches)

**Volatiles:** [loadedBpPerPx](../wigglescoreconfigmixin#volatile-loadedbpperpx)

**Getters:**
[scalebarOverlapLeft](../wigglescoreconfigmixin#getter-scalebaroverlapleft),
[posColor](../wigglescoreconfigmixin#getter-poscolor),
[negColor](../wigglescoreconfigmixin#getter-negcolor),
[bicolorPivot](../wigglescoreconfigmixin#getter-bicolorpivot),
[scaleType](../wigglescoreconfigmixin#getter-scaletype),
[autoscaleType](../wigglescoreconfigmixin#getter-autoscaletype),
[numStdDev](../wigglescoreconfigmixin#getter-numstddev),
[scatterPointSize](../wigglescoreconfigmixin#getter-scatterpointsize),
[summaryScoreMode](../wigglescoreconfigmixin#getter-summaryscoremode),
[renderingType](../wigglescoreconfigmixin#getter-renderingtype),
[minScore](../wigglescoreconfigmixin#getter-minscore),
[maxScore](../wigglescoreconfigmixin#getter-maxscore),
[minScoreBound](../wigglescoreconfigmixin#getter-minscorebound),
[maxScoreBound](../wigglescoreconfigmixin#getter-maxscorebound),
[hasResolution](../wigglescoreconfigmixin#getter-hasresolution)

**Actions:**
[toggleCrossHatches](../wigglescoreconfigmixin#action-togglecrosshatches),
[setResolution](../wigglescoreconfigmixin#action-setresolution),
[setLoadedBpPerPx](../wigglescoreconfigmixin#action-setloadedbpperpx),
[setScaleType](../wigglescoreconfigmixin#action-setscaletype),
[setMinScore](../wigglescoreconfigmixin#action-setminscore),
[setMaxScore](../wigglescoreconfigmixin#action-setmaxscore),
[setRenderingType](../wigglescoreconfigmixin#action-setrenderingtype),
[setSummaryScoreMode](../wigglescoreconfigmixin#action-setsummaryscoremode),
[setAutoscale](../wigglescoreconfigmixin#action-setautoscale),
[isCacheValid](../wigglescoreconfigmixin#action-iscachevalid)

<details open>
<summary>WiggleCommonMixin - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                               | Signature                                 |
| ------------------------------------ | ----------------------------------------- |
| [`rpcDataMap`](#volatile-rpcdatamap) | `ObservableMap<number, WiggleDataResult>` |

</details>

<details>
<summary>WiggleCommonMixin - Volatiles (all signatures)</summary>

#### volatile: rpcDataMap

```ts
// type signature
type rpcDataMap = ObservableMap<number, WiggleDataResult>
// code
rpcDataMap: observable.map<number, WiggleDataResult>()
```

</details>

<details open>
<summary>WiggleCommonMixin - Getters</summary>

#### getter: hasNoData

True once a fetch has completed (loadedBpPerPx set) but every loaded region came
back with zero features — lets the display show a "no data" message instead of
an ambiguous flat baseline at score 0.

```ts
type hasNoData = boolean
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                           | Signature                       |
| ------------------------------------------------ | ------------------------------- |
| [`visibleScoreRange`](#getter-visiblescorerange) | `[number, number] \| undefined` |
| [`domain`](#getter-domain)                       | `[number, number] \| undefined` |

</details>

<details>
<summary>WiggleCommonMixin - Getters (all signatures)</summary>

#### getter: visibleScoreRange

```ts
type visibleScoreRange = [number, number] | undefined
```

#### getter: domain

```ts
type domain = [number, number] | undefined
```

</details>

<details open>
<summary>WiggleCommonMixin - Actions</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                         | Signature    |
| -------------------------------------------------------------- | ------------ |
| [`clearDisplaySpecificData`](#action-cleardisplayspecificdata) | `() => void` |

</details>

<details>
<summary>WiggleCommonMixin - Actions (all signatures)</summary>

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

</details>
