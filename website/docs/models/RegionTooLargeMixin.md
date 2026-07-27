---
id: regiontoolargemixin
title: RegionTooLargeMixin
sidebar_label: Mixin -> RegionTooLargeMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts).

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
without a flag-clear round trip and doesn't flicker on pan.

A pre-flight display opts in with two lines and nothing else: override
`byteGateEnabled` to true, and `await self.byteGateBlocksFetch(regions, ctx)` at
the top of its fetch, returning if it says so. Both live here, so the
measurement and the verdict can't drift apart and the "capture `visibleBp`
before the await" rule is structural rather than a call-site convention.
(`MultiRegionDisplayMixin.fetchRegions` already makes that call, so displays in
that family write only the first line.) Add `densityTooLarge` for a second
gating axis (canvas's feature-density gate); the budget hooks default off the
display config.

`MultiRegionDisplayMixin` drops the cached estimate on chromosome nav for
everything it composes; the two displays outside that family (LD, arc) wire
`onDisplayedRegionsChange(self, () => self.clearByteEstimate())` themselves. The
estimate intentionally survives viewport-change clears, so only region
navigation drops it. Used by canvas/LD/arc/maf/MultiSampleVariant/alignments.

A display that opts into neither axis never gates on size (`regionTooLarge` is a
literal false, so the LGV-only `tooLargeStatus` getters aren't evaluated — safe
for non-byte / non-LGV consumers like synteny). The old imperative
`setRegionTooLarge` flag path was removed once every byte-gated display went
derived.

## Members

| Member                                                               | Kind      | Defined by          | Description                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------- | --------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [forceLoadTrack](#volatile-forceloadtrack)                           | Volatiles | RegionTooLargeMixin | The force-load button's answer: render this track regardless of region size or feature density.                                                                                                                                                   |
| [byteEstimate](#volatile-byteestimate)                               | Volatiles | RegionTooLargeMixin | The last byte measurement for this display: the estimated bytes **and the span they cover**, which is what lets the derived gate rescale them to the span on screen now.                                                                          |
| [gateFoldedIntoFetch](#getter-gatefoldedintofetch)                   | Getters   | RegionTooLargeMixin | Additive opt-in for displays that measure the estimate inside their own feature RPC instead of a pre-flight (canvas).                                                                                                                             |
| [byteGateEnabled](#getter-bytegateenabled)                           | Getters   | RegionTooLargeMixin | The one opt-in a pre-flight display writes: true means "measure this fetch and gate on it".                                                                                                                                                       |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)         | Getters   | RegionTooLargeMixin | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                               |
| [densityTooLarge](#getter-densitytoolarge)                           | Getters   | RegionTooLargeMixin | Second (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                             |
| [adapterFetchSizeLimit](#getter-adapterfetchsizelimit)               | Getters   | RegionTooLargeMixin | The adapter's own `fetchSizeLimit` slot (undefined when the adapter type declares none); `resolveByteLimit` prefers it over the display config.                                                                                                   |
| [configForceLoad](#getter-configforceload)                           | Getters   | RegionTooLargeMixin | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                                 |
| [gateVisibleBp](#getter-gatevisiblebp)                               | Getters   | RegionTooLargeMixin | The span on screen, or undefined before the view is measured.                                                                                                                                                                                     |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled) | Getters   | RegionTooLargeMixin | Whether the derived, self-releasing gate is live at all — the union of the two ways a display can measure: a pre-flight estimate (`byteGateEnabled`) or a byte check folded into its own feature RPC (`gateFoldedIntoFetch`).                     |
| [byteGateExempt](#getter-bytegateexempt)                             | Getters   | RegionTooLargeMixin | True when nothing may gate, on either axis and in both the worker and the banner: the declarative `forceLoad` slot, or the force-load button.                                                                                                     |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan) | Getters   | RegionTooLargeMixin | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored measurement from the span it covers.                                                                                              |
| [gateByteLimit](#getter-gatebytelimit)                               | Getters   | RegionTooLargeMixin | The byte budget the gate enforces: the adapter's limit, else the display config.                                                                                                                                                                  |
| [gateActive](#getter-gateactive)                                     | Getters   | RegionTooLargeMixin | Whether anything may gate at this moment: the display opted in, nothing exempts it, and the view is measured and wider than the `AUTO_FORCE_LOAD_BP` force-load floor.                                                                            |
| [tooLargeStatus](#getter-toolargestatus)                             | Getters   | RegionTooLargeMixin | The verdict the whole mixin exists to produce, with the banner text: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips (bytes take precedence for the text). |
| [regionTooLarge](#getter-regiontoolarge)                             | Getters   | RegionTooLargeMixin |                                                                                                                                                                                                                                                   |
| [regionTooLargeReason](#getter-regiontoolargereason)                 | Getters   | RegionTooLargeMixin | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                          |
| [resolvedByteLimit](#method-resolvedbytelimit)                       | Methods   | RegionTooLargeMixin | The byte budget a fetch RPC enforces worker-side, short-circuiting an over-budget region before it downloads any features.                                                                                                                        |
| [setByteEstimate](#action-setbyteestimate)                           | Actions   | RegionTooLargeMixin | Commits a byte measurement: the estimate together with the span it covers, so the derived gate can rescale it to the span on screen.                                                                                                              |
| [clearByteEstimate](#action-clearbyteestimate)                       | Actions   | RegionTooLargeMixin | Drops the cached estimate.                                                                                                                                                                                                                        |
| [setForceLoadTrack](#action-setforceloadtrack)                       | Actions   | RegionTooLargeMixin | Exempt this track from the gate (or put it back under it).                                                                                                                                                                                        |
| [reload](#action-reload)                                             | Actions   | RegionTooLargeMixin |                                                                                                                                                                                                                                                   |
| [forceLoad](#action-forceload)                                       | Actions   | RegionTooLargeMixin | Force-load: exempt this track from the gate and refetch.                                                                                                                                                                                          |
| [byteGateBlocksFetch](#action-bytegateblocksfetch)                   | Actions   | RegionTooLargeMixin | The entire pre-flight gate for one fetch: measure the region set, commit the estimate with the span it covers, and answer whether the caller must abandon the fetch — either superseded mid-measure, or over budget.                              |

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

The last byte measurement for this display: the estimated bytes **and the span
they cover**, which is what lets the derived gate rescale them to the span on
screen now. One volatile rather than two, because the pair is a single
measurement — written together by `setByteEstimate`, dropped together by
`clearByteEstimate`, and meaningless apart. Survives `clearAllRpcData` so an
ordinary viewport change doesn't flicker the banner; only chromosome navigation
drops it. Ignored unless `derivedRegionTooLargeEnabled`.

```ts
// type signature
type byteEstimate = ByteEstimate | undefined
// code
byteEstimate: undefined as ByteEstimate | undefined
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

#### getter: byteGateEnabled

The one opt-in a pre-flight display writes: true means "measure this fetch and
gate on it". `byteGateBlocksFetch` reads it (so a display that calls the gate
unconditionally still pays no RPC when it's off) and so does the verdict, which
is why requesting the estimate and gating on it can't drift apart. MAF flips it
off in summary mode, LD for pre-computed adapters.

```ts
type byteGateEnabled = boolean
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

#### getter: densityTooLarge

Second (non-byte) too-large axis folded into the derived verdict — canvas
overrides it with its feature-density gate. Byte-only derived displays leave it
false.

```ts
type densityTooLarge = boolean
```

#### getter: adapterFetchSizeLimit

The adapter's own `fetchSizeLimit` slot (undefined when the adapter type
declares none); `resolveByteLimit` prefers it over the display config. Read on
the main thread, and only here — the estimate that crosses the worker boundary
carries bytes and nothing else, so the banner and the worker budget have no
second spelling of "the adapter's limit" to disagree about.

A slot **path off the live config**, not a read off `self.adapterConfig`: that
getter is a snapshot, which by design omits slots sitting at their default, so a
BAM's declared 5 Mb read back as `undefined` in every config that doesn't
restate it. Resolved values come from a config node — see CONFIG_PATTERN.md
§"Reading a slot: node, not snapshot".

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

#### getter: gateVisibleBp

The span on screen, or undefined before the view is measured. The gate's only
read of its container: `visibleBp` reads `view.width`, which throws before
measurement and a bare getter must never throw, so the pre-init guard lives here
once rather than at each reader.

```ts
type gateVisibleBp = number | undefined
```

#### getter: derivedRegionTooLargeEnabled

Whether the derived, self-releasing gate is live at all — the union of the two
ways a display can measure: a pre-flight estimate (`byteGateEnabled`) or a byte
check folded into its own feature RPC (`gateFoldedIntoFetch`). Additive, never
an override, so a gate mixin's opt-in doesn't hinge on which side of
`.compose()` it lands on. False for the non-byte displays (wiggle, manhattan,
sequence, synteny), which therefore never evaluate the LGV-only `tooLargeStatus`
getters.

```ts
type derivedRegionTooLargeEnabled = boolean
```

#### getter: byteGateExempt

True when nothing may gate, on either axis and in both the worker and the
banner: the declarative `forceLoad` slot, or the force-load button. One boolean
is the whole force-load mechanism — there is no per-region ceiling to carry,
expire, or reconcile between the two axes. A self-summarizing adapter (BigWig,
HiC, sequence) needs no term here: it reports no byte estimate at all, which
already keeps the byte axis out of the verdict.

```ts
type byteGateExempt = boolean
```

#### getter: estimatedBytesForVisibleSpan

How many bytes we estimate a fetch of the span on screen right now would pull,
obtained by rescaling the stored measurement from the span it covers. Rescaling
is what makes the derived verdict a pure function of the current view and lets
it self-release on zoom-in — without it a large zoomed-out estimate stays above
the limit forever and gates refetch. Only meaningful when
`derivedRegionTooLargeEnabled`.

```ts
type estimatedBytesForVisibleSpan = number | undefined
```

#### getter: gateByteLimit

The byte budget the gate enforces: the adapter's limit, else the display config.
Also what `resolvedByteLimit()` hands the worker, so the two can't gate against
different numbers. Force-load doesn't raise this — it exempts the track outright
via `byteGateExempt`.

```ts
type gateByteLimit = number
```

#### getter: gateActive

Whether anything may gate at this moment: the display opted in, nothing exempts
it, and the view is measured and wider than the `AUTO_FORCE_LOAD_BP` force-load
floor.

The single home of that question. Everything downstream reads it instead of
restating it: the verdict, the pre-flight (no estimate RPC when nothing could
act on it), and the worker budgets, which go undefined together here rather than
each re-deriving the floor. The floor used to be spelled out in three places at
three layers, which is a standing invitation for them to disagree.

```ts
type gateActive = boolean
```

#### getter: tooLargeStatus

The verdict the whole mixin exists to produce, with the banner text: true when
the estimated download for the span on screen exceeds the resolved byte budget,
or when the display's own density axis trips (bytes take precedence for the
text). Derived from the rescaled estimate, so it releases itself on zoom-in;
false whenever `gateActive` is false.

The fetch autoruns hold off while `regionTooLarge` is true, and `DisplayChrome`
renders the banner from `regionTooLargeReason`.

```ts
type tooLargeStatus = RegionTooLargeStatus
```

#### getter: regionTooLargeReason

Which axis tripped, as banner text: the estimated download size, or "Too many
features". Empty string when the region isn't too large.

```ts
type regionTooLargeReason = string
```

</details>

<details>
<summary>RegionTooLargeMixin - Getters (other undocumented members)</summary>

| Member                                                 | Type      |
| ------------------------------------------------------ | --------- |
| <span id="getter-regiontoolarge">regionTooLarge</span> | `boolean` |

</details>

<details>
<summary>RegionTooLargeMixin - Methods</summary>

#### method: resolvedByteLimit

The byte budget a fetch RPC enforces worker-side, short-circuiting an
over-budget region before it downloads any features. Undefined (unlimited) when
nothing gates; otherwise the very number the banner compares against, so the
worker can't reject a region the banner then calls fine. Lives here, not on the
canvas gate that consumes it, because both its terms are this mixin's — canvas
owns only the density axis.

```ts
type resolvedByteLimit = () => number | undefined
```

</details>

<details>
<summary>RegionTooLargeMixin - Actions</summary>

#### action: setByteEstimate

Commits a byte measurement: the estimate together with the span it covers, so
the derived gate can rescale it to the span on screen. `measuredSpanBp` must be
the `visibleBp` captured when the measurement was _requested_, not read at
commit time: a view that zoomed during the in-flight fetch would otherwise
anchor the estimate to a span it never covered, and since `FetchVisibleRegions`
skips while `regionTooLarge` holds, an over-anchored estimate wedges the banner
with no refetch to correct it. Harmless for non-gated displays (they ignore it).

```ts
type setByteEstimate = (estimate: ByteEstimate) => void
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

#### action: byteGateBlocksFetch

The entire pre-flight gate for one fetch: measure the region set, commit the
estimate with the span it covers, and answer whether the caller must abandon the
fetch — either superseded mid-measure, or over budget.

Every pre-flight caller (`fetchRegions` for the MultiRegionDisplayMixin family,
LD and arc from their own global fetches) calls this and returns on true.
Sequencing the steps at a call site is what used to go wrong: the span is read
here, _before_ the await, so the estimate is anchored to the span it actually
covers — a re-read afterwards would pin it to whatever a mid-fetch zoom left on
screen, and since the fetch autoruns skip while `regionTooLarge` holds, an
over-anchored estimate wedges the banner with no refetch to correct it.

```ts
type byteGateBlocksFetch = (
  regions: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }[],
  ctx: { isStale: () => boolean },
) => Promise<boolean>
```

</details>

<details>
<summary>RegionTooLargeMixin - Actions (other undocumented members)</summary>

| Member                                 | Type         |
| -------------------------------------- | ------------ |
| <span id="action-reload">reload</span> | `() => void` |

</details>
