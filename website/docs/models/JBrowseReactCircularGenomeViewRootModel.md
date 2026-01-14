---
id: jbrowsereactcirculargenomeviewrootmodel
title: JBrowseReactCircularGenomeViewRootModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
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
IModelType<{ configuration: any; assembly: AnyConfigurationSchemaType; tracks: IArrayType<any>; internetAccounts: IArrayType<any>; connections: IArrayType<any>; aggregateTextSearchAdapters: IArrayType<...>; plugins: IType<...>; }, { ...; }, _NotCustomized, _NotCustomized>
// code
config: createConfigModel(pluginManager, assemblyConfigSchema)
```

#### property: session

```js
// type signature
IModelType<{ id: any; name: ISimpleType<string>; margin: IType<number, number, number>; } & { drawerPosition: IOptionalIType<ISimpleType<string>, [undefined]>; drawerWidth: IOptionalIType<...>; widgets: IMapType<...>; activeWidgets: IMapType<...>; minimized: IOptionalIType<...>; } & { ...; } & ModelProperties & { .....
// code
session: Session
```

#### property: assemblyManager

```js
// type signature
IOptionalIType<any, [undefined]>
// code
assemblyManager: types.optional(assemblyManagerType, {})
```

#### property: internetAccounts

```js
// type signature
IArrayType<any>
// code
internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      )
```

### JBrowseReactCircularGenomeViewRootModel - Getters

#### getter: jbrowse

```js
// type
{ configuration: any; assembly: AnyConfigurationSchemaType; tracks: IMSTArray<any> & IStateTreeNode<IArrayType<any>>; internetAccounts: IMSTArray<any> & IStateTreeNode<...>; connections: IMSTArray<...> & IStateTreeNode<...>; aggregateTextSearchAdapters: IMSTArray<...> & IStateTreeNode<...>; plugins: any; } & NonEmpt...
```

#### getter: pluginManager

```js
// type
any
```

### JBrowseReactCircularGenomeViewRootModel - Actions

#### action: setSession

```js
// type signature
setSession: (sessionSnapshot: unknown) => void
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
