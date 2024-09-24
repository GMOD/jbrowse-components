---
id: baserootmodel
title: BaseRootModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/product-core/src/RootModel/BaseRootModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/BaseRootModel.ts)

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
sessionPath: types.optional(types.string, '')
```

#### property: assemblyManager

```js
// type signature
IOptionalIType<IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; volatileRegions: BasicRegion[] | undefined; refNameAliases: RefNameAliases | undefined; lowerCaseRefNameAliases: RefNameAliases | undefined; cytob...
// code
assemblyManager: types.optional(
        assemblyManagerFactory(assemblyConfigSchema, pluginManager),
        {},
      )
```

### BaseRootModel - Actions

#### action: setError

```js
// type signature
setError: (error: unknown) => void
```

#### action: setSession

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
