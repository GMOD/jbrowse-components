---
id: jbrowsereactcirculargenomeviewrootmodel
title: JBrowseReactCircularGenomeViewRootModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/src/createModel/createModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseReactCircularGenomeViewRootModel.md)

## Docs

### JBrowseReactCircularGenomeViewRootModel - Properties

#### property: config

```js
// type signature
IModelType<{ configuration: ConfigurationSchemaType<{ rpc: ConfigurationSchemaType<{ defaultDriver: { type: string; description: string; defaultValue: string; }; drivers: IOptionalIType<IMapType<ITypeUnion<ModelCreationType<ExtractCFromProps<Record<string, any>>>, ModelSnapshotType<...>, {} & ... 1 more ... & NonEmp...
// code
config: createConfigModel(pluginManager, assemblyConfigSchema)
```

#### property: session

```js
// type signature
IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; } & { ...; } & { ...; } & { ...; }, { ...; } & ... 21 more ... & { ...; }, _NotCustomized, _NotCustomized>
// code
session: Session
```

#### property: assemblyManager

```js
// type signature
IOptionalIType<IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loadingP: Promise<void>; volatileRegions: BasicRegion[]; refNameAliases: RefNameAliases; cytobands: Feature[]; } & ... 5 more ... & { ...; }, _NotCustomized, _NotCustomized>>; }, { .....
// code
assemblyManager: types.optional(assemblyManagerType, {})
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

### JBrowseReactCircularGenomeViewRootModel - Getters

#### getter: jbrowse

```js
// type
{ configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ ...; } & NonEmptyObject & { ...; } & IStateTreeNode<...>); } & IStateTreeNode<...>; ... 5 more ...; plugins: any; } & NonEmptyObject & { ...; } & IStateTreeNode<...>
```

#### getter: pluginManager

```js
// type
PluginManager
```

### JBrowseReactCircularGenomeViewRootModel - Actions

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; } & { ...; } & { ...; } & { ...; }>>) => void
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
