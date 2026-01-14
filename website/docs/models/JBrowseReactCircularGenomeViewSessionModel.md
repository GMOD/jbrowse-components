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

## Docs

composed of

- [BaseSessionModel](../basesessionmodel)
- [DrawerWidgetSessionMixin](../drawerwidgetsessionmixin)
- [ConnectionManagementSessionMixin](../connectionmanagementsessionmixin)
- [DialogQueueSessionMixin](../dialogqueuesessionmixin)
- [TracksManagerSessionMixin](../tracksmanagersessionmixin)
- [ReferenceManagementSessionMixin](../referencemanagementsessionmixin)
- [SnackbarModel](../snackbarmodel)

### JBrowseReactCircularGenomeViewSessionModel - Properties

#### property: view

```js
// type signature
any
// code
view: pluginManager.getViewType('CircularView')!.stateModel
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

#### method: getTrackActionMenuItems

```js
// type signature
getTrackActionMenuItems: (config: any, extraTrackActions?: MenuItem[]) => MenuItem[]
```

### JBrowseReactCircularGenomeViewSessionModel - Actions

#### action: addView

replaces view in this case

```js
// type signature
addView: (typeName: string, initialState?: {}) => any
```

#### action: removeView

does nothing

```js
// type signature
removeView: () => void
```
