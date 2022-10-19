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

#### getter: staticBlocks

static blocks are an important concept jbrowse uses to avoid
re-rendering when you scroll to the side. when you horizontally
scroll to the right, old blocks to the left may be removed, and
new blocks may be instantiated on the right. tracks may use the
static blocks to render their data for the region represented by
the block

```js
// Type
BlockSet
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

#### property: bpPerPx

bpPerPx corresponds roughly to the zoom level, base-pairs per pixel

```js
v.bpPerPx
```

#### method: pxToBp

```js
// Type signature
pxToBp: (px: number) => {
  coord: number
  index: number
  refName: string
  oob: boolean
  assemblyName: string
  offset: number
  start: number
  end: number
  reversed: boolean
}
```

#### getter: width

```js
// Type
any
```

#### action: setNewView

```js
// Type signature
setNewView: (bpPerPx: number, offsetPx: number) => void
```

#### property: offsetPx

bpPerPx corresponds roughly to the horizontal scroll of the LGV

```js
view.offsetPx
```

#### method: centerAt

scrolls the view to center on the given bp. if that is not in any
of the displayed regions, does nothing

```js
// Type signature
centerAt: (coord: number, refName: string, regionNumber: number) => void
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

#### action: moveTo

offset is the base-pair-offset in the displayed region, index is the index of the
displayed region in the linear genome view

```js
// Type signature
moveTo: (start?: BpOffset, end?: BpOffset) => void
```
