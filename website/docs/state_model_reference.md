---
id: state_model_reference
title: State-model reference
toplevel: true
---

## LinearGenomeView

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
type: types.literal('LinearGenomeView')
```

#### property: offsetPx

```js
/**
 * !property
 * bpPerPx corresponds roughly to the horizontal scroll of the LGV
 */
offsetPx: 0
```

#### property: bpPerPx

```js
/**
 * !property
 * bpPerPx corresponds roughly to the zoom level, base-pairs per pixel
 */
bpPerPx: 1
```

#### property: displayedRegions

```js
/**
 * !property
 * currently displayed region, can be a single chromosome or the entire
 * set of chromosomes in the genome:
 * {start:number,end:number,refName:string,assemblyName:string}[]
 */
displayedRegions: types.array(MyRegion)
```

#### property: tracks

```js
/**
 * !property
 * array of currently displayed tracks state models instances
 */
tracks: types.array(pluginManager.pluggableMstType('track', 'stateModel'))
```

#### property: hideHeader

```js
/**
 * !property
 * array of currently displayed tracks state model's
 */
hideHeader: false
```

#### property: hideHeaderOverview

```js
/**
 * !property
 */
hideHeaderOverview: false
```

#### property: hideNoTracksActive

```js
/**
 * !property
 */
hideNoTracksActive: false
```

#### property: trackSelectorType

```js
/**
 * !property
 */
trackSelectorType: types.optional(
  types.enumeration(['hierarchical']),
  'hierarchical',
)
```

#### property: trackLabels

```js
/**
 * !property
 * how to display the track labels, can be "overlapping", "offset", or "hidden"
 */
trackLabels: types.optional(
  types.string,
  () => localStorageGetItem('lgv-trackLabels') || 'overlapping',
)
```

#### property: showCenterLine

```js
/**
 * !property
 * show the "center line"
 */
showCenterLine: types.optional(types.boolean, () => {
  const setting = localStorageGetItem('lgv-showCenterLine')
  return setting !== undefined && setting !== null ? !!+setting : false
})
```

#### property: showCytobandsSetting

```js
/**
 * !property
 * show the "cytobands" in the overview scale bar
 */
showCytobandsSetting: types.optional(types.boolean, () => {
  const setting = localStorageGetItem('lgv-showCytobands')
  return setting !== undefined && setting !== null ? !!+setting : true
})
```

#### property: showGridlines

```js
/**
 * !property
 * show the "gridlines" in the track area
 */
showGridlines: true
```

#### getter: width

```js
// Type
number
```

#### getter: interRegionPaddingWidth

```js
// Type
number
```

#### getter: assemblyNames

```js
// Type
any[]
```

#### action: setShowCytobands

```js
// Type signature
setShowCytobands: (flag: boolean) => void
```

#### action: setWidth

```js
// Type signature
setWidth: (newWidth: number) => void
```

#### action: setError

```js
// Type signature
setError: (error: Error) => void
```

#### action: toggleHeader

```js
// Type signature
toggleHeader: () => void
```

#### action: toggleHeaderOverview

```js
// Type signature
toggleHeaderOverview: () => void
```

#### action: toggleNoTracksActive

```js
// Type signature
toggleNoTracksActive: () => void
```

#### action: toggleShowGridlines

```js
// Type signature
toggleShowGridlines: () => void
```

#### action: scrollTo

```js
// Type signature
scrollTo: (offsetPx: number) => number
```

#### action: zoomTo

```js
// Type signature
zoomTo: (bpPerPx: number) => number
```

#### action: setOffsets

sets offsets used in the get sequence dialog

```js
// Type signature
setOffsets: (left?: BpOffset, right?: BpOffset) => void
```

#### action: setSearchResults

```js
// Type signature
setSearchResults: (results?: BaseResult[], query?: string) => void
```

#### action: setGetSequenceDialogOpen

```js
// Type signature
setGetSequenceDialogOpen: (open: boolean) => void
```

#### action: setNewView

```js
// Type signature
setNewView: (bpPerPx: number, offsetPx: number) => void
```

#### action: horizontallyFlip

```js
// Type signature
horizontallyFlip: () => void
```

#### action: showTrack

```js
// Type signature
showTrack: (
  trackId: string,
  initialSnapshot?: {},
  displayInitialSnapshot?: {},
) => any
```

#### action: moveTrack

```js
// Type signature
moveTrack: (movingId: string, targetId: string) => void
```

#### action: closeView

```js
// Type signature
closeView: () => void
```

#### action: toggleTrack

```js
// Type signature
toggleTrack: (trackId: string) => void
```

#### action: setTrackLabels

```js
// Type signature
setTrackLabels: (setting: "overlapping" | "offset" | "hidden") => void
```

#### action: toggleCenterLine

```js
// Type signature
toggleCenterLine: () => void
```

#### action: setDisplayedRegions

```js
// Type signature
setDisplayedRegions: (regions: Region[]) => void
```

#### action: activateTrackSelector

```js
// Type signature
activateTrackSelector: () => Widget
```

#### method: getSelectedRegions

Helper method for the fetchSequence.
Retrieves the corresponding regions that were selected by the rubberband

```js
// Type signature
getSelectedRegions: (leftOffset?: BpOffset, rightOffset?: BpOffset) => BaseBlock[]
```

#### action: afterDisplayedRegionsSet

schedule something to be run after the next time displayedRegions is set

```js
// Type signature
afterDisplayedRegionsSet: (cb: Function) => void
```

#### action: horizontalScroll

```js
// Type signature
horizontalScroll: (distance: number) => number
```

#### action: center

```js
// Type signature
center: () => void
```

#### action: showAllRegions

```js
// Type signature
showAllRegions: () => void
```

#### action: showAllRegionsInAssembly

```js
// Type signature
showAllRegionsInAssembly: (assemblyName?: string) => void
```

#### action: setDraggingTrackId

```js
// Type signature
setDraggingTrackId: (idx?: string) => void
```

#### action: setScaleFactor

```js
// Type signature
setScaleFactor: (factor: number) => void
```

#### action: clearView

this "clears the view" and makes the view return to the import form

```js
// Type signature
clearView: () => void
```

#### action: exportSvg

creates an svg export and save using FileSaver

```js
// Type signature
exportSvg: (opts?: ExportSvgOptions) => Promise<void>
```

#### action: slide

perform animated slide

```js
// Type signature
slide: (viewWidths: number) => void
```

#### action: zoom

perform animated zoom

```js
// Type signature
zoom: (targetBpPerPx: number) => void
```

#### getter: canShowCytobands

```js
// Type
any
```

#### getter: showCytobands

```js
// Type
boolean
```

#### getter: anyCytobandsExist

```js
// Type
boolean
```

#### getter: cytobandOffset

the cytoband is displayed to the right of the chromosome name,
and that offset is calculated manually with this method

```js
// Type
number
```

#### method: menuItems

return the view menu items

```js
// Type signature
menuItems: () => MenuItem[]
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

#### getter: dynamicBlocks

dynamic blocks represent the exact coordinates of the currently
visible genome regions on the screen. they are similar to static
blocks, but statcic blocks can go offscreen while dynamic blocks
represent exactly what is on screen

```js
// Type
BlockSet
```

#### getter: roundedDynamicBlocks

rounded dynamic blocks are dynamic blocks without fractions of bp

```js
// Type
any
```

#### getter: visibleLocStrings

a single "combo-locstring" representing all the regions visible
on the screen

```js
// Type
string
```

#### getter: coarseVisibleLocStrings

same as visibleLocStrings, but only updated every 300ms

```js
// Type
string
```

#### action: setCoarseDynamicBlocks

```js
// Type signature
setCoarseDynamicBlocks: (blocks: BlockSet) => void
```

#### action: moveTo

offset is the base-pair-offset in the displayed region, index is the index of the
displayed region in the linear genome view

```js
// Type signature
moveTo: (start?: BpOffset, end?: BpOffset) => void
```

#### action: navToLocString

navigate to the given locstring

```js
// Type signature
navToLocString: (locString: string, optAssemblyName?: string) => void
```

#### action: navTo

Navigate to a location based on its refName and optionally start, end,
and assemblyName. Can handle if there are multiple displayedRegions
from same refName. Only navigates to a location if it is entirely
within a displayedRegion. Navigates to the first matching location
encountered.

Throws an error if navigation was unsuccessful

```js
// Type signature
navTo: (query: NavLocation) => void
```

#### action: navToMultiple

```js
// Type signature
navToMultiple: (locations: NavLocation[]) => void
```

#### method: rubberBandMenuItems

```js
// Type signature
rubberBandMenuItems: () => MenuItem[]
```

#### method: bpToPx

```js
// Type signature
bpToPx: ({
  refName,
  coord,
  regionNumber,
}: {
  refName: string,
  coord: number,
  regionNumber?: number,
}) => {
  index: number
  offsetPx: number
}
```

#### method: centerAt

scrolls the view to center on the given bp. if that is not in any
of the displayed regions, does nothing

```js
// Type signature
centerAt: (coord: number, refName: string, regionNumber: number) => void
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

#### getter: centerLineInfo

```js
// Type
any
```

## DotplotView

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

#### getter: views

```js
// Type
(({ id: string; displayedRegions: IMSTArray<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; bpPerPx: number; offsetPx: number; interRegionPaddingWidth: numbe...
```

#### method: renderProps

```js
// Type signature
renderProps: () => any
```

#### action: setCursorMode

```js
// Type signature
setCursorMode: (str: string) => void
```

#### action: setDrawCigar

```js
// Type signature
setDrawCigar: (flag: boolean) => void
```

#### action: clearView

returns to the import form

```js
// Type signature
clearView: () => void
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

#### action: zoomInButton

```js
// Type signature
zoomInButton: () => void
```

#### action: activateTrackSelector

```js
// Type signature
activateTrackSelector: () => any
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

#### action: setViews

```js
// Type signature
setViews: (arr: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IArrayType<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<...>; reversed: IOptionalIType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>; bpPerPx...
```

#### action: getCoords

```js
// Type signature
getCoords: (mousedown: Coord, mouseup: Coord) => { coord: number; index: number; refName: string; oob: boolean; assemblyName: string; offset: number; start: number; end: number; reversed: boolean; }[]
```

#### action: zoomIn

zooms into clicked and dragged region

```js
// Type signature
zoomIn: (mousedown: Coord, mouseup: Coord) => void
```

#### action: onDotplotView

creates a linear synteny view from the clicked and dragged region

```js
// Type signature
onDotplotView: (mousedown: Coord, mouseup: Coord) => void
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

#### getter: error

```js
// Type
unknown
```

#### action: navToLocString

navigate to the given locstring

```js
// Type signature
navToLocString: (locString: string, optAssemblyName?: string) => void
```

## LinearComparativeView

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
tracks: types.array(pluginManager.pluggableMstType('track', 'stateModel'))
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
removeView: (view: { id: string; displayName: string; type: "LinearGenomeView"; offsetPx: number; bpPerPx: number; displayedRegions: IMSTArray<any> & IStateTreeNode<IArrayType<any>>; ... 8 more ...; showGridlines: boolean; } & ... 17 more ... & IStateTreeNode<...>) => void
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

## LinearSyntenyView

extends the LinearComparativeView base model

#### property: type

```js
/**
 * !property
 */
type: types.literal('LinearSyntenyView')
```

#### property: drawCurves

```js
/**
 * !property
 */
drawCurves: false
```

#### action: toggleCurves

```js
// Type signature
toggleCurves: () => void
```

#### method: menuItems

```js
// Type signature
menuItems: any
```

#### action: squareView

```js
// Type signature
squareView: () => void
```

#### property: linkViews

```js
self.linkViews
```

#### action: toggleLinkViews

```js
// Type signature
toggleLinkViews: () => void
```
