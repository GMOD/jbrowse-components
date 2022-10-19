---
id: circularview
title: CircularView
toplevel: true
---


extends `BaseViewModel`
#### property: type


```js

        /**
         * !property
         */
        type: types.literal('CircularView')
```
#### property: offsetRadians


```js

        /**
         * !property
         * similar to offsetPx in linear genome view
         */
        offsetRadians: -Math.PI / 2
```
#### property: bpPerPx


```js

        /**
         * !property
         */
        bpPerPx: 2000000
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
#### property: hideVerticalResizeHandle


```js


        /**
         * !property
         */
        hideVerticalResizeHandle: false
```
#### property: hideTrackSelectorButton


```js

        /**
         * !property
         */
        hideTrackSelectorButton: false
```
#### property: lockedFitToWindow


```js

        /**
         * !property
         */
        lockedFitToWindow: true
```
#### property: disableImportForm


```js

        /**
         * !property
         */
        disableImportForm: false
```
#### property: height


```js


        /**
         * !property
         */
        height: types.optional(
          types.refinement('trackHeight', types.number, n => n >= minHeight),
          defaultHeight,
        )
```
#### property: displayedRegions


```js

        /**
         * !property
         */
        displayedRegions: types.array(Region)
```
#### property: scrollX


```js

        /**
         * !property
         */
        scrollX: 0
```
#### property: scrollY


```js

        /**
         * !property
         */
        scrollY: 0
```
#### getter: staticSlices



```js
// Type
any[]
```
#### getter: visibleSection



```js
// Type
{ rho: [number, number]; theta: [number, number]; }
```
#### property: scrollX


```js

              self.scrollX
```
#### property: scrollX


```js

              self.scrollX
```
#### property: scrollY


```js

              self.scrollY
```
#### property: scrollY


```js

              self.scrollY
```
#### property: height


```js
 self.height
```
#### getter: circumferencePx



```js
// Type
number
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### getter: radiusPx



```js
// Type
number
```
#### getter: bpPerRadian



```js
// Type
number
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### getter: pxPerRadian



```js
// Type
any
```
#### getter: centerXY



```js
// Type
[number, number]
```
#### getter: totalBp



```js
// Type
number
```
#### property: displayedRegions


```js
 self.displayedRegions
```
#### getter: maximumRadiusPx



```js
// Type
number
```
#### property: lockedFitToWindow


```js
 self.lockedFitToWindow
```
#### property: height


```js
 self.height
```
#### getter: maxBpPerPx



```js
// Type
number
```
#### getter: minBpPerPx



```js
// Type
number
```
#### getter: atMaxBpPerPx



```js
// Type
boolean
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### getter: atMinBpPerPx



```js
// Type
boolean
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### getter: tooSmallToLock



```js
// Type
boolean
```
#### getter: figureDimensions



```js
// Type
[number, number]
```
#### getter: figureWidth



```js
// Type
any
```
#### getter: figureHeight



```js
// Type
any
```
#### getter: elidedRegions


this is displayedRegions, post-processed to
elide regions that are too small to see reasonably
```js
// Type
any[]
```
#### property: displayedRegions


```js

          self.displayedRegions
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### getter: assemblyNames



```js
// Type
string[]
```
#### property: displayedRegions


```js

          self.displayedRegions
```
#### getter: initialized



```js
// Type
any
```
#### getter: visibleStaticSlices



```js
// Type
any[]
```
#### getter: staticSlices



```js
// Type
any[]
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
#### action: resizeHeight



```js
// Type signature
resizeHeight: (distance: number) => number
```
#### property: height


```js
 self.height
```
#### property: height


```js
self.height
```
#### getter: tooSmallToLock



```js
// Type
boolean
```
#### action: resizeWidth



```js
// Type signature
resizeWidth: (distance: number) => number
```
#### getter: tooSmallToLock



```js
// Type
boolean
```
#### action: rotateClockwiseButton



```js
// Type signature
rotateClockwiseButton: () => void
```
#### action: rotateCounterClockwiseButton



```js
// Type signature
rotateCounterClockwiseButton: () => void
```
#### action: rotateClockwise



```js
// Type signature
rotateClockwise: (distance?: number) => void
```
#### property: offsetRadians


```js

          self.offsetRadians
```
#### action: rotateCounterClockwise



```js
// Type signature
rotateCounterClockwise: (distance?: number) => void
```
#### property: offsetRadians


```js

          self.offsetRadians
```
#### action: zoomInButton



```js
// Type signature
zoomInButton: () => void
```
#### property: bpPerPx


```js
self.bpPerPx
```
#### action: zoomOutButton



```js
// Type signature
zoomOutButton: () => void
```
#### property: bpPerPx


```js
self.bpPerPx
```
#### action: setBpPerPx



```js
// Type signature
setBpPerPx: (newVal: number) => void
```
#### property: bpPerPx


```js

          self.bpPerPx
```
#### getter: minBpPerPx



```js
// Type
number
```
#### getter: maxBpPerPx



```js
// Type
number
```
#### action: setModelViewWhenAdjust



```js
// Type signature
setModelViewWhenAdjust: (secondCondition: boolean) => void
```
#### property: lockedFitToWindow


```js
self.lockedFitToWindow
```
#### getter: minBpPerPx



```js
// Type
number
```
#### action: closeView



```js
// Type signature
closeView: () => void
```
#### action: setDisplayedRegions



```js
// Type signature
setDisplayedRegions: (regions: SnapshotOrInstance<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>[]) => void
```
#### property: displayedRegions


```js
 self.displayedRegions
```
#### property: displayedRegions


```js

          self.displayedRegions
```
#### getter: minBpPerPx



```js
// Type
number
```
#### property: bpPerPx


```js
self.bpPerPx
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
#### action: setError



```js
// Type signature
setError: (error: unknown) => void
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
#### property: tracks


```js

          self.tracks
```
#### action: addTrackConf



```js
// Type signature
addTrackConf: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>, initialSnapshot?: {}) => void
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
#### action: toggleFitToWindowLock



```js
// Type signature
toggleFitToWindowLock: () => boolean
```
#### property: lockedFitToWindow


```js

          // when going unlocked -> locked and circle is cut off, set to the locked minBpPerPx
          self.lockedFitToWindow
```
#### property: lockedFitToWindow


```js
self.lockedFitToWindow
```
#### getter: atMinBpPerPx



```js
// Type
boolean
```
#### property: lockedFitToWindow


```js
 self.lockedFitToWindow
```
