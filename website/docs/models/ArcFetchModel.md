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

| Member                                                             | Kind       | Defined by                                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ---------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [features](#volatile-features)                                     | Volatiles  | ArcFetchModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [loadedRegionSignature](#volatile-loadedregionsignature)           | Volatiles  | ArcFetchModel                                 | signature of the static-block region set `features` were fetched for; the `dataLoaded`/`svgReady` freshness axis (see regionSignature.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [byteEstimateVisibleBp](#volatile-byteestimatevisiblebp)           | Volatiles  | ArcFetchModel                                 | visibleBp when the current `featureDensityStats` estimate was captured, so the derived `regionTooLarge` getter can scale it to the current view                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)       | Getters    | ArcFetchModel                                 | Overridable hook: the display's configured `fetchSizeLimit`. The mixin can't read a config slot itself (it owns no `configuration`), so each concrete arc model supplies `getConf(self, 'fetchSizeLimit')`. Default matches the BaseLinearDisplay slot default; every arc model overrides it.                                                                                                                                                                                                                                                                                                                   |
| [estimatedVisibleBytes](#getter-estimatedvisiblebytes)             | Getters    | ArcFetchModel                                 | cached byte estimate scaled from the span it was measured over to the current visible span, so the verdict self-releases on zoom-in                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [tooLargeStatus](#getter-toolargestatus)                           | Getters    | ArcFetchModel                                 | shared verdict + reason (AUTO_FORCE_LOAD_BP floor + bytes-over-limit), fed the scaled estimate — same helper as every other gating path                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [regionTooLarge](#getter-regiontoolarge)                           | Getters    | ArcFetchModel                                 | derived — shadows GlobalFetchMixin's imperative RegionTooLargeMixin getter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [regionTooLargeReason](#getter-regiontoolargereason)               | Getters    | ArcFetchModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [dataLoaded](#getter-dataloaded)                                   | Getters    | ArcFetchModel                                 | fresh only when `features` were fetched for the current static-block set; overrides GlobalFetchMixin's default so `svgReady` can resolve on load                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setFeatures](#action-setfeatures)                                 | Actions    | ArcFetchModel                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setFeatureDensityStats](#action-setfeaturedensitystats)           | Actions    | ArcFetchModel                                 | Records the span the byte estimate was measured at so `estimatedVisibleBytes` can scale it to the current view.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setFeatureDensityStatsLimit](#action-setfeaturedensitystatslimit) | Actions    | ArcFetchModel                                 | Force-load raises the byte gate past the estimate scaled to the _current_ view (shared helper), not the raw captured bytes, so it clears even if the view zoomed out after the estimate was captured.                                                                                                                                                                                                                                                                                                                                                                                                           |
| [reloadCounter](#volatile-reloadcounter)                           | Volatiles  | [GlobalFetchMixin](../globalfetchmixin)       | Bumped by `reload()` to retrigger a global display's fetch autorun. Each display reads `void self.reloadCounter` in its `afterAttach` fetch autorun so a user-initiated reload re-runs the fetch even when no viewport/setting changed.                                                                                                                                                                                                                                                                                                                                                                         |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)             | Getters    | [GlobalFetchMixin](../globalfetchmixin)       | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data (mirrors `MultiRegionDisplayMixin.svgReadyExtraTerminal`).                                                                                                                                                                                                                                                                                                                                                                                                    |
| [svgReady](#getter-svgready)                                       | Getters    | [GlobalFetchMixin](../globalfetchmixin)       | Global-display analog of `MultiRegionDisplayMixin.svgReady`: true once an off-screen (SVG) export can read final data. Like that mixin it requires the dataset to actually be loaded (or a terminal error / too-large / extra state), NOT merely "not currently fetching": the fetch trigger is a debounced `afterAttach` autorun, so at export time `isLoading` can still be false with no data yet — a `displayPhase !== 'loading'` test would then capture an empty render. Never gates on `canvasDrawn`, which an off-screen export never sets. Off-screen renderers gate on it via `awaitSvgReady(model)`. |
| [reload](#action-reload)                                           | Actions    | [GlobalFetchMixin](../globalfetchmixin)       | Satisfies the `reload` contract `DisplayChrome` (and the arc SVG chrome) require of every display. Clears any error and bumps `reloadCounter` so the display's fetch autorun re-runs. A subclass whose reload needs extra teardown can override and chain.                                                                                                                                                                                                                                                                                                                                                      |
| [userByteSizeLimit](#property-userbytesizelimit)                   | Properties | [RegionTooLargeMixin](../regiontoolargemixin) | user-confirmed byte limit after a force-load, disabling the gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [regionTooLargeState](#volatile-regiontoolargestate)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [regionTooLargeReasonState](#volatile-regiontoolargereasonstate)   | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [featureDensityStats](#volatile-featuredensitystats)               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)   | Methods    | [RegionTooLargeMixin](../regiontoolargemixin) | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [setRegionTooLarge](#action-setregiontoolarge)                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [forceLoad](#action-forceload)                                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin) | Raises the byte limit past the current density stats and triggers a reload. The display chrome calls this via TooLargeMessage's force-load button; concrete display models override reload() to do the actual refetch.                                                                                                                                                                                                                                                                                                                                                                                          |
| [activeStopToken](#volatile-activestoptoken)                       | Volatiles  | [FetchMixin](../fetchmixin)                   | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [fetchGeneration](#volatile-fetchgeneration)                       | Volatiles  | [FetchMixin](../fetchmixin)                   | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [error](#volatile-error)                                           | Volatiles  | [FetchMixin](../fetchmixin)                   | last non-abort fetch error, or undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [statusMessage](#volatile-statusmessage)                           | Volatiles  | [FetchMixin](../fetchmixin)                   | work-in-progress status string                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [statusProgress](#volatile-statusprogress)                         | Volatiles  | [FetchMixin](../fetchmixin)                   | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [fetchCanceled](#volatile-fetchcanceled)                           | Volatiles  | [FetchMixin](../fetchmixin)                   | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`, it does not retrigger the fetch autoruns — so the load stays stopped until the user retries (`reload`) or the viewport changes. Any new fetch clears it (`runFetch` resets it at the start).                                                                                                                                                                                                                                                       |
| [regionStatuses](#volatile-regionstatuses)                         | Volatiles  | [FetchMixin](../fetchmixin)                   | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex). Plain bookkeeping — not read reactively; setRegionStatus derives the observable statusMessage/statusProgress from it on every update so N parallel region fetches aggregate into one bar instead of clobbering.                                                                                                                                                                                                                                                                  |
| [lastStatusMs](#volatile-laststatusms)                             | Volatiles  | [FetchMixin](../fetchmixin)                   | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [isLoading](#getter-isloading)                                     | Getters    | [FetchMixin](../fetchmixin)                   | true while a fetch is active                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [makeStatusCallback](#method-makestatuscallback)                   | Methods    | [FetchMixin](../fetchmixin)                   | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op. Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard at every call site.                                                                                                                                                                                                                                                                 |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)       | Methods    | [FetchMixin](../fetchmixin)                   | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other. Same `isAlive` guard.                                                                                                                                                                                                                                                                                                                                                                                          |
| [setError](#action-seterror)                                       | Actions    | [FetchMixin](../fetchmixin)                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [setStatusMessage](#action-setstatusmessage)                       | Actions    | [FetchMixin](../fetchmixin)                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [throttleStatus](#action-throttlestatus)                           | Actions    | [FetchMixin](../fetchmixin)                   | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write. A leading-edge throttle: sparse updates pass straight through, dense progress bursts are thinned so the loading overlay stops re-rendering faster than the view animates. The final status doesn't need a trailing flush — fetch completion clears it via `resetStatus`.                                                                                                                                                                                                                                              |
| [resetStatus](#action-resetstatus)                                 | Actions    | [FetchMixin](../fetchmixin)                   | Drop the active stop token and clear all status bookkeeping. Shared by both cancel paths and runFetch's cleanup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [stopActiveFetch](#action-stopactivefetch)                         | Actions    | [FetchMixin](../fetchmixin)                   | Abort the in-flight fetch (if any) and clear its status. The shared preamble of both cancel paths; the difference between them is only what they do to `fetchCanceled` / `fetchGeneration` afterward.                                                                                                                                                                                                                                                                                                                                                                                                           |
| [setRegionStatus](#action-setregionstatus)                         | Actions    | [FetchMixin](../fetchmixin)                   | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys. Pass undefined to drop a key. Used by displays that fan a single fetch out into parallel per-region RPCs.                                                                                                                                                                                                                                                                                                                                             |
| [cancelFetch](#action-cancelfetch)                                 | Actions    | [FetchMixin](../fetchmixin)                   | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight). This is the _internal_ reset used by clearAllRpcData/invalidateLoadedRegions — it clears any user-cancel flag so the retrigger actually re-fetches.                                                                                                                                                                                                                                                                                                                |
| [cancelFetchByUser](#action-cancelfetchbyuser)                     | Actions    | [FetchMixin](../fetchmixin)                   | User-initiated cancel from the loading overlay. Stops the in-flight fetch and lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump fetchGeneration — so the fetch autoruns don't immediately restart the load. The user retries via `reload` (the overlay's retry button), or it clears on the next viewport change.                                                                                                                                                                                                                                                                |
| [runFetch](#action-runfetch)                                       | Actions    | [FetchMixin](../fetchmixin)                   | Run a cancel-safe fetch (cancels any prior). The work callback gets a FetchContext with a stopToken to forward to the RPC and an isStale() check to short-circuit commits once the user has moved on. Abort errors are swallowed; others are stored in `error` if not stale.                                                                                                                                                                                                                                                                                                                                    |

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

#### volatile: byteEstimateVisibleBp

visibleBp when the current `featureDensityStats` estimate was captured, so the
derived `regionTooLarge` getter can scale it to the current view

```ts
// type signature
type byteEstimateVisibleBp = number | undefined
// code
byteEstimateVisibleBp: undefined as number | undefined
```

</details>

<details>
<summary>ArcFetchModel - Volatiles (other undocumented members)</summary>

#### volatile: features

```ts
// type signature
type features = Feature[] | undefined
// code
features: undefined as Feature[] | undefined
```

</details>

<details>
<summary>ArcFetchModel - Getters</summary>

#### getter: configuredFetchSizeLimit

Overridable hook: the display's configured `fetchSizeLimit`. The mixin can't
read a config slot itself (it owns no `configuration`), so each concrete arc
model supplies `getConf(self, 'fetchSizeLimit')`. Default matches the
BaseLinearDisplay slot default; every arc model overrides it.

```ts
type configuredFetchSizeLimit = number
```

#### getter: estimatedVisibleBytes

cached byte estimate scaled from the span it was measured over to the current
visible span, so the verdict self-releases on zoom-in

```ts
type estimatedVisibleBytes = number | undefined
```

#### getter: tooLargeStatus

shared verdict + reason (AUTO_FORCE_LOAD_BP floor + bytes-over-limit), fed the
scaled estimate — same helper as every other gating path

```ts
type tooLargeStatus = RegionTooLargeStatus
```

#### getter: regionTooLarge

derived — shadows GlobalFetchMixin's imperative RegionTooLargeMixin getter

```ts
type regionTooLarge = boolean
```

#### getter: dataLoaded

fresh only when `features` were fetched for the current static-block set;
overrides GlobalFetchMixin's default so `svgReady` can resolve on load

```ts
type dataLoaded = boolean
```

</details>

<details>
<summary>ArcFetchModel - Getters (other undocumented members)</summary>

#### getter: regionTooLargeReason

```ts
type regionTooLargeReason = string
```

</details>

<details>
<summary>ArcFetchModel - Actions</summary>

#### action: setFeatureDensityStats

Records the span the byte estimate was measured at so `estimatedVisibleBytes`
can scale it to the current view.

```ts
type setFeatureDensityStats = (stats?: FeatureDensityStats | undefined) => void
```

#### action: setFeatureDensityStatsLimit

Force-load raises the byte gate past the estimate scaled to the _current_ view
(shared helper), not the raw captured bytes, so it clears even if the view
zoomed out after the estimate was captured.

```ts
type setFeatureDensityStatsLimit = (
  stats?: { bytes?: number | undefined } | undefined,
) => void
```

</details>

<details>
<summary>ArcFetchModel - Actions (other undocumented members)</summary>

#### action: setFeatures

```ts
type setFeatures = (f: Feature[], signature: string) => void
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
