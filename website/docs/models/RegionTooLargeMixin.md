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

## Derived, self-releasing gate

`regionTooLarge` is a pure function of the cached byte estimate scaled to the
current viewport (`tooLargeStatus`), so the banner self-releases on zoom-in
without a flag-clear round trip and doesn't flicker on pan. A byte-gated display
opts in by overriding three hooks — `derivedRegionTooLargeEnabled` → true,
`configuredFetchSizeLimit` (the mixin owns no `configuration`), and, if it has a
second gating axis, `densityTooLargeForDerivedGate` (canvas's feature-density
gate) — and clears the cached estimate on chromosome nav with
`onDisplayedRegionsChange(self, () => self.setFeatureDensityStats(undefined))`
in its `afterAttach` (the estimate intentionally survives viewport-change
clears, so only region navigation drops it). Used by
canvas/LD/arc/maf/MultiSampleVariant/alignments.

A display that leaves `derivedRegionTooLargeEnabled` false never gates on size
(`regionTooLarge` is a literal false, so the LGV-only `tooLargeStatus` getters
aren't evaluated — safe for non-byte / non-LGV consumers like synteny). The old
imperative `setRegionTooLarge` flag path was removed once every byte-gated
display went derived.

## Members

| Member                                                                 | Kind      | Defined by          | Description                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------- | --------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [userByteSizeLimit](#volatile-userbytesizelimit)                       | Volatiles | RegionTooLargeMixin | user-confirmed byte limit after a force-load, disabling the gate. Volatile, not persisted: the interactive force-load button is a transient "show me this now" action and must not leak a raised gate into a saved or shared session. The declarative, session-scoped escape hatch is instead the `forceLoad` config slot (set per-session via a session spec, or baked into a track config for embedded/notebook views). |
| [featureDensityStats](#volatile-featuredensitystats)                   | Volatiles | RegionTooLargeMixin |                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [byteEstimateVisibleBp](#volatile-byteestimatevisiblebp)               | Volatiles | RegionTooLargeMixin | visibleBp at which the current `featureDensityStats` byte estimate was captured, so the derived gate (`estimatedVisibleBytes`) can scale it to the current view. Written by `setFeatureDensityStats`; ignored unless `derivedRegionTooLargeEnabled`.                                                                                                                                                                      |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters   | RegionTooLargeMixin | Opt-in switch: a byte-gated display flips this true to enable the derived, self-releasing region-too-large gate. Default false means the display never gates on size (`regionTooLarge` is always false), so non-byte displays (wiggle, manhattan, sequence, synteny, …) don't evaluate the LGV-only `tooLargeStatus` getters at all.                                                                                      |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)           | Getters   | RegionTooLargeMixin | The composing display's configured `fetchSizeLimit`, read straight from its config. Only evaluated when the derived gate is enabled (guarded by `derivedRegionTooLargeEnabled`), and every derived display extends `baseLinearDisplayConfigSchema`, which owns the slot — so the read is always valid where it fires. A display with a bespoke source can still override it.                                              |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters   | RegionTooLargeMixin | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate. Byte-only derived displays leave it false.                                                                                                                                                                                                                                                           |
| [configForceLoad](#getter-configforceload)                             | Getters   | RegionTooLargeMixin | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button). Read straight from the `forceLoad` config slot on `baseLinearDisplayConfigSchema` (same guard/ownership as `configuredFetchSizeLimit`), so every opt-in display honors it without per-display wiring.                                                   |
| [estimatedVisibleBytes](#getter-estimatedvisiblebytes)                 | Getters   | RegionTooLargeMixin | The cached byte estimate scaled from the span it was measured over (`byteEstimateVisibleBp`) to the currently visible span. Roughly proportional to span, so scaling makes the derived verdict a pure function of the current view and self-releases on zoom-in — without it a large zoomed-out estimate stays above the limit forever and gates refetch. Only meaningful when `derivedRegionTooLargeEnabled`.            |
| [tooLargeStatus](#getter-toolargestatus)                               | Getters   | RegionTooLargeMixin | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in. Same helper as every other gating path so the banner text can't drift.                                                                                                                                                                       |
| [regionTooLarge](#getter-regiontoolarge)                               | Getters   | RegionTooLargeMixin |                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [regionTooLargeReason](#getter-regiontoolargereason)                   | Getters   | RegionTooLargeMixin |                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)       | Methods   | RegionTooLargeMixin | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                                                                                                                                                                     |
| [setFeatureDensityStats](#action-setfeaturedensitystats)               | Actions   | RegionTooLargeMixin | Commits the byte estimate and records the span it was measured at (`byteEstimateVisibleBp`) so the derived gate can scale it to the current view. The capture is harmless for non-gated displays (they ignore it).                                                                                                                                                                                                        |
| [setFeatureDensityStatsLimit](#action-setfeaturedensitystatslimit)     | Actions   | RegionTooLargeMixin | force-load: raise the byte limit past the current request so the gate releases. Raises past the estimate scaled to the _current_ view (not the raw captured bytes), so it clears even if the view zoomed out after the estimate was captured; `raiseLimitPast` is the raw fallback for a display with no scaled estimate. Canvas (which also has a density force-load) overrides this entirely.                           |
| [reload](#action-reload)                                               | Actions   | RegionTooLargeMixin |                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [forceLoad](#action-forceload)                                         | Actions   | RegionTooLargeMixin | Raises the byte limit past the current density stats and triggers a reload. The display chrome calls this via TooLargeMessage's force-load button; concrete display models override reload() to do the actual refetch.                                                                                                                                                                                                    |

<details>
<summary>RegionTooLargeMixin - Volatiles</summary>

#### volatile: userByteSizeLimit

user-confirmed byte limit after a force-load, disabling the gate. Volatile, not
persisted: the interactive force-load button is a transient "show me this now"
action and must not leak a raised gate into a saved or shared session. The
declarative, session-scoped escape hatch is instead the `forceLoad` config slot
(set per-session via a session spec, or baked into a track config for
embedded/notebook views).

```ts
// type signature
type userByteSizeLimit = number | undefined
// code
userByteSizeLimit: undefined as number | undefined
```

#### volatile: byteEstimateVisibleBp

visibleBp at which the current `featureDensityStats` byte estimate was captured,
so the derived gate (`estimatedVisibleBytes`) can scale it to the current view.
Written by `setFeatureDensityStats`; ignored unless
`derivedRegionTooLargeEnabled`.

```ts
// type signature
type byteEstimateVisibleBp = number | undefined
// code
byteEstimateVisibleBp: undefined as number | undefined
```

</details>

<details>
<summary>RegionTooLargeMixin - Volatiles (other undocumented members)</summary>

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

#### getter: derivedRegionTooLargeEnabled

Opt-in switch: a byte-gated display flips this true to enable the derived,
self-releasing region-too-large gate. Default false means the display never
gates on size (`regionTooLarge` is always false), so non-byte displays (wiggle,
manhattan, sequence, synteny, …) don't evaluate the LGV-only `tooLargeStatus`
getters at all.

```ts
type derivedRegionTooLargeEnabled = boolean
```

#### getter: configuredFetchSizeLimit

The composing display's configured `fetchSizeLimit`, read straight from its
config. Only evaluated when the derived gate is enabled (guarded by
`derivedRegionTooLargeEnabled`), and every derived display extends
`baseLinearDisplayConfigSchema`, which owns the slot — so the read is always
valid where it fires. A display with a bespoke source can still override it.

```ts
type configuredFetchSizeLimit = number
```

#### getter: densityTooLargeForDerivedGate

Extra (non-byte) too-large axis folded into the derived verdict — canvas
overrides it with its feature-density gate. Byte-only derived displays leave it
false.

```ts
type densityTooLargeForDerivedGate = boolean
```

#### getter: configForceLoad

Declarative force-load: when true the display always renders regardless of
region size / feature density (the config-driven equivalent of the force-load
button). Read straight from the `forceLoad` config slot on
`baseLinearDisplayConfigSchema` (same guard/ownership as
`configuredFetchSizeLimit`), so every opt-in display honors it without
per-display wiring.

```ts
type configForceLoad = boolean
```

#### getter: estimatedVisibleBytes

The cached byte estimate scaled from the span it was measured over
(`byteEstimateVisibleBp`) to the currently visible span. Roughly proportional to
span, so scaling makes the derived verdict a pure function of the current view
and self-releases on zoom-in — without it a large zoomed-out estimate stays
above the limit forever and gates refetch. Only meaningful when
`derivedRegionTooLargeEnabled`.

```ts
type estimatedVisibleBytes = number | undefined
```

#### getter: tooLargeStatus

Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then
bytes-over-limit, then the density axis), fed the scaled estimate so the byte
gate self-releases on zoom-in. Same helper as every other gating path so the
banner text can't drift.

```ts
type tooLargeStatus = RegionTooLargeStatus
```

</details>

<details>
<summary>RegionTooLargeMixin - Getters (other undocumented members)</summary>

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

#### action: setFeatureDensityStats

Commits the byte estimate and records the span it was measured at
(`byteEstimateVisibleBp`) so the derived gate can scale it to the current view.
The capture is harmless for non-gated displays (they ignore it).

```ts
type setFeatureDensityStats = (stats?: FeatureDensityStats | undefined) => void
```

#### action: setFeatureDensityStatsLimit

force-load: raise the byte limit past the current request so the gate releases.
Raises past the estimate scaled to the _current_ view (not the raw captured
bytes), so it clears even if the view zoomed out after the estimate was
captured; `raiseLimitPast` is the raw fallback for a display with no scaled
estimate. Canvas (which also has a density force-load) overrides this entirely.

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

#### action: reload

```ts
type reload = () => void
```

</details>
