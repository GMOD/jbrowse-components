---
id: wigglecommonmixin
title: WiggleCommonMixin
sidebar_label: Mixin -> WiggleCommonMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`wiggle` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/WiggleCommonMixin.ts).

## Overview

Extends WiggleScoreConfigMixin with rpcDataMap, autoscale domain, and cache
reset. Used by LinearWiggleDisplay and MultiLinearWiggleDisplay. Displays that
own a different rpcDataMap type should compose WiggleScoreConfigMixin directly
instead.

## Members

| Member                                                       | Kind       | Defined by                                          | Description                                                                                          |
| ------------------------------------------------------------ | ---------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [rpcDataMap](#volatile-rpcdatamap)                           | Volatiles  | WiggleCommonMixin                                   |                                                                                                      |
| [featureUnderMouse](#volatile-featureundermouse)             | Volatiles  | WiggleCommonMixin                                   |                                                                                                      |
| [autoscaleSourceNames](#getter-autoscalesourcenames)         | Getters    | WiggleCommonMixin                                   | Source names to include when computing the autoscale domain; `undefined` means every fetched source. |
| [visibleScoreRange](#getter-visiblescorerange)               | Getters    | WiggleCommonMixin                                   |                                                                                                      |
| [dataRange](#getter-datarange)                               | Getters    | WiggleCommonMixin                                   | The true, unclipped `[min, max]` of the visible data.                                                |
| [domain](#getter-domain)                                     | Getters    | WiggleCommonMixin                                   |                                                                                                      |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata) | Actions    | WiggleCommonMixin                                   |                                                                                                      |
| [setFeatureUnderMouse](#action-setfeatureundermouse)         | Actions    | WiggleCommonMixin                                   |                                                                                                      |
| [selectFeature](#action-selectfeature)                       | Actions    | WiggleCommonMixin                                   |                                                                                                      |
| [resolution](#property-resolution)                           | Properties | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [displayCrossHatches](#property-displaycrosshatches)         | Properties | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [loadedBpPerPx](#volatile-loadedbpperpx)                     | Volatiles  | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [scalebarOverlapLeft](#getter-scalebaroverlapleft)           | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [posColor](#getter-poscolor)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [negColor](#getter-negcolor)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [bicolorPivot](#getter-bicolorpivot)                         | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [scaleType](#getter-scaletype)                               | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [autoscaleType](#getter-autoscaletype)                       | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [numStdDev](#getter-numstddev)                               | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [numQuantile](#getter-numquantile)                           | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [scatterPointSize](#getter-scatterpointsize)                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [lineWidth](#getter-linewidth)                               | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [summaryScoreMode](#getter-summaryscoremode)                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [renderingType](#getter-renderingtype)                       | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [minScore](#getter-minscore)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [maxScore](#getter-maxscore)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [minScoreBound](#getter-minscorebound)                       | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [maxScoreBound](#getter-maxscorebound)                       | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [hasResolution](#getter-hasresolution)                       | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [toggleCrossHatches](#action-togglecrosshatches)             | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [setResolution](#action-setresolution)                       | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [setLoadedBpPerPx](#action-setloadedbpperpx)                 | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [setScaleType](#action-setscaletype)                         | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [setBicolorPivot](#action-setbicolorpivot)                   | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [setMinScore](#action-setminscore)                           | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [setMaxScore](#action-setmaxscore)                           | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [setRenderingType](#action-setrenderingtype)                 | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [setSummaryScoreMode](#action-setsummaryscoremode)           | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [setScatterPointSize](#action-setscatterpointsize)           | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [setLineWidth](#action-setlinewidth)                         | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [setAutoscale](#action-setautoscale)                         | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                      |
| [isCacheValid](#action-iscachevalid)                         | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) | Strict zoom equality: see adr-008.                                                                   |

<details>
<summary>WiggleCommonMixin - Volatiles</summary>

| Member                                                         | Type                                      |
| -------------------------------------------------------------- | ----------------------------------------- |
| <span id="volatile-rpcdatamap">rpcDataMap</span>               | `ObservableMap<number, WiggleDataResult>` |
| <span id="volatile-featureundermouse">featureUnderMouse</span> | `WiggleFeatureUnderMouse \| undefined`    |

</details>

<details>
<summary>WiggleCommonMixin - Getters</summary>

#### getter: autoscaleSourceNames

Source names to include when computing the autoscale domain; `undefined` means
every fetched source. Multi-wiggle always fetches all sources and filters
client-side, so it overrides this to the visible subset — otherwise a subtree
filter that hides sources would leave the Y-axis scaled to the hidden ones.

```ts
type autoscaleSourceNames = Set<string> | undefined
```

#### getter: dataRange

The true, unclipped `[min, max]` of the visible data. The displayed `domain` may
clip this (localpercentile/localsd/fixed bounds), so the score legend compares
the two to flag clipped signal.

```ts
type dataRange = [number, number] | undefined
```

</details>

<details>
<summary>WiggleCommonMixin - Getters (other undocumented members)</summary>

| Member                                                       | Type                            |
| ------------------------------------------------------------ | ------------------------------- |
| <span id="getter-visiblescorerange">visibleScoreRange</span> | `[number, number] \| undefined` |
| <span id="getter-domain">domain</span>                       | `[number, number] \| undefined` |

</details>

<details>
<summary>WiggleCommonMixin - Actions</summary>

| Member                                                                     | Type                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------- |
| <span id="action-cleardisplayspecificdata">clearDisplaySpecificData</span> | `() => void`                                            |
| <span id="action-setfeatureundermouse">setFeatureUnderMouse</span>         | `(feat?: WiggleFeatureUnderMouse \| undefined) => void` |
| <span id="action-selectfeature">selectFeature</span>                       | `(feat: WiggleFeatureUnderMouse) => void`               |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from WiggleScoreConfigMixin</summary>

[WiggleScoreConfigMixin →](../wigglescoreconfigmixin)

**Properties**

| Member                                                             | Type                                                |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| <span id="property-resolution">resolution</span>                   | `IOptionalIType<ISimpleType<number>, [undefined]>`  |
| <span id="property-displaycrosshatches">displayCrossHatches</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |

**Volatiles**

| Member                                                 | Type                  |
| ------------------------------------------------------ | --------------------- |
| <span id="volatile-loadedbpperpx">loadedBpPerPx</span> | `number \| undefined` |

**Getters**

| Member                                                           | Type                  |
| ---------------------------------------------------------------- | --------------------- |
| <span id="getter-scalebaroverlapleft">scalebarOverlapLeft</span> | `number`              |
| <span id="getter-poscolor">posColor</span>                       | `string`              |
| <span id="getter-negcolor">negColor</span>                       | `string`              |
| <span id="getter-bicolorpivot">bicolorPivot</span>               | `number`              |
| <span id="getter-scaletype">scaleType</span>                     | `string`              |
| <span id="getter-autoscaletype">autoscaleType</span>             | `string`              |
| <span id="getter-numstddev">numStdDev</span>                     | `number`              |
| <span id="getter-numquantile">numQuantile</span>                 | `number`              |
| <span id="getter-scatterpointsize">scatterPointSize</span>       | `number`              |
| <span id="getter-linewidth">lineWidth</span>                     | `number`              |
| <span id="getter-summaryscoremode">summaryScoreMode</span>       | `string`              |
| <span id="getter-renderingtype">renderingType</span>             | `string`              |
| <span id="getter-minscore">minScore</span>                       | `number`              |
| <span id="getter-maxscore">maxScore</span>                       | `number`              |
| <span id="getter-minscorebound">minScoreBound</span>             | `number \| undefined` |
| <span id="getter-maxscorebound">maxScoreBound</span>             | `number \| undefined` |
| <span id="getter-hasresolution">hasResolution</span>             | `boolean`             |

**Actions**

#### action: isCacheValid

Strict zoom equality: see adr-008.

```ts
type isCacheValid = (_displayedRegionIndex: number) => boolean
```

| Member                                                           | Type                                     |
| ---------------------------------------------------------------- | ---------------------------------------- |
| <span id="action-togglecrosshatches">toggleCrossHatches</span>   | `() => void`                             |
| <span id="action-setresolution">setResolution</span>             | `(res: number) => void`                  |
| <span id="action-setloadedbpperpx">setLoadedBpPerPx</span>       | `(bpPerPx: number \| undefined) => void` |
| <span id="action-setscaletype">setScaleType</span>               | `(scaleType: string) => void`            |
| <span id="action-setbicolorpivot">setBicolorPivot</span>         | `(val?: number \| undefined) => void`    |
| <span id="action-setminscore">setMinScore</span>                 | `(val?: number \| undefined) => void`    |
| <span id="action-setmaxscore">setMaxScore</span>                 | `(val?: number \| undefined) => void`    |
| <span id="action-setrenderingtype">setRenderingType</span>       | `(type: string) => void`                 |
| <span id="action-setsummaryscoremode">setSummaryScoreMode</span> | `(val: string) => void`                  |
| <span id="action-setscatterpointsize">setScatterPointSize</span> | `(val?: number \| undefined) => void`    |
| <span id="action-setlinewidth">setLineWidth</span>               | `(val?: number \| undefined) => void`    |
| <span id="action-setautoscale">setAutoscale</span>               | `(val?: string \| undefined) => void`    |

</details>
