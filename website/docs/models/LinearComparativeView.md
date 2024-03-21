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

#### property: interactToggled

```js
// type signature
false
// code
interactToggled: false
```

#### property: linkViews

```js
// type signature
false
// code
linkViews: false
```

#### property: middleComparativeHeight

```js
// type signature
number
// code
middleComparativeHeight: 100
```

#### property: showIntraviewLinks

```js
// type signature
true
// code
showIntraviewLinks: true
```

#### property: trackSelectorType

```js
// type signature
string
// code
trackSelectorType: 'hierarchical'
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

#### property: type

```js
// type signature
ISimpleType<"LinearComparativeView">
// code
type: types.literal('LinearComparativeView')
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

#### property: views

currently this is limited to an array of two

```js
// type signature
IArrayType<IModelType<{ displayName: IMaybe<ISimpleType<string>>; id: IOptionalIType<ISimpleType<string>, [undefined]>; minimized: IType<boolean, boolean, boolean>; } & { ...; }, { ...; } & ... 15 more ... & { ...; }, _NotCustomized, _NotCustomized>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        )
```

### LinearComparativeView - Getters

#### getter: assemblyNames

```js
// type
any[]
```

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

#### action: activateTrackSelector

```js
// type signature
activateTrackSelector: () => Widget
```

#### action: clearView

```js
// type signature
clearView: () => void
```

#### action: closeView

removes the view itself from the state tree entirely by calling the parent
removeView

```js
// type signature
closeView: () => void
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string) => number
```

#### action: removeView

```js
// type signature
removeView: (view: { displayName: string; id: string; minimized: boolean; bpPerPx: number; colorByCDS: boolean; displayedRegions: IMSTArray<IModelType<{ end: ISimpleType<number>; refName: ISimpleType<string>; reversed: IOptionalIType<...>; start: ISimpleType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>> & IStat...
```

#### action: setMiddleComparativeHeight

```js
// type signature
setMiddleComparativeHeight: (n: number) => number
```

#### action: setViews

```js
// type signature
setViews: (views: ModelCreationType<ExtractCFromProps<{ displayName: IMaybe<ISimpleType<string>>; id: IOptionalIType<ISimpleType<string>, [undefined]>; minimized: IType<boolean, boolean, boolean>; } & { ...; }>>[]) => void
```

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => void
```

#### action: showTrack

```js
// type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
```

#### action: squareView

```js
// type signature
squareView: () => void
```

#### action: toggleLinkViews

```js
// type signature
toggleLinkViews: () => void
```

#### action: toggleTrack

```js
// type signature
toggleTrack: (trackId: string) => boolean
```
