---
id: fetchmixin
title: FetchMixin
sidebar_label: Mixin -> FetchMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/FetchMixin.ts).

Cancel-safe fetch lifecycle for any display that loads data over RPC. Owns the
entire fetch state machine (stop-token rotation, staleness tracking, error
capture, status reporting); consumers see only `runFetch`, `cancelFetch`,
`isLoading`, `error`, `statusMessage`, and `fetchGeneration`.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-activestoptoken">**activeStopToken**</span><br><code>activeStopToken: undefined as StopToken &#124; undefined</code> | stop token of the in-flight fetch, or undefined when idle |
| <span id="volatile-fetchgeneration">**fetchGeneration**</span><br><code>fetchGeneration: 0</code> | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch |
| <span id="volatile-error">**error**</span><br><code>error: undefined as unknown</code> | last non-abort fetch error, or undefined |
| <span id="volatile-statusmessage">**statusMessage**</span><br><code>statusMessage: undefined as string &#124; undefined</code> | work-in-progress status string |
| <span id="volatile-statusprogress">**statusProgress**</span><br><code>statusProgress: undefined as number &#124; undefined</code> | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate |
| <span id="volatile-fetchcanceled">**fetchCanceled**</span><br><code>fetchCanceled: false</code> | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`, it does not retrigger the fetch autoruns — so the load stays stopped until the user retries (`reload`) or the viewport changes. Any new fetch clears it (`runFetch` resets it at the start). |
| <span id="volatile-regionstatuses">**regionStatuses**</span><br><code>regionStatuses: new Map&lt;number, RpcStatus&gt;()</code> | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex). Plain bookkeeping — not read reactively; setRegionStatus derives the observable statusMessage/statusProgress from it on every update so N parallel region fetches aggregate into one bar instead of clobbering. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-isloading">**isLoading**</span><br><code>boolean</code> | true while a fetch is active |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-makestatuscallback">**makeStatusCallback**</span><br><code>() =&gt; (status: RpcStatus) =&gt; void</code> | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op. Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard at every call site. |
| <span id="method-makeregionstatuscallback">**makeRegionStatusCallback**</span><br><code>(key: number) =&gt; (status: RpcStatus) =&gt; void</code> | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other. Same `isAlive` guard; `setRegionStatus` owns the throttling (it has to thin only the bar write, not the per-region bookkeeping). |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-seterror">**setError**</span><br><code>(error?: unknown) =&gt; void</code> |  |
| <span id="action-setstatusmessage">**setStatusMessage**</span><br><code>(status?: RpcStatus &#124; undefined) =&gt; void</code> | Unthrottled: a display writing a phase label by hand must see every write land. The high-frequency RPC stream is thinned one level up, in the callback factories. |
| <span id="action-throttlestatus">**throttleStatus**</span><br><code>(apply: () =&gt; void) =&gt; void</code> | Run `apply` only if the throttle window has elapsed. |
| <span id="action-resetstatus">**resetStatus**</span><br><code>() =&gt; void</code> | Drop the active stop token and clear all status bookkeeping. Shared by both cancel paths and runFetch's cleanup. |
| <span id="action-stopactivefetch">**stopActiveFetch**</span><br><code>() =&gt; void</code> | Abort the in-flight fetch (if any) and clear its status. The shared preamble of both cancel paths; the difference between them is only what they do to `fetchCanceled` / `fetchGeneration` afterward. |
| <span id="action-setregionstatus">**setRegionStatus**</span><br><code>(key: number, status?: RpcStatus &#124; undefined) =&gt; void</code> | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys. Pass undefined to drop a key. Used by displays that fan a single fetch out into parallel per-region RPCs. |
| <span id="action-cancelfetch">**cancelFetch**</span><br><code>() =&gt; void</code> | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight). This is the *internal* reset used by clearAllRpcData/invalidateLoadedRegions — it clears any user-cancel flag so the retrigger actually re-fetches. |
| <span id="action-cancelfetchbyuser">**cancelFetchByUser**</span><br><code>() =&gt; void</code> | User-initiated cancel from the loading overlay. Stops the in-flight fetch and lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump fetchGeneration — so the fetch autoruns don't immediately restart the load. The user retries via `reload` (the overlay's retry button), or it clears on the next viewport change. |
| <span id="action-beforedestroy">**beforeDestroy**</span><br><code>() =&gt; void</code> | Release an in-flight fetch's stop token on teardown. Without this, a display destroyed mid-fetch (track/view closed while loading) never signals the worker to abort the now-useless work, and its in-flight HTTP reads keep downloading. MST auto-chains lifecycle hooks, so a composing display can still define its own beforeDestroy. |
| <span id="action-runfetch">**runFetch**</span><br><code>(work: (ctx: FetchContext) =&gt; Promise&lt;void&gt;) =&gt; Promise&lt;void&gt;</code> | Run a cancel-safe fetch (cancels any prior). The work callback gets a FetchContext with a stopToken to forward to the RPC and an isStale() check to short-circuit commits once the user has moved on. Abort errors are swallowed; others are stored in `error` if not stale. |
