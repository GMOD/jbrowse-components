---
id: baserootmodel
title: BaseRootModel
description: "Holds the loaded config, the session, the assembly manager and the RPC manager. Every JBrowse product's root model composes this one."
sidebar_label: Root -> BaseRootModel
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/BaseRootModel.ts).

Holds the loaded config, the session, the assembly manager and the RPC
manager. Every JBrowse product's root model composes this one.

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
| <span id="volatile-rpcmanager">**rpcManager**</span><br><code>RpcManager</code> |  |
| <span id="volatile-adminmode">**adminMode**</span><br><code>boolean</code> |  |
| <span id="volatile-error">**error**</span><br><code>unknown</code> |  |
| <span id="volatile-textsearchmanager">**textSearchManager**</span><br><code>TextSearchManager</code> |  |
| <span id="volatile-pluginmanager">**pluginManager**</span><br><code>PluginManager</code> |  |
| <span id="volatile-detachdisposers">**detachDisposers**</span><br><code>(() =&gt; void)[]</code> | What has to stop the moment the host lets go of this root: everything reaching outside the tree, like an autosave autorun.<br><br>Not `addDisposer`, which fires only on destroy, and destroy follows a task later, once React has let go of the views it still holds (ADR-069). Work left running in that gap acts for the outgoing session. See `detach`. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-seterror">**setError**</span><br><code>(error: unknown) =&gt; void</code> |  |
| <span id="action-adddetachdisposer">**addDetachDisposer**</span><br><code>(disposer: () =&gt; void) =&gt; void</code> | Register something that must stop when the host detaches this root. |
| <span id="action-detach">**detach**</span><br><code>() =&gt; void</code> | Called when the host releases this root. Stops the worker pool and whatever was registered with `addDetachDisposer`, and leaves the tree itself alone.<br><br>The caller destroys the tree on a later task (`scheduleDetachedDestroy`), which runs the `beforeDestroy` hooks in it; plugins rely on those hooks, so the destroy cannot be skipped. ADR-069. |
| <span id="action-setsession">**setSession**</span><br><code>(sessionSnapshot?: any) =&gt; void</code> | Sets the active session. Remaps any legacy display type names (e.g. LinearPileupDisplay → LinearAlignmentsDisplay), drops nodes whose pluggable type this build has no plugin for (see `pruneUnbuildableNodes`), then walks the resulting MST tree to drop open tracks whose config can't hydrate so shared sessions still load when referencing tracks that no longer exist. Both kinds of drop are surfaced to the user via a snackbar. If filtering throws, the previous session is restored. |
| <span id="action-setdefaultsession">**setDefaultSession**</span><br><code>() =&gt; void</code> | Starts a new session from the config's defaultSession. An `id` in it (a pasted session export carries one) is dropped, since sessions are autosaved by id and each new one would otherwise overwrite the last. |
| <span id="action-setsessionpath">**setSessionPath**</span><br><code>(path: string) =&gt; void</code> |  |
| <span id="action-renamecurrentsession">**renameCurrentSession**</span><br><code>(newName: string) =&gt; void</code> |  |
