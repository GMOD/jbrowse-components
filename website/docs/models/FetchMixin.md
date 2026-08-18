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

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-isloading">**isLoading**</span><br><code>boolean</code> | true while a fetch is active |
| <span id="getter-isloadingorcanceled">**isLoadingOrCanceled**</span><br><code>boolean</code> | `isLoading` widened to cover a user-canceled load. **This, not `isLoading`, is what a `displayPhase` loading term wants.** `cancelFetchByUser` clears the stop token synchronously, so `isLoading` goes false the instant the user clicks Cancel — and the loading overlay that unmounts on it is carrying the Retry button, which is the only way back: the state is deliberately durable, so no autorun restarts the fetch on its own. A bare `isLoading` therefore reads as `ready` over a display that is stopped, empty and offering nothing.<br><br>Arc read `isLoading` directly and had exactly that hole. It is a getter here so no family has to remember the second term. |
| <span id="getter-loadingsuppressed">**loadingSuppressed**</span><br><code>boolean</code> | Overridable hook (default false): a subclass returns true when its body is deliberately showing a static message instead of data, so the loading scrim must not cover it. Sequence sets it past base resolution ("Zoom in to see sequence"); LD sets it with the triangle toggled off.<br><br>A hook rather than a `displayPhase` override, because overriding the getter means restating the whole loading condition — which is how sequence came to hold a verbatim copy of the other terms, one `git blame` away from silently missing the next one added.<br><br>It lives **here** because this is the one mixin all three display foundations compose. On `MultiRegionDisplayMixin` it was reachable by one of the three, so the global family hard-coded `false` and LD could express only the half `rendersCanvas` reaches — which drops the pre-first-paint term alone and leaves the scrim free to park over the placeholder on the durable cancel term. Same argument, one level down, that put `rendersCanvas` on `RenderLifecycleMixin` beside `canvasDrawn`. |
| <span id="getter-awaitingprerequisite">**awaitingPrerequisite**</span><br><code>boolean</code> | Overridable hook (default false), read only by the dev-only retry check (`makeRetryContractCheck`): "this run declined because a prerequisite fetch in another autorun has not landed, and its arrival wakes this one again". It **defers** the retry verdict to that later run rather than waiving it, so a display cannot spend its retry on a decline it called preliminary.<br><br>Two displays say it, one per fetch foundation, which is why it lives beside `loadingSuppressed` rather than on either: HiC's contacts fetch declines until `CoreGetInfo` lands, and `MultiSampleVariantBaseModel`'s `fetchNeeded` declines until `sourcesBase` does. Both have a `reload()` that wakes the prerequisite's autorun as well as their own.<br><br>**It has to be strictly narrower than the gate it explains.** One that restates the gate's negation makes every decline a deferred one, so no run is ever judged and the display has silently opted out — an exemption by another name. HiC is in that shape deliberately, because its gate and its prerequisite are one condition; what covers its retry instead is `LinearHicDisplay/infoFetchFailure.test.ts`.<br><br>Not for a display deliberately not fetching at all — that is `loadingSuppressed` above, which the loading scrim reads too. |
| <span id="getter-rpcpropscachekey">**rpcPropsCacheKey**</span><br><code>string</code> | The RPC cache key both fetch foundations invalidate on: this display's `rpcProps()` payload serialized to a string. `serializeRpcProps` owns the why, including the silently-dead-axis corollary.<br><br>Here, beside the two hooks above, for the same reason they are: it describes the display, and every foundation composes this mixin. The per-region family watches it from `SettingsInvalidate` and the global one from its fetch autorun's trigger list — one getter and one name, so the two cannot come to invalidate on different axes. The global side built its own local `computed` over the same function until 2026-08, which was the same value under a second spelling. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-seterror">**setError**</span><br><code>(error?: unknown) =&gt; void</code> |  |
| <span id="action-setstatusmessage">**setStatusMessage**</span><br><code>(status?: RpcStatus &#124; undefined) =&gt; void</code> | Unthrottled: a display writing a phase label by hand must see every write land. The high-frequency RPC stream is thinned one level up, in the callback factories. |
| <span id="action-throttlestatus">**throttleStatus**</span><br><code>(apply: () =&gt; void) =&gt; void</code> | Run `apply` only if the throttle window has elapsed. |
| <span id="action-flushstatus">**flushStatus**</span><br><code>(apply: () =&gt; void) =&gt; void</code> | Run `apply` now, dropping any write queued behind it. The escape from `throttleStatus` for a write that must land and that supersedes what it was queued behind — the `''` closing a phase is both. |
| <span id="action-resetstatus">**resetStatus**</span><br><code>() =&gt; void</code> | Drop the active stop token and clear all status bookkeeping. Shared by both cancel paths and runFetch's cleanup. |
| <span id="action-stopactivefetch">**stopActiveFetch**</span><br><code>() =&gt; void</code> | Abort the in-flight fetch (if any) and clear its status. The shared preamble of both cancel paths; the difference between them is only what they do to `fetchCanceled` / `fetchGeneration` afterward. |
| <span id="action-makestatuscallback">**makeStatusCallback**</span><br><code>(isCurrent: () =&gt; boolean) =&gt; StatusCallback</code> | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op, and throttled through the display-wide window. Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard at every call site.<br><br>`isCurrent` is required and has no "node is alive" default, because alive is not the interesting question: a *superseded* fetch is on a live node, and its late status repainting the overlay of the fetch that replaced it is the failure this guards. `runFetch` passes `!isStale()`, which is what every display gets for free through `ctx.statusCallback`; a caller outside a fetch (the clustering autorun) passes its own run's flag. Defaulting to `isAlive` made the loose answer the easy one and five displays took it.<br><br>Declared this early only so `runFetch` can put one on every `FetchContext`. |
| <span id="action-cancelfetch">**cancelFetch**</span><br><code>() =&gt; void</code> | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight). This is the *internal* reset `clearAllRpcData` runs — it clears any user-cancel flag so the retrigger actually re-fetches. |
| <span id="action-cancelfetchbyuser">**cancelFetchByUser**</span><br><code>() =&gt; void</code> | User-initiated cancel from the loading overlay. Stops the in-flight fetch and lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump fetchGeneration — so the fetch autoruns don't immediately restart the load. The user retries via `reload` (the overlay's retry button), or it clears on the next viewport change. |
| <span id="action-beforedestroy">**beforeDestroy**</span><br><code>() =&gt; void</code> | Release an in-flight fetch's stop token on teardown. Without this, a display destroyed mid-fetch (track/view closed while loading) never signals the worker to abort the now-useless work, and its in-flight HTTP reads keep downloading. MST auto-chains lifecycle hooks, so a composing display can still define its own beforeDestroy. |
| <span id="action-runfetch">**runFetch**</span><br><code>(work: (ctx: FetchContext) =&gt; Promise&lt;void&gt;) =&gt; Promise&lt;void&gt;</code> | Run a cancel-safe fetch (cancels any prior). The work callback gets a FetchContext with a stopToken to forward to the RPC and an isStale() check to short-circuit commits once the user has moved on. Abort errors are swallowed; others are stored in `error` if not stale. |
