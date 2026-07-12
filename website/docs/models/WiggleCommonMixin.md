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

| Member                                                       | Kind       | Defined by                                          | Description                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | ---------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [rpcDataMap](#volatile-rpcdatamap)                           | Volatiles  | WiggleCommonMixin                                   |                                                                                                                                                                                                                                                                                                                    |
| [featureUnderMouse](#volatile-featureundermouse)             | Volatiles  | WiggleCommonMixin                                   |                                                                                                                                                                                                                                                                                                                    |
| [autoscaleSourceNames](#getter-autoscalesourcenames)         | Getters    | WiggleCommonMixin                                   | Source names to include when computing the autoscale domain; `undefined` means every fetched source. Multi-wiggle always fetches all sources and filters client-side, so it overrides this to the visible subset — otherwise a subtree filter that hides sources would leave the Y-axis scaled to the hidden ones. |
| [visibleScoreRange](#getter-visiblescorerange)               | Getters    | WiggleCommonMixin                                   |                                                                                                                                                                                                                                                                                                                    |
| [domain](#getter-domain)                                     | Getters    | WiggleCommonMixin                                   |                                                                                                                                                                                                                                                                                                                    |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata) | Actions    | WiggleCommonMixin                                   |                                                                                                                                                                                                                                                                                                                    |
| [setFeatureUnderMouse](#action-setfeatureundermouse)         | Actions    | WiggleCommonMixin                                   |                                                                                                                                                                                                                                                                                                                    |
| [selectFeature](#action-selectfeature)                       | Actions    | WiggleCommonMixin                                   |                                                                                                                                                                                                                                                                                                                    |
| [resolution](#property-resolution)                           | Properties | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [displayCrossHatches](#property-displaycrosshatches)         | Properties | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [loadedBpPerPx](#volatile-loadedbpperpx)                     | Volatiles  | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [scalebarOverlapLeft](#getter-scalebaroverlapleft)           | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [posColor](#getter-poscolor)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [negColor](#getter-negcolor)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [bicolorPivot](#getter-bicolorpivot)                         | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [scaleType](#getter-scaletype)                               | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [autoscaleType](#getter-autoscaletype)                       | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [numStdDev](#getter-numstddev)                               | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [scatterPointSize](#getter-scatterpointsize)                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [lineWidth](#getter-linewidth)                               | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [summaryScoreMode](#getter-summaryscoremode)                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [renderingType](#getter-renderingtype)                       | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [minScore](#getter-minscore)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [maxScore](#getter-maxscore)                                 | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [minScoreBound](#getter-minscorebound)                       | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [maxScoreBound](#getter-maxscorebound)                       | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [hasResolution](#getter-hasresolution)                       | Getters    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [toggleCrossHatches](#action-togglecrosshatches)             | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [setResolution](#action-setresolution)                       | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [setLoadedBpPerPx](#action-setloadedbpperpx)                 | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [setScaleType](#action-setscaletype)                         | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [setMinScore](#action-setminscore)                           | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [setMaxScore](#action-setmaxscore)                           | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [setRenderingType](#action-setrenderingtype)                 | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [setSummaryScoreMode](#action-setsummaryscoremode)           | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [setScatterPointSize](#action-setscatterpointsize)           | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [setLineWidth](#action-setlinewidth)                         | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [setAutoscale](#action-setautoscale)                         | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) |                                                                                                                                                                                                                                                                                                                    |
| [isCacheValid](#action-iscachevalid)                         | Actions    | [WiggleScoreConfigMixin](../wigglescoreconfigmixin) | Strict zoom equality: see adr-008.                                                                                                                                                                                                                                                                                 |

<details>
<summary>WiggleCommonMixin - Volatiles</summary>

#### volatile: rpcDataMap

```ts
// type signature
type rpcDataMap = ObservableMap<number, WiggleDataResult>
// code
rpcDataMap: observable.map<number, WiggleDataResult>()
```

#### volatile: featureUnderMouse

```ts
// type signature
type featureUnderMouse = WiggleFeatureUnderMouse | undefined
// code
featureUnderMouse: undefined as WiggleFeatureUnderMouse | undefined
```

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

</details>

<details>
<summary>WiggleCommonMixin - Getters (other undocumented members)</summary>

#### getter: visibleScoreRange

```ts
type visibleScoreRange = [number, number] | undefined
```

#### getter: domain

```ts
type domain = [number, number] | undefined
```

</details>

<details>
<summary>WiggleCommonMixin - Actions</summary>

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

#### action: setFeatureUnderMouse

```ts
type setFeatureUnderMouse = (feat?: WiggleFeatureUnderMouse | undefined) => void
```

#### action: selectFeature

```ts
type selectFeature = (feat: WiggleFeatureUnderMouse) => void
```

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from WiggleScoreConfigMixin</summary>

[WiggleScoreConfigMixin →](../wigglescoreconfigmixin)

**Properties**

#### property: resolution

```ts
// type signature
type resolution = IOptionalIType<ISimpleType<number>, [undefined]>
// code
resolution: types.stripDefault(types.number, 1)
```

#### property: displayCrossHatches

```ts
// type signature
type displayCrossHatches = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
displayCrossHatches: types.stripDefault(types.boolean, false)
```

**Volatiles**

#### volatile: loadedBpPerPx

```ts
// type signature
type loadedBpPerPx = number | undefined
// code
loadedBpPerPx: undefined as number | undefined
```

**Getters**

#### getter: scalebarOverlapLeft

```ts
type scalebarOverlapLeft = number
```

#### getter: posColor

```ts
type posColor = string
```

#### getter: negColor

```ts
type negColor = string
```

#### getter: bicolorPivot

```ts
type bicolorPivot = number
```

#### getter: scaleType

```ts
type scaleType = string
```

#### getter: autoscaleType

```ts
type autoscaleType = string
```

#### getter: numStdDev

```ts
type numStdDev = number
```

#### getter: scatterPointSize

```ts
type scatterPointSize = number
```

#### getter: lineWidth

```ts
type lineWidth = number
```

#### getter: summaryScoreMode

```ts
type summaryScoreMode = string
```

#### getter: renderingType

```ts
type renderingType = string
```

#### getter: minScore

```ts
type minScore = number
```

#### getter: maxScore

```ts
type maxScore = number
```

#### getter: minScoreBound

```ts
type minScoreBound = number | undefined
```

#### getter: maxScoreBound

```ts
type maxScoreBound = number | undefined
```

#### getter: hasResolution

```ts
type hasResolution = boolean
```

**Actions**

#### action: toggleCrossHatches

```ts
type toggleCrossHatches = () => void
```

#### action: setResolution

```ts
type setResolution = (res: number) => void
```

#### action: setLoadedBpPerPx

```ts
type setLoadedBpPerPx = (bpPerPx: number | undefined) => void
```

#### action: setScaleType

```ts
type setScaleType = (scaleType: string) => void
```

#### action: setMinScore

```ts
type setMinScore = (val?: number | undefined) => void
```

#### action: setMaxScore

```ts
type setMaxScore = (val?: number | undefined) => void
```

#### action: setRenderingType

```ts
type setRenderingType = (type: string) => void
```

#### action: setSummaryScoreMode

```ts
type setSummaryScoreMode = (val: string) => void
```

#### action: setScatterPointSize

```ts
type setScatterPointSize = (val?: number | undefined) => void
```

#### action: setLineWidth

```ts
type setLineWidth = (val?: number | undefined) => void
```

#### action: setAutoscale

```ts
type setAutoscale = (val?: string | undefined) => void
```

#### action: isCacheValid

Strict zoom equality: see adr-008.

```ts
type isCacheValid = (_displayedRegionIndex: number) => boolean
```

</details>
