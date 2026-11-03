---
id: embeddedrootmodel
title: EmbeddedRootModel
description: "Root model shared by the single-view embedded products (react-linear-genome-view, react-circular-genome-view)."
sidebar_label: Root -> EmbeddedRootModel
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/embedded/createEmbeddedRootModel.ts).

Root model shared by the single-view embedded products
(react-linear-genome-view, react-circular-genome-view). Each product supplies
the model name, version, and session model, and may `.props()` on extra
fields (e.g. the LGV `disableAddTracks`/`drawerViewHeight`). Internet accounts
come from the same product-core mixin the web/desktop root models use, so
config `internetAccounts` are auto-initialized (no manual wiring needed).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-config">**config**</span><br><code>createConfigModel(pluginManager, assemblyConfigSchema)</code> |  |
| <span id="property-session">**session**</span><br><code>sessionModelType</code> |  |
| <span id="property-assemblymanager">**assemblyManager**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>types.optional( assemblyManagerFactory(assemblyConfigSchema, pl…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>types.optional(&#10;&#160;&#160;assemblyManagerFactory(assemblyConfigSchema, pluginManager),&#10;&#160;&#160;{},&#10;)</code></pre></dialog></span> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited property from one model</summary>

From [InternetAccountsMixin](../internetaccountsmixin): <span id="property-internetaccounts">[`internetAccounts`](../internetaccountsmixin#property-internetaccounts)</span>

</details>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-adminmode">**adminMode**</span><br><code>boolean</code> |  |
| <span id="volatile-version">**version**</span><br><code>string</code> |  |
| <span id="volatile-rpcmanager">**rpcManager**</span><br><code>RpcManager</code> |  |
| <span id="volatile-textsearchmanager">**textSearchManager**</span><br><code>TextSearchManager</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-jbrowse">**jbrowse**</span><br><code>JBrowseConfigModel</code> |  |
| <span id="getter-pluginmanager">**pluginManager**</span><br><code>PluginManager</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setsession">**setSession**</span><br><code>(sessionSnapshot: SnapshotIn&lt;SESSION&gt;) =&gt; void</code> | Synchronous: an async caller must `await pluginManager.preloadSessionTypes(snapshot)` first. |
| <span id="action-restoresession">**restoreSession**</span><br><code>(sessionSnapshot: SessionSnapshot) =&gt; void</code> | Load a session whose shape is only known at runtime — decoded from a URL, read back from storage, handed over by a non-TypeScript host. MST validates the snapshot as it applies it and throws on a mismatch, leaving the old session in place. |
| <span id="action-aftercreate">**afterCreate**</span><br><code>() =&gt; void</code> | The `session` prop at create is the third door, after the two above: a track whose config cannot load is dropped there too. |
| <span id="action-renamecurrentsession">**renameCurrentSession**</span><br><code>(sessionName: string) =&gt; void</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>3 inherited actions from one model</summary>

From [InternetAccountsMixin](../internetaccountsmixin): <span id="action-initializeinternetaccount">[`initializeInternetAccount`](../internetaccountsmixin#action-initializeinternetaccount)</span>, <span id="action-createephemeralinternetaccount">[`createEphemeralInternetAccount`](../internetaccountsmixin#action-createephemeralinternetaccount)</span>, <span id="action-findappropriateinternetaccount">[`findAppropriateInternetAccount`](../internetaccountsmixin#action-findappropriateinternetaccount)</span>

</details>
