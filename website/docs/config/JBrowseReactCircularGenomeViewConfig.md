---
id: jbrowsereactcirculargenomeviewconfig
title: JBrowseReactCircularGenomeViewConfig
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[products/jbrowse-react-circular-genome-view/src/createModel/createConfigModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/src/createModel/createConfigModel.ts)

### JBrowseReactCircularGenomeViewConfig - Slots

#### slot: aggregateTextSearchAdapters

```js
aggregateTextSearchAdapters: types.array(
  pluginManager.pluggableConfigSchemaType('text search adapter'),
)
```

#### slot: assembly

```js
assembly: assemblyConfigSchemasType
```

#### slot: configuration.highResolutionScaling

```js
highResolutionScaling: {
          defaultValue: 2,
          type: 'number',
        }
```

#### slot: configuration.rpc

```js
rpc: RpcManager.configSchema
```

#### slot: configuration.theme

```js
theme: { defaultValue: {}, type: 'frozen' }
```

#### slot: connections

```js
connections: types.array(pluginManager.pluggableConfigSchemaType('connection'))
```

#### slot: internetAccounts

```js
internetAccounts: types.array(
  pluginManager.pluggableConfigSchemaType('internet account'),
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

#### slot: tracks

```js
tracks: types.array(pluginManager.pluggableConfigSchemaType('track'))
```
