---
id: regiontoolargemixin
title: RegionTooLargeMixin
sidebar_label: Mixin -> RegionTooLargeMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/shared/RegionTooLargeMixin.tsx).

## Overview

Shared mixin owning "region too large" state and force-load UI.

Composed by MultiRegionDisplayMixin (canvas/GPU displays like
LinearAlignmentsDisplay, LinearWiggleDisplay, LinearBasicDisplay) and directly
by the SVG arc displays (LinearArcDisplay, LinearPairedArcDisplay), which do
their own byte-estimate gating in fetchArcFeatures.

Owns the state that TooLargeMessage reads: regionTooLarge, regionTooLargeReason,
forceLoad.

## Members

| Member                                                             | Kind       | Description                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [userByteSizeLimit](#property-userbytesizelimit)                   | Properties | user-confirmed byte limit after a force-load, disabling the gate                                                                                                                                                       |
| [regionTooLargeState](#volatile-regiontoolargestate)               | Volatiles  |                                                                                                                                                                                                                        |
| [regionTooLargeReasonState](#volatile-regiontoolargereasonstate)   | Volatiles  |                                                                                                                                                                                                                        |
| [featureDensityStats](#volatile-featuredensitystats)               | Volatiles  |                                                                                                                                                                                                                        |
| [regionTooLarge](#getter-regiontoolarge)                           | Getters    |                                                                                                                                                                                                                        |
| [regionTooLargeReason](#getter-regiontoolargereason)               | Getters    |                                                                                                                                                                                                                        |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)   | Methods    | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                  |
| [setRegionTooLarge](#action-setregiontoolarge)                     | Actions    |                                                                                                                                                                                                                        |
| [setFeatureDensityStats](#action-setfeaturedensitystats)           | Actions    |                                                                                                                                                                                                                        |
| [setFeatureDensityStatsLimit](#action-setfeaturedensitystatslimit) | Actions    | force-load: raise the byte limit past the current request and clear the too-large banner                                                                                                                               |
| [reload](#action-reload)                                           | Actions    |                                                                                                                                                                                                                        |
| [forceLoad](#action-forceload)                                     | Actions    | Raises the byte limit past the current density stats and triggers a reload. The display chrome calls this via TooLargeMessage's force-load button; concrete display models override reload() to do the actual refetch. |

<details>
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

<details>
<summary>RegionTooLargeMixin - Volatiles</summary>

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

<details>
<summary>RegionTooLargeMixin - Getters</summary>

#### getter: regionTooLarge

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

```ts
type regionTooLargeReason = string
```

</details>

<details>
<summary>RegionTooLargeMixin - Methods</summary>

#### method: regionCannotBeRenderedText

Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the
display chrome via `TooLargeMessage`, not the model.

```ts
type regionCannotBeRenderedText = () => '' | 'Force load to see features'
```

</details>

<details>
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

</details>

<details>
<summary>RegionTooLargeMixin - Actions (other undocumented members)</summary>

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
