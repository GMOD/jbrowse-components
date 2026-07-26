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
nothing else needs overriding. `MultiRegionDisplayMixin` drops the cached
estimate on chromosome nav for everything it composes; the two displays outside
that family (LD, arc) wire
`onDisplayedRegionsChange(self, () => self.clearByteEstimate())` themselves. The
estimate intentionally survives viewport-change clears, so only region
navigation drops it. Used by canvas/LD/arc/maf/MultiSampleVariant/alignments.

A display that leaves `derivedRegionTooLargeEnabled` false never gates on size
(`regionTooLarge` is a literal false, so the LGV-only `tooLargeStatus` getters
aren't evaluated — safe for non-byte / non-LGV consumers like synteny). The old
imperative `setRegionTooLarge` flag path was removed once every byte-gated
display went derived.

## Members

| Member                                                                 | Kind      | Defined by          | Description                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------- | --------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [forceLoadTrack](#volatile-forceloadtrack)                             | Volatiles | RegionTooLargeMixin | The force-load button's answer: render this track regardless of region size or feature density.                                                                                                                                  |
| [byteEstimate](#volatile-byteestimate)                                 | Volatiles | RegionTooLargeMixin | Last byte estimate reported for this display, with the adapter's own `fetchSizeLimit` and `alwaysRender` flag.                                                                                                                   |
| [measuredSpanBp](#volatile-measuredspanbp)                             | Volatiles | RegionTooLargeMixin | The span the current `byteEstimate` was measured over, so the derived gate can rescale it to the span on screen now.                                                                                                             |
| [gateFoldedIntoFetch](#getter-gatefoldedintofetch)                     | Getters   | RegionTooLargeMixin | Additive opt-in for displays that measure the estimate inside their own feature RPC instead of a pre-flight (canvas).                                                                                                            |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters   | RegionTooLargeMixin | Opt-in switch: a byte-gated display flips this true to enable the derived, self-releasing region-too-large gate.                                                                                                                 |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)           | Getters   | RegionTooLargeMixin | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                              |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters   | RegionTooLargeMixin | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                             |
| [adapterFetchSizeLimit](#getter-adapterfetchsizelimit)                 | Getters   | RegionTooLargeMixin | The adapter's own `fetchSizeLimit` slot (undefined when the adapter type declares none); `resolveByteLimit` prefers it over the display config.                                                                                  |
| [configForceLoad](#getter-configforceload)                             | Getters   | RegionTooLargeMixin | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                |
| [resolvedAdapterByteLimit](#getter-resolvedadapterbytelimit)           | Getters   | RegionTooLargeMixin | The adapter's byte budget, preferring one the estimate computed dynamically over the static `fetchSizeLimit` slot.                                                                                                               |
| [byteGateExempt](#getter-bytegateexempt)                               | Getters   | RegionTooLargeMixin | True when nothing may gate, on either axis and in both the worker and the banner: a self-summarizing adapter (BigWig/HiC cap what they return at screen resolution), the declarative `forceLoad` slot, or the force-load button. |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan)   | Getters   | RegionTooLargeMixin | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored estimate from the span it was measured over (`measuredSpanBp`).                                                  |
| [gateByteLimit](#getter-gatebytelimit)                                 | Getters   | RegionTooLargeMixin | The byte budget the gate enforces: the adapter's limit, else the display config.                                                                                                                                                 |
| [tooLargeStatus](#getter-toolargestatus)                               | Getters   | RegionTooLargeMixin | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in.                                                     |
| [regionTooLarge](#getter-regiontoolarge)                               | Getters   | RegionTooLargeMixin | The verdict the whole mixin exists to produce: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips.                                           |
| [regionTooLargeReason](#getter-regiontoolargereason)                   | Getters   | RegionTooLargeMixin | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                         |
| [setByteEstimate](#action-setbyteestimate)                             | Actions   | RegionTooLargeMixin | Commits the byte estimate together with the span it covers, so the derived gate can rescale it to the span on screen.                                                                                                            |
| [clearByteEstimate](#action-clearbyteestimate)                         | Actions   | RegionTooLargeMixin | Drops the cached estimate.                                                                                                                                                                                                       |
| [setForceLoadTrack](#action-setforceloadtrack)                         | Actions   | RegionTooLargeMixin | Exempt this track from the gate (or put it back under it).                                                                                                                                                                       |
| [reload](#action-reload)                                               | Actions   | RegionTooLargeMixin |                                                                                                                                                                                                                                  |
| [forceLoad](#action-forceload)                                         | Actions   | RegionTooLargeMixin | Force-load: exempt this track from the gate and refetch.                                                                                                                                                                         |

<details>
<summary>RegionTooLargeMixin - Volatiles</summary>

#### volatile: forceLoadTrack

The force-load button's answer: render this track regardless of region size or
feature density. One boolean for the whole track, not a raised ceiling per
region — the banner already tells the user how much data is involved, so one
informed click approves the track and they never have to re-approve it per
locus.

Volatile, not persisted, so it can't leak a disabled gate into a saved or shared
session (a recipient would download the same data with no warning and no way to
see why). A page load re-arms the gate. The durable, declarative equivalent is
the `forceLoad` config slot, for session specs, embeds and
`jbrowse-img --force`.

```ts
// type signature
type forceLoadTrack = false
// code
forceLoadTrack: false
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

#### getter: gateFoldedIntoFetch

Additive opt-in for displays that measure the estimate inside their own feature
RPC instead of a pre-flight (canvas). Kept separate from
`derivedRegionTooLargeEnabled` so a gate mixin contributes by setting _this_
rather than overriding the verdict switch — the two would otherwise race on
composition order, and the later `.compose()` argument silently winning is
invisible to both the type system and the tests.

```ts
type gateFoldedIntoFetch = boolean
```

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

#### getter: adapterFetchSizeLimit

The adapter's own `fetchSizeLimit` slot (undefined when the adapter type
declares none); `resolveByteLimit` prefers it over the display config. Read on
the main thread rather than trusted only from the estimate: the three adapters
that attach one (BAM/CRAM/VCF) just echo this same static slot back across the
worker boundary, and a display whose adapter never attaches it would otherwise
silently ignore a configured limit. `byteEstimate.fetchSizeLimit` still wins
where present, so an adapter that computes a limit dynamically keeps the last
word.

```ts
type adapterFetchSizeLimit = number | undefined
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

#### getter: resolvedAdapterByteLimit

The adapter's byte budget, preferring one the estimate computed dynamically over
the static `fetchSizeLimit` slot. One getter, because the banner, the force-load
baseline and the canvas worker budget each spelling "the adapter's limit" for
itself is how the worker ends up rejecting a region the banner considers fine —
a silently blank display with nothing to refetch it.

```ts
type resolvedAdapterByteLimit = number | undefined
```

#### getter: byteGateExempt

True when nothing may gate, on either axis and in both the worker and the
banner: a self-summarizing adapter (BigWig/HiC cap what they return at screen
resolution), the declarative `forceLoad` slot, or the force-load button. One
boolean is the whole force-load mechanism — there is no per-region ceiling to
carry, expire, or reconcile between the two axes.

```ts
type byteGateExempt = boolean
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

#### getter: gateByteLimit

The byte budget the gate enforces: the adapter's limit, else the display config.
Also what canvas hands the worker, so the two can't gate against different
numbers. Force-load doesn't raise this — it exempts the track outright via
`byteGateExempt`.

```ts
type gateByteLimit = number
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
<summary>RegionTooLargeMixin - Actions</summary>

#### action: setByteEstimate

Commits the byte estimate together with the span it covers, so the derived gate
can rescale it to the span on screen. `measuredSpanBp` must be the `visibleBp`
captured when the measurement was _requested_, not read at commit time: a view
that zoomed during the in-flight fetch would otherwise anchor the estimate to
the wrong span, and since `FetchVisibleRegions` skips while `regionTooLarge`
holds, an over-anchored estimate wedges the banner with no refetch to correct
it. Harmless for non-gated displays (they ignore it).

```ts
type setByteEstimate = (
  estimate: RegionByteEstimate,
  measuredSpanBp: number,
) => void
```

#### action: clearByteEstimate

Drops the cached estimate. Chromosome navigation only: the estimate
intentionally survives `clearAllRpcData` so an ordinary viewport change doesn't
flicker the banner.

`forceLoadTrack` deliberately survives: it is a track-wide approval, so expiring
it on navigation is exactly the per-locus re-approval the button exists to
avoid.

```ts
type clearByteEstimate = () => void
```

#### action: setForceLoadTrack

Exempt this track from the gate (or put it back under it). Separate from
`forceLoad` so turning the gate off and refetching stay separable — a caller
that just wants the flag (a revoke, a test) doesn't trigger a fetch, and
`forceLoad` doesn't have to inline a volatile write.

```ts
type setForceLoadTrack = (flag: boolean) => void
```

#### action: forceLoad

Force-load: exempt this track from the gate and refetch. One click covers every
region and both axes, informed by the size the banner just quoted. The display
chrome calls this from TooLargeMessage's button; concrete display models
override `reload()` to do the actual refetch.

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
