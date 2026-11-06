---
id: keyedfetchmixin
title: KeyedFetchMixin
description: "FetchMixin plus the freshness compare a single-payload fetch runs: the key the view, settings and adapter call for (currentFetchKey) against the key the held data was committed under…"
sidebar_label: Mixin -> KeyedFetchMixin
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/KeyedFetchMixin.ts).

`FetchMixin` plus the freshness compare a single-payload fetch runs: the key
the view, settings and adapter call for (`currentFetchKey`) against the key
the held data was committed under (`loadedFetchKey`). Composed by
`GlobalFetchMixin` and `ComparativeFetchMixin` (ADR-105).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-loadedfetchkey">**loadedFetchKey**</span><br><code>FetchKey &#124; undefined</code> | `currentFetchKey` as it stood when the held data was committed. Written only by `commitFetchResult` and cleared by `reload`; the data itself is the display's and stays on screen under the overlay. |

<details class="inherited-members" data-pagefind-ignore>
<summary>9 inherited volatiles from one model</summary>

From [FetchMixin](../fetchmixin): <span id="volatile-activesignal">[`activeSignal`](../fetchmixin#volatile-activesignal)</span>, <span id="volatile-fetchgeneration">[`fetchGeneration`](../fetchmixin#volatile-fetchgeneration)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../fetchmixin#volatile-reloadcounter)</span>, <span id="volatile-statuswindow">[`statusWindow`](../fetchmixin#volatile-statuswindow)</span>, <span id="volatile-error">[`error`](../fetchmixin#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../fetchmixin#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../fetchmixin#volatile-statusprogress)</span>, <span id="volatile-fetchcanceled">[`fetchCanceled`](../fetchmixin#volatile-fetchcanceled)</span>, <span id="volatile-fetchrotation">[`fetchRotation`](../fetchmixin#volatile-fetchrotation)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-viewsignature">**viewSignature**</span><br><code>string &#124; undefined</code> | Overridable hook, the freshness input a display supplies: what the current view calls for, such as its block set (`blockKeySignature`) plus any view-derived tier like HiC's bin size. Leave settings out; `currentFetchKey` pairs this with `settingsFetchInputs`. `undefined` holds the fetch off, and is the default, so a missing override hangs rather than draws stale data. |
| <span id="getter-datasuperseded">**dataSuperseded**</span><br><code>boolean</code> | Overridable hook (default false): the held data matches the key but the screen will settle on different data, as when a dependent fetch is still out. A term of `dataCurrent` only, so it holds the export and never refetches; state only what a later commit is sure to clear. See `MultiRegionDisplayMixin.dataSuperseded`. |
| <span id="getter-currentfetchkey">**currentFetchKey**</span><br><code>FetchKey &#124; undefined</code> | The key of the fetch the current view, settings and adapter call for: captured at issue and stamped at commit. Its identity survives a recomputation onto equal content. |
| <span id="getter-datacurrent">**dataCurrent**</span><br><code>boolean</code> | The held data was committed for the current key and the display is not about to supersede it. For readers outside the fetch, the export gate above all; the fetch autorun makes the same compare inside `installFetch`, where a reload can override it. |

<details class="inherited-members" data-pagefind-ignore>
<summary>6 inherited getters from one model</summary>

From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-fetchinert">[`fetchInert`](../fetchmixin#getter-fetchinert)</span>, <span id="getter-awaitingprerequisite">[`awaitingPrerequisite`](../fetchmixin#getter-awaitingprerequisite)</span>, <span id="getter-awaitingdependentdata">[`awaitingDependentData`](../fetchmixin#getter-awaitingdependentdata)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-commitfetchresult">**commitFetchResult**</span><br><code>(commit: () =&gt; void, key: FetchKey) =&gt; void</code> | The commit half of a keyed fetch: the display's store and the key stamp in one transaction, so no observer sees fresh data under a stale key or the reverse. |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | `FetchMixin.reload`, whose counter bump overrides the skeleton's freshness gate, plus dropping the loaded key so an export started after the click waits for the refetch. The data stays on screen. |

<details class="inherited-members" data-pagefind-ignore>
<summary>10 inherited actions from one model</summary>

From [FetchMixin](../fetchmixin): <span id="action-seterror">[`setError`](../fetchmixin#action-seterror)</span>, <span id="action-setstatusmessage">[`setStatusMessage`](../fetchmixin#action-setstatusmessage)</span>, <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span>

</details>
