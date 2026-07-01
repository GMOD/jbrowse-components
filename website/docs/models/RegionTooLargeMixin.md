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

Composed by MultiRegionDisplayMixin (canvas/GPU displays like
LinearAlignmentsDisplay, LinearWiggleDisplay, LinearBasicDisplay) and directly
by the SVG arc displays (LinearArcDisplay, LinearPairedArcDisplay), which do
their own byte-estimate gating in fetchArcFeatures.

Owns the state that TooLargeMessage reads: regionTooLarge, regionTooLargeReason,
forceLoad.

<details open>
<summary>RegionTooLargeMixin - Properties</summary>

#### property: userByteSizeLimit

user-confirmed byte limit after a force-load, disabling the gate

```ts
// type signature
type userByteSizeLimit = IMaybe<ISimpleType<number>>
// code
userByteSizeLimit: types.maybe(types.number)
```

</details>

<details open>
<summary>RegionTooLargeMixin - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                             | Signature                          |
| ------------------------------------------------------------------ | ---------------------------------- |
| [`regionTooLargeState`](#volatile-regiontoolargestate)             | `false`                            |
| [`regionTooLargeReasonState`](#volatile-regiontoolargereasonstate) | `string`                           |
| [`featureDensityStats`](#volatile-featuredensitystats)             | `FeatureDensityStats \| undefined` |

</details>

<details>
<summary>RegionTooLargeMixin - Volatiles (all signatures)</summary>

#### volatile: regionTooLargeState

```ts
// type signature
type regionTooLargeState = false
// code
regionTooLargeState: false
```

#### volatile: regionTooLargeReasonState

```ts
// type signature
type regionTooLargeReasonState = string
// code
regionTooLargeReasonState: ''
```

#### volatile: featureDensityStats

```ts
// type signature
type featureDensityStats = FeatureDensityStats | undefined
// code
featureDensityStats: undefined as FeatureDensityStats | undefined
```

</details>

<details open>
<summary>RegionTooLargeMixin - Getters</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                 | Signature |
| ------------------------------------------------------ | --------- |
| [`regionTooLarge`](#getter-regiontoolarge)             | `boolean` |
| [`regionTooLargeReason`](#getter-regiontoolargereason) | `string`  |

</details>

<details>
<summary>RegionTooLargeMixin - Getters (all signatures)</summary>

#### getter: regionTooLarge

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

```ts
type regionTooLargeReason = string
```

</details>

<details open>
<summary>RegionTooLargeMixin - Methods</summary>

#### method: regionCannotBeRenderedText

Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the
display chrome via `TooLargeMessage`, not the model.

```ts
type regionCannotBeRenderedText = (
  _region?: Region | undefined,
) => '' | 'Force load to see features'
```

</details>

<details open>
<summary>RegionTooLargeMixin - Actions</summary>

#### action: setFeatureDensityStatsLimit

force-load: raise the byte limit past the current request and clear the
too-large banner

```ts
type setFeatureDensityStatsLimit = (
  stats?: FeatureDensityStats | undefined,
) => void
```

#### action: forceLoad

Raises the byte limit past the current density stats and triggers a reload. The
display chrome calls this via TooLargeMessage's force-load button; concrete
display models override reload() to do the actual refetch.

```ts
type forceLoad = () => void
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                     | Signature                                              |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| [`setRegionTooLarge`](#action-setregiontoolarge)           | `(val: boolean, reason?: string \| undefined) => void` |
| [`setFeatureDensityStats`](#action-setfeaturedensitystats) | `(stats?: FeatureDensityStats \| undefined) => void`   |
| [`reload`](#action-reload)                                 | `() => void`                                           |

</details>

<details>
<summary>RegionTooLargeMixin - Actions (all signatures)</summary>

#### action: setRegionTooLarge

```ts
type setRegionTooLarge = (val: boolean, reason?: string | undefined) => void
```

#### action: setFeatureDensityStats

```ts
type setFeatureDensityStats = (stats?: FeatureDensityStats | undefined) => void
```

#### action: reload

```ts
type reload = () => void
```

</details>
