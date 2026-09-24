---
id: appcorejbrowsemodel
title: AppCoreJBrowseModel
sidebar_label: Root -> AppCoreJBrowseModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/JBrowseModel/index.ts).

built on the [JBrowseRootConfig](/docs/config/jbrowserootconfig) config model —
config models are MST trees themselves, which is why this state model is
allowed to build on one. Generally found on a property named rootModel.jbrowse

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
| <span id="action-addassemblyconf">**addAssemblyConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(conf: AnyConfigurationModel) =&gt; ConfigNodeProps&lt;any&gt; &amp; ConfigN…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(conf: AnyConfigurationModel) =&gt; ConfigNodeProps&lt;any&gt; &amp; ConfigNodeActions &amp; ConfigNodeBrand&lt;AnyConfigurationSchemaType&gt;</code></pre></dialog></span> |  |
| <span id="action-removeassemblyconf">**removeAssemblyConf**</span><br><code>(assemblyName: string) =&gt; void</code> |  |
| <span id="action-addtrackconf">**addTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(loose: { trackId: string; type?: string &#124; undefined; }) =&gt; { […</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(loose: { trackId: string; type?: string &#124; undefined; }) =&gt; { [key: string]: unknown; trackId: string; } &#124; undefined</code></pre></dialog></span> |  |
| <span id="action-addconnectionconf">**addConnectionConf**</span><br><code>(connectionConf: AnyConfiguration) =&gt; any</code> | Adds to the config's own `connections`, which every visitor to this instance loads. Takes a snapshot as readily as a built config model — the array coerces — since callers hand it plain JSON (a session spec's `sessionConnections`, the CLI's add-connection output). |
| <span id="action-deleteconnectionconf">**deleteConnectionConf**</span><br><code>(configuration: AnyConfigurationModel) =&gt; boolean</code> |  |
| <span id="action-deletetrackconf">**deleteTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackConf: AnyConfigurationModel &#124; { trackId: string; }) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackConf: AnyConfigurationModel &#124; { trackId: string; }) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-updatetrackconf">**updateTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackConf: { [key: string]: unknown; trackId: string; }) =&gt; vo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackConf: { [key: string]: unknown; trackId: string; }) =&gt; void</code></pre></dialog></span> | Updates an existing track configuration. Used to sync editable configs back to the frozen tracks array. A trackId the array repeats replaces its last entry, the one the session resolves it to. |
| <span id="action-addplugin">**addPlugin**</span><br><code>(pluginDefinition: PluginDefinition) =&gt; void</code> |  |
| <span id="action-removeplugin">**removePlugin**</span><br><code>(pluginDefinition: PluginDefinition) =&gt; void</code> | Removes the entry that loads from the same url — the version-pinned definition, not every entry sharing a name, so the update flow's remove-then-add swaps one version for another.<br><br>A definition naming no loader matches nothing (`isPluginUrl`) rather than every other url-less entry: `pluginUrl`'s miss value is the display string 'unknown url', so removing one hand-written broken entry used to filter out all of them. Such an entry has no InstalledPlugin row to remove it from either — it never loads, so it is never in `runtimePluginDefinitions` — so matching nothing costs nothing the UI could reach. |
| <span id="action-setdefaultsessionconf">**setDefaultSessionConf**</span><br><code>(sessionConf: AnyConfigurationModel) =&gt; void</code> | takes the live session or a plain session snapshot |
| <span id="action-addinternetaccountconf">**addInternetAccountConf**</span><br><code>(internetAccountConf: AnyConfigurationModel) =&gt; any</code> |  |
| <span id="action-deleteinternetaccountconf">**deleteInternetAccountConf**</span><br><code>(configuration: AnyConfigurationModel) =&gt; boolean</code> |  |
