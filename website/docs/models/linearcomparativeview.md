---
id: linearcomparativeview
title: LinearComparativeView
toplevel: true
---

#### property: id

```js
id: ElementId
```

#### property: type

```js
type: types.literal('LinearComparativeView')
```

#### property: height

```js
height: defaultHeight
```

#### property: trackSelectorType

```js
trackSelectorType: 'hierarchical'
```

#### property: showIntraviewLinks

```js
showIntraviewLinks: true
```

#### property: linkViews

```js
linkViews: false
```

#### property: interactToggled

```js
interactToggled: false
```

#### property: middleComparativeHeight

```js
middleComparativeHeight: 100
```

#### property: tracks

```js
tracks: types.array(pluginManager.pluggableMstType('track', 'stateModel'))
```

#### property: views

currently this is limited to an array of two

```js
views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        )
```

#### property: viewTrackConfigs

this represents tracks specific to this view specifically used
for read vs ref dotplots where this track would not really apply
elsewhere

```js
viewTrackConfigs: types.array(pluginManager.pluggableConfigSchemaType('track'))
```

#### getter: highResolutionScaling

```js
// Type
number
```

#### getter: initialized

```js
// Type
boolean
```

#### getter: refNames

```js
// Type
any[][]
```

#### getter: assemblyNames

```js
// Type
any[]
```

#### action: setWidth

```js
// Type signature
setWidth: (newWidth: number) => void
```

#### action: setHeight

```js
// Type signature
setHeight: (newHeight: number) => void
```

#### action: setViews

```js
// Type signature
setViews: (views: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; } & { id: IOptionalIType<ISimpleType<string>, [...]>; ... 12 more ...; showGridlines: IType<...>; }>>[]) => void
```

#### action: removeView

```js
// Type signature
removeView: (view: { id: string; displayName: string; type: "LinearGenomeView"; offsetPx: number; bpPerPx: number; displayedRegions: IMSTArray<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<...>; reversed: IOptionalIType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>> & IS...
```

#### action: closeView

removes the view itself from the state tree entirely by calling the parent removeView

```js
// Type signature
closeView: () => void
```

#### action: setMiddleComparativeHeight

```js
// Type signature
setMiddleComparativeHeight: (n: number) => number
```

#### action: toggleLinkViews

```js
// Type signature
toggleLinkViews: () => void
```

#### action: activateTrackSelector

```js
// Type signature
activateTrackSelector: () => Widget
```

#### action: toggleTrack

```js
// Type signature
toggleTrack: (trackId: string) => void
```

#### action: showTrack

```js
// Type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
```

#### action: hideTrack

```js
// Type signature
hideTrack: (trackId: string) => number
```

#### action: squareView

```js
// Type signature
squareView: () => void
```

#### action: clearView

```js
// Type signature
clearView: () => void
```

#### method: menuItems

```js
// Type signature
menuItems: () => MenuItem[]
```

#### method: rubberBandMenuItems

```js
// Type signature
rubberBandMenuItems: () => { label: string; onClick: () => void; }[]
```
