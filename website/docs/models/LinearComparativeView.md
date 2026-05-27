---
id: linearcomparativeview
title: LinearComparativeView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearComparativeView/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearComparativeView.md)

## Docs

extends

- [BaseViewModel](../baseviewmodel)

### LinearComparativeView - Properties

#### propertie: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### propertie: type

```js
// type signature
ISimpleType<"LinearComparativeView">
// code
type: types.literal('LinearComparativeView')
```

#### propertie: trackSelectorType

```js
// type signature
string
// code
trackSelectorType: 'hierarchical'
```

#### propertie: showIntraviewLinks

```js
// type signature
true
// code
showIntraviewLinks: true
```

#### propertie: linkViews

```js
// type signature
false
// code
linkViews: false
```

#### propertie: interactiveOverlay

```js
// type signature
false
// code
interactiveOverlay: false
```

#### propertie: scrollZoom

```js
// type signature
false
// code
scrollZoom: false
```

#### propertie: showDynamicControls

```js
// type signature
true
// code
showDynamicControls: true
```

#### propertie: levels

```js
// type signature
IArrayType<IAnyModelType>
// code
levels: types.array(LinearSyntenyViewHelper!)
```

#### propertie: views

currently this is limited to an array of two

```js
// type signature
IArrayType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; } & { ...; }, { ...; } & ... 16 more ... & { ...; }, ModelCreationType<...>, ModelSnapshotType<...>>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')!
            .stateModel as LinearGenomeViewStateModel,
        )
```

#### propertie: viewTrackConfigs

this represents tracks specific to this view specifically used for read vs ref
dotplots where this track would not really apply elsewhere

```js
// type signature
IArrayType<IAnyModelType>
// code
viewTrackConfigs: types.array(
          pluginManager.pluggableConfigSchemaType('track'),
        )
```

### LinearComparativeView - Getters

#### getter: initialized

```js
// type
boolean
```

#### getter: refNames

```js
// type
(string | undefined)[][]
```

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: loadingMessage

```js
// type
'Loading' | undefined
```

#### getter: showLoading

Whether to show a loading indicator instead of the import form or view

```js
// type
boolean
```

### LinearComparativeView - Methods

#### method: isViewCompact

```js
// type signature
isViewCompact: (idx: number) => boolean
```

#### method: headerMenuItems

includes a subset of view menu options because the full list is a little
overwhelming. overridden by subclasses

```js
// type signature
headerMenuItems: () => MenuItem[]
```

#### method: showMenuItems

items for the "Show..." submenu in the header. overridden by subclasses to add
view-specific toggle options

```js
// type signature
showMenuItems: () => MenuItem[]
```

#### method: menuItems

```js
// type signature
menuItems: () => MenuItem[]
```

#### method: rubberBandMenuItems

```js
// type signature
rubberBandMenuItems: () => { label: string; onClick: () => void; }[]
```

### LinearComparativeView - Actions

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => void
```

#### action: setIsLoading

```js
// type signature
setIsLoading: (arg: boolean) => void
```

#### action: setViews

```js
// type signature
setViews: (views: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean | undefined, boolean, boolean>; } & { ...; }>>[]) => void
```

#### action: removeView

```js
// type signature
removeView: (view: { id: string; displayName: string | undefined; minimized: boolean; type: string; offsetPx: number; bpPerPx: number; displayedRegions: Region[] & IStateTreeNode<IOptionalIType<IType<Region[], Region[], Region[]>, [...]>>; ... 16 more ...; init: (InitState & IStateTreeNode<...>) | undefined; } & ... 19 more ......
```

#### action: setLinkViews

```js
// type signature
setLinkViews: (arg: boolean) => void
```

#### action: setScrollZoom

```js
// type signature
setScrollZoom: (arg: boolean) => void
```

#### action: setShowDynamicControls

```js
// type signature
setShowDynamicControls: (arg: boolean) => void
```

#### action: activateTrackSelector

```js
// type signature
activateTrackSelector: (level: number) => Widget
```

#### action: toggleTrack

```js
// type signature
toggleTrack: (trackId: string, level?: number) => void
```

#### action: showTrack

```js
// type signature
showTrack: (trackId: string, level?: number, initialSnapshot?: {}) => void
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string, level?: number) => void
```

#### action: squareView

```js
// type signature
squareView: () => void
```

#### action: clearView

```js
// type signature
clearView: () => void
```

#### action: toggleCompactView

```js
// type signature
toggleCompactView: (idx: number) => void
```

#### action: compactAllViews

```js
// type signature
compactAllViews: () => void
```

#### action: expandAllViews

```js
// type signature
expandAllViews: () => void
```

#### action: autoScaleLevelHeights

```js
// type signature
autoScaleLevelHeights: () => void
```
