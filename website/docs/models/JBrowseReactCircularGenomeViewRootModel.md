---
id: jbrowsereactcirculargenomeviewrootmodel
title: JBrowseReactCircularGenomeViewRootModel
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[products/jbrowse-react-circular-genome-view/src/createModel/createModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/src/createModel/createModel.ts)

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
IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; name: ISimpleType<string>; margin: IType<number, number, number>; } & { ...; } & { ...; } & { ...; }, { ...; } & ... 18 more ... & { ...; }, _NotCustomized, _NotCustomized>
// code
session: Session
```

#### property: assemblyManager

```js
// type signature
IModelType<{ assemblies: IArrayType<IModelType<{ configuration: IMaybe<IReferenceType<IAnyType>>; }, { error: unknown; loaded: boolean; loadingP: Promise<void>; volatileRegions: BasicRegion[]; refNameAliases: RefNameAliases; lowerCaseRefNameAliases: RefNameAliases; cytobands: Feature[]; } & ... 4 more ... & { ...; }...
// code
assemblyManager: assemblyManagerType
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
{ configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<ConfigurationSchemaType<{ rpc: ConfigurationSchemaType<{ defaultDriver: { type: string; description: string; defaultValue: string; }; drivers: IOptionalIType<...>; }, ConfigurationSchema...
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
setError: (errorMessage: Error) => void
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
