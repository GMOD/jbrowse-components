---
id: jbrowsereactlineargenomeviewsessionmodel
title: JBrowseReactLinearGenomeViewSessionModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[products/jbrowse-react-linear-genome-view/src/createModel/createSessionModel.ts](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/src/createModel/createSessionModel.ts)

composed of

- [BaseSessionModel](../basesessionmodel)
- [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)
- [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin)
- [DialogQueueSessionMixin](../dialogqueuesessionmixin)
- [TracksManagerSessionMixin](../tracksmanagersessionmixin)
- [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)
- [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin)
- [SnackbarModel](../snackbarmodel)

### JBrowseReactLinearGenomeViewSessionModel - Properties

#### property: sessionTracks

```js
// type signature
IArrayType<IAnyModelType>
// code
sessionTracks: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
      )
```

#### property: view

```js
// type signature
IModelType<{ displayName: IMaybe<ISimpleType<string>>; id: IOptionalIType<ISimpleType<string>, [undefined]>; minimized: IType<boolean, boolean, boolean>; } & { ...; }, { ...; } & ... 15 more ... & { ...; }, _NotCustomized, _NotCustomized>
// code
view: pluginManager.getViewType('LinearGenomeView')
        .stateModel as LinearGenomeViewStateModel
```

### JBrowseReactLinearGenomeViewSessionModel - Getters

#### getter: assemblies

```js
// type
any[]
```

#### getter: assemblyManager

```js
// type
any
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

#### getter: disableAddTracks

```js
// type
any
```

#### getter: version

```js
// type
any
```

#### getter: views

```js
// type
({ displayName: string; id: string; minimized: boolean; bpPerPx: number; colorByCDS: boolean; displayedRegions: IMSTArray<IModelType<{ end: ISimpleType<number>; refName: ISimpleType<string>; reversed: IOptionalIType<...>; start: ISimpleType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeN...
```

### JBrowseReactLinearGenomeViewSessionModel - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  highResolutionScaling: any
  theme: any
}
```

#### method: getTrackActionMenuItems

```js
// type signature
getTrackActionMenuItems: (config: any) => { icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; label: string; onClick: () => void; }[]
```

### JBrowseReactLinearGenomeViewSessionModel - Actions

#### action: addView

```js
// type signature
addView: (typeName: string, initialState?: {}) => { displayName: string; id: string; minimized: boolean; bpPerPx: number; colorByCDS: boolean; displayedRegions: IMSTArray<IModelType<{ end: ISimpleType<number>; refName: ISimpleType<...>; reversed: IOptionalIType<...>; start: ISimpleType<...>; } & { ...; }, { ...; }, _NotCusto...
```
