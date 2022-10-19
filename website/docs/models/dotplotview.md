---
id: dotplotview
title: DotplotView
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
        type: types.literal('DotplotView')
```
#### property: height


```js

        /**
         * !property
         */
        height: 600
```
#### property: borderSize


```js

        /**
         * !property
         */
        borderSize: 20
```
#### property: tickSize


```js

        /**
         * !property
         */
        tickSize: 5
```
#### property: vtextRotation


```js

        /**
         * !property
         */
        vtextRotation: 0
```
#### property: htextRotation


```js

        /**
         * !property
         */
        htextRotation: -90
```
#### property: fontSize


```js

        /**
         * !property
         */
        fontSize: 15
```
#### property: trackSelectorType


```js

        /**
         * !property
         */
        trackSelectorType: 'hierarchical'
```
#### property: assemblyNames


```js

        /**
         * !property
         */
        assemblyNames: types.array(types.string)
```
#### property: drawCigar


```js

        /**
         * !property
         */
        drawCigar: true
```
#### property: hview


```js

        /**
         * !property
         */
        hview: types.optional(DotplotHView, {})
```
#### property: vview


```js

        /**
         * !property
         */
        vview: types.optional(DotplotVView, {})
```
#### property: cursorMode


```js

        /**
         * !property
         */
        cursorMode: 'crosshair'
```
#### property: tracks


```js


        /**
         * !property
         */
        tracks: types.array(
          pm.pluggableMstType('track', 'stateModel') as BaseTrackStateModel,
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
        viewTrackConfigs: types.array(pm.pluggableConfigSchemaType('track'))
```
#### getter: width



```js
// Type
number
```
#### getter: assemblyErrors



```js
// Type
string
```
#### property: assemblyNames


```js
 self.assemblyNames
```
#### getter: assembliesInitialized



```js
// Type
boolean
```
#### getter: initialized



```js
// Type
boolean
```
#### property: hview


```js

          self.hview
```
#### property: vview


```js

          self.vview
```
#### getter: assembliesInitialized



```js
// Type
boolean
```
#### getter: hticks



```js
// Type
any[]
```
#### getter: vticks



```js
// Type
any[]
```
#### getter: loading



```js
// Type
boolean
```
#### property: assemblyNames


```js
 self.assemblyNames
```
#### getter: viewWidth



```js
// Type
number
```
#### getter: width



```js
// Type
any
```
#### getter: viewHeight



```js
// Type
number
```
#### property: height


```js
 self.height
```
#### getter: views



```js
// Type
(({ id: string; displayedRegions: IMSTArray<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; bpPerPx: number; offsetPx: number; interRegionPaddingWidth: numbe...
```
#### property: hview


```js
self.hview
```
#### property: vview


```js
 self.vview
```
#### method: renderProps

```js
// Type signature
renderProps: () => any
```
#### property: drawCigar


```js
 self.drawCigar
```
#### action: setCursorMode



```js
// Type signature
setCursorMode: (str: string) => void
```
#### property: cursorMode


```js

        self.cursorMode
```
#### action: setDrawCigar



```js
// Type signature
setDrawCigar: (flag: boolean) => void
```
#### property: drawCigar


```js

        self.drawCigar
```
#### action: clearView


returns to the import form
```js
// Type signature
clearView: () => void
```
#### property: hview


```js

        self.hview
```
#### property: vview


```js

        self.vview
```
#### property: assemblyNames


```js

        self.assemblyNames
```
#### action: setBorderX



```js
// Type signature
setBorderX: (n: number) => void
```
#### action: setBorderY



```js
// Type signature
setBorderY: (n: number) => void
```
#### action: setWidth



```js
// Type signature
setWidth: (newWidth: number) => number
```
#### action: setHeight



```js
// Type signature
setHeight: (newHeight: number) => number
```
#### property: height


```js

        self.height
```
#### property: height


```js
 self.height
```
#### action: setError



```js
// Type signature
setError: (e: unknown) => void
```
#### action: closeView


removes the view itself from the state tree entirely by calling the parent removeView
```js
// Type signature
closeView: () => void
```
#### action: zoomOutButton



```js
// Type signature
zoomOutButton: () => void
```
#### property: hview


```js

        self.hview
```
#### property: vview


```js

        self.vview
```
#### action: zoomInButton



```js
// Type signature
zoomInButton: () => void
```
#### property: hview


```js

        self.hview
```
#### property: vview


```js

        self.vview
```
#### action: activateTrackSelector



```js
// Type signature
activateTrackSelector: () => any
```
#### property: trackSelectorType


```js
self.trackSelectorType
```
#### property: trackSelectorType


```js
self.trackSelectorType
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
#### action: toggleTrack



```js
// Type signature
toggleTrack: (trackId: string) => void
```
#### action: setAssemblyNames



```js
// Type signature
setAssemblyNames: (target: string, query: string) => void
```
#### property: assemblyNames


```js

        self.assemblyNames
```
#### action: setViews



```js
// Type signature
setViews: (arr: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IArrayType<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<...>; reversed: IOptionalIType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>; bpPerPx...
```
#### property: hview


```js

        self.hview
```
#### property: vview


```js

        self.vview
```
#### action: getCoords



```js
// Type signature
getCoords: (mousedown: Coord, mouseup: Coord) => { coord: number; index: number; refName: string; oob: boolean; assemblyName: string; offset: number; start: number; end: number; reversed: boolean; }[]
```
#### property: hview


```js

              self.hview
```
#### property: hview


```js

              self.hview
```
#### property: vview


```js

              self.vview
```
#### getter: viewHeight



```js
// Type
number
```
#### property: vview


```js

              self.vview
```
#### getter: viewHeight



```js
// Type
number
```
#### action: zoomIn


zooms into clicked and dragged region
```js
// Type signature
zoomIn: (mousedown: Coord, mouseup: Coord) => void
```
#### property: hview


```js

          self.hview
```
#### property: vview


```js

          self.vview
```
#### action: onDotplotView


creates a linear synteny view from the clicked and dragged region
```js
// Type signature
onDotplotView: (mousedown: Coord, mouseup: Coord) => void
```
#### property: hview


```js
self.hview
```
#### property: vview


```js
self.vview
```
#### property: hview


```js
self.hview
```
#### property: vview


```js
self.vview
```
#### getter: width



```js
// Type
any
```
#### property: hview


```js
 self.hview
```
#### getter: width



```js
// Type
any
```
#### property: vview


```js
 self.vview
```
#### property: tracks


```js
 self.tracks
```
#### property: assemblyNames


```js

        self.assemblyNames
```
#### getter: initialized



```js
// Type
boolean
```
#### getter: viewWidth



```js
// Type
number
```
#### getter: viewHeight



```js
// Type
number
```
#### property: hview


```js
self.hview
```
#### property: vview


```js
 self.vview
```
#### property: assemblyNames


```js

              self.assemblyNames
```
#### action: setError



```js
// Type signature
setError: (e: unknown) => void
```
#### action: setBorderY



```js
// Type signature
setBorderY: (n: number) => void
```
#### action: setBorderX



```js
// Type signature
setBorderX: (n: number) => void
```
#### action: squareView



```js
// Type signature
squareView: () => void
```
#### action: squareViewProportional



```js
// Type signature
squareViewProportional: () => void
```
#### method: menuItems

```js
// Type signature
menuItems: () => ({ label: string; onClick: () => void; icon?: undefined; } | { label: string; onClick: () => any; icon: any; })[]
```
#### action: squareView



```js
// Type signature
squareView: () => void
```
#### action: squareView



```js
// Type signature
squareView: () => void
```
#### action: activateTrackSelector



```js
// Type signature
activateTrackSelector: () => any
```
#### getter: error



```js
// Type
unknown
```
#### getter: assemblyErrors



```js
// Type
string
```
