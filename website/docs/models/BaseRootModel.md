---
id: baserootmodel
title: BaseRootModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/BaseRootModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/BaseRootModel.md)

## Overview

factory function for the Base-level root model shared by all products

### BaseRootModel - Properties

#### property: jbrowse

`jbrowse` is a mapping of the config.json into the in-memory state tree

```js
// type signature
IAnyType
// code
jbrowse: jbrowseModelType
```

#### property: session

`session` encompasses the currently active state of the app, including views
open, tracks open in those views, etc.

```js
// type signature
IMaybe<IAnyType>
// code
session: types.maybe(sessionModelType)
```

#### property: sessionPath

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
sessionPath: types.stripDefault(types.string, '')
```

#### property: assemblyManager

```js
// type signature
IOptionalIType<IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; adapterLoads: QuickLRU<...>; ... 5 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 11 more ... & { ...; }, _NotCustomized, _NotC...
// code
assemblyManager: types.optional(
        assemblyManagerFactory(assemblyConfigSchema, pluginManager),
        {},
      )
```

### BaseRootModel - Volatiles

#### volatile: rpcManager

```js
// type signature
RpcManager
// code
rpcManager: new RpcManager(pluginManager, self.jbrowse.configuration.rpc)
```

#### volatile: adminMode

```js
// type signature
false
// code
adminMode: false
```

#### volatile: error

```js
// type signature
unknown
// code
error: undefined as unknown
```

#### volatile: textSearchManager

```js
// type signature
TextSearchManager
// code
textSearchManager: new TextSearchManager(pluginManager)
```

#### volatile: pluginManager

```js
// type signature
PluginManager
// code
pluginManager
```

### BaseRootModel - Actions

#### action: setError

```js
// type signature
setError: (error: unknown) => void
```

#### action: setSession

Sets the active session. Remaps any legacy display type names (e.g.
LinearPileupDisplay → LinearAlignmentsDisplay), then walks the resulting MST
tree to drop undefined references in arrays/maps so shared sessions still load
when referencing tracks/widgets that no longer exist. If filtering throws, the
previous session is restored.

```js
// type signature
setSession: (sessionSnapshot?: any) => void
```

#### action: setDefaultSession

```js
// type signature
setDefaultSession: () => void
```

#### action: setSessionPath

```js
// type signature
setSessionPath: (path: string) => void
```

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (newName: string) => void
```
