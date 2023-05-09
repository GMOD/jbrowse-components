---
id: jbrowsewebconfiguration
title: JBrowseWebConfiguration
toplevel: true
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

## Source file

[products/jbrowse-web/src/jbrowseConfig.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/jbrowseConfig.ts)

## Docs

configuration in a config.json

### JBrowseWebConfiguration - Slots

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

#### slot: configuration.shareURL

```js
shareURL: {
        type: 'string',
        defaultValue: 'https:
      }
```

#### slot: configuration.formatDetails.feature

```js
feature: {
          type: 'frozen',
          description: 'adds extra fields to the feature details',
          defaultValue: {},
          contextVariable: ['feature'],
        }
```

#### slot: configuration.formatDetails.subfeatures

```js
subfeatures: {
          type: 'frozen',
          description: 'adds extra fields to the subfeatures of a feature',
          defaultValue: {},
          contextVariable: ['feature'],
        }
```

#### slot: configuration.formatDetails.depth

```js
depth: {
          type: 'number',
          defaultValue: 2,
          description: 'depth to iterate on subfeatures',
        }
```

#### slot: configuration.formatAbout.conf

```js
config: {
          type: 'frozen',
          description: 'formats configuration object in about dialog',
          defaultValue: {},
          contextVariable: ['config'],
        }
```

#### slot: configuration.formatAbout.hideUris

```js
hideUris: {
          type: 'boolean',
          defaultValue: false,
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

```js
assemblies: types.array(assemblyConfigSchemasType)
```

#### slot: internetAccounts

```js
internetAccounts: types.array(
  pluginManager.pluggableConfigSchemaType('internet account'),
)
```

#### slot: aggregateTextSearchAdapters

```js
aggregateTextSearchAdapters: types.array(
  pluginManager.pluggableConfigSchemaType('text search adapter'),
)
```

#### slot: connections

```js
connections: types.array(pluginManager.pluggableConfigSchemaType('connection'))
```

#### slot: defaultSession

```js
defaultSession: types.optional(types.frozen(), {
  name: `New session`,
})
```
