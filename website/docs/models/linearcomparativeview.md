---
id: linearcomparativeview
title: LinearComparativeView
toplevel: true
---



#### property: id


```js

        /**
         * !property
         */
        id: ElementId
```
#### property: type


```js

        /**
         * !property
         */
        type: types.literal('LinearComparativeView')
```
#### property: height


```js

        /**
         * !property
         */
        height: defaultHeight
```
#### property: trackSelectorType


```js

        /**
         * !property
         */
        trackSelectorType: 'hierarchical'
```
#### property: showIntraviewLinks


```js

        /**
         * !property
         */
        showIntraviewLinks: true
```
#### property: linkViews


```js

        /**
         * !property
         */
        linkViews: false
```
#### property: interactToggled


```js

        /**
         * !property
         */
        interactToggled: false
```
#### property: middleComparativeHeight


```js

        /**
         * !property
         */
        middleComparativeHeight: 100
```
#### property: tracks


```js

        /**
         * !property
         */
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        )
```
#### property: views


```js

        /**
         * !property
         * currently this is limited to an array of two
         */
        views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        )
```
#### property: viewTrackConfigs


```js


        /**
         * !property
         * this represents tracks specific to this view specifically used
         * for read vs ref dotplots where this track would not really apply
         * elsewhere
         */
        viewTrackConfigs: types.array(
          pluginManager.pluggableConfigSchemaType('track'),
        )
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
#### property: views


```js
 self.views
```
#### getter: refNames



```js
// Type
any[][]
```
#### property: views


```js
 self.views
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
#### property: views


```js
self.views
```
#### getter: assemblyNames



```js
// Type
any[]
```
#### property: linkViews


```js
self.linkViews
```
#### getter: assemblyNames



```js
// Type
any[]
```
#### property: views


```js

        self.views
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
#### property: height


```js

        self.height
```
#### action: setViews



```js
// Type signature
setViews: (views: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; } & { id: IOptionalIType<ISimpleType<string>, [...]>; ... 12 more ...; showGridlines: IType<...>; }>>[]) => void
```
#### property: views


```js

        self.views
```
#### action: removeView



```js
// Type signature
removeView: (view: { id: string; displayName: string; type: "LinearGenomeView"; offsetPx: number; bpPerPx: number; displayedRegions: IMSTArray<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<...>; reversed: IOptionalIType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>> & IS...
```
#### property: views


```js

        self.views
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
#### property: middleComparativeHeight


```js

        self.middleComparativeHeight
```
#### property: middleComparativeHeight


```js
 self.middleComparativeHeight
```
#### action: toggleLinkViews



```js
// Type signature
toggleLinkViews: () => void
```
#### property: linkViews


```js

        self.linkViews
```
#### property: linkViews


```js
self.linkViews
```
#### action: activateTrackSelector



```js
// Type signature
activateTrackSelector: () => Widget
```
#### property: trackSelectorType


```js
self.trackSelectorType
```
#### property: trackSelectorType


```js
self.trackSelectorType
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
#### property: type


```js
self.type
```
#### property: type


```js
self.type
```
#### property: tracks


```js

        self.tracks
```
#### action: hideTrack



```js
// Type signature
hideTrack: (trackId: string) => number
```
#### property: tracks


```js
 self.tracks
```
#### property: tracks


```js
 self.tracks
```
#### action: squareView



```js
// Type signature
squareView: () => void
```
#### property: views


```js
 self.views
```
#### property: bpPerPx


```js
 v.bpPerPx
```
#### property: views


```js

        self.views
```
#### method: pxToBp

```js
// Type signature
pxToBp: (px: number) => { coord: number; index: number; refName: string; oob: boolean; assemblyName: string; offset: number; start: number; end: number; reversed: boolean; }
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
#### property: views


```js

        self.views
```
#### method: menuItems

```js
// Type signature
menuItems: () => MenuItem[]
```
#### property: views


```js

        self.views
```
#### method: menuItems
return the view menu items
```js
// Type signature
menuItems: any
```
#### method: menuItems
return the view menu items
```js
// Type signature
menuItems: any
```
#### action: activateTrackSelector



```js
// Type signature
activateTrackSelector: () => Widget
```
#### method: rubberBandMenuItems

```js
// Type signature
rubberBandMenuItems: () => { label: string; onClick: () => void; }[]
```
#### property: views


```js

              self.views
```
#### action: moveTo


offset is the base-pair-offset in the displayed region, index is the index of the
displayed region in the linear genome view
```js
// Type signature
moveTo: (start?: BpOffset, end?: BpOffset) => void
```
#### getter: initialized



```js
// Type
boolean
```
#### property: views


```js

              self.views
```
#### action: setWidth



```js
// Type signature
setWidth: any
```
