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
[config slot types reference](/docs/config_guides/slot_types).

| Slot                                                             | Type | Description                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [plugins](#slot-plugins)                                         |      | defines plugins of the format `typescript type PluginDefinition= { umdUrl: string, name:string } \| { url: string, name: string } \| { esmUrl: string } \| { cjsUrl: string } \| { umdLoc: { uri: string } } \| { esmLoc: { uri: string } } \| ` |
| [assemblies](#slot-assemblies)                                   |      | configuration of the assemblies in the instance, see BaseAssembly                                                                                                                                                                                |
| [tracks](#slot-tracks)                                           |      | track configuration is an array of track config schemas.                                                                                                                                                                                         |
| [internetAccounts](#slot-internetaccounts)                       |      | configuration for internet accounts, see InternetAccounts                                                                                                                                                                                        |
| [aggregateTextSearchAdapters](#slot-aggregatetextsearchadapters) |      | configuration for aggregate text search adapters (created by e.g. jbrowse text-index, but can be a pluggable TextSearchAdapter type)                                                                                                             |
| [connections](#slot-connections)                                 |      | configuration for connections                                                                                                                                                                                                                    |
| [defaultSession](#slot-defaultsession)                           |      | the session loaded when no session is otherwise specified, e.g. the initial view shown on first load                                                                                                                                             |
| [preConfiguredSessions](#slot-preconfiguredsessions)             |      | named sessions bundled with the config that a user can open from the session selector                                                                                                                                                            |

<details>
<summary>JBrowseRootConfig - Slots</summary>

#### slot: plugins

defines plugins of the format

```typescript
type PluginDefinition=
   { umdUrl: string, name:string } |
   { url: string, name: string } |
   { esmUrl: string } |
   { cjsUrl: string } |
   { umdLoc: { uri: string } } |
   { esmLoc: { uri: string } } |
```

```js
types.array(types.frozen<PluginDefinition>())
```

#### slot: assemblies

configuration of the assemblies in the instance, see BaseAssembly

```js
types.array(assemblyConfigSchema)
```

#### slot: tracks

track configuration is an array of track config schemas. multiple instances of a
track can exist that use the same configuration. Always uses frozen for
performance - editing creates temporary MST models.

```js
types.frozen([] as { trackId: string; [key: string]: unknown }[])
```

#### slot: internetAccounts

configuration for internet accounts, see InternetAccounts

```js
types.array(pluginManager.pluggableConfigSchemaType('internet account'))
```

#### slot: aggregateTextSearchAdapters

configuration for aggregate text search adapters (created by e.g. jbrowse
text-index, but can be a pluggable TextSearchAdapter type)

```js
types.array(pluginManager.pluggableConfigSchemaType('text search adapter'))
```

#### slot: connections

configuration for connections

```js
types.array(pluginManager.pluggableConfigSchemaType('connection'))
```

#### slot: defaultSession

the session loaded when no session is otherwise specified, e.g. the initial view
shown on first load

```js
types.optional(types.frozen(), {
  name: 'New Session',
})
```

#### slot: preConfiguredSessions

named sessions bundled with the config that a user can open from the session
selector

```js
types.array(types.frozen())
```

</details>
