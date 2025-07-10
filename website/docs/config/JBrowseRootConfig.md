---
id: jbrowserootconfig
title: JBrowseRootConfig
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/JBrowseConfig/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/JBrowseRootConfig.md)

## Docs

this is a config model representing a config.json (for jbrowse-web) or
somefile.jbrowse (for jbrowse-desktop, where configs have the .jbrowse
extension)

also includes any pluginManager.pluginConfigurationSchemas(), so plugins that
have a configurationSchema field on their class are mixed into this object

### JBrowseRootConfig - Slots

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

#### slot: preConfiguredSessions

```js
preConfiguredSessions: types.array(types.frozen())
```
