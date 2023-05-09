---
id: jbrowsewebmodel
title: JBrowseWebModel
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[products/jbrowse-web/src/jbrowseModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-web/src/jbrowseModel.ts)

## Docs

the rootModel.jbrowse state model for JBrowse Web

### JBrowseWebModel - Getters

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: rpcManager

```js
// type
RpcManager
```

### JBrowseWebModel - Actions

#### action: addAssemblyConf

```js
// type signature
addAssemblyConf: (assemblyConf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => { ...; } & ... 2 more ... & IStateTreeNode<...>
```

#### action: removeAssemblyConf

```js
// type signature
removeAssemblyConf: (assemblyName: string) => void
```

#### action: addTrackConf

```js
// type signature
addTrackConf: (
  trackConf: { [x: string]: any } & NonEmptyObject & {
      setSubschema(slotName: string, data: unknown): any,
    } & IStateTreeNode<AnyConfigurationSchemaType>,
) => any
```

#### action: addDisplayConf

```js
// type signature
addDisplayConf: (
  trackId: string,
  displayConf: { [x: string]: any } & NonEmptyObject & {
      setSubschema(slotName: string, data: unknown): any,
    } & IStateTreeNode<AnyConfigurationSchemaType>,
) => any
```

#### action: addConnectionConf

```js
// type signature
addConnectionConf: (
  connectionConf: { [x: string]: any } & NonEmptyObject & {
      setSubschema(slotName: string, data: unknown): any,
    } & IStateTreeNode<AnyConfigurationSchemaType>,
) => any
```

#### action: deleteConnectionConf

```js
// type signature
deleteConnectionConf: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => any[]
```

#### action: deleteTrackConf

```js
// type signature
deleteTrackConf: (trackConf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => any[]
```

#### action: setDefaultSessionConf

```js
// type signature
setDefaultSessionConf: (sessionConf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

#### action: addPlugin

```js
// type signature
addPlugin: (pluginDefinition: PluginDefinition) => void
```

#### action: removePlugin

```js
// type signature
removePlugin: (pluginDefinition: PluginDefinition) => void
```

#### action: addInternetAccountConf

```js
// type signature
addInternetAccountConf: (
  config: { [x: string]: any } & NonEmptyObject & {
      setSubschema(slotName: string, data: unknown): any,
    } & IStateTreeNode<AnyConfigurationSchemaType>,
) => any
```

#### action: deleteInternetAccountConf

```js
// type signature
deleteInternetAccountConf: (config: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => any[]
```
