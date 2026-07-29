---
id: jbrowsedesktopconfigmodel
title: JBrowseDesktopConfigModel
sidebar_label: Root -> JBrowseDesktopConfigModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/jbrowseModel.ts).

the rootModel.jbrowse state model for JBrowseDesktop

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#getter-assemblynames) |
| <span id="getter-rpcmanager">**rpcManager**</span><br><code>RpcManager</code> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#getter-rpcmanager) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-addassemblyconf">**addAssemblyConf**</span><br><details><summary><code>(conf: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) =&gt;…</code></summary><pre><code>(conf: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) =&gt; ModelInstanceTypeProps&lt;…&gt; &amp; ... 1 more ... &amp; IStateTreeNode&lt;…&gt;</code></pre></details> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-addassemblyconf) |
| <span id="action-removeassemblyconf">**removeAssemblyConf**</span><br><code>(assemblyName: string) =&gt; void</code> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-removeassemblyconf) |
| <span id="action-addtrackconf">**addTrackConf**</span><br><details><summary><code>(trackConf: { trackId: string; type: string; }) =&gt; { [key: stri…</code></summary><pre><code>(trackConf: { trackId: string; type: string; }) =&gt; { [key: string]: unknown; trackId: string; } &#124; undefined</code></pre></details> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-addtrackconf) |
| <span id="action-addconnectionconf">**addConnectionConf**</span><br><details><summary><code>(connectionConf: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slo…</code></summary><pre><code>(connectionConf: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;…&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;…&gt;) =&gt; any</code></pre></details> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-addconnectionconf) |
| <span id="action-deleteconnectionconf">**deleteConnectionConf**</span><br><details><summary><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNod…</code></summary><pre><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) =&gt; boolean</code></pre></details> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-deleteconnectionconf) |
| <span id="action-deletetrackconf">**deleteTrackConf**</span><br><details><summary><code>(trackConf: (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;……</code></summary><pre><code>(trackConf: (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) &#124; { ...; }) =&gt; void</code></pre></details> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-deletetrackconf) |
| <span id="action-updatetrackconf">**updateTrackConf**</span><br><details><summary><code>(trackConf: { [key: string]: unknown; trackId: string; }) =&gt; vo…</code></summary><pre><code>(trackConf: { [key: string]: unknown; trackId: string; }) =&gt; void</code></pre></details> | <span data-pagefind-ignore>Updates an existing track configuration. Used to sync editable configs back to the frozen tracks array.</span> | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-updatetrackconf) |
| <span id="action-addplugin">**addPlugin**</span><br><code>(pluginDefinition: PluginDefinition) =&gt; void</code> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-addplugin) |
| <span id="action-removeplugin">**removePlugin**</span><br><code>(pluginDefinition: PluginDefinition) =&gt; void</code> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-removeplugin) |
| <span id="action-setdefaultsessionconf">**setDefaultSessionConf**</span><br><details><summary><code>(sessionConf: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotNa…</code></summary><pre><code>(sessionConf: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;…&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;) =&gt; void</code></pre></details> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-setdefaultsessionconf) |
| <span id="action-addinternetaccountconf">**addInternetAccountConf**</span><br><details><summary><code>(internetAccountConf: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateT…</code></summary><pre><code>(internetAccountConf: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) =&gt; any</code></pre></details> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-addinternetaccountconf) |
| <span id="action-deleteinternetaccountconf">**deleteInternetAccountConf**</span><br><details><summary><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNod…</code></summary><pre><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) =&gt; boolean</code></pre></details> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-deleteinternetaccountconf) |
