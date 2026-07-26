---
id: globalfetchmixin
title: GlobalFetchMixin
sidebar_label: Mixin -> GlobalFetchMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/GlobalFetchMixin.ts).

## Overview

Rendering-agnostic foundation for any display holding a single global
(non-regional) dataset. Owns the _fetch_ concern only — no GPU rendering — so it
is shared by GPU global displays (via GlobalDataDisplayMixin) AND main-thread
SVG ones (the arc displays), which compose it directly. That's the whole reason
it's split out from GlobalDataDisplayMixin: fetch (cancellation, staleness,
region-too-large, reload, the svgReady export gate) is orthogonal to how the
display paints, so a non-GPU display shouldn't have to drag in
RenderLifecycleMixin to get it.

Composes:

- RegionTooLargeMixin (regionTooLarge, force-load, …)
- FetchMixin (runFetch, cancelFetch, isLoading, error, statusMessage,
  fetchGeneration)

Installs no autoruns — each display owns its fetch trigger, sharing the
`installGlobalFetchAutorun` skeleton. `displayPhase` lives in
GlobalDataDisplayMixin, not here, because it reads `renderError` from
RenderLifecycleMixin — the one genuinely GPU-only piece. A non-GPU composer
(arc) defines its own one-line `displayPhase` over the same shared
`computeDisplayPhase`, passing `renderError: undefined`.

## Members

| Member                                                                 | Kind      | Defined by                                    | Description                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | --------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [reloadCounter](#volatile-reloadcounter)                               | Volatiles | GlobalFetchMixin                              | Bumped by `reload()` to retrigger a global display's fetch autorun.                                                                                                                                                                          |
| [dataCurrent](#getter-datacurrent)                                     | Getters   | GlobalFetchMixin                              | This family's answer to the shared freshness question every display foundation must answer: the held data corresponds to what is on screen right now — fetched, and fetched _for this viewport_.                                             |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)                 | Getters   | GlobalFetchMixin                              | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data (mirrors `MultiRegionDisplayMixin.svgReadyExtraTerminal`).                                 |
| [svgReady](#getter-svgready)                                           | Getters   | GlobalFetchMixin                              | Policy single-sourced in `computeSvgReady`; this family supplies only its `dataCurrent` predicate.                                                                                                                                           |
| [reload](#action-reload)                                               | Actions   | GlobalFetchMixin                              | Satisfies the `reload` contract `DisplayChrome` (and the arc SVG chrome) require of every display.                                                                                                                                           |
| [forceLoadTrack](#volatile-forceloadtrack)                             | Volatiles | [RegionTooLargeMixin](../regiontoolargemixin) | The force-load button's answer: render this track regardless of region size or feature density.                                                                                                                                              |
| [byteEstimate](#volatile-byteestimate)                                 | Volatiles | [RegionTooLargeMixin](../regiontoolargemixin) | Last byte estimate reported for this display, with the adapter's own `fetchSizeLimit` and `alwaysRender` flag.                                                                                                                               |
| [measuredSpanBp](#volatile-measuredspanbp)                             | Volatiles | [RegionTooLargeMixin](../regiontoolargemixin) | The span the current `byteEstimate` was measured over, so the derived gate can rescale it to the span on screen now.                                                                                                                         |
| [gateFoldedIntoFetch](#getter-gatefoldedintofetch)                     | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Additive opt-in for displays that measure the estimate inside their own feature RPC instead of a pre-flight (canvas).                                                                                                                        |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Opt-in switch: a byte-gated display flips this true to enable the derived, self-releasing region-too-large gate.                                                                                                                             |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)           | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                          |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                         |
| [adapterFetchSizeLimit](#getter-adapterfetchsizelimit)                 | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | The adapter's own `fetchSizeLimit` slot (undefined when the adapter type declares none); `resolveByteLimit` prefers it over the display config.                                                                                              |
| [configForceLoad](#getter-configforceload)                             | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                            |
| [resolvedAdapterByteLimit](#getter-resolvedadapterbytelimit)           | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | The adapter's byte budget, preferring one the estimate computed dynamically over the static `fetchSizeLimit` slot.                                                                                                                           |
| [byteGateExempt](#getter-bytegateexempt)                               | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | True when nothing may gate, on either axis and in both the worker and the banner: a self-summarizing adapter (BigWig/HiC cap what they return at screen resolution), the declarative `forceLoad` slot, or the force-load button.             |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan)   | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored estimate from the span it was measured over (`measuredSpanBp`).                                                              |
| [gateByteLimit](#getter-gatebytelimit)                                 | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | The byte budget the gate enforces: the adapter's limit, else the display config.                                                                                                                                                             |
| [tooLargeStatus](#getter-toolargestatus)                               | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in.                                                                 |
| [regionTooLarge](#getter-regiontoolarge)                               | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | The verdict the whole mixin exists to produce: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips.                                                       |
| [regionTooLargeReason](#getter-regiontoolargereason)                   | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                     |
| [setByteEstimate](#action-setbyteestimate)                             | Actions   | [RegionTooLargeMixin](../regiontoolargemixin) | Commits the byte estimate together with the span it covers, so the derived gate can rescale it to the span on screen.                                                                                                                        |
| [clearByteEstimate](#action-clearbyteestimate)                         | Actions   | [RegionTooLargeMixin](../regiontoolargemixin) | Drops the cached estimate.                                                                                                                                                                                                                   |
| [setForceLoadTrack](#action-setforceloadtrack)                         | Actions   | [RegionTooLargeMixin](../regiontoolargemixin) | Exempt this track from the gate (or put it back under it).                                                                                                                                                                                   |
| [forceLoad](#action-forceload)                                         | Actions   | [RegionTooLargeMixin](../regiontoolargemixin) | Force-load: exempt this track from the gate and refetch.                                                                                                                                                                                     |
| [activeStopToken](#volatile-activestoptoken)                           | Volatiles | [FetchMixin](../fetchmixin)                   | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                    |
| [fetchGeneration](#volatile-fetchgeneration)                           | Volatiles | [FetchMixin](../fetchmixin)                   | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                             |
| [error](#volatile-error)                                               | Volatiles | [FetchMixin](../fetchmixin)                   | last non-abort fetch error, or undefined                                                                                                                                                                                                     |
| [statusMessage](#volatile-statusmessage)                               | Volatiles | [FetchMixin](../fetchmixin)                   | work-in-progress status string                                                                                                                                                                                                               |
| [statusProgress](#volatile-statusprogress)                             | Volatiles | [FetchMixin](../fetchmixin)                   | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate                                                                                                                           |
| [fetchCanceled](#volatile-fetchcanceled)                               | Volatiles | [FetchMixin](../fetchmixin)                   | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                   |
| [regionStatuses](#volatile-regionstatuses)                             | Volatiles | [FetchMixin](../fetchmixin)                   | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                               |
| [isLoading](#getter-isloading)                                         | Getters   | [FetchMixin](../fetchmixin)                   | true while a fetch is active                                                                                                                                                                                                                 |
| [makeStatusCallback](#method-makestatuscallback)                       | Methods   | [FetchMixin](../fetchmixin)                   | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op. |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)           | Methods   | [FetchMixin](../fetchmixin)                   | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                             |
| [setError](#action-seterror)                                           | Actions   | [FetchMixin](../fetchmixin)                   |                                                                                                                                                                                                                                              |
| [setStatusMessage](#action-setstatusmessage)                           | Actions   | [FetchMixin](../fetchmixin)                   | Unthrottled: a display writing a phase label by hand must see every write land.                                                                                                                                                              |
| [throttleStatus](#action-throttlestatus)                               | Actions   | [FetchMixin](../fetchmixin)                   | Run `apply` only if the throttle window has elapsed.                                                                                                                                                                                         |
| [resetStatus](#action-resetstatus)                                     | Actions   | [FetchMixin](../fetchmixin)                   | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                 |
| [stopActiveFetch](#action-stopactivefetch)                             | Actions   | [FetchMixin](../fetchmixin)                   | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                     |
| [setRegionStatus](#action-setregionstatus)                             | Actions   | [FetchMixin](../fetchmixin)                   | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                    |
| [cancelFetch](#action-cancelfetch)                                     | Actions   | [FetchMixin](../fetchmixin)                   | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                 |
| [cancelFetchByUser](#action-cancelfetchbyuser)                         | Actions   | [FetchMixin](../fetchmixin)                   | User-initiated cancel from the loading overlay.                                                                                                                                                                                              |
| [beforeDestroy](#action-beforedestroy)                                 | Actions   | [FetchMixin](../fetchmixin)                   | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                         |
| [runFetch](#action-runfetch)                                           | Actions   | [FetchMixin](../fetchmixin)                   | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                 |

<details>
<summary>GlobalFetchMixin - Volatiles</summary>

#### volatile: reloadCounter

Bumped by `reload()` to retrigger a global display's fetch autorun. Each display
reads `void self.reloadCounter` in its `afterAttach` fetch autorun so a
user-initiated reload re-runs the fetch even when no viewport/setting changed.

```ts
// type signature
type reloadCounter = number
// code
reloadCounter: 0
```

</details>

<details>
<summary>GlobalFetchMixin - Getters</summary>

#### getter: dataCurrent

This family's answer to the shared freshness question every display foundation
must answer: the held data corresponds to what is on screen right now — fetched,
and fetched _for this viewport_. The mixin owns no data state, so a global
display must express it; the two in tree do so differently (HiC compares the
viewport snapshot via `viewportMatchesLastDrawn`, arc compares a region
signature via `isDataCurrent`), which is exactly what the hook is for.

Default false, so a display that forgets the override never exports — a hung
export is diagnosable, a stale one silently ships wrong pixels.

```ts
type dataCurrent = boolean
```

#### getter: svgReadyExtraTerminal

Overridable hook (default false): a subclass returns true to mark an extra
terminal state where off-screen export can proceed with no loaded data (mirrors
`MultiRegionDisplayMixin.svgReadyExtraTerminal`).

```ts
type svgReadyExtraTerminal = boolean
```

#### getter: svgReady

Policy single-sourced in `computeSvgReady`; this family supplies only its
`dataCurrent` predicate. Note it requires the dataset to actually be current,
NOT merely "not currently fetching": the fetch trigger is a debounced
`afterAttach` autorun, so at export time `isLoading` can still be false with no
data yet — a `displayPhase !== 'loading'` test would then capture an empty
render. Never gates on `canvasDrawn`, which an off-screen export never sets.
Off-screen renderers gate on it via `awaitSvgReady(model)`.

```ts
type svgReady = boolean
```

</details>

<details>
<summary>GlobalFetchMixin - Actions</summary>

#### action: reload

Satisfies the `reload` contract `DisplayChrome` (and the arc SVG chrome) require
of every display. Clears any error and bumps `reloadCounter` so the display's
fetch autorun re-runs. A subclass whose reload needs extra teardown can override
and chain.

```ts
type reload = () => void
```

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from RegionTooLargeMixin</summary>

[RegionTooLargeMixin →](../regiontoolargemixin)

**Volatiles**

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

**Getters**

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

**Actions**

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
<summary>Derived from FetchMixin</summary>

[FetchMixin →](../fetchmixin)

**Volatiles**

#### volatile: activeStopToken

stop token of the in-flight fetch, or undefined when idle

```ts
// type signature
type activeStopToken = StopToken | undefined
// code
activeStopToken: undefined as StopToken | undefined
```

#### volatile: fetchGeneration

bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the
staleness epoch inside runFetch

```ts
// type signature
type fetchGeneration = number
// code
fetchGeneration: 0
```

#### volatile: error

last non-abort fetch error, or undefined

```ts
// type signature
type error = unknown
// code
error: undefined as unknown
```

#### volatile: statusMessage

work-in-progress status string

```ts
// type signature
type statusMessage = string | undefined
// code
statusMessage: undefined as string | undefined
```

#### volatile: statusProgress

determinate progress fraction [0,1] for the current status, or undefined when
the in-flight phase is indeterminate

```ts
// type signature
type statusProgress = number | undefined
// code
statusProgress: undefined as number | undefined
```

#### volatile: fetchCanceled

true after the user explicitly cancels a load (the loading overlay's cancel
button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`,
it does not retrigger the fetch autoruns — so the load stays stopped until the
user retries (`reload`) or the viewport changes. Any new fetch clears it
(`runFetch` resets it at the start).

```ts
// type signature
type fetchCanceled = false
// code
fetchCanceled: false
```

#### volatile: regionStatuses

latest status of each concurrent in-flight operation, keyed by an arbitrary id
(the canvas display uses displayedRegionIndex). Plain bookkeeping — not read
reactively; setRegionStatus derives the observable statusMessage/statusProgress
from it on every update so N parallel region fetches aggregate into one bar
instead of clobbering.

```ts
// type signature
type regionStatuses = Map<number, RpcStatus>
// code
regionStatuses: new Map<number, RpcStatus>()
```

**Getters**

#### getter: isLoading

true while a fetch is active

```ts
type isLoading = boolean
```

**Methods**

#### method: makeStatusCallback

An RPC `statusCallback` bound to this display: forwards progress to the shared
`statusMessage`, guarded by `isAlive` so a callback that fires after the node is
torn down (RPCs resolve their status stream asynchronously) is a safe no-op.
Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard
at every call site.

```ts
type makeStatusCallback = () => (status: RpcStatus) => void
```

#### method: makeRegionStatusCallback

Per-region variant of `makeStatusCallback`: routes progress through
`setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one
status bar instead of clobbering each other. Same `isAlive` guard;
`setRegionStatus` owns the throttling (it has to thin only the bar write, not
the per-region bookkeeping).

```ts
type makeRegionStatusCallback = (key: number) => (status: RpcStatus) => void
```

**Actions**

#### action: setStatusMessage

Unthrottled: a display writing a phase label by hand must see every write land.
The high-frequency RPC stream is thinned one level up, in the callback
factories.

```ts
type setStatusMessage = (status?: RpcStatus | undefined) => void
```

#### action: throttleStatus

Run `apply` only if the throttle window has elapsed.

```ts
type throttleStatus = (apply: () => void) => void
```

#### action: resetStatus

Drop the active stop token and clear all status bookkeeping. Shared by both
cancel paths and runFetch's cleanup.

```ts
type resetStatus = () => void
```

#### action: stopActiveFetch

Abort the in-flight fetch (if any) and clear its status. The shared preamble of
both cancel paths; the difference between them is only what they do to
`fetchCanceled` / `fetchGeneration` afterward.

```ts
type stopActiveFetch = () => void
```

#### action: setRegionStatus

Record one concurrent operation's latest status (keyed) and recompute the shared
statusMessage/statusProgress as the aggregate across all in-flight keys. Pass
undefined to drop a key. Used by displays that fan a single fetch out into
parallel per-region RPCs.

```ts
type setRegionStatus = (key: number, status?: RpcStatus | undefined) => void
```

#### action: cancelFetch

cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers
can retrigger fetch autoruns even when nothing was in flight). This is the
_internal_ reset used by clearAllRpcData/invalidateLoadedRegions — it clears any
user-cancel flag so the retrigger actually re-fetches.

```ts
type cancelFetch = () => void
```

#### action: cancelFetchByUser

User-initiated cancel from the loading overlay. Stops the in-flight fetch and
lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump
fetchGeneration — so the fetch autoruns don't immediately restart the load. The
user retries via `reload` (the overlay's retry button), or it clears on the next
viewport change.

```ts
type cancelFetchByUser = () => void
```

#### action: beforeDestroy

Release an in-flight fetch's stop token on teardown. Without this, a display
destroyed mid-fetch (track/view closed while loading) never revokes its token —
a blob-URL leak on the non-SAB fallback path — and never signals the worker to
abort the now-useless work. MST auto-chains lifecycle hooks, so a composing
display can still define its own beforeDestroy.

```ts
type beforeDestroy = () => void
```

#### action: runFetch

Run a cancel-safe fetch (cancels any prior). The work callback gets a
FetchContext with a stopToken to forward to the RPC and an isStale() check to
short-circuit commits once the user has moved on. Abort errors are swallowed;
others are stored in `error` if not stale.

```ts
type runFetch = (work: (ctx: FetchContext) => Promise<void>) => Promise<void>
```

| Member                                     | Type                        |
| ------------------------------------------ | --------------------------- |
| <span id="action-seterror">setError</span> | `(error?: unknown) => void` |

</details>
