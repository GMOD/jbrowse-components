---
id: jbrowsedesktopconfigmodel
title: JBrowseDesktopConfigModel
sidebar_label: Root -> JBrowseDesktopConfigModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. [View source](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/jbrowseModel.ts).

the rootModel.jbrowse state model for JBrowseDesktop

JBrowseDesktopConfigModel declares no members of its own — it composes the models below, and everything here is theirs.

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
| <span id="action-addassemblyconf">**addAssemblyConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(conf: AnyConfigurationModel) =&gt; ConfigNodeProps&lt;any&gt; &amp; ConfigN…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(conf: AnyConfigurationModel) =&gt; ConfigNodeProps&lt;any&gt; &amp; ConfigNodeActions &amp; ConfigNodeBrand&lt;AnyConfigurationSchemaType&gt;</code></pre></dialog></span> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-addassemblyconf) |
| <span id="action-removeassemblyconf">**removeAssemblyConf**</span><br><code>(assemblyName: string) =&gt; void</code> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-removeassemblyconf) |
| <span id="action-addtrackconf">**addTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(loose: { trackId: string; type?: string &#124; undefined; }) =&gt; { […</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(loose: { trackId: string; type?: string &#124; undefined; }) =&gt; { [key: string]: unknown; trackId: string; } &#124; undefined</code></pre></dialog></span> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-addtrackconf) |
| <span id="action-addconnectionconf">**addConnectionConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(connectionConf: AnyConfiguration) =&gt; PluggableConfigNode &amp; ISt…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(connectionConf: AnyConfiguration) =&gt; PluggableConfigNode &amp; IStateTreeNode&lt;PluggableConfigSchemaType&gt;</code></pre></dialog></span> | <span data-pagefind-ignore>Adds to the config's own `connections`, which every visitor to this instance loads. Takes a snapshot as readily as a built config model — the array coerces — since callers hand it plain JSON (a session spec's `sessionConnections`, the CLI's add-connection output).</span> | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-addconnectionconf) |
| <span id="action-deleteconnectionconf">**deleteConnectionConf**</span><br><code>(configuration: AnyConfigurationModel) =&gt; boolean</code> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-deleteconnectionconf) |
| <span id="action-deletetrackconf">**deleteTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackConf: AnyConfigurationModel &#124; { trackId: string; }) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackConf: AnyConfigurationModel &#124; { trackId: string; }) =&gt; void</code></pre></dialog></span> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-deletetrackconf) |
| <span id="action-updatetrackconf">**updateTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackConf: { [key: string]: unknown; trackId: string; }) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackConf: { [key: string]: unknown; trackId: string; }) =&gt; void</code></pre></dialog></span> | <span data-pagefind-ignore>Updates an existing track configuration. Used to sync editable configs back to the frozen tracks array. A trackId the array repeats replaces its last entry, the one the session resolves it to.</span> | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-updatetrackconf) |
| <span id="action-addplugin">**addPlugin**</span><br><code>(pluginDefinition: PluginDefinition) =&gt; void</code> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-addplugin) |
| <span id="action-removeplugin">**removePlugin**</span><br><code>(pluginDefinition: PluginDefinition) =&gt; void</code> | <span data-pagefind-ignore>Removes the entry the loaded copy came from — the version-pinned definition, or the bare store ref that resolved to it. Not every entry sharing a name or a ref, so the update flow's remove-then-add swaps one version for another; `holdsPluginVersion` argues both halves.</span> | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-removeplugin) |
| <span id="action-setdefaultsessionconf">**setDefaultSessionConf**</span><br><code>(sessionConf: AnyConfigurationModel) =&gt; void</code> | <span data-pagefind-ignore>takes the live session or a plain session snapshot</span> | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-setdefaultsessionconf) |
| <span id="action-addinternetaccountconf">**addInternetAccountConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(internetAccountConf: AnyConfigurationModel) =&gt; PluggableConfig…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(internetAccountConf: AnyConfigurationModel) =&gt; PluggableConfigNode &amp; IStateTreeNode&lt;PluggableConfigSchemaType&gt;</code></pre></dialog></span> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-addinternetaccountconf) |
| <span id="action-deleteinternetaccountconf">**deleteInternetAccountConf**</span><br><code>(configuration: AnyConfigurationModel) =&gt; boolean</code> |  | [AppCoreJBrowseModel](../appcorejbrowsemodel#action-deleteinternetaccountconf) |
