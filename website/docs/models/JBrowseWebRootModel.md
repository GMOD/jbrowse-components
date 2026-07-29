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
| <span id="property-assemblymanager">**assemblyManager**</span><br><details><summary><code>assemblyManager: types.optional( assemblyManagerFactory(assembl…</code></summary><pre><code>assemblyManager: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;assemblyManagerFactory(assemblyConfigSchema, pluginManager),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;{},&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  | [BaseRootModel](../baserootmodel#property-assemblymanager) |
| <span id="property-internetaccounts">**internetAccounts**</span><br><details><summary><code>internetAccounts: types.array( pluginManager.pluggableMstType('…</code></summary><pre><code>internetAccounts: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('internet account', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  | [InternetAccountsMixin](../internetaccountsmixin#property-internetaccounts) |
| <span id="property-history">**history**</span><br><details><summary><code>history: types.optional(TimeTraveller, { targetPath: '../sessio…</code></summary><pre><code>history: types.optional(TimeTraveller, { targetPath: '../session' })</code></pre></details> | <span data-pagefind-ignore>used for undo/redo</span> | [HistoryManagementMixin](../historymanagementmixin#property-history) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-adminmode">**adminMode**</span><br><code>adminMode</code> |  | JBrowseWebRootModel |
| <span id="volatile-sessiondb">**sessionDB**</span><br><code>sessionDB: undefined as IDBPDatabase&lt;SessionDB&gt; &#124; undefined</code> |  | JBrowseWebRootModel |
| <span id="volatile-version">**version**</span><br><code>version: packageJSON.version</code> |  | JBrowseWebRootModel |
| <span id="volatile-gitcommit">**gitCommit**</span><br><code>gitCommit</code> |  | JBrowseWebRootModel |
| <span id="volatile-pluginsupdated">**pluginsUpdated**</span><br><code>pluginsUpdated: false</code> |  | JBrowseWebRootModel |
| <span id="volatile-rpcmanager">**rpcManager**</span><br><details><summary><code>rpcManager: new RpcManager( pluginManager, self.jbrowse.configu…</code></summary><pre><code>rpcManager: new RpcManager(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;self.jbrowse.configuration.rpc,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;{&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;makeWorkerInstance,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;defaultDriverName: 'WebWorkerRpcDriver',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></details> |  | JBrowseWebRootModel |
| <span id="volatile-savedsessionmetadata">**savedSessionMetadata**</span><br><code>savedSessionMetadata: undefined as SessionMetadata[] &#124; undefined</code> |  | JBrowseWebRootModel |
| <span id="volatile-reloadpluginmanagercallback">**reloadPluginManagerCallback**</span><br><details><summary><code>reloadPluginManagerCallback: ( _configSnapshot: Record&lt;string,…</code></summary><pre><code>reloadPluginManagerCallback: (&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;_configSnapshot: Record&lt;string, unknown&gt;,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;_sessionSnapshot: Record&lt;string, unknown&gt;,&#10;&#160;&#160;&#160;&#160;&#160;&#160;) =&gt; {&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;console.error('reloadPluginManagerCallback unimplemented')&#10;&#160;&#160;&#160;&#160;&#160;&#160;}</code></pre></details> |  | JBrowseWebRootModel |
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
| <span id="action-fetchsessionmetadata">**fetchSessionMetadata**</span><br><code>() =&gt; Promise&lt;void&gt;</code> |  | JBrowseWebRootModel |
| <span id="action-setsessiondb">**setSessionDB**</span><br><code>(sessionDB: IDBPDatabase&lt;SessionDB&gt;) =&gt; void</code> |  | JBrowseWebRootModel |
| <span id="action-setpluginsupdated">**setPluginsUpdated**</span><br><code>() =&gt; void</code> |  | JBrowseWebRootModel |
| <span id="action-setreloadpluginmanagercallback">**setReloadPluginManagerCallback**</span><br><details><summary><code>(callback: (configSnapshot: Record&lt;string, unknown&gt;, sessionSna…</code></summary><pre><code>(callback: (configSnapshot: Record&lt;string, unknown&gt;, sessionSnapshot: Record&lt;string, unknown&gt;) =&gt; void) =&gt; void</code></pre></details> |  | JBrowseWebRootModel |
| <span id="action-activatesession">**activateSession**</span><br><code>(id: string) =&gt; Promise&lt;void&gt;</code> |  | JBrowseWebRootModel |
| <span id="action-setsavedsessionfavorite">**setSavedSessionFavorite**</span><br><code>(id: string, favorite: boolean) =&gt; Promise&lt;void&gt;</code> |  | JBrowseWebRootModel |
| <span id="action-deletesavedsession">**deleteSavedSession**</span><br><code>(id: string) =&gt; Promise&lt;void&gt;</code> |  | JBrowseWebRootModel |
| <span id="action-renamesavedsession">**renameSavedSession**</span><br><code>(id: string, name: string) =&gt; Promise&lt;void&gt;</code> |  | JBrowseWebRootModel |
| <span id="action-seterror">**setError**</span><br><code>(error: unknown) =&gt; void</code> |  | [BaseRootModel](../baserootmodel#action-seterror) |
| <span id="action-setsession">**setSession**</span><br><code>(sessionSnapshot?: any) =&gt; void</code> | <span data-pagefind-ignore>Sets the active session. Remaps any legacy display type names (e.g. LinearPileupDisplay → LinearAlignmentsDisplay), then walks the resulting MST tree to drop open tracks whose config can't hydrate so shared sessions still load when referencing tracks that no longer exist. Dropped tracks are surfaced to the user via a snackbar. If filtering throws, the previous session is restored.</span> | [BaseRootModel](../baserootmodel#action-setsession) |
| <span id="action-setdefaultsession">**setDefaultSession**</span><br><code>() =&gt; void</code> |  | [BaseRootModel](../baserootmodel#action-setdefaultsession) |
| <span id="action-setsessionpath">**setSessionPath**</span><br><code>(path: string) =&gt; void</code> |  | [BaseRootModel](../baserootmodel#action-setsessionpath) |
| <span id="action-renamecurrentsession">**renameCurrentSession**</span><br><code>(newName: string) =&gt; void</code> |  | [BaseRootModel](../baserootmodel#action-renamecurrentsession) |
| <span id="action-initializeinternetaccount">**initializeInternetAccount**</span><br><details><summary><code>(internetAccountConfig: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStat…</code></summary><pre><code>(internetAccountConfig: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;, initialSnapshot?: any) =&gt; any</code></pre></details> |  | [InternetAccountsMixin](../internetaccountsmixin#action-initializeinternetaccount) |
| <span id="action-createephemeralinternetaccount">**createEphemeralInternetAccount**</span><br><details><summary><code>(internetAccountId: string, initialSnapshot: Record&lt;string, unk…</code></summary><pre><code>(internetAccountId: string, initialSnapshot: Record&lt;string, unknown&gt;, url: string) =&gt; any</code></pre></details> |  | [InternetAccountsMixin](../internetaccountsmixin#action-createephemeralinternetaccount) |
| <span id="action-findappropriateinternetaccount">**findAppropriateInternetAccount**</span><br><code>(location: UriLocation) =&gt; any</code> |  | [InternetAccountsMixin](../internetaccountsmixin#action-findappropriateinternetaccount) |
| <span id="action-setmenus">**setMenus**</span><br><code>(newMenus: Menu[]) =&gt; void</code> |  | [RootAppMenuMixin](../rootappmenumixin#action-setmenus) |
| <span id="action-appendmenu">**appendMenu**</span><br><code>(menuName: string) =&gt; void</code> | <span data-pagefind-ignore>Add a top-level menu</span> | [RootAppMenuMixin](../rootappmenumixin#action-appendmenu) |
| <span id="action-insertmenu">**insertMenu**</span><br><code>(menuName: string, position: number) =&gt; void</code> | <span data-pagefind-ignore>Insert a top-level menu</span> | [RootAppMenuMixin](../rootappmenumixin#action-insertmenu) |
| <span id="action-appendtomenu">**appendToMenu**</span><br><code>(menuName: string, menuItem: MenuItem) =&gt; void</code> | <span data-pagefind-ignore>Add a menu item to a top-level menu</span> | [RootAppMenuMixin](../rootappmenumixin#action-appendtomenu) |
| <span id="action-insertinmenu">**insertInMenu**</span><br><code>(menuName: string, menuItem: MenuItem, position: number) =&gt; void</code> | <span data-pagefind-ignore>Insert a menu item into a top-level menu</span> | [RootAppMenuMixin](../rootappmenumixin#action-insertinmenu) |
| <span id="action-appendtosubmenu">**appendToSubMenu**</span><br><code>(menuPath: string[], menuItem: MenuItem) =&gt; void</code> | <span data-pagefind-ignore>Add a menu item to a sub-menu</span> | [RootAppMenuMixin](../rootappmenumixin#action-appendtosubmenu) |
| <span id="action-insertinsubmenu">**insertInSubMenu**</span><br><details><summary><code>(menuPath: string[], menuItem: MenuItem, position: number) =&gt; v…</code></summary><pre><code>(menuPath: string[], menuItem: MenuItem, position: number) =&gt; void</code></pre></details> | <span data-pagefind-ignore>Insert a menu item into a sub-menu</span> | [RootAppMenuMixin](../rootappmenumixin#action-insertinsubmenu) |
