---
id: baserootmodel
title: BaseRootModel
sidebar_label: Root -> BaseRootModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/BaseRootModel.ts).

factory function for the Base-level root model shared by all products

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-jbrowse">**jbrowse**</span><br><code>jbrowse: jbrowseModelType</code> | `jbrowse` is a mapping of the config.json into the in-memory state tree |
| <span id="property-session">**session**</span><br><code>session: types.maybe(sessionModelType)</code> | `session` encompasses the currently active state of the app, including views open, tracks open in those views, etc. |
| <span id="property-sessionpath">**sessionPath**</span><br><code>sessionPath: types.stripDefault(types.string, '')</code> |  |
| <span id="property-assemblymanager">**assemblyManager**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>assemblyManager: types.optional( assemblyManagerFactory(assembl…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>assemblyManager: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;assemblyManagerFactory(assemblyConfigSchema, pluginManager),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;{},&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-rpcmanager">**rpcManager**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>rpcManager: new RpcManager( pluginManager, self.jbrowse.configu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>rpcManager: new RpcManager(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;self.jbrowse.configuration.rpc,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;rpcManagerOptions,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="volatile-adminmode">**adminMode**</span><br><code>adminMode: false</code> |  |
| <span id="volatile-error">**error**</span><br><code>error: undefined as unknown</code> |  |
| <span id="volatile-textsearchmanager">**textSearchManager**</span><br><code>textSearchManager: new TextSearchManager(pluginManager)</code> |  |
| <span id="volatile-pluginmanager">**pluginManager**</span><br><code>pluginManager</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-seterror">**setError**</span><br><code>(error: unknown) =&gt; void</code> |  |
| <span id="action-setsession">**setSession**</span><br><code>(sessionSnapshot?: any) =&gt; void</code> | Sets the active session. Remaps any legacy display type names (e.g. LinearPileupDisplay → LinearAlignmentsDisplay), drops nodes whose pluggable type this build has no plugin for (see `pruneUnbuildableNodes`), then walks the resulting MST tree to drop open tracks whose config can't hydrate so shared sessions still load when referencing tracks that no longer exist. Both kinds of drop are surfaced to the user via a snackbar. If filtering throws, the previous session is restored. |
| <span id="action-setdefaultsession">**setDefaultSession**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setsessionpath">**setSessionPath**</span><br><code>(path: string) =&gt; void</code> |  |
| <span id="action-renamecurrentsession">**renameCurrentSession**</span><br><code>(newName: string) =&gt; void</code> |  |
