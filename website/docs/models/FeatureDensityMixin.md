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

**Properties:**
[userByteSizeLimit](../regiontoolargemixin#property-userbytesizelimit)

**Volatiles:**
[regionTooLargeState](../regiontoolargemixin#volatile-regiontoolargestate),
[regionTooLargeReasonState](../regiontoolargemixin#volatile-regiontoolargereasonstate),
[featureDensityStats](../regiontoolargemixin#volatile-featuredensitystats)

**Getters:** [regionTooLarge](../regiontoolargemixin#getter-regiontoolarge),
[regionTooLargeReason](../regiontoolargemixin#getter-regiontoolargereason)

**Methods:**
[regionCannotBeRenderedText](../regiontoolargemixin#method-regioncannotberenderedtext)

**Actions:**
[setRegionTooLarge](../regiontoolargemixin#action-setregiontoolarge),
[setFeatureDensityStats](../regiontoolargemixin#action-setfeaturedensitystats),
[setFeatureDensityStatsLimit](../regiontoolargemixin#action-setfeaturedensitystatslimit),
[reload](../regiontoolargemixin#action-reload),
[forceLoad](../regiontoolargemixin#action-forceload)

<details open>
<summary>FeatureDensityMixin - Properties</summary>

#### property: userBpPerPxLimit

```ts
// type signature
type userBpPerPxLimit = IMaybe<ISimpleType<number>>
// code
userBpPerPxLimit: types.maybe(types.number)
```

</details>

<details open>
<summary>FeatureDensityMixin - Volatiles</summary>

#### volatile: featureDensityStatsP

```ts
// type signature
type featureDensityStatsP = Promise<FeatureDensityStats> | undefined
// code
featureDensityStatsP: undefined as undefined | Promise<FeatureDensityStats>
```

#### volatile: currStatsBpPerPx

```ts
// type signature
type currStatsBpPerPx = number
// code
currStatsBpPerPx: 0
```

</details>

<details open>
<summary>FeatureDensityMixin - Getters</summary>

#### getter: currentBytesRequested

```ts
type currentBytesRequested = number
```

#### getter: currentFeatureScreenDensity

```ts
type currentFeatureScreenDensity = number
```

#### getter: maxFeatureScreenDensity

```ts
type maxFeatureScreenDensity = any
```

#### getter: featureDensityStatsReady

```ts
type featureDensityStatsReady = boolean
```

#### getter: maxAllowableBytes

```ts
type maxAllowableBytes = number
```

#### getter: bytesTooLarge

```ts
type bytesTooLarge = boolean
```

#### getter: densityTooLarge

```ts
type densityTooLarge = boolean
```

#### getter: regionTooLarge

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

```ts
type regionTooLargeReason = string
```

#### getter: featureDensityStatsReadyAndRegionNotTooLarge

```ts
type featureDensityStatsReadyAndRegionNotTooLarge = boolean
```

</details>

<details open>
<summary>FeatureDensityMixin - Methods</summary>

#### method: regionCannotBeRendered

```ts
type regionCannotBeRendered = (_region: Region) => Element | null
```

</details>

<details open>
<summary>FeatureDensityMixin - Actions</summary>

#### action: setCurrStatsBpPerPx

```ts
type setCurrStatsBpPerPx = (n: number) => void
```

#### action: setFeatureDensityStatsLimit

```ts
type setFeatureDensityStatsLimit = (
  stats?: FeatureDensityStats | undefined,
) => void
```

#### action: getFeatureDensityStats

```ts
type getFeatureDensityStats = () => Promise<FeatureDensityStats>
```

#### action: setFeatureDensityStatsP

```ts
type setFeatureDensityStatsP = (
  arg: Promise<FeatureDensityStats> | undefined,
) => void
```

#### action: clearFeatureDensityStats

```ts
type clearFeatureDensityStats = () => void
```

</details>
