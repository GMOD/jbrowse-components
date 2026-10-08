---
id: keyedfetchmixin
title: KeyedFetchMixin
description: "FetchMixin plus the one freshness compare a single-payload fetch runs: the key of what the view, settings and adapter call for (currentFetchKey) against the key the held data was committed under…"
sidebar_label: Mixin -> KeyedFetchMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/KeyedFetchMixin.ts).

`FetchMixin` plus the one freshness compare a single-payload fetch runs: the
key of what the view, settings and adapter call for (`currentFetchKey`)
against the key the held data was committed under (`loadedFetchKey`). The
LGV global family composes it under `GlobalFetchMixin` and the comparative
family under `ComparativeFetchMixin`; the per-region family answers the same
question per region through `isCacheValid`, so it stays on `FetchMixin`
(ADR-105).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-loadedfetchkey">**loadedFetchKey**</span><br><code>FetchKey &#124; undefined</code> | `currentFetchKey` as it stood when the held data was committed — the loaded half of the freshness compare. Written only by `commitFetchResult`, so a display cannot stamp data it did not fetch, and cleared by `reload` for the overlay's sake rather than the refetch's (the skeleton's reload epoch is what overrides its gate). The data itself stays display-owned: arc keeps stale arcs on screen under the loading overlay, HiC the stale matrix, synteny the stale ribbons. |

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="volatile-activesignal">[`activeSignal`](../fetchmixin#volatile-activesignal)</span>, <span id="volatile-fetchgeneration">[`fetchGeneration`](../fetchmixin#volatile-fetchgeneration)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../fetchmixin#volatile-reloadcounter)</span>, <span id="volatile-statuswindow">[`statusWindow`](../fetchmixin#volatile-statuswindow)</span>, <span id="volatile-error">[`error`](../fetchmixin#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../fetchmixin#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../fetchmixin#volatile-statusprogress)</span>, <span id="volatile-fetchcanceled">[`fetchCanceled`](../fetchmixin#volatile-fetchcanceled)</span>, <span id="volatile-fetchrotation">[`fetchRotation`](../fetchmixin#volatile-fetchrotation)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-viewsignature">**viewSignature**</span><br><code>string &#124; undefined</code> | Overridable hook, the one freshness input a display supplies: the signature of what the current *view* calls for — its block set (`blockKeySignature`) plus any view-derived fetch tier, like HiC's binsize; both comparative views' region sets, zoom buckets and LOD tier. `undefined` means "not computable yet" (view unmeasured, a prerequisite header still in flight) and holds the fetch off.<br><br>Settings and the adapter are deliberately not the display's half: `currentFetchKey` below pairs this with `settingsFetchInputs`, so a field added to `rpcProps()` or a track re-pointed in the config editor invalidates held data structurally. HiC hand-folded one settings term in, and a second term would not have invalidated anything; the comparative family folded the adapter in at its installer and compared without it at its export gate.<br><br>Default `undefined`, so a display that forgets the override never fetches and never exports — hung is diagnosable, stale ships wrong pixels. |
| <span id="getter-datasuperseded">**dataSuperseded**</span><br><code>boolean</code> | Overridable hook (default false): the held data answers the key, but this display knows it is not what the screen will settle on — a dependent fetch of its own is still out, or a fetch input it writes itself has moved. The same hook `MultiRegionDisplayMixin` declares, for the same reason: the key compare is structurally blind to anything the display fetches outside its primary fetch, and an export sampling `svgReady` in that window paints the half-filled frame.<br><br>A term of `dataCurrent` and NOT of the skeleton's freshness gate, so it holds the export and never re-runs the primary fetch. It fails hung, not stale: a value that latches true parks `awaitSvgReady` on its backstop, so state only what a later commit is guaranteed to clear. |
| <span id="getter-currentfetchkey">**currentFetchKey**</span><br><code>FetchKey &#124; undefined</code> | Key of the fetch the current view, settings and adapter call for. The fetch skeleton's freshness key: captured at issue, compared against the stamp above, and written to it at commit. Its identity survives a recomputation onto equal content, so the idle compare is `===`. |
| <span id="getter-datacurrent">**dataCurrent**</span><br><code>boolean</code> | The shared freshness answer every foundation gives: data has been committed (`loadedFetchKey` is only ever written beside it), it was fetched for the current view and settings, and the display is not about to supersede it itself. A pan inside the loaded blocks stays current; a block entering, a tier step, a settings change or a `reload()` moves one side of the compare. **What the fetch autorun gates on is the same compare inside `installFetch`**, not this getter — the skeleton owns it so a reload can override it. This one is for the readers outside the fetch, the export gate above all. The per-region twin is `isCacheValid`: what decides a refetch, and deliberately not the whole freshness answer. |

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-fetchinert">[`fetchInert`](../fetchmixin#getter-fetchinert)</span>, <span id="getter-awaitingprerequisite">[`awaitingPrerequisite`](../fetchmixin#getter-awaitingprerequisite)</span>, <span id="getter-awaitingdependentdata">[`awaitingDependentData`](../fetchmixin#getter-awaitingdependentdata)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-commitfetchresult">**commitFetchResult**</span><br><code>(commit: () =&gt; void, key: FetchKey) =&gt; void</code> | The commit half of a keyed fetch: run the display's own store in the same transaction as the key stamp, so no observer can see fresh data under a stale key or the reverse. As the only writer of `loadedFetchKey`, this action makes `dataCurrent` derivable, because a display cannot commit without stamping. |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | `FetchMixin.reload` (error, cancel, counter — the shared skeleton's reload epoch makes that bump override the freshness gate, even against a fetch that commits mid-reload, so nothing here has to remember to invalidate for the retry's sake) plus this layer's one addition, for the export gate rather than the refetch: dropping the loaded key sends `dataCurrent` false, so an export started after the click waits for the refetch instead of capturing what the retry is about to replace. The data itself survives, staying on screen under that overlay. A subclass whose reload needs extra teardown can override and chain. |

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="action-seterror">[`setError`](../fetchmixin#action-seterror)</span>, <span id="action-setstatusmessage">[`setStatusMessage`](../fetchmixin#action-setstatusmessage)</span>, <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span></span>
