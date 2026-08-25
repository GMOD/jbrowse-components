---
id: jbrowserootconfig
title: JBrowseRootConfig
sidebar_label: Root -> JBrowseRootConfig
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/JBrowseConfig/index.ts).

this is a config model representing a config.json (for jbrowse-web) or
somefile.jbrowse (for jbrowse-desktop, where configs have the .jbrowse
extension)

also includes any pluginManager.pluginConfigurationSchemas(), so plugins that
have a configurationSchema field on their class are mixed into this object

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-plugins">**plugins**</span><br><code>types.array(types.frozen&lt;PluginDefinition&gt;())</code> | defines plugins of the format ```typescript type PluginDefinition= { umdUrl: string, name:string } \| { url: string, name: string } \| { esmUrl: string } \| { cjsUrl: string } \| { umdLoc: { uri: string } } \| { esmLoc: { uri: string } } \| ``` |
| <span id="slot-assemblies">**assemblies**</span><br><code>types.array(assemblyConfigSchema)</code> | configuration of the assemblies in the instance, see BaseAssembly |
| <span id="slot-tracks">**tracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>types.frozen([] as { trackId: string; [key: string]: unknown }[…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>types.frozen([] as { trackId: string; [key: string]: unknown }[])</code></pre></dialog></span> | track configuration is an array of track config schemas. multiple instances of a track can exist that use the same configuration. Always uses frozen for performance - editing creates temporary MST models. |
| <span id="slot-internetaccounts">**internetAccounts**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>types.array( pluginManager.pluggableConfigSchemaType('internet…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>types.array(&#10;&#160;&#160;pluginManager.pluggableConfigSchemaType('internet account'),&#10;)</code></pre></dialog></span> | configuration for internet accounts, see InternetAccounts |
| <span id="slot-aggregatetextsearchadapters">**aggregateTextSearchAdapters**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>types.array( pluginManager.pluggableConfigSchemaType('text sear…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>types.array(&#10;&#160;&#160;pluginManager.pluggableConfigSchemaType('text search adapter'),&#10;)</code></pre></dialog></span> | configuration for aggregate text search adapters (created by e.g. jbrowse text-index, but can be a pluggable TextSearchAdapter type) |
| <span id="slot-connections">**connections**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>types.array( pluginManager.pluggableConfigSchemaType('connectio…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>types.array(&#10;&#160;&#160;pluginManager.pluggableConfigSchemaType('connection'),&#10;)</code></pre></dialog></span> | configuration for connections |
| <span id="slot-defaultsession">**defaultSession**</span><br><code>types.optional(types.frozen(), { name: 'New Session', })</code> | the session loaded when no session is otherwise specified, e.g. the initial view shown on first load |
| <span id="slot-preconfiguredsessions">**preConfiguredSessions**</span><br><code>types.array(types.frozen())</code> | named sessions bundled with the config that a user can open from the session selector |
