---
id: featuredensitymixin
title: FeatureDensityMixin
sidebar_label: Mixin -> FeatureDensityMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/shared/FeatureDensityMixin.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/FeatureDensityMixin.md)

## Overview

Block-based display mixin that adds reactive density-stats checking on top of
RegionTooLargeMixin.

Runs autorunFeatureDensityStats to RPC for density stats, then computes
regionTooLarge reactively from bytes/density thresholds.

For canvas/GPU displays, use MultiRegionDisplayMixin instead (which also
composes RegionTooLargeMixin but uses an imperative check path).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:** userByteSizeLimit

**Volatiles:** regionTooLargeState, regionTooLargeReasonState,
featureDensityStats

**Getters:** regionTooLarge, regionTooLargeReason

**Methods:** regionCannotBeRenderedText

**Actions:** setRegionTooLarge, setFeatureDensityStats,
setFeatureDensityStatsLimit, reload, forceLoad

### FeatureDensityMixin - Properties

#### property: userBpPerPxLimit

```js
// type signature
IMaybe<ISimpleType<number>>
// code
userBpPerPxLimit: types.maybe(types.number)
```

### FeatureDensityMixin - Volatiles

#### volatile: featureDensityStatsP

```js
// type signature
Promise<FeatureDensityStats> | undefined
// code
featureDensityStatsP: undefined as
        | undefined
        | Promise<FeatureDensityStats>
```

#### volatile: currStatsBpPerPx

```js
// type signature
number
// code
currStatsBpPerPx: 0
```

### FeatureDensityMixin - Getters

#### getter: currentBytesRequested

```js
// type
number
```

#### getter: currentFeatureScreenDensity

```js
// type
number
```

#### getter: maxFeatureScreenDensity

```js
// type
any
```

#### getter: featureDensityStatsReady

```js
// type
boolean
```

#### getter: maxAllowableBytes

```js
// type
number
```

#### getter: bytesTooLarge

```js
// type
boolean
```

#### getter: densityTooLarge

```js
// type
boolean
```

#### getter: regionTooLarge

```js
// type
boolean
```

#### getter: regionTooLargeReason

```js
// type
string
```

#### getter: featureDensityStatsReadyAndRegionNotTooLarge

```js
// type
boolean
```

### FeatureDensityMixin - Methods

#### method: regionCannotBeRendered

```js
// type signature
regionCannotBeRendered: (_region: Region) => Element | null
```

### FeatureDensityMixin - Actions

#### action: setCurrStatsBpPerPx

```js
// type signature
setCurrStatsBpPerPx: (n: number) => void
```

#### action: setFeatureDensityStatsLimit

```js
// type signature
setFeatureDensityStatsLimit: (stats?: FeatureDensityStats | undefined) => void
```

#### action: getFeatureDensityStats

```js
// type signature
getFeatureDensityStats: () => Promise<FeatureDensityStats>
```

#### action: setFeatureDensityStatsP

```js
// type signature
setFeatureDensityStatsP: (arg: Promise<FeatureDensityStats> | undefined) => void
```

#### action: clearFeatureDensityStats

```js
// type signature
clearFeatureDensityStats: () => void
```
