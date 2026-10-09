---
id: jbrowsedesktoprootmodel
title: JBrowseDesktopRootModel
description: "note: many properties of the root model are available through the session, and we generally prefer using the session model (via e.g. getSession) over the root model (via e.g. getRoot) in plugin code"
sidebar_label: Root -> JBrowseDesktopRootModel
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. [View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/rootModel/rootModel.ts).

note: many properties of the root model are available through the session,
and we generally prefer using the session model (via e.g. getSession) over
the root model (via e.g. getRoot) in plugin code

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-jobsmanager">**jobsManager**</span><br><code>jobsManager: types.optional(JobsManager, {})</code> |  |

<span data-pagefind-ignore>From [BaseRootModel](../baserootmodel): <span id="property-jbrowse">[`jbrowse`](../baserootmodel#property-jbrowse)</span>, <span id="property-session">[`session`](../baserootmodel#property-session)</span>, <span id="property-sessionpath">[`sessionPath`](../baserootmodel#property-sessionpath)</span>, <span id="property-assemblymanager">[`assemblyManager`](../baserootmodel#property-assemblymanager)</span></span>

<span data-pagefind-ignore>From [InternetAccountsMixin](../internetaccountsmixin): <span id="property-internetaccounts">[`internetAccounts`](../internetaccountsmixin#property-internetaccounts)</span></span>

<span data-pagefind-ignore>From [HistoryManagementMixin](../historymanagementmixin): <span id="property-history">[`history`](../historymanagementmixin#property-history)</span></span>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-version">**version**</span><br><code>string</code> |  |
| <span id="volatile-adminmode">**adminMode**</span><br><code>boolean</code> |  |
| <span id="volatile-detachdisposers">**detachDisposers**</span><br><code>(() =&gt; void)[]</code> | What has to stop the moment the Loader lets go of this root — here, the autosave autorun, which writes to disk over IPC.<br><br>Not `addDisposer`, which fires only on destroy, and the destroy is now a task later than the swap. An autosave left running in that gap writes the *outgoing* session to `sessionPath`, which the replacement has already been loaded from. See `detach`. |
| <span id="volatile-opennewsessioncallback">**openNewSessionCallback**</span><br><code>(_path: string) =&gt; Promise&lt;void&gt;</code> |  |
| <span id="volatile-openlinkcallback">**openLinkCallback**</span><br><code>(_link: string) =&gt; Promise&lt;void&gt;</code> |  |
| <span id="volatile-returntostartscreencallback">**returnToStartScreenCallback**</span><br><code>() =&gt; void</code> |  |

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
| <span id="action-adddetachdisposer">**addDetachDisposer**</span><br><code>(disposer: () =&gt; void) =&gt; void</code> | Register something that must stop when the Loader detaches this root. See the `detachDisposers` volatile for why this is not `addDisposer`. |
| <span id="action-detach">**detach**</span><br><code>() =&gt; void</code> | Called when the Loader releases this root. Stops everything the root runs outside the tree (the worker pool and the autosave autorun) and leaves the tree itself alone.<br><br>The caller destroys the tree on a later task (`scheduleDetachedDestroy`), which runs the `beforeDestroy` hooks in it; plugins rely on those hooks, so the destroy cannot be skipped. This action stops the outside work immediately, so none of it runs between detach and destroy. ADR-069. |
| <span id="action-setopennewsessioncallback">**setOpenNewSessionCallback**</span><br><code>(cb: (arg: string) =&gt; Promise&lt;void&gt;) =&gt; void</code> |  |
| <span id="action-setopenlinkcallback">**setOpenLinkCallback**</span><br><code>(cb: (arg: string) =&gt; Promise&lt;void&gt;) =&gt; void</code> | Wired by the Loader to open a JBrowse Web link as a new session (the Loader owns plugin-manager lifecycle, as with openNewSessionCallback). |
| <span id="action-setreturntostartscreencallback">**setReturnToStartScreenCallback**</span><br><code>(cb: () =&gt; void) =&gt; void</code> | Wired by the Loader to tear down this plugin manager and show the start screen (the Loader owns plugin-manager lifecycle). |
| <span id="action-savesession">**saveSession**</span><br><code>(val: SessionSnap) =&gt; Promise&lt;void&gt;</code> |  |
| <span id="action-updatetrackbase">**updateTrackBase**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackConf: { [key: string]: unknown; trackId: string; }) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackConf: { [key: string]: unknown; trackId: string; }) =&gt; void</code></pre></dialog></span> | Replace a track's base config: its sessionTracks entry when the session owns the track, otherwise its jbrowse.tracks entry. |
| <span id="action-setpluginsupdated">**setPluginsUpdated**</span><br><code>() =&gt; Promise&lt;void&gt;</code> | Persist the session, then rebuild the plugin manager from disk so the changed plugin set takes effect (Loader wires openNewSessionCallback to reload from the session path). |
| <span id="action-flushsession">**flushSession**</span><br><code>() =&gt; Promise&lt;void&gt;</code> | Save now rather than waiting out the autosave's 1s debounce, so the last second of edits survives. Every path that tears the session down — quitting, returning to the start screen — has to call this first; Exit did not, and lost whatever was still inside the debounce window. |

<span data-pagefind-ignore>From [BaseRootModel](../baserootmodel): <span id="action-seterror">[`setError`](../baserootmodel#action-seterror)</span>, <span id="action-setsession">[`setSession`](../baserootmodel#action-setsession)</span>, <span id="action-setdefaultsession">[`setDefaultSession`](../baserootmodel#action-setdefaultsession)</span>, <span id="action-setsessionpath">[`setSessionPath`](../baserootmodel#action-setsessionpath)</span>, <span id="action-renamecurrentsession">[`renameCurrentSession`](../baserootmodel#action-renamecurrentsession)</span></span>

<span data-pagefind-ignore>From [InternetAccountsMixin](../internetaccountsmixin): <span id="action-initializeinternetaccount">[`initializeInternetAccount`](../internetaccountsmixin#action-initializeinternetaccount)</span>, <span id="action-createephemeralinternetaccount">[`createEphemeralInternetAccount`](../internetaccountsmixin#action-createephemeralinternetaccount)</span>, <span id="action-findappropriateinternetaccount">[`findAppropriateInternetAccount`](../internetaccountsmixin#action-findappropriateinternetaccount)</span></span>

<span data-pagefind-ignore>From [RootAppMenuMixin](../rootappmenumixin): <span id="action-appendmenu">[`appendMenu`](../rootappmenumixin#action-appendmenu)</span>, <span id="action-insertmenu">[`insertMenu`](../rootappmenumixin#action-insertmenu)</span>, <span id="action-appendtomenu">[`appendToMenu`](../rootappmenumixin#action-appendtomenu)</span>, <span id="action-insertinmenu">[`insertInMenu`](../rootappmenumixin#action-insertinmenu)</span>, <span id="action-appendtosubmenu">[`appendToSubMenu`](../rootappmenumixin#action-appendtosubmenu)</span>, <span id="action-insertinsubmenu">[`insertInSubMenu`](../rootappmenumixin#action-insertinsubmenu)</span></span>
