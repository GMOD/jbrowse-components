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

| Member                                               | Kind       | Defined by             | Description                        |
| ---------------------------------------------------- | ---------- | ---------------------- | ---------------------------------- |
| [resolution](#property-resolution)                   | Properties | WiggleScoreConfigMixin |                                    |
| [displayCrossHatches](#property-displaycrosshatches) | Properties | WiggleScoreConfigMixin |                                    |
| [loadedBpPerPx](#volatile-loadedbpperpx)             | Volatiles  | WiggleScoreConfigMixin |                                    |
| [scalebarOverlapLeft](#getter-scalebaroverlapleft)   | Getters    | WiggleScoreConfigMixin |                                    |
| [posColor](#getter-poscolor)                         | Getters    | WiggleScoreConfigMixin |                                    |
| [negColor](#getter-negcolor)                         | Getters    | WiggleScoreConfigMixin |                                    |
| [bicolorPivot](#getter-bicolorpivot)                 | Getters    | WiggleScoreConfigMixin |                                    |
| [scaleType](#getter-scaletype)                       | Getters    | WiggleScoreConfigMixin |                                    |
| [autoscaleType](#getter-autoscaletype)               | Getters    | WiggleScoreConfigMixin |                                    |
| [numStdDev](#getter-numstddev)                       | Getters    | WiggleScoreConfigMixin |                                    |
| [scatterPointSize](#getter-scatterpointsize)         | Getters    | WiggleScoreConfigMixin |                                    |
| [lineWidth](#getter-linewidth)                       | Getters    | WiggleScoreConfigMixin |                                    |
| [summaryScoreMode](#getter-summaryscoremode)         | Getters    | WiggleScoreConfigMixin |                                    |
| [renderingType](#getter-renderingtype)               | Getters    | WiggleScoreConfigMixin |                                    |
| [minScore](#getter-minscore)                         | Getters    | WiggleScoreConfigMixin |                                    |
| [maxScore](#getter-maxscore)                         | Getters    | WiggleScoreConfigMixin |                                    |
| [minScoreBound](#getter-minscorebound)               | Getters    | WiggleScoreConfigMixin |                                    |
| [maxScoreBound](#getter-maxscorebound)               | Getters    | WiggleScoreConfigMixin |                                    |
| [hasResolution](#getter-hasresolution)               | Getters    | WiggleScoreConfigMixin |                                    |
| [toggleCrossHatches](#action-togglecrosshatches)     | Actions    | WiggleScoreConfigMixin |                                    |
| [setResolution](#action-setresolution)               | Actions    | WiggleScoreConfigMixin |                                    |
| [setLoadedBpPerPx](#action-setloadedbpperpx)         | Actions    | WiggleScoreConfigMixin |                                    |
| [setScaleType](#action-setscaletype)                 | Actions    | WiggleScoreConfigMixin |                                    |
| [setMinScore](#action-setminscore)                   | Actions    | WiggleScoreConfigMixin |                                    |
| [setMaxScore](#action-setmaxscore)                   | Actions    | WiggleScoreConfigMixin |                                    |
| [setRenderingType](#action-setrenderingtype)         | Actions    | WiggleScoreConfigMixin |                                    |
| [setSummaryScoreMode](#action-setsummaryscoremode)   | Actions    | WiggleScoreConfigMixin |                                    |
| [setScatterPointSize](#action-setscatterpointsize)   | Actions    | WiggleScoreConfigMixin |                                    |
| [setLineWidth](#action-setlinewidth)                 | Actions    | WiggleScoreConfigMixin |                                    |
| [setAutoscale](#action-setautoscale)                 | Actions    | WiggleScoreConfigMixin |                                    |
| [isCacheValid](#action-iscachevalid)                 | Actions    | WiggleScoreConfigMixin | Strict zoom equality: see adr-008. |

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
