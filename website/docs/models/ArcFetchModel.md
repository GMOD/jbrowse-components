---
id: arcfetchmodel
title: ArcFetchModel
sidebar_label: Display -> ArcFetchModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`arc` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/shared/ArcFetchModel.ts).

## Overview

Shared fetch/gating model for both arc displays. Composes the rendering-agnostic
`GlobalFetchMixin` (cancel-safe `runFetch`, region-too-large gate,
`reload`/`reloadCounter`, `svgReady`) and adds the arc-specific data state
(`features` + its region signature) plus a **derived** `regionTooLarge` — the
exact byte-only pattern LinearWiggle/LD/canvas use, so arc has no special
region-too-large handling: the banner is a pure function of the cached estimate
scaled to the current viewport and self-releases on zoom-in with no imperative
clear.

## Members

| Member                                                                 | Kind      | Defined by                                    | Description                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | --------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [features](#volatile-features)                                         | Volatiles | ArcFetchModel                                 |                                                                                                                                                                                                                                              |
| [loadedRegionSignature](#volatile-loadedregionsignature)               | Volatiles | ArcFetchModel                                 | signature of the static-block region set `features` were fetched for; the `dataLoaded`/`svgReady` freshness axis (see regionSignature.ts)                                                                                                    |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters   | ArcFetchModel                                 |                                                                                                                                                                                                                                              |
| [dataLoaded](#getter-dataloaded)                                       | Getters   | ArcFetchModel                                 | fresh only when `features` were fetched for the current static-block set; overrides GlobalFetchMixin's default so `svgReady` can resolve on load                                                                                             |
| [setFeatures](#action-setfeatures)                                     | Actions   | ArcFetchModel                                 |                                                                                                                                                                                                                                              |
| [reload](#action-reload)                                               | Actions   | ArcFetchModel                                 | Arc's fetch trigger gates on `!dataLoaded`, so bumping `reloadCounter` alone can't refetch: the signature still matches the current blocks.                                                                                                  |
| [reloadCounter](#volatile-reloadcounter)                               | Volatiles | [GlobalFetchMixin](../globalfetchmixin)       | Bumped by `reload()` to retrigger a global display's fetch autorun.                                                                                                                                                                          |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)                 | Getters   | [GlobalFetchMixin](../globalfetchmixin)       | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data (mirrors `MultiRegionDisplayMixin.svgReadyExtraTerminal`).                                 |
| [svgReady](#getter-svgready)                                           | Getters   | [GlobalFetchMixin](../globalfetchmixin)       | Global-display analog of `MultiRegionDisplayMixin.svgReady`: true once an off-screen (SVG) export can read final data.                                                                                                                       |
| [userByteLimit](#volatile-userbytelimit)                               | Volatiles | [RegionTooLargeMixin](../regiontoolargemixin) | user-confirmed byte limit after a force-load, disabling the gate.                                                                                                                                                                            |
| [byteEstimate](#volatile-byteestimate)                                 | Volatiles | [RegionTooLargeMixin](../regiontoolargemixin) | Last byte estimate reported for this display, with the adapter's own `fetchSizeLimit` and `alwaysRender` flag.                                                                                                                               |
| [measuredSpanBp](#volatile-measuredspanbp)                             | Volatiles | [RegionTooLargeMixin](../regiontoolargemixin) | The span the current `byteEstimate` was measured over, so the derived gate can rescale it to the span on screen now.                                                                                                                         |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)           | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                          |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                         |
| [configForceLoad](#getter-configforceload)                             | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                            |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan)   | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored estimate from the span it was measured over (`measuredSpanBp`).                                                              |
| [tooLargeStatus](#getter-toolargestatus)                               | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in.                                                                 |
| [regionTooLarge](#getter-regiontoolarge)                               | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | The verdict the whole mixin exists to produce: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips.                                                       |
| [regionTooLargeReason](#getter-regiontoolargereason)                   | Getters   | [RegionTooLargeMixin](../regiontoolargemixin) | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                     |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)       | Methods   | [RegionTooLargeMixin](../regiontoolargemixin) | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                        |
| [setByteEstimate](#action-setbyteestimate)                             | Actions   | [RegionTooLargeMixin](../regiontoolargemixin) | Commits the byte estimate and records the span it covers (`measuredSpanBp`) so the derived gate can rescale it to the span on screen.                                                                                                        |
| [raiseForceLoadLimits](#action-raiseforceloadlimits)                   | Actions   | [RegionTooLargeMixin](../regiontoolargemixin) | force-load: raise the byte limit past the current request so the gate releases.                                                                                                                                                              |
| [forceLoad](#action-forceload)                                         | Actions   | [RegionTooLargeMixin](../regiontoolargemixin) | Raises the byte limit past the current estimate and triggers a reload.                                                                                                                                                                       |
| [activeStopToken](#volatile-activestoptoken)                           | Volatiles | [FetchMixin](../fetchmixin)                   | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                    |
| [fetchGeneration](#volatile-fetchgeneration)                           | Volatiles | [FetchMixin](../fetchmixin)                   | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                             |
| [error](#volatile-error)                                               | Volatiles | [FetchMixin](../fetchmixin)                   | last non-abort fetch error, or undefined                                                                                                                                                                                                     |
| [statusMessage](#volatile-statusmessage)                               | Volatiles | [FetchMixin](../fetchmixin)                   | work-in-progress status string                                                                                                                                                                                                               |
| [statusProgress](#volatile-statusprogress)                             | Volatiles | [FetchMixin](../fetchmixin)                   | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate                                                                                                                           |
| [fetchCanceled](#volatile-fetchcanceled)                               | Volatiles | [FetchMixin](../fetchmixin)                   | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                   |
| [regionStatuses](#volatile-regionstatuses)                             | Volatiles | [FetchMixin](../fetchmixin)                   | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                               |
| [lastStatusMs](#volatile-laststatusms)                                 | Volatiles | [FetchMixin](../fetchmixin)                   | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                   |
| [isLoading](#getter-isloading)                                         | Getters   | [FetchMixin](../fetchmixin)                   | true while a fetch is active                                                                                                                                                                                                                 |
| [makeStatusCallback](#method-makestatuscallback)                       | Methods   | [FetchMixin](../fetchmixin)                   | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op. |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)           | Methods   | [FetchMixin](../fetchmixin)                   | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                             |
| [setError](#action-seterror)                                           | Actions   | [FetchMixin](../fetchmixin)                   |                                                                                                                                                                                                                                              |
| [setStatusMessage](#action-setstatusmessage)                           | Actions   | [FetchMixin](../fetchmixin)                   |                                                                                                                                                                                                                                              |
| [throttleStatus](#action-throttlestatus)                               | Actions   | [FetchMixin](../fetchmixin)                   | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write.                                                                                                                                                    |
| [resetStatus](#action-resetstatus)                                     | Actions   | [FetchMixin](../fetchmixin)                   | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                 |
| [stopActiveFetch](#action-stopactivefetch)                             | Actions   | [FetchMixin](../fetchmixin)                   | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                     |
| [setRegionStatus](#action-setregionstatus)                             | Actions   | [FetchMixin](../fetchmixin)                   | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                    |
| [cancelFetch](#action-cancelfetch)                                     | Actions   | [FetchMixin](../fetchmixin)                   | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                 |
| [cancelFetchByUser](#action-cancelfetchbyuser)                         | Actions   | [FetchMixin](../fetchmixin)                   | User-initiated cancel from the loading overlay.                                                                                                                                                                                              |
| [beforeDestroy](#action-beforedestroy)                                 | Actions   | [FetchMixin](../fetchmixin)                   | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                         |
| [runFetch](#action-runfetch)                                           | Actions   | [FetchMixin](../fetchmixin)                   | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                 |

<details>
<summary>ArcFetchModel - Volatiles</summary>

#### volatile: loadedRegionSignature

signature of the static-block region set `features` were fetched for; the
`dataLoaded`/`svgReady` freshness axis (see regionSignature.ts)

```ts
// type signature
type loadedRegionSignature = string | undefined
// code
loadedRegionSignature: undefined as string | undefined
```

</details>

<details>
<summary>ArcFetchModel - Volatiles (other undocumented members)</summary>

| Member                                       | Type                     |
| -------------------------------------------- | ------------------------ |
| <span id="volatile-features">features</span> | `Feature[] \| undefined` |

</details>

<details>
<summary>ArcFetchModel - Getters</summary>

#### getter: dataLoaded

fresh only when `features` were fetched for the current static-block set;
overrides GlobalFetchMixin's default so `svgReady` can resolve on load

```ts
type dataLoaded = boolean
```

</details>

<details>
<summary>ArcFetchModel - Getters (other undocumented members)</summary>

| Member                                                                             | Type      |
| ---------------------------------------------------------------------------------- | --------- |
| <span id="getter-derivedregiontoolargeenabled">derivedRegionTooLargeEnabled</span> | `boolean` |

</details>

<details>
<summary>ArcFetchModel - Actions</summary>

#### action: reload

Arc's fetch trigger gates on `!dataLoaded`, so bumping `reloadCounter` alone
can't refetch: the signature still matches the current blocks. Drop it so
`dataLoaded` goes false and the autorun fires. `features` deliberately survives
— the stale arcs stay on screen under the loading overlay rather than blanking,
and `setFeatures` replaces them.

```ts
type reload = () => void
```

</details>

<details>
<summary>ArcFetchModel - Actions (other undocumented members)</summary>

| Member                                           | Type                                        |
| ------------------------------------------------ | ------------------------------------------- |
| <span id="action-setfeatures">setFeatures</span> | `(f: Feature[], signature: string) => void` |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from GlobalFetchMixin</summary>

[GlobalFetchMixin →](../globalfetchmixin)

**Volatiles**

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

**Getters**

#### getter: svgReadyExtraTerminal

Overridable hook (default false): a subclass returns true to mark an extra
terminal state where off-screen export can proceed with no loaded data (mirrors
`MultiRegionDisplayMixin.svgReadyExtraTerminal`).

```ts
type svgReadyExtraTerminal = boolean
```

#### getter: svgReady

Global-display analog of `MultiRegionDisplayMixin.svgReady`: true once an
off-screen (SVG) export can read final data. Like that mixin it requires the
dataset to actually be loaded (or a terminal error / too-large / extra state),
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
<summary>Derived from RegionTooLargeMixin</summary>

[RegionTooLargeMixin →](../regiontoolargemixin)

**Volatiles**

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

**Getters**

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

**Methods**

#### method: regionCannotBeRenderedText

Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the
display chrome via `TooLargeMessage`, not the model.

```ts
type regionCannotBeRenderedText = () => '' | 'Force load to see features'
```

**Actions**

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

#### volatile: lastStatusMs

Date.now() of the last applied status write; the status callbacks gate on it to
throttle a high-frequency progress stream.

```ts
// type signature
type lastStatusMs = number
// code
lastStatusMs: 0
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
status bar instead of clobbering each other. Same `isAlive` guard.

```ts
type makeRegionStatusCallback = (key: number) => (status: RpcStatus) => void
```

**Actions**

#### action: throttleStatus

Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last
status write. A leading-edge throttle: sparse updates pass straight through,
dense progress bursts are thinned so the loading overlay stops re-rendering
faster than the view animates. The final status doesn't need a trailing flush —
fetch completion clears it via `resetStatus`.

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

| Member                                                     | Type                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| <span id="action-seterror">setError</span>                 | `(error?: unknown) => void`                 |
| <span id="action-setstatusmessage">setStatusMessage</span> | `(status?: RpcStatus \| undefined) => void` |

</details>
