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
opts in by flipping `derivedRegionTooLargeEnabled` true, plus
`densityTooLargeForDerivedGate` if it has a second gating axis (canvas's
feature-density gate). The budget hooks default off the display config, so
nothing else needs overriding. It also clears the cached estimate on chromosome
nav with `onDisplayedRegionsChange(self, () => self.setByteEstimate(undefined))`
in its `afterAttach` (the estimate intentionally survives viewport-change
clears, so only region navigation drops it). Used by
canvas/LD/arc/maf/MultiSampleVariant/alignments.

A display that leaves `derivedRegionTooLargeEnabled` false never gates on size
(`regionTooLarge` is a literal false, so the LGV-only `tooLargeStatus` getters
aren't evaluated — safe for non-byte / non-LGV consumers like synteny). The old
imperative `setRegionTooLarge` flag path was removed once every byte-gated
display went derived.

## Members

| Member                                                                 | Kind      | Defined by          | Description                                                                                                                                                                            |
| ---------------------------------------------------------------------- | --------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [userByteLimit](#volatile-userbytelimit)                               | Volatiles | RegionTooLargeMixin | user-confirmed byte limit after a force-load, disabling the gate.                                                                                                                      |
| [byteEstimate](#volatile-byteestimate)                                 | Volatiles | RegionTooLargeMixin | Last byte estimate reported for this display, with the adapter's own `fetchSizeLimit` and `alwaysRender` flag.                                                                         |
| [measuredSpanBp](#volatile-measuredspanbp)                             | Volatiles | RegionTooLargeMixin | The span the current `byteEstimate` was measured over, so the derived gate can rescale it to the span on screen now.                                                                   |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters   | RegionTooLargeMixin | Opt-in switch: a byte-gated display flips this true to enable the derived, self-releasing region-too-large gate.                                                                       |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)           | Getters   | RegionTooLargeMixin | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                    |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters   | RegionTooLargeMixin | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                   |
| [configForceLoad](#getter-configforceload)                             | Getters   | RegionTooLargeMixin | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                      |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan)   | Getters   | RegionTooLargeMixin | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored estimate from the span it was measured over (`measuredSpanBp`).        |
| [tooLargeStatus](#getter-toolargestatus)                               | Getters   | RegionTooLargeMixin | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in.           |
| [regionTooLarge](#getter-regiontoolarge)                               | Getters   | RegionTooLargeMixin | The verdict the whole mixin exists to produce: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips. |
| [regionTooLargeReason](#getter-regiontoolargereason)                   | Getters   | RegionTooLargeMixin | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                               |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)       | Methods   | RegionTooLargeMixin | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                  |
| [setByteEstimate](#action-setbyteestimate)                             | Actions   | RegionTooLargeMixin | Commits the byte estimate and records the span it covers (`measuredSpanBp`) so the derived gate can rescale it to the span on screen.                                                  |
| [raiseForceLoadLimits](#action-raiseforceloadlimits)                   | Actions   | RegionTooLargeMixin | force-load: raise the byte limit past the current request so the gate releases.                                                                                                        |
| [reload](#action-reload)                                               | Actions   | RegionTooLargeMixin |                                                                                                                                                                                        |
| [forceLoad](#action-forceload)                                         | Actions   | RegionTooLargeMixin | Raises the byte limit past the current estimate and triggers a reload.                                                                                                                 |

<details>
<summary>RegionTooLargeMixin - Volatiles</summary>

#### volatile: userByteLimit

user-confirmed byte limit after a force-load, disabling the gate. Volatile, not
persisted: the interactive force-load button is a transient "show me this now"
action and must not leak a raised gate into a saved or shared session. The
declarative, session-scoped escape hatch is instead the `forceLoad` config slot
(set per-session via a session spec, or baked into a track config for
embedded/notebook views).

```ts
// type signature
type userByteLimit = number | undefined
// code
userByteLimit: undefined as number | undefined
```

#### volatile: byteEstimate

Last byte estimate reported for this display, with the adapter's own
`fetchSizeLimit` and `alwaysRender` flag. Its `bytes` covers `measuredSpanBp`,
not the span on screen now. Survives `clearAllRpcData` so an ordinary viewport
change doesn't flicker the banner; only chromosome navigation drops it.

```ts
// type signature
type byteEstimate = RegionByteEstimate | undefined
// code
byteEstimate: undefined as RegionByteEstimate | undefined
```

#### volatile: measuredSpanBp

The span the current `byteEstimate` was measured over, so the derived gate can
rescale it to the span on screen now. Written by `setByteEstimate`; ignored
unless `derivedRegionTooLargeEnabled`.

```ts
// type signature
type measuredSpanBp = number | undefined
// code
measuredSpanBp: undefined as number | undefined
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

#### getter: estimatedBytesForVisibleSpan

How many bytes we estimate a fetch of the span on screen right now would pull,
obtained by rescaling the stored estimate from the span it was measured over
(`measuredSpanBp`). Rescaling is what makes the derived verdict a pure function
of the current view and lets it self-release on zoom-in — without it a large
zoomed-out estimate stays above the limit forever and gates refetch. Only
meaningful when `derivedRegionTooLargeEnabled`.

```ts
type estimatedBytesForVisibleSpan = number | undefined
```

#### getter: tooLargeStatus

Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then
bytes-over-limit, then the density axis), fed the scaled estimate so the byte
gate self-releases on zoom-in. Same helper as every other gating path so the
banner text can't drift.

```ts
type tooLargeStatus = RegionTooLargeStatus
```

#### getter: regionTooLarge

The verdict the whole mixin exists to produce: true when the estimated download
for the span on screen exceeds the resolved byte budget, or when the display's
own density axis trips. Derived, so it releases itself on zoom-in. Always false
for a display that hasn't opted in via `derivedRegionTooLargeEnabled`. The fetch
autoruns hold off while it is true, and `DisplayChrome` renders the banner from
it.

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

Which axis tripped, as banner text: the estimated download size, or "Too many
features". Empty string when the region isn't too large.

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

#### action: setByteEstimate

Commits the byte estimate and records the span it covers (`measuredSpanBp`) so
the derived gate can rescale it to the span on screen. Harmless for non-gated
displays (they ignore it).

```ts
type setByteEstimate = (estimate?: RegionByteEstimate | undefined) => void
```

#### action: raiseForceLoadLimits

force-load: raise the byte limit past the current request so the gate releases.
Prefers the estimate for the span on screen now, so it clears even if the view
zoomed out since the measurement; a display with the derived gate off has no
such estimate and falls back to the measured-span number. Canvas (which also has
a density force-load) overrides this entirely.

```ts
type raiseForceLoadLimits = (estimate?: RegionByteEstimate | undefined) => void
```

#### action: forceLoad

Raises the byte limit past the current estimate and triggers a reload. The
display chrome calls this via TooLargeMessage's force-load button; concrete
display models override reload() to do the actual refetch.

```ts
type forceLoad = () => void
```

</details>

<details>
<summary>RegionTooLargeMixin - Actions (other undocumented members)</summary>

| Member                                 | Type         |
| -------------------------------------- | ------------ |
| <span id="action-reload">reload</span> | `() => void` |

</details>
