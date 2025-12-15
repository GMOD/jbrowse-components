---
id: appcorejbrowsemodel
title: AppCoreJBrowseModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/app-core/src/JBrowseModel/index.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/AppCoreJBrowseModel.md)

## Docs

note that JBrowseRootConfig is a config model, but config models are MST trees
themselves, which is why this stateModel is allowed to extend it

the AppCoreJBrowseModel is generally on a property named rootModel.jbrowse

extends

- [JBrowseRootConfig](/docs/config/jbrowserootconfig)

### AppCoreJBrowseModel - Getters

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

### AppCoreJBrowseModel - Actions

#### action: addAssemblyConf

```js
// type signature
addAssemblyConf: (conf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => { ...; } & ... 2 more ... & IStateTreeNode<...>
```

#### action: removeAssemblyConf

```js
// type signature
removeAssemblyConf: (assemblyName: string) => void
```

#### action: addTrackConf

```js
// type signature
addTrackConf: (trackConf: { trackId: string; type: string; }) => { [key: string]: unknown; trackId: string; }
```

#### action: addConnectionConf

```js
// type signature
addConnectionConf: (connectionConf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => any
```

#### action: deleteConnectionConf

```js
// type signature
deleteConnectionConf: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => boolean
```

#### action: deleteTrackConf

```js
// type signature
deleteTrackConf: (trackConf: ({ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) | { ...; }) => void
```

#### action: updateTrackConf

Updates an existing track configuration. Used to sync editable configs back to
the frozen tracks array.

```js
// type signature
updateTrackConf: (trackConf: { [key: string]: unknown; trackId: string; }) => void
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

#### action: setDefaultSessionConf

```js
// type signature
setDefaultSessionConf: (sessionConf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => void
```

#### action: addInternetAccountConf

```js
// type signature
addInternetAccountConf: (internetAccountConf: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => any
```

#### action: deleteInternetAccountConf

```js
// type signature
deleteInternetAccountConf: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>) => boolean
```
