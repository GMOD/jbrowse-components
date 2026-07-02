---
id: wigglescoreconfigmixin
title: WiggleScoreConfigMixin
sidebar_label: Mixin -> WiggleScoreConfigMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/WiggleScoreConfigMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/WiggleScoreConfigMixin.md)

## Overview

Score/scale/color config and isCacheValid for wiggle-family displays. Does NOT
include rpcDataMap or autoscale domain computation — those live in
WiggleCommonMixin, which composes this. Displays that own their own rpcDataMap
type (e.g. LinearManhattanDisplay) should compose this instead.

<details open>
<summary>WiggleScoreConfigMixin - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                 | Signature                                           |
| ------------------------------------------------------ | --------------------------------------------------- |
| [`resolution`](#property-resolution)                   | `IOptionalIType<ISimpleType<number>, [undefined]>`  |
| [`displayCrossHatches`](#property-displaycrosshatches) | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |

</details>

<details>
<summary>WiggleScoreConfigMixin - Properties (all signatures)</summary>

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

<details open>
<summary>WiggleScoreConfigMixin - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature             |
| ------------------------------------------ | --------------------- |
| [`loadedBpPerPx`](#volatile-loadedbpperpx) | `number \| undefined` |

</details>

<details>
<summary>WiggleScoreConfigMixin - Volatiles (all signatures)</summary>

#### volatile: loadedBpPerPx

```ts
// type signature
type loadedBpPerPx = number | undefined
// code
loadedBpPerPx: undefined as number | undefined
```

</details>

<details open>
<summary>WiggleScoreConfigMixin - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                               | Signature             |
| ---------------------------------------------------- | --------------------- |
| [`scalebarOverlapLeft`](#getter-scalebaroverlapleft) | `number`              |
| [`posColor`](#getter-poscolor)                       | `string`              |
| [`negColor`](#getter-negcolor)                       | `string`              |
| [`bicolorPivot`](#getter-bicolorpivot)               | `number`              |
| [`scaleType`](#getter-scaletype)                     | `string`              |
| [`autoscaleType`](#getter-autoscaletype)             | `string`              |
| [`numStdDev`](#getter-numstddev)                     | `number`              |
| [`scatterPointSize`](#getter-scatterpointsize)       | `number`              |
| [`summaryScoreMode`](#getter-summaryscoremode)       | `string`              |
| [`renderingType`](#getter-renderingtype)             | `string`              |
| [`minScore`](#getter-minscore)                       | `number`              |
| [`maxScore`](#getter-maxscore)                       | `number`              |
| [`minScoreBound`](#getter-minscorebound)             | `number \| undefined` |
| [`maxScoreBound`](#getter-maxscorebound)             | `number \| undefined` |
| [`hasResolution`](#getter-hasresolution)             | `boolean`             |

</details>

<details>
<summary>WiggleScoreConfigMixin - Getters (all signatures)</summary>

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

<details open>
<summary>WiggleScoreConfigMixin - Actions</summary>

#### action: isCacheValid

Strict zoom equality: see adr-008.

```ts
type isCacheValid = (_displayedRegionIndex: number) => boolean
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                               | Signature                                |
| ---------------------------------------------------- | ---------------------------------------- |
| [`toggleCrossHatches`](#action-togglecrosshatches)   | `() => void`                             |
| [`setResolution`](#action-setresolution)             | `(res: number) => void`                  |
| [`setLoadedBpPerPx`](#action-setloadedbpperpx)       | `(bpPerPx: number \| undefined) => void` |
| [`setScaleType`](#action-setscaletype)               | `(scaleType: string) => void`            |
| [`setMinScore`](#action-setminscore)                 | `(val?: number \| undefined) => void`    |
| [`setMaxScore`](#action-setmaxscore)                 | `(val?: number \| undefined) => void`    |
| [`setRenderingType`](#action-setrenderingtype)       | `(type: string) => void`                 |
| [`setSummaryScoreMode`](#action-setsummaryscoremode) | `(val: string) => void`                  |
| [`setAutoscale`](#action-setautoscale)               | `(val?: string \| undefined) => void`    |

</details>

<details>
<summary>WiggleScoreConfigMixin - Actions (all signatures)</summary>

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

#### action: setAutoscale

```ts
type setAutoscale = (val?: string | undefined) => void
```

</details>
