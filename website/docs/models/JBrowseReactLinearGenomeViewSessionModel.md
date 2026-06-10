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

## Overview

composed of

- [BaseSessionModel](../basesessionmodel)
- [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)
- [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin)
- [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)
- [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin)
- [TrackMenuSessionMixin](../trackmenusessionmixin)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseSessionModel](../basesessionmodel)

**Properties:** id, name, margin, focusedViewId

**Volatiles:** selection, hovered, queueOfDialogs

**Getters:** root, jbrowse, rpcManager, configuration, adminMode,
textSearchManager, assemblies, DialogComponent, DialogProps

**Actions:** setSelection, clearSelection, setHovered, setName,
setFocusedViewId, removeActiveDialog, queueDialog

### Available via [SnackbarModel](../snackbarmodel)

**Volatiles:** snackbarMessages

**Getters:** snackbarMessageSet

**Actions:** notify, notifyError, pushSnackbarMessage, popSnackbarMessage,
removeSnackbarMessage

### Available via [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)

**Properties:** drawerPosition, drawerWidth, widgets, activeWidgets, minimized

**Getters:** visibleWidget

**Actions:** setDrawerPosition, updateDrawerWidth, resizeDrawer, addWidget,
showWidget, hideWidget, minimizeWidgetDrawer, showWidgetDrawer, hideAllWidgets,
editConfiguration

### Available via [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin)

**Properties:** connectionInstances

**Getters:** connections

**Actions:** makeConnection, prepareToBreakConnection, breakConnection,
deleteConnection, addConnectionConf, clearConnections

### Available via [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)

**Methods:** getReferring

**Actions:** removeReferring

### Available via [SessionTracksManagerSessionMixin](../sessiontracksmanagersessionmixin)

**Properties:** sessionTracks

**Getters:** tracks

**Actions:** addTrackConf, deleteTrackConf

### Available via [TrackMenuSessionMixin](../trackmenusessionmixin)

**Methods:** getTrackActionMenuItems

### JBrowseReactLinearGenomeViewSessionModel - Properties

#### property: view

```js
// type signature
IModelType<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; }, { ...; }>, { ...; } & ... 17 more ... & { ...; }, _NotCustomized, { ...; }>
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
(ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; }, { ...; }>> & ... 19 more ... & IStateTreeNode<...>)[]
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
addView: (typeName: string, initialState?: any) => ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<...>; }, { ...; }>> & ... 19 more ... & IStateTreeNode<...>
```
