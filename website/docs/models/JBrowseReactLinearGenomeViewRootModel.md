---
id: jbrowsereactlineargenomeviewrootmodel
title: JBrowseReactLinearGenomeViewRootModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[products/jbrowse-react-linear-genome-view/src/createModel/createModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/src/createModel/createModel.ts)

### JBrowseReactLinearGenomeViewRootModel - Properties

#### property: config

```js
// type signature
IModelType<{ configuration: ConfigurationSchemaType<{ rpc: ConfigurationSchemaType<{ defaultDriver: { type: string; description: string; defaultValue: string; }; drivers: IOptionalIType<IMapType<ITypeUnion<ModelCreationType<ExtractCFromProps<Record<string, any>>>, ModelSnapshotType<...>, {} & ... 1 more ... & NonEmp...
// code
config: createConfigModel(pluginManager, assemblyConfig)
```

#### property: session

```js
// type signature
IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; } & { ...; } & { ...; } & { ...; } & { ...; }, { ...; } & ... 22 more ... & { ...; }, _NotCustomized, _NotCustomized>
// code
session: Session
```

#### property: assemblyManager

```js
// type signature
IOptionalIType<IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void> | undefined; volatileRegions: BasicRegion[] | undefined; refNameAliases: RefNameAliases | undefined; lowerCaseRefNameAliases: RefNameAliases | undefined; cytob...
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

#### property: internetAccounts

```js
// type signature
IArrayType<IAnyType>
// code
internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      )
```

### JBrowseReactLinearGenomeViewRootModel - Getters

#### getter: jbrowse

```js
// type
{ configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ ...; } & NonEmptyObject & { ...; } & IStateTreeNode<...>); } & IStateTreeNode<...>; ... 5 more ...; plugins: any; } & NonEmptyObject & { ...; } & IStateTreeNode<...>
```

### JBrowseReactLinearGenomeViewRootModel - Actions

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; } & { ...; } & { ...; } & { ...; } & { ...; }>>) => void
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
addInternetAccount: (internetAccount: any) => void
```

#### action: findAppropriateInternetAccount

```js
// type signature
findAppropriateInternetAccount: (location: UriLocation) => any
```
