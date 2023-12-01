---
id: linearcomparativeview
title: LinearComparativeView
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/linear-comparative-view/src/LinearComparativeView/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearComparativeView/model.ts)

extends

- [BaseViewModel](../baseviewmodel)

### LinearComparativeView - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```js
// type signature
ISimpleType<"LinearComparativeView">
// code
type: types.literal('LinearComparativeView')
```

#### property: trackSelectorType

```js
// type signature
string
// code
trackSelectorType: 'hierarchical'
```

#### property: showIntraviewLinks

```js
// type signature
true
// code
showIntraviewLinks: true
```

#### property: linkViews

```js
// type signature
false
// code
linkViews: false
```

#### property: interactToggled

```js
// type signature
false
// code
interactToggled: false
```

#### property: middleComparativeHeight

```js
// type signature
number
// code
middleComparativeHeight: 100
```

#### property: tracks

```js
// type signature
IArrayType<IAnyType>
// code
tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        )
```

#### property: views

currently this is limited to an array of two

```js
// type signature
IArrayType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean, boolean, boolean>; } & { ...; }, { ...; } & ... 15 more ... & { ...; }, _NotCustomized, _NotCustomized>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        )
```

#### property: viewTrackConfigs

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

#### getter: highResolutionScaling

```js
// type
number
```

#### getter: initialized

```js
// type
boolean
```

#### getter: refNames

```js
// type
any[][]
```

#### getter: assemblyNames

```js
// type
any[]
```

### LinearComparativeView - Methods

#### method: headerMenuItems

includes a subset of view menu options because the full list is a little
overwhelming. overridden by subclasses

```js
// type signature
headerMenuItems: () => MenuItem[]
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

#### action: setViews

```js
// type signature
setViews: (views: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IType<boolean, boolean, boolean>; } & { ...; }>>[]) => void
```

#### action: removeView

```js
// type signature
removeView: (view: { id: string; displayName: string; minimized: boolean; type: string; offsetPx: number; bpPerPx: number; displayedRegions: IMSTArray<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<...>; reversed: IOptionalIType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomize...
```

#### action: closeView

removes the view itself from the state tree entirely by calling the parent
removeView

```js
// type signature
closeView: () => void
```

#### action: setMiddleComparativeHeight

```js
// type signature
setMiddleComparativeHeight: (n: number) => number
```

#### action: toggleLinkViews

```js
// type signature
toggleLinkViews: () => void
```

#### action: activateTrackSelector

```js
// type signature
activateTrackSelector: () => Widget
```

#### action: toggleTrack

```js
// type signature
toggleTrack: (trackId: string) => boolean
```

#### action: showTrack

```js
// type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string) => number
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
