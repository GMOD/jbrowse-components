---
id: jbrowserootconfig
title: JBrowseRootConfig
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[packages/app-core/src/JBrowseConfig/index.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/JBrowseConfig/index.ts)

this is a config model representing a config.json (for jbrowse-web) or
somefile.jbrowse (for jbrowse-desktop, where configs have the .jbrowse
extension)

includes

- [FormatDetails](../formatdetails) for global (instead of per-track) feature
  detail formatters
- [FormatAbout](../formatabout) for global (instead of per-track) about track
  formatters
- [HierarchicalConfigSchema](../hierarchicalconfigschema) for track selector
  configs

also includes any pluginManager.pluginConfigurationSchemas(), so plugins that
have a configurationSchema field on their class are mixed into this object

### JBrowseRootConfig - Slots

#### slot: configuration.rpc

```js
rpc: RpcManager.configSchema
```

#### slot: configuration.highResolutionScaling

```js
highResolutionScaling: {
        type: 'number',
        defaultValue: 2,
      }
```

#### slot: configuration.disableAnalytics

```js
disableAnalytics: {
        type: 'boolean',
        defaultValue: false,
      }
```

#### slot: configuration.theme

```js
theme: {
        type: 'frozen',
        defaultValue: {},
      }
```

#### slot: configuration.extraThemes

```js
extraThemes: {
        type: 'frozen',
        defaultValue: {},
      }
```

#### slot: configuration.logoPath

```js
logoPath: {
        type: 'fileLocation',
        defaultValue: { uri: '', locationType: 'UriLocation' },
      }
```

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
plugins: types.array(types.frozen<PluginDefinition>())
```

#### slot: assemblies

configuration of the assemblies in the instance, see BaseAssembly

```js
assemblies: types.array(assemblyConfigSchema)
```

#### slot: tracks

track configuration is an array of track config schemas. multiple instances of a
track can exist that use the same configuration

```js
tracks: types.array(pluginManager.pluggableConfigSchemaType('track'))
```

#### slot: internetAccounts

configuration for internet accounts, see InternetAccounts

```js
internetAccounts: types.array(
  pluginManager.pluggableConfigSchemaType('internet account'),
)
```

#### slot: aggregateTextSearchAdapters

configuration for aggregate text search adapters (created by e.g. jbrowse
text-index, but can be a pluggable TextSearchAdapter type)

```js
aggregateTextSearchAdapters: types.array(
  pluginManager.pluggableConfigSchemaType('text search adapter'),
)
```

#### slot: connections

configuration for connections

```js
connections: types.array(pluginManager.pluggableConfigSchemaType('connection'))
```

#### slot: defaultSession

```js
defaultSession: types.optional(types.frozen(), {
  name: 'New Session',
})
```
