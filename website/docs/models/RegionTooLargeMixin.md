---
id: regiontoolargemixin
title: RegionTooLargeMixin
sidebar_label: Mixin -> RegionTooLargeMixin
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

## Overview

Shared mixin owning "region too large" state and force-load UI.

Composed by both FeatureDensityMixin (block-based server-side rendered displays
like LinearBasicDisplay, LinearArcDisplay) and MultiRegionDisplayMixin
(canvas/GPU displays like LinearAlignmentsDisplay, LinearWiggleDisplay,
LinearBasicDisplay).

Owns the state that TooLargeMessage reads: regionTooLarge, regionTooLargeReason,
forceLoad.

<details>
<summary>RegionTooLargeMixin - Properties</summary>

#### property: userByteSizeLimit

user-confirmed byte limit after a force-load, disabling the gate

```js
// type signature
IMaybe<ISimpleType<number>>
// code
userByteSizeLimit: types.maybe(types.number)
```

</details>

<details>
<summary>RegionTooLargeMixin - Volatiles</summary>

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

</details>

<details>
<summary>RegionTooLargeMixin - Getters</summary>

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

</details>

<details>
<summary>RegionTooLargeMixin - Methods</summary>

#### method: regionCannotBeRenderedText

Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the
display chrome via `TooLargeMessage`, not the model.

```js
// type signature
regionCannotBeRenderedText: (_region?: Region | undefined) => "" | "Force load to see features"
```

</details>

<details>
<summary>RegionTooLargeMixin - Actions</summary>

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

#### action: forceLoad

Raises the byte limit past the current density stats and triggers a reload. The
display chrome calls this via TooLargeMessage's force-load button; concrete
display models override reload() to do the actual refetch.

```js
// type signature
forceLoad: () => void
```

</details>
