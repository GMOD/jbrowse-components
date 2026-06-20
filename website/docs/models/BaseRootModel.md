---
id: baserootmodel
title: BaseRootModel
sidebar_label: Root -> BaseRootModel
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

<details open>
<summary>BaseRootModel - Properties</summary>

#### property: jbrowse

`jbrowse` is a mapping of the config.json into the in-memory state tree

```ts
// type signature
type jbrowse = IAnyType
// code
jbrowse: jbrowseModelType
```

#### property: session

`session` encompasses the currently active state of the app, including views
open, tracks open in those views, etc.

```ts
// type signature
type session = IMaybe<IAnyType>
// code
session: types.maybe(sessionModelType)
```

#### property: sessionPath

```ts
// type signature
type sessionPath = IOptionalIType<ISimpleType<string>, [undefined]>
// code
sessionPath: types.stripDefault(types.string, '')
```

#### property: assemblyManager

```ts
// type signature
type assemblyManager = IOptionalIType<IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; adapterLoads: QuickLRU<...>; ... 6 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 11 more ... & { ...; }, _NotCustomized, _NotC...
// code
assemblyManager: types.optional(
        assemblyManagerFactory(assemblyConfigSchema, pluginManager),
        {},
      )
```

</details>

<details open>
<summary>BaseRootModel - Volatiles</summary>

#### volatile: rpcManager

```ts
// type signature
type rpcManager = RpcManager
// code
rpcManager: new RpcManager(pluginManager, self.jbrowse.configuration.rpc)
```

#### volatile: adminMode

```ts
// type signature
type adminMode = false
// code
adminMode: false
```

#### volatile: error

```ts
// type signature
type error = unknown
// code
error: undefined as unknown
```

#### volatile: textSearchManager

```ts
// type signature
type textSearchManager = TextSearchManager
// code
textSearchManager: new TextSearchManager(pluginManager)
```

#### volatile: pluginManager

```ts
// type signature
type pluginManager = PluginManager
// code
pluginManager
```

</details>

<details open>
<summary>BaseRootModel - Actions</summary>

#### action: setError

```ts
type setError = (error: unknown) => void
```

#### action: setSession

Sets the active session. Remaps any legacy display type names (e.g.
LinearPileupDisplay → LinearAlignmentsDisplay), then walks the resulting MST
tree to drop undefined references in arrays/maps so shared sessions still load
when referencing tracks/widgets that no longer exist. If filtering throws, the
previous session is restored.

```ts
type setSession = (sessionSnapshot?: any) => void
```

#### action: setDefaultSession

```ts
type setDefaultSession = () => void
```

#### action: setSessionPath

```ts
type setSessionPath = (path: string) => void
```

#### action: renameCurrentSession

```ts
type renameCurrentSession = (newName: string) => void
```

</details>
