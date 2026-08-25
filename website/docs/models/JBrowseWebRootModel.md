---
id: jbrowsewebrootmodel
title: JBrowseWebRootModel
sidebar_label: Root -> JBrowseWebRootModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/rootModel/rootModel.ts).

note: many properties of the root model are available through the session, and
we generally prefer using the session model (via e.g. getSession) over the root
model (via e.g. getRoot) in plugin code

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-configpath">**configPath**</span><br><code>configPath: types.maybe(types.string)</code> |  | JBrowseWebRootModel |
| <span id="property-jbrowse">**jbrowse**</span><br><code>jbrowse: jbrowseModelType</code> | <span data-pagefind-ignore>`jbrowse` is a mapping of the config.json into the in-memory state tree</span> | [BaseRootModel](../baserootmodel#property-jbrowse) |
| <span id="property-session">**session**</span><br><code>session: types.maybe(sessionModelType)</code> | <span data-pagefind-ignore>`session` encompasses the currently active state of the app, including views open, tracks open in those views, etc.</span> | [BaseRootModel](../baserootmodel#property-session) |
| <span id="property-sessionpath">**sessionPath**</span><br><code>sessionPath: types.stripDefault(types.string, '')</code> |  | [BaseRootModel](../baserootmodel#property-sessionpath) |
| <span id="property-assemblymanager">**assemblyManager**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>assemblyManager: types.optional( assemblyManagerFactory(assembl…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>assemblyManager: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;assemblyManagerFactory(assemblyConfigSchema, pluginManager),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;{},&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | [BaseRootModel](../baserootmodel#property-assemblymanager) |
| <span id="property-internetaccounts">**internetAccounts**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>internetAccounts: types.array( pluginManager.pluggableMstType('…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>internetAccounts: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('internet account', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | [InternetAccountsMixin](../internetaccountsmixin#property-internetaccounts) |
| <span id="property-history">**history**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>history: types.optional(TimeTraveller, { targetPath: '../sessio…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>history: types.optional(TimeTraveller, { targetPath: '../session' })</code></pre></dialog></span> | <span data-pagefind-ignore>used for undo/redo</span> | [HistoryManagementMixin](../historymanagementmixin#property-history) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-adminmode">**adminMode**</span><br><code>adminMode</code> |  | JBrowseWebRootModel |
| <span id="volatile-sessiondb">**sessionDB**</span><br><code>sessionDB: undefined as SessionDBHandle &#124; undefined</code> |  | JBrowseWebRootModel |
| <span id="volatile-version">**version**</span><br><code>version: packageJSON.version</code> |  | JBrowseWebRootModel |
| <span id="volatile-gitcommit">**gitCommit**</span><br><code>gitCommit</code> |  | JBrowseWebRootModel |
| <span id="volatile-pluginsupdated">**pluginsUpdated**</span><br><code>pluginsUpdated: false</code> |  | JBrowseWebRootModel |
| <span id="volatile-savedsessionmetadata">**savedSessionMetadata**</span><br><code>savedSessionMetadata: undefined as SessionMetadata[] &#124; undefined</code> |  | JBrowseWebRootModel |
| <span id="volatile-detachdisposers">**detachDisposers**</span><br><code>detachDisposers: [] as (() =&gt; void)[]</code> | What has to stop the moment the React host lets go of this root — the `beforeunload` listener and the autoruns that write to sessionStorage and IndexedDB, i.e. everything reaching outside the tree.<br><br>Deliberately not `addDisposer`, which fires only on destroy, because destroy is what this root cannot do at detach time: React is still holding its views and widgets in the outgoing props of the same passive-effect flush. The destroy follows on a later task, so an `addDisposer` here would run late rather than never — but "the moment the host lets go" is the contract these want. See `detach` and SessionLoader's disposePluginManager. | JBrowseWebRootModel |
| <span id="volatile-reloadpluginmanagercallback">**reloadPluginManagerCallback**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>reloadPluginManagerCallback: ( _configSnapshot: Record&lt;string,…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>reloadPluginManagerCallback: (&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;_configSnapshot: Record&lt;string, unknown&gt;,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;_sessionSnapshot: Record&lt;string, unknown&gt;,&#10;&#160;&#160;&#160;&#160;&#160;&#160;) =&gt; {&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;console.error('reloadPluginManagerCallback unimplemented')&#10;&#160;&#160;&#160;&#160;&#160;&#160;}</code></pre></dialog></span> |  | JBrowseWebRootModel |
| <span id="volatile-rpcmanager">**rpcManager**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>rpcManager: new RpcManager( pluginManager, self.jbrowse.configu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>rpcManager: new RpcManager(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;self.jbrowse.configuration.rpc,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;rpcManagerOptions,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | [BaseRootModel](../baserootmodel#volatile-rpcmanager) |
| <span id="volatile-error">**error**</span><br><code>error: undefined as unknown</code> |  | [BaseRootModel](../baserootmodel#volatile-error) |
| <span id="volatile-textsearchmanager">**textSearchManager**</span><br><code>textSearchManager: new TextSearchManager(pluginManager)</code> |  | [BaseRootModel](../baserootmodel#volatile-textsearchmanager) |
| <span id="volatile-pluginmanager">**pluginManager**</span><br><code>pluginManager</code> |  | [BaseRootModel](../baserootmodel#volatile-pluginmanager) |
| <span id="volatile-mutablemenuactions">**mutableMenuActions**</span><br><code>mutableMenuActions: [] as MenuAction[]</code> |  | [RootAppMenuMixin](../rootappmenumixin#volatile-mutablemenuactions) |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-menus">**menus**</span><br><code>() =&gt; Menu[]</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setsavedsessionmetadata">**setSavedSessionMetadata**</span><br><code>(sessions: SessionMetadata[]) =&gt; void</code> |  | JBrowseWebRootModel |
| <span id="action-fetchsessionmetadata">**fetchSessionMetadata**</span><br><code>() =&gt; Promise&lt;void&gt;</code> | Re-reads the whole `metadata` store. For anything that changes rows this model didn't just write itself (first load, pruning, favorite, rename, delete) — the autosave path uses `upsertSessionMetadata` instead. | JBrowseWebRootModel |
| <span id="action-upsertsessionmetadata">**upsertSessionMetadata**</span><br><code>(meta: SessionMetadata) =&gt; void</code> | Merges a row this model has just written into the in-memory list. The autosave autorun writes exactly one row on every debounced session edit — every 400ms for as long as you keep panning — and already holds its contents, so re-reading every session's metadata to learn what it just stored is the expensive way to move one row to the top. | JBrowseWebRootModel |
| <span id="action-setsessiondb">**setSessionDB**</span><br><code>(sessionDB: SessionDBHandle &#124; undefined) =&gt; void</code> |  | JBrowseWebRootModel |
| <span id="action-adddetachdisposer">**addDetachDisposer**</span><br><code>(disposer: () =&gt; void) =&gt; void</code> | Register something that must stop when the React host detaches this root. See the `detachDisposers` volatile for why this is not `addDisposer`. | JBrowseWebRootModel |
| <span id="action-detach">**detach**</span><br><code>() =&gt; void</code> | The React host has let go of this root: stop everything of ours that reaches outside the tree — the worker pool, the `beforeunload` listener, the sessionStorage and IndexedDB autoruns — and leave the tree itself alone.<br><br>Half the teardown. The caller destroys the tree on a later task (`scheduleDetachedDestroy`), which is what runs the `beforeDestroy` hooks in it — a plugin-facing contract, so skipping it is not an option. What this action does is take everything that reaches outside the tree off that deferral, so nothing keeps running in the window between the two. ADR-069. | JBrowseWebRootModel |
| <span id="action-setpluginsupdated">**setPluginsUpdated**</span><br><code>() =&gt; void</code> |  | JBrowseWebRootModel |
| <span id="action-setreloadpluginmanagercallback">**setReloadPluginManagerCallback**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(callback: (configSnapshot: Record&lt;string, unknown&gt;, sessionSna…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(callback: (configSnapshot: Record&lt;string, unknown&gt;, sessionSnapshot: Record&lt;string, unknown&gt;) =&gt; void) =&gt; void</code></pre></dialog></span> |  | JBrowseWebRootModel |
| <span id="action-activatesession">**activateSession**</span><br><code>(id: string) =&gt; Promise&lt;void&gt;</code> |  | JBrowseWebRootModel |
| <span id="action-setsavedsessionfavorite">**setSavedSessionFavorite**</span><br><code>(id: string, favorite: boolean) =&gt; Promise&lt;void&gt;</code> |  | JBrowseWebRootModel |
| <span id="action-deletesavedsession">**deleteSavedSession**</span><br><code>(id: string) =&gt; Promise&lt;void&gt;</code> |  | JBrowseWebRootModel |
| <span id="action-deletesavedsessions">**deleteSavedSessions**</span><br><code>(ids: string[]) =&gt; Promise&lt;void&gt;</code> | Deletes a batch of saved sessions in ONE transaction, and re-reads the metadata once at the end. Looping `deleteSavedSession` instead is both N transactions and N full `getAll('metadata')` scans, and — because those interleave — leaves `savedSessionMetadata` holding whichever scan happened to resolve last, so already-deleted rows stay on screen until something else refreshes the list.<br><br>The open session is skipped rather than reported on, since a bulk delete is not aimed at any one row (see deleteSavedSession). | JBrowseWebRootModel |
| <span id="action-renamesavedsession">**renameSavedSession**</span><br><code>(id: string, name: string) =&gt; Promise&lt;void&gt;</code> |  | JBrowseWebRootModel |
| <span id="action-seterror">**setError**</span><br><code>(error: unknown) =&gt; void</code> |  | [BaseRootModel](../baserootmodel#action-seterror) |
| <span id="action-setsession">**setSession**</span><br><code>(sessionSnapshot?: any) =&gt; void</code> | <span data-pagefind-ignore>Sets the active session. Remaps any legacy display type names (e.g. LinearPileupDisplay → LinearAlignmentsDisplay), drops nodes whose pluggable type this build has no plugin for (see `pruneUnbuildableNodes`), then walks the resulting MST tree to drop open tracks whose config can't hydrate so shared sessions still load when referencing tracks that no longer exist. Both kinds of drop are surfaced to the user via a snackbar. If filtering throws, the previous session is restored.</span> | [BaseRootModel](../baserootmodel#action-setsession) |
| <span id="action-setdefaultsession">**setDefaultSession**</span><br><code>() =&gt; void</code> |  | [BaseRootModel](../baserootmodel#action-setdefaultsession) |
| <span id="action-setsessionpath">**setSessionPath**</span><br><code>(path: string) =&gt; void</code> |  | [BaseRootModel](../baserootmodel#action-setsessionpath) |
| <span id="action-renamecurrentsession">**renameCurrentSession**</span><br><code>(newName: string) =&gt; void</code> |  | [BaseRootModel](../baserootmodel#action-renamecurrentsession) |
| <span id="action-initializeinternetaccount">**initializeInternetAccount**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(internetAccountConfig: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStat…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(internetAccountConfig: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;, initialSnapshot?: object) =&gt; any</code></pre></dialog></span> |  | [InternetAccountsMixin](../internetaccountsmixin#action-initializeinternetaccount) |
| <span id="action-createephemeralinternetaccount">**createEphemeralInternetAccount**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(internetAccountId: string, initialSnapshot: Record&lt;string, unk…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(internetAccountId: string, initialSnapshot: Record&lt;string, unknown&gt;, url: string) =&gt; any</code></pre></dialog></span> |  | [InternetAccountsMixin](../internetaccountsmixin#action-createephemeralinternetaccount) |
| <span id="action-findappropriateinternetaccount">**findAppropriateInternetAccount**</span><br><code>(location: UriLocation) =&gt; any</code> |  | [InternetAccountsMixin](../internetaccountsmixin#action-findappropriateinternetaccount) |
| <span id="action-setmenus">**setMenus**</span><br><code>(newMenus: MenuDefinition[]) =&gt; void</code> | <span data-pagefind-ignore>Replace the menu bar wholesale. Item contributions recorded before this one are dropped along with the menus they targeted, so a plugin adding to the existing bar wants `appendToMenu` instead.</span> | [RootAppMenuMixin](../rootappmenumixin#action-setmenus) |
| <span id="action-appendmenu">**appendMenu**</span><br><code>(menuName: string) =&gt; void</code> | <span data-pagefind-ignore>Add a top-level menu, if the app bar does not already have one with this name.</span> | [RootAppMenuMixin](../rootappmenumixin#action-appendmenu) |
| <span id="action-insertmenu">**insertMenu**</span><br><code>(menuName: string, position: number) =&gt; void</code> | <span data-pagefind-ignore>Insert a top-level menu, if the app bar does not already have one with this name.</span> | [RootAppMenuMixin](../rootappmenumixin#action-insertmenu) |
| <span id="action-appendtomenu">**appendToMenu**</span><br><code>(menuName: string, menuItem: MenuItem) =&gt; void</code> | <span data-pagefind-ignore>Add a menu item to a top-level menu, creating the menu if it does not exist.</span> | [RootAppMenuMixin](../rootappmenumixin#action-appendtomenu) |
| <span id="action-insertinmenu">**insertInMenu**</span><br><code>(menuName: string, menuItem: MenuItem, position: number) =&gt; void</code> | <span data-pagefind-ignore>Insert a menu item into a top-level menu, creating the menu if it does not exist.</span> | [RootAppMenuMixin](../rootappmenumixin#action-insertinmenu) |
| <span id="action-appendtosubmenu">**appendToSubMenu**</span><br><code>(menuPath: string[], menuItem: MenuItem) =&gt; void</code> | <span data-pagefind-ignore>Add a menu item to a sub-menu, creating any part of the path that does not exist.</span> | [RootAppMenuMixin](../rootappmenumixin#action-appendtosubmenu) |
| <span id="action-insertinsubmenu">**insertInSubMenu**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(menuPath: string[], menuItem: MenuItem, position: number) =&gt; v…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(menuPath: string[], menuItem: MenuItem, position: number) =&gt; void</code></pre></dialog></span> | <span data-pagefind-ignore>Insert a menu item into a sub-menu, creating any part of the path that does not exist.</span> | [RootAppMenuMixin](../rootappmenumixin#action-insertinsubmenu) |
