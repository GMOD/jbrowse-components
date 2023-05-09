---
id: jbrowsereactcirculargenomeviewconfig
title: JBrowseReactCircularGenomeViewConfig
toplevel: true
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

## Source file

[products/jbrowse-react-circular-genome-view/src/createModel/createConfigModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/src/createModel/createConfigModel.ts)

## Docs

### JBrowseReactCircularGenomeViewConfig - Slots

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

#### slot: configuration.formatAbout.config

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

#### slot: configuration.theme

```js
theme: { type: 'frozen', defaultValue: {} }
```

#### slot: assembly

```js
assembly: assemblyConfigSchemasType
```

#### slot: tracks

```js
tracks: types.array(pluginManager.pluggableConfigSchemaType('track'))
```

#### slot: internetAccounts

```js
internetAccounts: types.array(
  pluginManager.pluggableConfigSchemaType('internet account'),
)
```

#### slot: connections

```js
connections: types.array(pluginManager.pluggableConfigSchemaType('connection'))
```

#### slot: aggregateTextSearchAdapters

```js
aggregateTextSearchAdapters: types.array(
  pluginManager.pluggableConfigSchemaType('text search adapter'),
)
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
plugins: types.frozen()
```
