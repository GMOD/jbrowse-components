---
id: appcorejbrowsemodel
title: AppCoreJBrowseModel
sidebar_label: Root -> AppCoreJBrowseModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/JBrowseModel/index.ts).

built on the [JBrowseRootConfig](/docs/config/jbrowserootconfig) config model —
config models are MST trees themselves, which is why this state model is allowed
to build on one. Generally found on a property named rootModel.jbrowse

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  |
| <span id="getter-rpcmanager">**rpcManager**</span><br><code>RpcManager</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-addassemblyconf">**addAssemblyConf**</span><br><details><summary><code>(conf: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) =&gt;…</code></summary><pre><code>(conf: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) =&gt; ModelInstanceTypeProps&lt;…&gt; &amp; ... 1 more ... &amp; IStateTreeNode&lt;…&gt;</code></pre></details> |  |
| <span id="action-removeassemblyconf">**removeAssemblyConf**</span><br><code>(assemblyName: string) =&gt; void</code> |  |
| <span id="action-addtrackconf">**addTrackConf**</span><br><details><summary><code>(trackConf: { trackId: string; type: string; }) =&gt; { [key: stri…</code></summary><pre><code>(trackConf: { trackId: string; type: string; }) =&gt; { [key: string]: unknown; trackId: string; } &#124; undefined</code></pre></details> |  |
| <span id="action-addconnectionconf">**addConnectionConf**</span><br><details><summary><code>(connectionConf: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slo…</code></summary><pre><code>(connectionConf: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;…&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;…&gt;) =&gt; any</code></pre></details> |  |
| <span id="action-deleteconnectionconf">**deleteConnectionConf**</span><br><details><summary><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNod…</code></summary><pre><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) =&gt; boolean</code></pre></details> |  |
| <span id="action-deletetrackconf">**deleteTrackConf**</span><br><details><summary><code>(trackConf: (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;……</code></summary><pre><code>(trackConf: (ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) &#124; { ...; }) =&gt; void</code></pre></details> |  |
| <span id="action-updatetrackconf">**updateTrackConf**</span><br><details><summary><code>(trackConf: { [key: string]: unknown; trackId: string; }) =&gt; vo…</code></summary><pre><code>(trackConf: { [key: string]: unknown; trackId: string; }) =&gt; void</code></pre></details> | Updates an existing track configuration. Used to sync editable configs back to the frozen tracks array. |
| <span id="action-addplugin">**addPlugin**</span><br><code>(pluginDefinition: PluginDefinition) =&gt; void</code> |  |
| <span id="action-removeplugin">**removePlugin**</span><br><code>(pluginDefinition: PluginDefinition) =&gt; void</code> |  |
| <span id="action-setdefaultsessionconf">**setDefaultSessionConf**</span><br><details><summary><code>(sessionConf: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotNa…</code></summary><pre><code>(sessionConf: ModelInstanceTypeProps&lt;…&gt; &amp; { setSubschema(slotName: string, data: Record&lt;…&gt;): any; setSlot(slotName: string, value: unknown): void; } &amp; IStateTreeNode&lt;...&gt;) =&gt; void</code></pre></details> |  |
| <span id="action-addinternetaccountconf">**addInternetAccountConf**</span><br><details><summary><code>(internetAccountConf: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateT…</code></summary><pre><code>(internetAccountConf: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) =&gt; any</code></pre></details> |  |
| <span id="action-deleteinternetaccountconf">**deleteInternetAccountConf**</span><br><details><summary><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNod…</code></summary><pre><code>(configuration: ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; IStateTreeNode&lt;…&gt;) =&gt; boolean</code></pre></details> |  |
