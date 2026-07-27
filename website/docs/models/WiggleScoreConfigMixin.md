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

| Member                                               | Kind       | Defined by             | Description                                                                                                                                                             |
| ---------------------------------------------------- | ---------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [resolution](#property-resolution)                   | Properties | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [displayCrossHatches](#property-displaycrosshatches) | Properties | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [loadedBpPerPx](#volatile-loadedbpperpx)             | Volatiles  | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [posColor](#getter-poscolor)                         | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [negColor](#getter-negcolor)                         | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [bicolorPivot](#getter-bicolorpivot)                 | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [scaleType](#getter-scaletype)                       | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [autoscaleType](#getter-autoscaletype)               | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [numStdDev](#getter-numstddev)                       | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [numQuantile](#getter-numquantile)                   | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [scatterPointSize](#getter-scatterpointsize)         | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [lineWidth](#getter-linewidth)                       | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [summaryScoreMode](#getter-summaryscoremode)         | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [renderingType](#getter-renderingtype)               | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [minScore](#getter-minscore)                         | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [maxScore](#getter-maxscore)                         | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [minScoreBound](#getter-minscorebound)               | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [maxScoreBound](#getter-maxscorebound)               | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [hasResolution](#getter-hasresolution)               | Getters    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [isCacheValid](#method-iscachevalid)                 | Methods    | WiggleScoreConfigMixin | Strict zoom equality: see adr-008.                                                                                                                                      |
| [toggleCrossHatches](#action-togglecrosshatches)     | Actions    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [setResolution](#action-setresolution)               | Actions    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [setLoadedBpPerPx](#action-setloadedbpperpx)         | Actions    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [setScaleType](#action-setscaletype)                 | Actions    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [setBicolorPivot](#action-setbicolorpivot)           | Actions    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [setPosColor](#action-setposcolor)                   | Actions    | WiggleScoreConfigMixin | Lives here beside the `posColor`/`negColor` getters and `setBicolorPivot` so both the single- and multi-wiggle color editors write the score-sign palette the same way. |
| [setNegColor](#action-setnegcolor)                   | Actions    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [setMinScore](#action-setminscore)                   | Actions    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [setMaxScore](#action-setmaxscore)                   | Actions    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [setRenderingType](#action-setrenderingtype)         | Actions    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [setSummaryScoreMode](#action-setsummaryscoremode)   | Actions    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [setScatterPointSize](#action-setscatterpointsize)   | Actions    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [setLineWidth](#action-setlinewidth)                 | Actions    | WiggleScoreConfigMixin |                                                                                                                                                                         |
| [setAutoscale](#action-setautoscale)                 | Actions    | WiggleScoreConfigMixin |                                                                                                                                                                         |

<details>
<summary>WiggleScoreConfigMixin - Properties</summary>

| Member                                                             | Type                                                |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| <span id="property-resolution">resolution</span>                   | `IOptionalIType<ISimpleType<number>, [undefined]>`  |
| <span id="property-displaycrosshatches">displayCrossHatches</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |

</details>

<details>
<summary>WiggleScoreConfigMixin - Volatiles</summary>

| Member                                                 | Type                  |
| ------------------------------------------------------ | --------------------- |
| <span id="volatile-loadedbpperpx">loadedBpPerPx</span> | `number \| undefined` |

</details>

<details>
<summary>WiggleScoreConfigMixin - Getters</summary>

| Member                                                     | Type                  |
| ---------------------------------------------------------- | --------------------- |
| <span id="getter-poscolor">posColor</span>                 | `string`              |
| <span id="getter-negcolor">negColor</span>                 | `string`              |
| <span id="getter-bicolorpivot">bicolorPivot</span>         | `number`              |
| <span id="getter-scaletype">scaleType</span>               | `string`              |
| <span id="getter-autoscaletype">autoscaleType</span>       | `string`              |
| <span id="getter-numstddev">numStdDev</span>               | `number`              |
| <span id="getter-numquantile">numQuantile</span>           | `number`              |
| <span id="getter-scatterpointsize">scatterPointSize</span> | `number`              |
| <span id="getter-linewidth">lineWidth</span>               | `number`              |
| <span id="getter-summaryscoremode">summaryScoreMode</span> | `string`              |
| <span id="getter-renderingtype">renderingType</span>       | `string`              |
| <span id="getter-minscore">minScore</span>                 | `number`              |
| <span id="getter-maxscore">maxScore</span>                 | `number`              |
| <span id="getter-minscorebound">minScoreBound</span>       | `number \| undefined` |
| <span id="getter-maxscorebound">maxScoreBound</span>       | `number \| undefined` |
| <span id="getter-hasresolution">hasResolution</span>       | `boolean`             |

</details>

<details>
<summary>WiggleScoreConfigMixin - Methods</summary>

#### method: isCacheValid

Strict zoom equality: see adr-008. A view, not an action, so the `view.bpPerPx`
read below actually registers as a dependency of whoever calls it (see
MultiRegionDisplayMixin's hook block).

```ts
type isCacheValid = (_displayedRegionIndex: number) => boolean
```

</details>

<details>
<summary>WiggleScoreConfigMixin - Actions</summary>

#### action: setPosColor

Lives here beside the `posColor`/`negColor` getters and `setBicolorPivot` so
both the single- and multi-wiggle color editors write the score-sign palette the
same way.

```ts
type setPosColor = (color?: string | undefined) => void
```

</details>

<details>
<summary>WiggleScoreConfigMixin - Actions (other undocumented members)</summary>

| Member                                                           | Type                                     |
| ---------------------------------------------------------------- | ---------------------------------------- |
| <span id="action-togglecrosshatches">toggleCrossHatches</span>   | `() => void`                             |
| <span id="action-setresolution">setResolution</span>             | `(res: number) => void`                  |
| <span id="action-setloadedbpperpx">setLoadedBpPerPx</span>       | `(bpPerPx: number \| undefined) => void` |
| <span id="action-setscaletype">setScaleType</span>               | `(scaleType: string) => void`            |
| <span id="action-setbicolorpivot">setBicolorPivot</span>         | `(val?: number \| undefined) => void`    |
| <span id="action-setnegcolor">setNegColor</span>                 | `(color?: string \| undefined) => void`  |
| <span id="action-setminscore">setMinScore</span>                 | `(val?: number \| undefined) => void`    |
| <span id="action-setmaxscore">setMaxScore</span>                 | `(val?: number \| undefined) => void`    |
| <span id="action-setrenderingtype">setRenderingType</span>       | `(type: string) => void`                 |
| <span id="action-setsummaryscoremode">setSummaryScoreMode</span> | `(val: string) => void`                  |
| <span id="action-setscatterpointsize">setScatterPointSize</span> | `(val?: number \| undefined) => void`    |
| <span id="action-setlinewidth">setLineWidth</span>               | `(val?: number \| undefined) => void`    |
| <span id="action-setautoscale">setAutoscale</span>               | `(val?: string \| undefined) => void`    |

</details>
