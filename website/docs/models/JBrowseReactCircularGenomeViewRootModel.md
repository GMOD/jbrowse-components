---
id: jbrowsereactcirculargenomeviewrootmodel
title: JBrowseReactCircularGenomeViewRootModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[products/jbrowse-react-circular-genome-view/src/createModel/createModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/src/createModel/createModel.ts)

### JBrowseReactCircularGenomeViewRootModel - Properties

#### property: assemblyManager

```js
// type signature
IOptionalIType<IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { cytobands: Feature[]; error: unknown; loaded: boolean; loadingP: Promise<void>; lowerCaseRefNameAliases: RefNameAliases; refNameAliases: RefNameAliases; volatileRegions: BasicRegion[]; } & ... 5 more...
// code
assemblyManager: types.optional(assemblyManagerType, {})
```

#### property: config

```js
// type signature
IModelType<{ aggregateTextSearchAdapters: IArrayType<IAnyModelType>; assembly: AnyConfigurationSchemaType; configuration: ConfigurationSchemaType<{ ...; }, ConfigurationSchemaOptions<...>>; connections: IArrayType<...>; internetAccounts: IArrayType<...>; plugins: IType<...>; tracks: IArrayType<...>; }, { ...; }, _No...
// code
config: createConfigModel(pluginManager, assemblyConfigSchema)
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

#### property: session

```js
// type signature
IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; margin: IType<number, number, number>; name: ISimpleType<string>; } & { ...; } & { ...; } & { ...; }, { ...; } & ... 20 more ... & { ...; }, _NotCustomized, _NotCustomized>
// code
session: Session
```

### JBrowseReactCircularGenomeViewRootModel - Getters

#### getter: jbrowse

```js
// type
{ aggregateTextSearchAdapters: IMSTArray<IAnyModelType> & IStateTreeNode<IArrayType<IAnyModelType>>; ... 5 more ...; tracks: IMSTArray<...> & IStateTreeNode<...>; } & NonEmptyObject & { ...; } & IStateTreeNode<...>
```

#### getter: pluginManager

```js
// type
PluginManager
```

### JBrowseReactCircularGenomeViewRootModel - Actions

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

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; margin: IType<number, number, number>; name: ISimpleType<string>; } & { ...; } & { ...; } & { ...; }>>) => void
```
