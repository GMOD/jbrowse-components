---
id: globaldatadisplaymixin
title: GlobalDataDisplayMixin
sidebar_label: Mixin -> GlobalDataDisplayMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/GlobalDataDisplayMixin.ts).

## Overview

Mixin for GPU displays that hold a single global (non-regional) dataset — HiC
contact matrix, LD triangle, variant matrix, etc.

`GlobalFetchMixin` (the rendering-agnostic fetch foundation) +
RenderLifecycleMixin (attachRenderingBackend, renderNow, renderError, …) + the
GPU `displayPhase`.

Unlike MultiRegionDisplayMixin, it owns no per-region state and installs no
autoruns. Fetch triggering is left to the display's own afterAttach autorun so
each display can express its own trigger conditions (HiC: viewport change; LD:
viewport + showLDTriangle + etc). The shared skeleton of that autorun lives in
`installGlobalFetchAutorun` (below) — a display supplies only its own
`shouldFetch` gate + `fetch` action.

## Members

| Member                                                             | Kind       | Defined by                                      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ---------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [displayPhase](#getter-displayphase)                               | Getters    | GlobalDataDisplayMixin                          | Same precedence as MultiRegionDisplayMixin (single-sourced in `computeDisplayPhase`). A global display has no per-region staleness axis — it either has its one dataset or is fetching it — so its `loading` axis is simply "fetch in flight". Reads `renderError` (RenderLifecycleMixin), which is why it lives here, not in GlobalFetchMixin.                                                                                                                                                                                                                                                                 |
| [reloadCounter](#volatile-reloadcounter)                           | Volatiles  | [GlobalFetchMixin](../globalfetchmixin)         | Bumped by `reload()` to retrigger a global display's fetch autorun. Each display reads `void self.reloadCounter` in its `afterAttach` fetch autorun so a user-initiated reload re-runs the fetch even when no viewport/setting changed.                                                                                                                                                                                                                                                                                                                                                                         |
| [dataLoaded](#getter-dataloaded)                                   | Getters    | [GlobalFetchMixin](../globalfetchmixin)         | Overridable hook (default false): a subclass returns true once its single global dataset has actually been fetched — even when the fetch committed an empty result. The mixin owns no data state, so a global display must express this; it is the global-display analog of `MultiRegionDisplayMixin.viewportWithinLoadedData`.                                                                                                                                                                                                                                                                                 |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)             | Getters    | [GlobalFetchMixin](../globalfetchmixin)         | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data (mirrors `MultiRegionDisplayMixin.svgReadyExtraTerminal`).                                                                                                                                                                                                                                                                                                                                                                                                    |
| [svgReady](#getter-svgready)                                       | Getters    | [GlobalFetchMixin](../globalfetchmixin)         | Global-display analog of `MultiRegionDisplayMixin.svgReady`: true once an off-screen (SVG) export can read final data. Like that mixin it requires the dataset to actually be loaded (or a terminal error / too-large / extra state), NOT merely "not currently fetching": the fetch trigger is a debounced `afterAttach` autorun, so at export time `isLoading` can still be false with no data yet — a `displayPhase !== 'loading'` test would then capture an empty render. Never gates on `canvasDrawn`, which an off-screen export never sets. Off-screen renderers gate on it via `awaitSvgReady(model)`. |
| [reload](#action-reload)                                           | Actions    | [GlobalFetchMixin](../globalfetchmixin)         | Satisfies the `reload` contract `DisplayChrome` (and the arc SVG chrome) require of every display. Clears any error and bumps `reloadCounter` so the display's fetch autorun re-runs. A subclass whose reload needs extra teardown can override and chain.                                                                                                                                                                                                                                                                                                                                                      |
| [userByteSizeLimit](#property-userbytesizelimit)                   | Properties | [RegionTooLargeMixin](../regiontoolargemixin)   | user-confirmed byte limit after a force-load, disabling the gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [regionTooLargeState](#volatile-regiontoolargestate)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [regionTooLargeReasonState](#volatile-regiontoolargereasonstate)   | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [featureDensityStats](#volatile-featuredensitystats)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [regionTooLarge](#getter-regiontoolarge)                           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [regionTooLargeReason](#getter-regiontoolargereason)               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)   | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)   | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [setRegionTooLarge](#action-setregiontoolarge)                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setFeatureDensityStats](#action-setfeaturedensitystats)           | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setFeatureDensityStatsLimit](#action-setfeaturedensitystatslimit) | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)   | force-load: raise the byte limit past the current request and clear the too-large banner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [forceLoad](#action-forceload)                                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)   | Raises the byte limit past the current density stats and triggers a reload. The display chrome calls this via TooLargeMessage's force-load button; concrete display models override reload() to do the actual refetch.                                                                                                                                                                                                                                                                                                                                                                                          |
| [activeStopToken](#volatile-activestoptoken)                       | Volatiles  | [FetchMixin](../fetchmixin)                     | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [fetchGeneration](#volatile-fetchgeneration)                       | Volatiles  | [FetchMixin](../fetchmixin)                     | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [error](#volatile-error)                                           | Volatiles  | [FetchMixin](../fetchmixin)                     | last non-abort fetch error, or undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [statusMessage](#volatile-statusmessage)                           | Volatiles  | [FetchMixin](../fetchmixin)                     | work-in-progress status string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [statusProgress](#volatile-statusprogress)                         | Volatiles  | [FetchMixin](../fetchmixin)                     | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [fetchCanceled](#volatile-fetchcanceled)                           | Volatiles  | [FetchMixin](../fetchmixin)                     | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`, it does not retrigger the fetch autoruns — so the load stays stopped until the user retries (`reload`) or the viewport changes. Any new fetch clears it (`runFetch` resets it at the start).                                                                                                                                                                                                                                                       |
| [regionStatuses](#volatile-regionstatuses)                         | Volatiles  | [FetchMixin](../fetchmixin)                     | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex). Plain bookkeeping — not read reactively; setRegionStatus derives the observable statusMessage/statusProgress from it on every update so N parallel region fetches aggregate into one bar instead of clobbering.                                                                                                                                                                                                                                                                  |
| [lastStatusMs](#volatile-laststatusms)                             | Volatiles  | [FetchMixin](../fetchmixin)                     | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [isLoading](#getter-isloading)                                     | Getters    | [FetchMixin](../fetchmixin)                     | true while a fetch is active                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [makeStatusCallback](#method-makestatuscallback)                   | Methods    | [FetchMixin](../fetchmixin)                     | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op. Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard at every call site.                                                                                                                                                                                                                                                                 |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)       | Methods    | [FetchMixin](../fetchmixin)                     | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other. Same `isAlive` guard.                                                                                                                                                                                                                                                                                                                                                                                          |
| [setError](#action-seterror)                                       | Actions    | [FetchMixin](../fetchmixin)                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setStatusMessage](#action-setstatusmessage)                       | Actions    | [FetchMixin](../fetchmixin)                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [throttleStatus](#action-throttlestatus)                           | Actions    | [FetchMixin](../fetchmixin)                     | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write. A leading-edge throttle: sparse updates pass straight through, dense progress bursts are thinned so the loading overlay stops re-rendering faster than the view animates. The final status doesn't need a trailing flush — fetch completion clears it via `resetStatus`.                                                                                                                                                                                                                                              |
| [resetStatus](#action-resetstatus)                                 | Actions    | [FetchMixin](../fetchmixin)                     | Drop the active stop token and clear all status bookkeeping. Shared by both cancel paths and runFetch's cleanup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [stopActiveFetch](#action-stopactivefetch)                         | Actions    | [FetchMixin](../fetchmixin)                     | Abort the in-flight fetch (if any) and clear its status. The shared preamble of both cancel paths; the difference between them is only what they do to `fetchCanceled` / `fetchGeneration` afterward.                                                                                                                                                                                                                                                                                                                                                                                                           |
| [setRegionStatus](#action-setregionstatus)                         | Actions    | [FetchMixin](../fetchmixin)                     | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys. Pass undefined to drop a key. Used by displays that fan a single fetch out into parallel per-region RPCs.                                                                                                                                                                                                                                                                                                                                             |
| [cancelFetch](#action-cancelfetch)                                 | Actions    | [FetchMixin](../fetchmixin)                     | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight). This is the _internal_ reset used by clearAllRpcData/invalidateLoadedRegions — it clears any user-cancel flag so the retrigger actually re-fetches.                                                                                                                                                                                                                                                                                                                |
| [cancelFetchByUser](#action-cancelfetchbyuser)                     | Actions    | [FetchMixin](../fetchmixin)                     | User-initiated cancel from the loading overlay. Stops the in-flight fetch and lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump fetchGeneration — so the fetch autoruns don't immediately restart the load. The user retries via `reload` (the overlay's retry button), or it clears on the next viewport change.                                                                                                                                                                                                                                                                |
| [runFetch](#action-runfetch)                                       | Actions    | [FetchMixin](../fetchmixin)                     | Run a cancel-safe fetch (cancels any prior). The work callback gets a FetchContext with a stopToken to forward to the RPC and an isStale() check to short-circuit commits once the user has moved on. Abort errors are swallowed; others are stored in `error` if not stale.                                                                                                                                                                                                                                                                                                                                    |
| [canvasDrawn](#volatile-canvasdrawn)                               | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [currentRenderingBackend](#volatile-currentrenderingbackend)       | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | current backend reference, updated on context-loss recovery. Typed `unknown` (not generic `B`) on purpose: this mixin is composed by every display via a non-generic factory, so the per-display backend type `B` isn't known here — it's supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the autoruns. Don't "fix" the cast.                                                                                                                                                                                                                                                           |
| [renderTick](#volatile-rendertick)                                 | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [autorunsInstalled](#volatile-autorunsinstalled)                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [renderError](#volatile-rendererror)                               | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined. Single source of truth for the render-error terminal state: `useRenderingBackend` writes it from the canvas-init mechanism so the model — not React-local hook state — owns every terminal state. Read by `displayPhase` (whose `renderError` term outranks `loading`, suppressing the scrim) and by `DisplayChrome` (shows the retry overlay).                                                                                                                                                                                     |
| [markCanvasDrawn](#action-markcanvasdrawn)                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                       | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [stopRenderingBackend](#action-stoprenderingbackend)               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [renderNow](#action-rendernow)                                     | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setRenderError](#action-setrendererror)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) | set/clear the render-backend error. Called by `useRenderingBackend`: with the error when the canvas factory rejects (or context-loss re-init fails), and with `undefined` on successful (re)init and on retry.                                                                                                                                                                                                                                                                                                                                                                                                  |
| [attachRenderingBackend](#action-attachrenderingbackend)           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

<details>
<summary>GlobalDataDisplayMixin - Getters</summary>

#### getter: displayPhase

Same precedence as MultiRegionDisplayMixin (single-sourced in
`computeDisplayPhase`). A global display has no per-region staleness axis — it
either has its one dataset or is fetching it — so its `loading` axis is simply
"fetch in flight". Reads `renderError` (RenderLifecycleMixin), which is why it
lives here, not in GlobalFetchMixin.

```ts
type displayPhase = DisplayPhase
```

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

#### getter: dataLoaded

Overridable hook (default false): a subclass returns true once its single global
dataset has actually been fetched — even when the fetch committed an empty
result. The mixin owns no data state, so a global display must express this; it
is the global-display analog of
`MultiRegionDisplayMixin.viewportWithinLoadedData`.

```ts
type dataLoaded = boolean
```

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

**Actions**

#### action: reload

Satisfies the `reload` contract `DisplayChrome` (and the arc SVG chrome) require
of every display. Clears any error and bumps `reloadCounter` so the display's
fetch autorun re-runs. A subclass whose reload needs extra teardown can override
and chain.

```ts
type reload = () => void
```

</details>

<details>
<summary>Derived from RegionTooLargeMixin</summary>

[RegionTooLargeMixin →](../regiontoolargemixin)

**Properties**

#### property: userByteSizeLimit

user-confirmed byte limit after a force-load, disabling the gate

```ts
// type signature
type userByteSizeLimit = IMaybe<ISimpleType<number>>
// code
userByteSizeLimit: types.maybe(types.number)
```

**Volatiles**

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

**Getters**

#### getter: regionTooLarge

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

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

#### action: setRegionTooLarge

```ts
type setRegionTooLarge = (val: boolean, reason?: string | undefined) => void
```

#### action: setFeatureDensityStats

```ts
type setFeatureDensityStats = (stats?: FeatureDensityStats | undefined) => void
```

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

#### action: setError

```ts
type setError = (error?: unknown) => void
```

#### action: setStatusMessage

```ts
type setStatusMessage = (status?: RpcStatus | undefined) => void
```

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

#### action: runFetch

Run a cancel-safe fetch (cancels any prior). The work callback gets a
FetchContext with a stopToken to forward to the RPC and an isStale() check to
short-circuit commits once the user has moved on. Abort errors are swallowed;
others are stored in `error` if not stale.

```ts
type runFetch = (work: (ctx: FetchContext) => Promise<void>) => Promise<void>
```

</details>

<details>
<summary>Derived from RenderLifecycleMixin</summary>

[RenderLifecycleMixin →](../renderlifecyclemixin)

**Volatiles**

#### volatile: canvasDrawn

flips true on first paint; read by test selectors to detect render

```ts
// type signature
type canvasDrawn = false
// code
canvasDrawn: false
```

#### volatile: currentRenderingBackend

current backend reference, updated on context-loss recovery. Typed `unknown`
(not generic `B`) on purpose: this mixin is composed by every display via a
non-generic factory, so the per-display backend type `B` isn't known here — it's
supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the
autoruns. Don't "fix" the cast.

```ts
// type signature
type currentRenderingBackend = undefined
// code
currentRenderingBackend: undefined
```

#### volatile: renderTick

counter the render autorun observes; bumped to force a re-render

```ts
// type signature
type renderTick = number
// code
renderTick: 0
```

#### volatile: autorunsInstalled

guards attachRenderingBackend so the autorun pair spawns once per instance

```ts
// type signature
type autorunsInstalled = false
// code
autorunsInstalled: false
```

#### volatile: renderError

the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.
Single source of truth for the render-error terminal state:
`useRenderingBackend` writes it from the canvas-init mechanism so the model —
not React-local hook state — owns every terminal state. Read by `displayPhase`
(whose `renderError` term outranks `loading`, suppressing the scrim) and by
`DisplayChrome` (shows the retry overlay).

```ts
// type signature
type renderError = undefined
// code
renderError: undefined
```

**Actions**

#### action: markCanvasDrawn

```ts
type markCanvasDrawn = () => void
```

#### action: resetCanvasDrawn

```ts
type resetCanvasDrawn = () => void
```

#### action: stopRenderingBackend

```ts
type stopRenderingBackend = () => void
```

#### action: renderNow

```ts
type renderNow = () => void
```

#### action: setRenderError

set/clear the render-backend error. Called by `useRenderingBackend`: with the
error when the canvas factory rejects (or context-loss re-init fails), and with
`undefined` on successful (re)init and on retry.

```ts
type setRenderError = (error: unknown) => void
```

#### action: attachRenderingBackend

attach a GPU/Canvas2D backend and install the upload + render autorun pair
(idempotent — re-calling only swaps the backend)

```ts
type attachRenderingBackend = <B>(
  backend: B,
  cbs: RenderingBackendCallbacks<B>,
) => void
```

</details>
