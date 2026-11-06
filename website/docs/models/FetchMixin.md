---
id: fetchmixin
title: FetchMixin
description: "Cancel-safe fetch lifecycle for any display that loads data over RPC: abort rotation, staleness, error capture and status reporting."
sidebar_label: Mixin -> FetchMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/FetchMixin.ts).

Cancel-safe fetch lifecycle for any display that loads data over RPC: abort
rotation, staleness, error capture and status reporting. Consumers use
`runFetch`, `cancelFetch`, `isLoading`, `error`, `statusMessage` and
`fetchGeneration`. Every fetch foundation composes it: the per-region family
directly, the global and comparative families through `KeyedFetchMixin`.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-activesignal">**activeSignal**</span><br><code>AbortSignal &#124; undefined</code> | signal of the in-flight fetch, or undefined when idle |
| <span id="volatile-fetchgeneration">**fetchGeneration**</span><br><code>number</code> | Bumps when a current fetch ends (never for a superseded one) and on `cancelFetch`, not on `cancelFetchByUser`, which is what makes a user cancel durable. Fetch autoruns read it to re-evaluate. |
| <span id="volatile-reloadcounter">**reloadCounter**</span><br><code>number</code> | Bumped by `reload()` and read unconditionally by every fetch autorun, so a retry re-runs the body even when no other input moved, as after an error. `makeRetryContractCheck` reports a bump that fetches nothing: a dead Retry button. |
| <span id="volatile-statuswindow">**statusWindow**</span><br><code>StatusWindow</code> | The display's status field's only writer: one throttle window, one slot per concurrent operation, so parallel per-region fetches thin to one stream and one operation cannot end another's label (ADR-081). |
| <span id="volatile-error">**error**</span><br><code>unknown</code> | last non-abort fetch error, or undefined |
| <span id="volatile-statusmessage">**statusMessage**</span><br><code>string &#124; undefined</code> | work-in-progress status string |
| <span id="volatile-statusprogress">**statusProgress**</span><br><code>number &#124; undefined</code> | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate |
| <span id="volatile-fetchcanceled">**fetchCanceled**</span><br><code>boolean</code> | True after the user cancels a load from the loading overlay. Unlike `cancelFetch` it does not retrigger the fetch autoruns, so the load stays stopped until `reload` or a viewport change; any new fetch clears it. |
| <span id="volatile-fetchrotation">**fetchRotation**</span><br><code>{ begin(): ActiveFetch; cancel: () =&gt; void; dispose(): void; }</code> | The latest-wins machine `runFetch` wraps: abort rotation, the `isCurrent` guard, the status slot and the supersede-versus-end rule (ADR-080, ADR-081). A second concurrent fetch on the same display holds its own rotation (ADR-054 §1). It takes a slot on this display's `statusWindow` rather than opening a second window. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-isloading">**isLoading**</span><br><code>boolean</code> | true while a fetch is active |
| <span id="getter-isloadingorcanceled">**isLoadingOrCanceled**</span><br><code>boolean</code> | `isLoading` or a user-canceled load: neither has a frame on screen for a hover to describe. Not a phase input, since `computeActivityPhase` tells `loading` from `canceled`. |
| <span id="getter-fetchinert">**fetchInert**</span><br><code>boolean</code> | Overridable hook (default false): the states where this display deliberately fetches nothing, such as sequence past base resolution or LD with the triangle off. Three readers depend on it: the phase (`computeActivityPhase`), which would otherwise scrim the placeholder; the SVG export (`computeSvgReady`), whose unbounded wait would hang the view's export; and the retry contract check, which would report a dead Retry. ADR-082.<br><br>Override this rather than `displayPhase`, which would restate the whole loading condition and miss any term added to it later. |
| <span id="getter-awaitingprerequisite">**awaitingPrerequisite**</span><br><code>boolean</code> | Overridable hook (default false), read only by the retry contract check: this run declined because a prerequisite fetch in another autorun has not landed, and its arrival wakes this one. It defers the retry verdict to that run rather than waiving it, so it must be strictly narrower than the gate it explains; one restating the gate's negation exempts the display from the check. HiC's contacts (waiting on `CoreGetInfo`) and `LinearVariantDisplay` (waiting on `sourcesBase`) set it. For a display not fetching at all, use `fetchInert`. |
| <span id="getter-awaitingdependentdata">**awaitingDependentData**</span><br><code>boolean</code> | Overridable hook (default false), read by `computeActivityPhase` and `foundationSvgReady`: a load beyond the primary fetch has not landed for the first time, so the frame is still missing something. Multi-way synteny sets it until its lane genes and links first arrive; `TreeSidebarMixin` sets it while a declared clustering run is due. Unlike `dataSuperseded`, it holds the scrim and export on the first landing only. |
| <span id="getter-settingsfetchinputs">**settingsFetchInputs**</span><br><code>unknown</code> | The settings axis every fetch family invalidates on: `rpcProps()` and the adapter config, as one value compared structurally. The per-region family stamps it on each region, the keyed families fold it into `currentFetchKey`, and the byte gate measures under it. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-seterror">**setError**</span><br><code>(error?: unknown) =&gt; void</code> |  |
| <span id="action-setstatusmessage">**setStatusMessage**</span><br><code>(status?: RpcStatus &#124; undefined) =&gt; void</code> | Unthrottled, so a phase label written by hand always lands; the RPC stream is thinned by the slots `statusWindow` hands out. |
| <span id="action-stopactivefetch">**stopActiveFetch**</span><br><code>() =&gt; void</code> | Abort the in-flight fetch, if any, and retire its status slot: the shared preamble of both cancel paths. It never resets the window, which would drop a sibling operation's queued status write on every `clearAllRpcData` (ADR-081); only teardown resets it. |
| <span id="action-openstatusstream">**openStatusStream**</span><br><code>(isCurrent: () =&gt; boolean) =&gt; StatusStream</code> | Open a slot on the display's status field for an operation outside any fetch, such as the tree sidebar's clustering run: a throttled RPC `statusCallback` and the `clear` that retires it. `isCurrent` is required because a live node is not enough: a superseded run's late status must not repaint the overlay of the run that replaced it. |
| <span id="action-cancelfetch">**cancelFetch**</span><br><code>() =&gt; void</code> | Cancel any in-flight fetch, clear a user cancel and bump `fetchGeneration`, so the fetch autoruns re-fetch. The internal reset `clearAllRpcData` runs. |
| <span id="action-cancelfetchbyuser">**cancelFetchByUser**</span><br><code>() =&gt; void</code> | The loading overlay's Cancel: stop the fetch and set the durable `fetchCanceled`, without bumping `fetchGeneration`, so nothing restarts the load until `reload` or a viewport change. |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | The display's half of the retry contract (DISPLAYCHROME.md): clear the error, clear a user cancel at once so the overlay flips to loading, and bump `reloadCounter`. Each foundation chains this and adds the invalidation its freshness gate needs. An override that neither chains nor bumps the counter turns the retry check off; `reloadReachesCounter.test.ts` reads every `reload()` in the tree. |
| <span id="action-beforedestroy">**beforeDestroy**</span><br><code>() =&gt; void</code> | Abort an in-flight fetch on teardown, so a closed track stops downloading, and reset the status window, whose trailing write still holds a timer after the last fetch ends. |
| <span id="action-beginfetch">**beginFetch**</span><br><code>(signal: AbortSignal) =&gt; void</code> | The `onBegin` half of a fetch's bookkeeping: publish the signal (`isLoading`) and clear a user cancel, the one clear point every retrigger path passes through. |
| <span id="action-endfetch">**endFetch**</span><br><code>(current: boolean) =&gt; void</code> | The `onEnd` half, an action because `runFetchOnce`'s `finally` runs outside the flow. A superseded fetch writes nothing, or it would clear the loading flag of the fetch that replaced it. |
| <span id="action-runfetch">**runFetch**</span><br><code>(work: (ctx: FetchContext) =&gt; Promise&lt;void&gt;) =&gt; Promise&lt;void&gt;</code> | Run a cancel-safe fetch, superseding any prior one. `work` gets a `FetchContext` with the signal to forward to the RPC and `isStale()` to skip commits once the user has moved on. The sequence is the shared `runFetchOnce`; this adds the observable bookkeeping and the flow, which runs `work`'s synchronous prefix untracked. |
