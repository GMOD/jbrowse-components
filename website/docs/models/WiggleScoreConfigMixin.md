---
id: wigglescoreconfigmixin
title: WiggleScoreConfigMixin
sidebar_label: Mixin -> WiggleScoreConfigMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`wiggle` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/WiggleScoreConfigMixin.ts).

## Overview

Score/scale/color config and isCacheValid for wiggle-family displays. Does NOT
include rpcDataMap or autoscale domain computation — those live in
WiggleCommonMixin, which composes this. Displays that own their own rpcDataMap
type (e.g. LinearManhattanDisplay) should compose this instead.

## Members

| Member                                               | Kind       | Description                        |
| ---------------------------------------------------- | ---------- | ---------------------------------- |
| [resolution](#property-resolution)                   | Properties |                                    |
| [displayCrossHatches](#property-displaycrosshatches) | Properties |                                    |
| [loadedBpPerPx](#volatile-loadedbpperpx)             | Volatiles  |                                    |
| [scalebarOverlapLeft](#getter-scalebaroverlapleft)   | Getters    |                                    |
| [posColor](#getter-poscolor)                         | Getters    |                                    |
| [negColor](#getter-negcolor)                         | Getters    |                                    |
| [bicolorPivot](#getter-bicolorpivot)                 | Getters    |                                    |
| [scaleType](#getter-scaletype)                       | Getters    |                                    |
| [autoscaleType](#getter-autoscaletype)               | Getters    |                                    |
| [numStdDev](#getter-numstddev)                       | Getters    |                                    |
| [scatterPointSize](#getter-scatterpointsize)         | Getters    |                                    |
| [lineWidth](#getter-linewidth)                       | Getters    |                                    |
| [summaryScoreMode](#getter-summaryscoremode)         | Getters    |                                    |
| [renderingType](#getter-renderingtype)               | Getters    |                                    |
| [minScore](#getter-minscore)                         | Getters    |                                    |
| [maxScore](#getter-maxscore)                         | Getters    |                                    |
| [minScoreBound](#getter-minscorebound)               | Getters    |                                    |
| [maxScoreBound](#getter-maxscorebound)               | Getters    |                                    |
| [hasResolution](#getter-hasresolution)               | Getters    |                                    |
| [toggleCrossHatches](#action-togglecrosshatches)     | Actions    |                                    |
| [setResolution](#action-setresolution)               | Actions    |                                    |
| [setLoadedBpPerPx](#action-setloadedbpperpx)         | Actions    |                                    |
| [setScaleType](#action-setscaletype)                 | Actions    |                                    |
| [setMinScore](#action-setminscore)                   | Actions    |                                    |
| [setMaxScore](#action-setmaxscore)                   | Actions    |                                    |
| [setRenderingType](#action-setrenderingtype)         | Actions    |                                    |
| [setSummaryScoreMode](#action-setsummaryscoremode)   | Actions    |                                    |
| [setScatterPointSize](#action-setscatterpointsize)   | Actions    |                                    |
| [setLineWidth](#action-setlinewidth)                 | Actions    |                                    |
| [setAutoscale](#action-setautoscale)                 | Actions    |                                    |
| [isCacheValid](#action-iscachevalid)                 | Actions    | Strict zoom equality: see adr-008. |

<details>
<summary>WiggleScoreConfigMixin - Properties</summary>

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

</details>

<details>
<summary>WiggleScoreConfigMixin - Volatiles</summary>

#### volatile: loadedBpPerPx

```ts
// type signature
type loadedBpPerPx = number | undefined
// code
loadedBpPerPx: undefined as number | undefined
```

</details>

<details>
<summary>WiggleScoreConfigMixin - Getters</summary>

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

</details>

<details>
<summary>WiggleScoreConfigMixin - Actions</summary>

#### action: isCacheValid

Strict zoom equality: see adr-008.

```ts
type isCacheValid = (_displayedRegionIndex: number) => boolean
```

</details>

<details>
<summary>WiggleScoreConfigMixin - Actions (other undocumented members)</summary>

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

</details>
