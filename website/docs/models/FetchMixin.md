---
id: fetchmixin
title: FetchMixin
sidebar_label: Mixin -> FetchMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/FetchMixin.ts).

## Overview

Cancel-safe fetch lifecycle for any display that loads data over RPC. Owns the
entire fetch state machine (stop-token rotation, staleness tracking, error
capture, status reporting); consumers see only `runFetch`, `cancelFetch`,
`isLoading`, `error`, `statusMessage`, and `fetchGeneration`.

## Members

| Member                                                       | Kind      | Defined by | Description                                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | --------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [activeStopToken](#volatile-activestoptoken)                 | Volatiles | FetchMixin | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                    |
| [fetchGeneration](#volatile-fetchgeneration)                 | Volatiles | FetchMixin | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                             |
| [error](#volatile-error)                                     | Volatiles | FetchMixin | last non-abort fetch error, or undefined                                                                                                                                                                                                     |
| [statusMessage](#volatile-statusmessage)                     | Volatiles | FetchMixin | work-in-progress status string                                                                                                                                                                                                               |
| [statusProgress](#volatile-statusprogress)                   | Volatiles | FetchMixin | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate                                                                                                                           |
| [fetchCanceled](#volatile-fetchcanceled)                     | Volatiles | FetchMixin | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                   |
| [regionStatuses](#volatile-regionstatuses)                   | Volatiles | FetchMixin | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                               |
| [lastStatusMs](#volatile-laststatusms)                       | Volatiles | FetchMixin | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                   |
| [isLoading](#getter-isloading)                               | Getters   | FetchMixin | true while a fetch is active                                                                                                                                                                                                                 |
| [makeStatusCallback](#method-makestatuscallback)             | Methods   | FetchMixin | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op. |
| [makeRegionStatusCallback](#method-makeregionstatuscallback) | Methods   | FetchMixin | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                             |
| [setError](#action-seterror)                                 | Actions   | FetchMixin |                                                                                                                                                                                                                                              |
| [setStatusMessage](#action-setstatusmessage)                 | Actions   | FetchMixin |                                                                                                                                                                                                                                              |
| [throttleStatus](#action-throttlestatus)                     | Actions   | FetchMixin | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write.                                                                                                                                                    |
| [resetStatus](#action-resetstatus)                           | Actions   | FetchMixin | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                 |
| [stopActiveFetch](#action-stopactivefetch)                   | Actions   | FetchMixin | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                     |
| [setRegionStatus](#action-setregionstatus)                   | Actions   | FetchMixin | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                    |
| [cancelFetch](#action-cancelfetch)                           | Actions   | FetchMixin | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                 |
| [cancelFetchByUser](#action-cancelfetchbyuser)               | Actions   | FetchMixin | User-initiated cancel from the loading overlay.                                                                                                                                                                                              |
| [beforeDestroy](#action-beforedestroy)                       | Actions   | FetchMixin | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                         |
| [runFetch](#action-runfetch)                                 | Actions   | FetchMixin | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                 |

<details>
<summary>FetchMixin - Volatiles</summary>

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

</details>

<details>
<summary>FetchMixin - Getters</summary>

#### getter: isLoading

true while a fetch is active

```ts
type isLoading = boolean
```

</details>

<details>
<summary>FetchMixin - Methods</summary>

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

</details>

<details>
<summary>FetchMixin - Actions</summary>

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

</details>

<details>
<summary>FetchMixin - Actions (other undocumented members)</summary>

| Member                                                     | Type                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| <span id="action-seterror">setError</span>                 | `(error?: unknown) => void`                 |
| <span id="action-setstatusmessage">setStatusMessage</span> | `(status?: RpcStatus \| undefined) => void` |

</details>
