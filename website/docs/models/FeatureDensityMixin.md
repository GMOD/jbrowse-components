---
id: featuredensitymixin
title: FeatureDensityMixin
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/linear-genome-view/src/BaseLinearDisplay/models/FeatureDensityMixin.tsx](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/FeatureDensityMixin.tsx)

### FeatureDensityMixin - Properties

#### property: userBpPerPxLimit

```js
// type signature
IMaybe<ISimpleType<number>>
// code
userBpPerPxLimit: types.maybe(types.number)
```

#### property: userByteSizeLimit

```js
// type signature
IMaybe<ISimpleType<number>>
// code
userByteSizeLimit: types.maybe(types.number)
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

#### getter: regionTooLarge

region is too large if:

- stats are ready
- region is greater than 20kb (don't warn when zoomed in less than that)
- and bytes is greater than max allowed bytes or density greater than max
  density

```js
// type
boolean
```

#### getter: regionTooLargeReason

only shows a message of bytes requested is defined, the feature density based
stats don't produce any helpful message besides to zoom in

```js
// type
string
```

### FeatureDensityMixin - Methods

#### method: regionCannotBeRenderedText

```js
// type signature
regionCannotBeRenderedText: (_region: Region) => "" | "Force load to see features"
```

#### method: regionCannotBeRendered

```js
// type signature
regionCannotBeRendered: (_region: Region) => Element
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
setFeatureDensityStatsLimit: (stats?: FeatureDensityStats) => void
```

#### action: getFeatureDensityStats

```js
// type signature
getFeatureDensityStats: () => Promise<FeatureDensityStats>
```

#### action: setFeatureDensityStatsP

```js
// type signature
setFeatureDensityStatsP: (arg: any) => void
```

#### action: setFeatureDensityStats

```js
// type signature
setFeatureDensityStats: (featureDensityStats?: FeatureDensityStats) => void
```

#### action: clearFeatureDensityStats

```js
// type signature
clearFeatureDensityStats: () => void
```
