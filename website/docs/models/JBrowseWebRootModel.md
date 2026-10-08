---
id: jbrowsewebrootmodel
title: JBrowseWebRootModel
description: "note: many properties of the root model are available through the session, and we generally prefer using the session model (via e.g. getSession) over the root model (via e.g. getRoot) in plugin code"
sidebar_label: Root -> JBrowseWebRootModel
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. [View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/rootModel/rootModel.ts).

note: many properties of the root model are available through the session,
and we generally prefer using the session model (via e.g. getSession) over
the root model (via e.g. getRoot) in plugin code

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-configpath">**configPath**</span><br><code>configPath: types.maybe(types.string)</code> |  |

<span data-pagefind-ignore>From [BaseRootModel](../baserootmodel): <span id="property-jbrowse">[`jbrowse`](../baserootmodel#property-jbrowse)</span>, <span id="property-session">[`session`](../baserootmodel#property-session)</span>, <span id="property-sessionpath">[`sessionPath`](../baserootmodel#property-sessionpath)</span>, <span id="property-assemblymanager">[`assemblyManager`](../baserootmodel#property-assemblymanager)</span></span>

<span data-pagefind-ignore>From [InternetAccountsMixin](../internetaccountsmixin): <span id="property-internetaccounts">[`internetAccounts`](../internetaccountsmixin#property-internetaccounts)</span></span>

<span data-pagefind-ignore>From [HistoryManagementMixin](../historymanagementmixin): <span id="property-history">[`history`](../historymanagementmixin#property-history)</span></span>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-adminmode">**adminMode**</span><br><code>boolean</code> |  |
| <span id="volatile-sessiondb">**sessionDB**</span><br><code>SessionDBHandle &#124; undefined</code> |  |
| <span id="volatile-version">**version**</span><br><code>string</code> |  |
| <span id="volatile-gitcommit">**gitCommit**</span><br><code>string</code> |  |
| <span id="volatile-pluginsupdated">**pluginsUpdated**</span><br><code>false</code> |  |
| <span id="volatile-savedsessionmetadata">**savedSessionMetadata**</span><br><code>SessionMetadata[] &#124; undefined</code> |  |
| <span id="volatile-detachdisposers">**detachDisposers**</span><br><code>(() =&gt; void)[]</code> | What has to stop the moment the React host lets go of this root — the `beforeunload` listener and the autoruns that write to sessionStorage and IndexedDB, i.e. everything reaching outside the tree.<br><br>Deliberately not `addDisposer`, which fires only on destroy, because destroy is what this root cannot do at detach time: React is still holding its views and widgets in the outgoing props of the same passive-effect flush. The destroy follows on a later task, so an `addDisposer` here would run late rather than never — but "the moment the host lets go" is the contract these want. See `detach` and SessionLoader's disposePluginManager. |
| <span id="volatile-reloadpluginmanagercallback">**reloadPluginManagerCallback**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(_configSnapshot: Record&lt;string, unknown&gt;, _sessionSnapshot: Re…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(_configSnapshot: Record&lt;string, unknown&gt;, _sessionSnapshot: Record&lt;string, unknown&gt;) =&gt; void</code></pre></dialog></span> |  |

<span data-pagefind-ignore>From [BaseRootModel](../baserootmodel): <span id="volatile-rpcmanager">[`rpcManager`](../baserootmodel#volatile-rpcmanager)</span>, <span id="volatile-error">[`error`](../baserootmodel#volatile-error)</span>, <span id="volatile-textsearchmanager">[`textSearchManager`](../baserootmodel#volatile-textsearchmanager)</span>, <span id="volatile-pluginmanager">[`pluginManager`](../baserootmodel#volatile-pluginmanager)</span></span>

<span data-pagefind-ignore>From [RootAppMenuMixin](../rootappmenumixin): <span id="volatile-mutablemenuactions">[`mutableMenuActions`](../rootappmenumixin#volatile-mutablemenuactions)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-menus">**menus**</span><br><code>() =&gt; Menu[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setsavedsessionmetadata">**setSavedSessionMetadata**</span><br><code>(sessions: SessionMetadata[]) =&gt; void</code> |  |
| <span id="action-fetchsessionmetadata">**fetchSessionMetadata**</span><br><code>() =&gt; Promise&lt;void&gt;</code> | Re-reads the whole `metadata` store. For anything that changes rows this model didn't just write itself (first load, pruning, favorite, rename, delete) — the autosave path uses `upsertSessionMetadata` instead. |
| <span id="action-upsertsessionmetadata">**upsertSessionMetadata**</span><br><code>(meta: SessionMetadata) =&gt; void</code> | Merges a row this model has just written into the in-memory list. The autosave autorun writes exactly one row on every debounced session edit — every 400ms for as long as you keep panning — and already holds its contents, so re-reading every session's metadata to learn what it just stored is the expensive way to move one row to the top. |
| <span id="action-setsessiondb">**setSessionDB**</span><br><code>(sessionDB: SessionDBHandle &#124; undefined) =&gt; void</code> |  |
| <span id="action-adddetachdisposer">**addDetachDisposer**</span><br><code>(disposer: () =&gt; void) =&gt; void</code> | Register something that must stop when the React host detaches this root. See the `detachDisposers` volatile for why this is not `addDisposer`. |
| <span id="action-detach">**detach**</span><br><code>() =&gt; void</code> | Called when the React host releases this root. Stops everything the root runs outside the tree (the worker pool, the `beforeunload` listener, the sessionStorage and IndexedDB autoruns) and leaves the tree itself alone.<br><br>The caller destroys the tree on a later task (`scheduleDetachedDestroy`), which runs the `beforeDestroy` hooks in it; plugins rely on those hooks, so the destroy cannot be skipped. This action stops the outside work immediately, so none of it runs between detach and destroy. ADR-069. |
| <span id="action-setpluginsupdated">**setPluginsUpdated**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setreloadpluginmanagercallback">**setReloadPluginManagerCallback**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(callback: (configSnapshot: Record&lt;string, unknown&gt;, sessionSna…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(callback: (configSnapshot: Record&lt;string, unknown&gt;, sessionSnapshot: Record&lt;string, unknown&gt;) =&gt; void) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-activatesession">**activateSession**</span><br><code>(id: string) =&gt; Promise&lt;void&gt;</code> |  |
| <span id="action-opensessioncopy">**openSessionCopy**</span><br><code>(snap: Record&lt;string, unknown&gt;) =&gt; Promise&lt;void&gt;</code> | Opens a session snapshot under a fresh id, so it autosaves beside the session it came from rather than over it. |
| <span id="action-setsavedsessionfavorite">**setSavedSessionFavorite**</span><br><code>(id: string, favorite: boolean) =&gt; Promise&lt;void&gt;</code> |  |
| <span id="action-deletesavedsession">**deleteSavedSession**</span><br><code>(id: string) =&gt; Promise&lt;void&gt;</code> |  |
| <span id="action-deletesavedsessions">**deleteSavedSessions**</span><br><code>(ids: string[]) =&gt; Promise&lt;void&gt;</code> | Deletes a batch of saved sessions in ONE transaction, and re-reads the metadata once at the end. Looping `deleteSavedSession` instead is both N transactions and N full `getAll('metadata')` scans, and — because those interleave — leaves `savedSessionMetadata` holding whichever scan happened to resolve last, so already-deleted rows stay on screen until something else refreshes the list.<br><br>The open session is skipped rather than reported on, since a bulk delete is not aimed at any one row (see deleteSavedSession). |
| <span id="action-renamesavedsession">**renameSavedSession**</span><br><code>(id: string, name: string) =&gt; Promise&lt;void&gt;</code> |  |

<span data-pagefind-ignore>From [BaseRootModel](../baserootmodel): <span id="action-seterror">[`setError`](../baserootmodel#action-seterror)</span>, <span id="action-setsession">[`setSession`](../baserootmodel#action-setsession)</span>, <span id="action-setdefaultsession">[`setDefaultSession`](../baserootmodel#action-setdefaultsession)</span>, <span id="action-setsessionpath">[`setSessionPath`](../baserootmodel#action-setsessionpath)</span>, <span id="action-renamecurrentsession">[`renameCurrentSession`](../baserootmodel#action-renamecurrentsession)</span></span>

<span data-pagefind-ignore>From [InternetAccountsMixin](../internetaccountsmixin): <span id="action-initializeinternetaccount">[`initializeInternetAccount`](../internetaccountsmixin#action-initializeinternetaccount)</span>, <span id="action-createephemeralinternetaccount">[`createEphemeralInternetAccount`](../internetaccountsmixin#action-createephemeralinternetaccount)</span>, <span id="action-findappropriateinternetaccount">[`findAppropriateInternetAccount`](../internetaccountsmixin#action-findappropriateinternetaccount)</span></span>

<span data-pagefind-ignore>From [RootAppMenuMixin](../rootappmenumixin): <span id="action-appendmenu">[`appendMenu`](../rootappmenumixin#action-appendmenu)</span>, <span id="action-insertmenu">[`insertMenu`](../rootappmenumixin#action-insertmenu)</span>, <span id="action-appendtomenu">[`appendToMenu`](../rootappmenumixin#action-appendtomenu)</span>, <span id="action-insertinmenu">[`insertInMenu`](../rootappmenumixin#action-insertinmenu)</span>, <span id="action-appendtosubmenu">[`appendToSubMenu`](../rootappmenumixin#action-appendtosubmenu)</span>, <span id="action-insertinsubmenu">[`insertInSubMenu`](../rootappmenumixin#action-insertinsubmenu)</span></span>
