---
id: jbrowsereactlineargenomeviewsessionmodel
title: JBrowseReactLinearGenomeViewSessionModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/src/createModel/createSessionModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseReactLinearGenomeViewSessionModel.md)

## Docs

composed of

- [BaseSessionModel](../basesessionmodel)
- [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)
- [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin)
- [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)
- [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin)
- [SnackbarModel](../snackbarmodel)

### JBrowseReactLinearGenomeViewSessionModel - Properties

#### property: view

```js
// type signature
IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; } & { ...; }, { ...; } & ... 16 more ... & { ...; }, ModelCreationType<...>, ModelSnapshotType<...>>
// code
view: pluginManager.getViewType('LinearGenomeView')!
        .stateModel as LinearGenomeViewStateModel
```

### JBrowseReactLinearGenomeViewSessionModel - Getters

#### getter: version

```js
// type
any
```

#### getter: disableAddTracks

```js
// type
any
```

#### getter: assemblies

```js
// type
any[]
```

#### getter: assemblyNames

```js
// type
any[]
```

#### getter: connections

```js
// type
any
```

#### getter: assemblyManager

```js
// type
any
```

#### getter: views

```js
// type
({ id: string; displayName: string | undefined; minimized: boolean; type: string; offsetPx: number; bpPerPx: number; displayedRegions: Region[] & IStateTreeNode<IOptionalIType<IType<Region[], Region[], Region[]>, [...]>>; ... 16 more ...; init: (InitState & IStateTreeNode<...>) | undefined; } & ... 19 more ... & ISt...
```

### JBrowseReactLinearGenomeViewSessionModel - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  theme: any
  highResolutionScaling: any
}
```

### JBrowseReactLinearGenomeViewSessionModel - Actions

#### action: addView

```js
// type signature
addView: (typeName: string, initialState?: {}) => { id: string; displayName: string | undefined; minimized: boolean; type: string; offsetPx: number; bpPerPx: number; displayedRegions: Region[] & IStateTreeNode<...>; ... 16 more ...; init: (InitState & IStateTreeNode<...>) | undefined; } & ... 19 more ... & IStateTreeNode<...>
```
