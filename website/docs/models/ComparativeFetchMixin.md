---
id: comparativefetchmixin
title: ComparativeFetchMixin
description: "The fetch foundation of the two comparative displays (LinearSyntenyDisplay, DotplotDisplay): KeyedFetchMixin — FetchMixin's rotation, loading flag, error, status, durable cancel and retry, plus…"
sidebar_label: Mixin -> ComparativeFetchMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/synteny-core/src/ComparativeFetchMixin.ts).

The fetch foundation of the two comparative displays (LinearSyntenyDisplay,
DotplotDisplay): `KeyedFetchMixin` — `FetchMixin`'s rotation, loading flag,
error, status, durable cancel and retry, plus the `currentFetchKey` /
`loadedFetchKey` freshness pair the LGV global family runs on — and, on top,
the two-way loading answer a shared canvas wants — `loading` off the
`fetchLanded` hook, `refetching` off `isLoading` — and the one-shot
reversed-assembly flag.

Until 2026-09 this was `SyntenyFetchStateMixin`, a second spelling of every
`FetchMixin` member the overlay reads — `fetching` for `isLoading`, its own
`reloadCounter` / `fetchCanceled` / `reload` / `cancelFetchByUser`, a stop
handed back from the installer because the rotation lived there — kept apart
on the grounds ADR-054 gives and ADR-105 retires. `error` kept the four flags
below out of that mixin: it is a `BaseDisplay` volatile the flags read, and declaring a second one to make them type-check is the ADR-041
hazard. `FetchMixin` is the one declaration site that already wins that
compose, so composing it lets the flags be getters here.

`loading` and `refetching` are different questions, and the difference
decides whether the user gets a full overlay or a corner chip
(`ComparativeFetchStatus`). `displayPhase` stays per display — it reads the
shared canvas's `surfaceReadiness`, which each view publishes differently —
through `comparativeDisplayPhase`.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-assembliesswapped">**assembliesSwapped**</span><br><code>false</code> | Set once at view load by a refName-comparison check, independent of the per-render fetch, so it never re-fires or misfires on zoom. Surfaces through each display's `warnings`. |

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="volatile-loadedfetchkey">[`loadedFetchKey`](../keyedfetchmixin#volatile-loadedfetchkey)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="volatile-activesignal">[`activeSignal`](../fetchmixin#volatile-activesignal)</span>, <span id="volatile-fetchgeneration">[`fetchGeneration`](../fetchmixin#volatile-fetchgeneration)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../fetchmixin#volatile-reloadcounter)</span>, <span id="volatile-statuswindow">[`statusWindow`](../fetchmixin#volatile-statuswindow)</span>, <span id="volatile-error">[`error`](../fetchmixin#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../fetchmixin#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../fetchmixin#volatile-statusprogress)</span>, <span id="volatile-fetchcanceled">[`fetchCanceled`](../fetchmixin#volatile-fetchcanceled)</span>, <span id="volatile-fetchrotation">[`fetchRotation`](../fetchmixin#volatile-fetchrotation)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-fetchlanded">**fetchLanded**</span><br><code>boolean</code> | Overridable hook (default false): a fetch has completed and data is present, even if it mapped zero features. Not a feature-count test — an empty-but-finished fetch has landed, or an empty plot spins its overlay forever. Each display answers off its own payload field, which survives a `reload()` where `loadedFetchKey` does not, so a retry shows the corner chip rather than the full overlay.<br><br>Default false is the strict answer — a display that forgets the override shows its first-load overlay forever (diagnosable) rather than reporting done over an empty plot. |
| <span id="getter-hasdrawable">**hasDrawable**</span><br><code>boolean</code> | Overridable hook: the display holds something an SVG export can draw. Defaults to `fetchLanded`; the dotplot answers with its instance geometry rather than its `geometry` computed, because `svgReady` is polled outside any reactive context and a `geometry` read there recolors every segment per poll. |
| <span id="getter-loading">**loading**</span><br><code>boolean</code> | First load, nothing on screen yet: drives the full striped overlay. Deliberately not `&& isLoading`, which would blink the overlay off during the pre-fetch debounce gap. Excludes `error` so error UI and loading UI never show at once, and `fetchInert` so a display that will never fetch rests instead of spinning on data that is not coming. |
| <span id="getter-refetching">**refetching**</span><br><code>boolean</code> | A fetch is running over a stale plot still on screen (zoom, reorder, pan past the buffer): drives a corner indicator rather than the full overlay, so a viewport change does not mask what is drawn. |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | Off-screen SVG export gate, the shared `computeSvgReady` policy every display runs. Neither comparative display has a `regionTooLarge` state (LOD gates the fetch, not region size). `fetchInert` is the extra terminal, so an export cannot hang on data the autorun will never fetch, and `fetchCanceled` is terminal for the same reason: durable until Retry, and an export presses nothing. The data half waits out an in-flight same-key retry (`!refetching`) and a stale plot (`dataCurrent`). |

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="getter-viewsignature">[`viewSignature`](../keyedfetchmixin#getter-viewsignature)</span>, <span id="getter-datasuperseded">[`dataSuperseded`](../keyedfetchmixin#getter-datasuperseded)</span>, <span id="getter-currentfetchkey">[`currentFetchKey`](../keyedfetchmixin#getter-currentfetchkey)</span>, <span id="getter-datacurrent">[`dataCurrent`](../keyedfetchmixin#getter-datacurrent)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-fetchinert">[`fetchInert`](../fetchmixin#getter-fetchinert)</span>, <span id="getter-awaitingprerequisite">[`awaitingPrerequisite`](../fetchmixin#getter-awaitingprerequisite)</span>, <span id="getter-awaitingdependentdata">[`awaitingDependentData`](../fetchmixin#getter-awaitingdependentdata)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setassembliesswapped">**setAssembliesSwapped**</span><br><code>(arg: boolean) =&gt; void</code> |  |

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="action-commitfetchresult">[`commitFetchResult`](../keyedfetchmixin#action-commitfetchresult)</span>, <span id="action-reload">[`reload`](../keyedfetchmixin#action-reload)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="action-seterror">[`setError`](../fetchmixin#action-seterror)</span>, <span id="action-setstatusmessage">[`setStatusMessage`](../fetchmixin#action-setstatusmessage)</span>, <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span></span>
