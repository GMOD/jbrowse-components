---
id: regiontoolargemixin
title: RegionTooLargeMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/shared/RegionTooLargeMixin.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/RegionTooLargeMixin.md)

## Docs

Shared mixin owning "region too large" state and force-load UI.

Composed by both FeatureDensityMixin (block-based server-side rendered displays
like LinearBasicDisplay, LinearArcDisplay) and MultiRegionDisplayMixin
(canvas/GPU displays like LinearAlignmentsDisplay, LinearWiggleDisplay,
LinearBasicDisplay).

Owns the state that TooLargeMessage reads: regionTooLarge, regionTooLargeReason,
featureDensityStats, setFeatureDensityStatsLimit.

### RegionTooLargeMixin - Properties

#### property: userByteSizeLimit

user-confirmed byte limit after a force-load, disabling the gate

```js
// type signature
IMaybe<ISimpleType<number>>
// code
userByteSizeLimit: types.maybe(types.number)
```

### RegionTooLargeMixin - Volatiles

#### volatile: regionTooLargeState

```js
// type signature
false
// code
regionTooLargeState: false
```

#### volatile: regionTooLargeReasonState

```js
// type signature
string
// code
regionTooLargeReasonState: ''
```

#### volatile: featureDensityStats

```js
// type signature
FeatureDensityStats | undefined
// code
featureDensityStats: undefined as FeatureDensityStats | undefined
```

### RegionTooLargeMixin - Getters

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

### RegionTooLargeMixin - Methods

#### method: regionCannotBeRenderedText

```js
// type signature
regionCannotBeRenderedText: (_region?: Region | undefined) => "" | "Force load to see features"
```

#### method: regionCannotBeRendered

```js
// type signature
regionCannotBeRendered: (_region?: Region | undefined) => Element | null
```

### RegionTooLargeMixin - Actions

#### action: setRegionTooLarge

```js
// type signature
setRegionTooLarge: (val: boolean, reason?: string | undefined) => void
```

#### action: setFeatureDensityStats

```js
// type signature
setFeatureDensityStats: (stats?: FeatureDensityStats | undefined) => void
```

#### action: setFeatureDensityStatsLimit

force-load: raise the byte limit past the current request and clear the
too-large banner

```js
// type signature
setFeatureDensityStatsLimit: (stats?: FeatureDensityStats | undefined) => void
```

#### action: reload

```js
// type signature
reload: () => void
```
