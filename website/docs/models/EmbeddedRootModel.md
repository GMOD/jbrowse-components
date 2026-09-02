---
id: embeddedrootmodel
title: EmbeddedRootModel
sidebar_label: Root -> EmbeddedRootModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/embedded-core/src/createEmbeddedRootModel.ts).

Root model shared by the single-view embedded products
(react-linear-genome-view, react-circular-genome-view). Each product supplies
its own model name, version, and session model, and may `.props()` on extra
fields (e.g. the LGV `disableAddTracks`/`drawerViewHeight`). Internet accounts
come from the same product-core mixin the web/desktop root models use, so
config `internetAccounts` are auto-initialized (no manual wiring needed).

Members a composed model contributes are listed here too, so these tables are the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-config">**config**</span><br><code>config: createConfigModel(pluginManager, assemblyConfigSchema)</code> |  | EmbeddedRootModel |
| <span id="property-session">**session**</span><br><code>session: sessionModelType</code> |  | EmbeddedRootModel |
| <span id="property-assemblymanager">**assemblyManager**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>assemblyManager: types.optional( assemblyManagerFactory(assembl…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>assemblyManager: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;assemblyManagerFactory(assemblyConfigSchema, pluginManager),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;{},&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | EmbeddedRootModel |
| <span id="property-internetaccounts">**internetAccounts**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>internetAccounts: types.array( pluginManager.pluggableMstType('…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>internetAccounts: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('internet account', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  | [InternetAccountsMixin](../internetaccountsmixin#property-internetaccounts) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-error">**error**</span><br><code>error: undefined as unknown</code> |  |
| <span id="volatile-adminmode">**adminMode**</span><br><code>adminMode: false</code> |  |
| <span id="volatile-version">**version**</span><br><code>version</code> |  |
| <span id="volatile-rpcmanager">**rpcManager**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>rpcManager: new RpcManager( pluginManager, self.config.configur…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>rpcManager: new RpcManager(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;self.config.configuration.rpc,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;{&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;makeWorkerInstance,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;defaultDriverName: makeWorkerInstance&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;? 'WebWorkerRpcDriver'&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;: 'MainThreadRpcDriver',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;},&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="volatile-textsearchmanager">**textSearchManager**</span><br><code>textSearchManager: new TextSearchManager(pluginManager)</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-jbrowse">**jbrowse**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelPropertiesDeclarationToProperties&lt;{ config: IModelType&lt;…&gt;;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelPropertiesDeclarationToProperties&lt;{ config: IModelType&lt;…&gt;; session: SESSION; assemblyManager: IOptionalIType&lt;IModelType&lt;…&gt;, [undefined]&gt;; }&gt;["config"]["Type"]</code></pre></dialog></span> |  |
| <span id="getter-pluginmanager">**pluginManager**</span><br><code>PluginManager</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setsession">**setSession**</span><br><code>(sessionSnapshot: SnapshotIn&lt;SESSION&gt;) =&gt; void</code> | Synchronous: an async caller must `await pluginManager.preloadSessionTypes(snapshot)` first. | EmbeddedRootModel |
| <span id="action-restoresession">**restoreSession**</span><br><code>(sessionSnapshot: SessionSnapshot) =&gt; void</code> | Load a session whose shape is only known at runtime — decoded from a URL, read back from storage, handed over by a non-TypeScript host.<br><br>Separate from `setSession` because that one takes the compiler-checked snapshot type, which a value parsed out of JSON can never satisfy. The assertion below is the whole reason this exists: it is the single place the conversion happens, instead of every caller asserting at its own site. Nothing is unchecked at runtime — MST validates the snapshot as it applies it and throws on a mismatch, which is the check that actually matters for a value this app did not author. | EmbeddedRootModel |
| <span id="action-renamecurrentsession">**renameCurrentSession**</span><br><code>(sessionName: string) =&gt; void</code> |  | EmbeddedRootModel |
| <span id="action-seterror">**setError**</span><br><code>(error: unknown) =&gt; void</code> |  | EmbeddedRootModel |
| <span id="action-initializeinternetaccount">**initializeInternetAccount**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(internetAccountConfig: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStat…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(internetAccountConfig: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;, initialSnapshot?: object) =&gt; any</code></pre></dialog></span> |  | [InternetAccountsMixin](../internetaccountsmixin#action-initializeinternetaccount) |
| <span id="action-createephemeralinternetaccount">**createEphemeralInternetAccount**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(internetAccountId: string, initialSnapshot: Record&lt;string, unk…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(internetAccountId: string, initialSnapshot: Record&lt;string, unknown&gt;, url: string) =&gt; any</code></pre></dialog></span> |  | [InternetAccountsMixin](../internetaccountsmixin#action-createephemeralinternetaccount) |
| <span id="action-findappropriateinternetaccount">**findAppropriateInternetAccount**</span><br><code>(location: UriLocation) =&gt; any</code> |  | [InternetAccountsMixin](../internetaccountsmixin#action-findappropriateinternetaccount) |
