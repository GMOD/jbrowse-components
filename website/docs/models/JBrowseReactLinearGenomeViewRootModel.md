---
id: jbrowsereactlineargenomeviewrootmodel
title: JBrowseReactLinearGenomeViewRootModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/src/createModel/createModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseReactLinearGenomeViewRootModel.md)

## Docs

### JBrowseReactLinearGenomeViewRootModel - Properties

#### property: config

```js
// type signature
IModelType<{ configuration: ConfigurationSchemaType<{ rpc: ConfigurationSchemaType<{ defaultDriver: { type: string; description: string; defaultValue: string; }; drivers: IOptionalIType<IMapType<ITypeUnion<ModelCreationType<ExtractCFromProps<Record<string, any>>> | undefined, { ...; }, ModelInstanceType<...> | ... 1...
// code
config: createConfigModel(pluginManager, assemblyConfig)
```

#### property: session

```js
// type signature
IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number | undefined, number, number>; focusedViewId: IMaybe<...>; } & { ...; } & { ...; } & { ...; } & { ...; }, { ...; } & ... 21 more ... & { ...; }, _NotCustomized, { ...; } & ... 3 more ... & _NotCustomized>
// code
session: Session
```

#### property: assemblyManager

```js
// type signature
IOptionalIType<IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; volatileRegions: BasicRegion[] | undefined; ... 4 more ...; allRefNamesWithLowerCase: Set<...> | undefined; } & ... 6 more ... & { ...; }, _NotCus...
// code
assemblyManager: types.optional(AssemblyManager, {})
```

#### property: disableAddTracks

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
disableAddTracks: types.optional(types.boolean, false)
```

#### property: drawerViewHeight

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
drawerViewHeight: types.optional(types.string, '100vh')
```

#### property: internetAccounts

```js
// type signature
IArrayType<IAnyType>
// code
internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      )
```

### JBrowseReactLinearGenomeViewRootModel - Volatiles

#### volatile: error

```js
// type signature
unknown
// code
error: undefined as unknown
```

#### volatile: rpcManager

```js
// type signature
RpcManager
// code
rpcManager: new RpcManager(pluginManager, self.config.configuration.rpc, {
  WebWorkerRpcDriver: {
    makeWorkerInstance,
  },
  MainThreadRpcDriver: {},
})
```

#### volatile: textSearchManager

```js
// type signature
TextSearchManager
// code
textSearchManager: new TextSearchManager(pluginManager)
```

#### volatile: adminMode

```js
// type signature
false
// code
adminMode: false
```

#### volatile: version

```js
// type signature
string
// code
version
```

### JBrowseReactLinearGenomeViewRootModel - Getters

#### getter: jbrowse

```js
// type
ModelInstanceTypeProps<{ configuration: ConfigurationSchemaType<{ rpc: ConfigurationSchemaType<{ defaultDriver: { type: string; description: string; defaultValue: string; }; drivers: IOptionalIType<IMapType<ITypeUnion<ModelCreationType<ExtractCFromProps<Record<string, any>>> | undefined, { ...; }, ModelInstanceType<...
```

### JBrowseReactLinearGenomeViewRootModel - Actions

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number | undefined, number, number>; focusedViewId: IMaybe<...>; } & { ...; } & { ...; } & { ...; } & { ...; }>>) => void
```

#### action: renameCurrentSession

```js
// type signature
renameCurrentSession: (sessionName: string) => void
```

#### action: setError

```js
// type signature
setError: (error: unknown) => void
```

#### action: addInternetAccount

```js
// type signature
addInternetAccount: (acct: any) => void
```

#### action: findAppropriateInternetAccount

```js
// type signature
findAppropriateInternetAccount: (location: UriLocation) => any
```
