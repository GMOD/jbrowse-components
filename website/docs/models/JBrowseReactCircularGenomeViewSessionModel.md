---
id: jbrowsereactcirculargenomeviewsessionmodel
title: JBrowseReactCircularGenomeViewSessionModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/src/createModel/createSessionModel.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/JBrowseReactCircularGenomeViewSessionModel.md)

## Overview

composed of

- [BaseSessionModel](../basesessionmodel)
- [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)
- [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin)
- [TracksManagerSessionMixin](../tracksmanagersessionmixin)
- [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)
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

### Available via [TracksManagerSessionMixin](../tracksmanagersessionmixin)

**Getters:** tracks, getTracksById, tracksById

**Actions:** addTrackConf, deleteTrackConf

### Available via [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)

**Methods:** getReferring

**Actions:** removeReferring

### Available via [TrackMenuSessionMixin](../trackmenusessionmixin)

**Methods:** getTrackActionMenuItems

### JBrowseReactCircularGenomeViewSessionModel - Properties

#### property: view

```js
// type signature
IAnyModelType
// code
view: pluginManager.getViewType('CircularView').stateModel
```

### JBrowseReactCircularGenomeViewSessionModel - Getters

#### getter: version

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
any[]
```

### JBrowseReactCircularGenomeViewSessionModel - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  theme: any
  highResolutionScaling: any
}
```

### JBrowseReactCircularGenomeViewSessionModel - Actions

#### action: addView

replaces view in this case

```js
// type signature
addView: (typeName: string, initialState?: any) => any
```

#### action: removeView

does nothing

```js
// type signature
removeView: () => void
```
