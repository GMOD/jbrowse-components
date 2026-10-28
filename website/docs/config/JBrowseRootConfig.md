---
id: jbrowserootconfig
title: JBrowseRootConfig
description: "Holds a whole JBrowse config file: the config.json of jbrowse-web, or a file with the .jbrowse extension in jbrowse-desktop."
sidebar_label: Root -> JBrowseRootConfig
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/JBrowseConfig/index.ts).

Holds a whole JBrowse config file: the `config.json` of jbrowse-web, or a
file with the `.jbrowse` extension in jbrowse-desktop.

also includes any pluginManager.pluginConfigurationSchemas(), so plugins
that have a configurationSchema field on their class are mixed into this
object

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-plugins">**plugins**</span><br><code>types.array(types.frozen&lt;PluginDefinition&gt;())</code> | defines plugins of the format ```typescript type PluginDefinition= { umdUrl: string, name:string } \| { url: string, name: string } \| { esmUrl: string } \| { umdLoc: { uri: string } } \| { esmLoc: { uri: string } } \| { storePlugin: string } ``` |
| <span id="slot-assemblies">**assemblies**</span><br><code>types.array(assemblyConfigSchema)</code> | configuration of the assemblies in the instance, see BaseAssembly |
| <span id="slot-tracks">**tracks**</span><br><code>types.frozen([] as TrackConfigEntry[])</code> | track configuration is an array of track config schemas. multiple instances of a track can exist that use the same configuration. Always uses frozen for performance - editing creates temporary MST models. |
| <span id="slot-internetaccounts">**internetAccounts**</span><br>[list of internet account configs](/docs/config#internet-account) | configuration for internet accounts, see InternetAccounts |
| <span id="slot-aggregatetextsearchadapters">**aggregateTextSearchAdapters**</span><br>[list of text search adapter configs](/docs/config#adapter) | search indexes covering whole assemblies, as `jbrowse text-index` writes them or any pluggable text search adapter. A trix index can be just its `.ix` (`["trix/hg38.ix"]`), which takes the config's assembly when it has one; with several, write `{ uri, assemblyNames }`. |
| <span id="slot-connections">**connections**</span><br>[list of connection configs](/docs/config#connection) | configuration for connections |
| <span id="slot-defaultsession">**defaultSession**</span><br><code>types.optional(types.frozen(), { name: 'New Session', })</code> | the session loaded when no session is otherwise specified, e.g. the initial view shown on first load |
| <span id="slot-preconfiguredsessions">**preConfiguredSessions**</span><br><code>types.array(types.frozen())</code> | named sessions bundled with the config that a user can open from the session selector |
