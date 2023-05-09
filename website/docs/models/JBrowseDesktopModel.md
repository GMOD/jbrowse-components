---
id: jbrowsedesktopmodel
title: JBrowseDesktopModel
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[products/jbrowse-desktop/src/jbrowseModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-desktop/src/jbrowseModel.ts)

## Docs

the rootModel.jbrowse state model for JBrowse Desktop

### JBrowseDesktopModel - Getters

#### getter: savedSessionNames

```js
// type
string[]
```

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

### JBrowseDesktopModel - Actions

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
  internetAccountConf: { [x: string]: any } & NonEmptyObject & {
      setSubschema(slotName: string, data: unknown): any,
    } & IStateTreeNode<AnyConfigurationSchemaType>,
) => any
```

#### action: deleteInternetAccountConf

```js
// type signature
deleteInternetAccountConf: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => any[]
```
