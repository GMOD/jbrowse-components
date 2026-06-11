---
id: wigglescoreconfigmixin
title: WiggleScoreConfigMixin
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

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:** configOverrides

**Methods:** getOverride, getConfWithOverride

**Actions:** setOverride, clearOverride

### WiggleScoreConfigMixin - Properties

#### property: resolution

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
resolution: types.stripDefault(types.number, 1)
```

#### property: displayCrossHatches

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
displayCrossHatches: types.stripDefault(types.boolean, false)
```

### WiggleScoreConfigMixin - Volatiles

#### volatile: loadedBpPerPx

```js
// type signature
number | undefined
// code
loadedBpPerPx: undefined as number | undefined
```

### WiggleScoreConfigMixin - Getters

#### getter: scalebarOverlapLeft

```js
// type
number
```

#### getter: posColor

```js
// type
string
```

#### getter: negColor

```js
// type
string
```

#### getter: bicolorPivot

```js
// type
number
```

#### getter: scaleType

```js
// type
string
```

#### getter: autoscaleType

```js
// type
string
```

#### getter: numStdDev

```js
// type
number
```

#### getter: summaryScoreMode

```js
// type
string
```

#### getter: renderingType

```js
// type
string
```

#### getter: minScore

```js
// type
number
```

#### getter: maxScore

```js
// type
number
```

#### getter: minScoreBound

```js
// type
number | undefined
```

#### getter: maxScoreBound

```js
// type
number | undefined
```

#### getter: hasResolution

```js
// type
boolean
```

### WiggleScoreConfigMixin - Actions

#### action: toggleCrossHatches

```js
// type signature
toggleCrossHatches: () => void
```

#### action: setResolution

```js
// type signature
setResolution: (res: number) => void
```

#### action: setLoadedBpPerPx

```js
// type signature
setLoadedBpPerPx: (bpPerPx: number | undefined) => void
```

#### action: setScaleType

```js
// type signature
setScaleType: (scaleType: string) => void
```

#### action: setColor

```js
// type signature
setColor: (color?: string | undefined) => void
```

#### action: setMinScore

```js
// type signature
setMinScore: (val?: number | undefined) => void
```

#### action: setMaxScore

```js
// type signature
setMaxScore: (val?: number | undefined) => void
```

#### action: setRenderingType

```js
// type signature
setRenderingType: (type: string) => void
```

#### action: setSummaryScoreMode

```js
// type signature
setSummaryScoreMode: (val: string) => void
```

#### action: setAutoscale

```js
// type signature
setAutoscale: (val?: string | undefined) => void
```

#### action: isCacheValid

Strict zoom equality: see adr-008.

```js
// type signature
isCacheValid: (_displayedRegionIndex: number) => boolean
```
