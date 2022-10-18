---
id: state_model_reference
title: State-model reference
toplevel: true
---

## LinearGenomeView

### property: id

```js
/**
 * !property
 */
id: ElementId
```

### property: type

```js
/**
 * !property
 */
type: types.literal('LinearGenomeView')
```

### property: offsetPx

```js
/**
 * !property
 * bpPerPx corresponds roughly to the horizontal scroll of the LGV
 */
offsetPx: 0
```

### property: bpPerPx

```js
/**
 * !property
 * bpPerPx corresponds roughly to the zoom level, base-pairs per pixel
 */
bpPerPx: 1
```

### property: displayedRegions

```js
/**
 * !property
 * currently displayed region, can be a single chromosome, arbitrary subsections,
 * or the entire  set of chromosomes in the genome, but it not advised to use the
 * entire set of chromosomes if your assembly is very fragmented
 */
displayedRegions: types.array(MUIRegion)
```

### property: tracks

```js
/**
 * !property
 * array of currently displayed tracks state models instances
 */
tracks: types.array(pluginManager.pluggableMstType('track', 'stateModel'))
```

### property: hideHeader

```js
/**
 * !property
 * array of currently displayed tracks state model's
 */
hideHeader: false
```

### property: hideHeaderOverview

```js
/**
 * !property
 */
hideHeaderOverview: false
```

### property: hideNoTracksActive

```js
/**
 * !property
 */
hideNoTracksActive: false
```

### property: trackSelectorType

```js
/**
 * !property
 */
trackSelectorType: types.optional(
  types.enumeration(['hierarchical']),
  'hierarchical',
)
```

### property: trackLabels

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

### property: showCenterLine

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

### property: showCytobandsSetting

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

### property: showGridlines

```js
/**
 * !property
 * show the "gridlines" in the track area
 */
showGridlines: true
```

### getter: width

```js
// Type
number
```

### getter: interRegionPaddingWidth

```js
// Type
number
```

### getter: assemblyNames

```js
// Type
any[]
```

### action: setShowCytobands

```js
// Type signature
setShowCytobands: (flag: boolean) => void
```

### action: setWidth

```js
// Type signature
setWidth: (newWidth: number) => void
```

### action: setError

```js
// Type signature
setError: (error: Error) => void
```

### action: toggleHeader

```js
// Type signature
toggleHeader: () => void
```

### action: toggleHeaderOverview

```js
// Type signature
toggleHeaderOverview: () => void
```

### action: toggleNoTracksActive

```js
// Type signature
toggleNoTracksActive: () => void
```

### action: toggleShowGridlines

```js
// Type signature
toggleShowGridlines: () => void
```

### action: scrollTo

```js
// Type signature
scrollTo: (offsetPx: number) => number
```

### action: zoomTo

```js
// Type signature
zoomTo: (bpPerPx: number) => number
```

### action: setOffsets

sets offsets used in the get sequence dialog

```js
// Type signature
setOffsets: (left?: BpOffset, right?: BpOffset) => void
```

### action: setSearchResults

```js
// Type signature
setSearchResults: (results?: BaseResult[], query?: string) => void
```

### action: setGetSequenceDialogOpen

```js
// Type signature
setGetSequenceDialogOpen: (open: boolean) => void
```

### action: setNewView

```js
// Type signature
setNewView: (bpPerPx: number, offsetPx: number) => void
```

### action: horizontallyFlip

```js
// Type signature
horizontallyFlip: () => void
```

### action: showTrack

```js
// Type signature
showTrack: (
  trackId: string,
  initialSnapshot?: {},
  displayInitialSnapshot?: {},
) => any
```

### action: moveTrack

```js
// Type signature
moveTrack: (movingId: string, targetId: string) => void
```

### action: closeView

```js
// Type signature
closeView: () => void
```

### action: toggleTrack

```js
// Type signature
toggleTrack: (trackId: string) => void
```

### action: setTrackLabels

```js
// Type signature
setTrackLabels: (setting: "overlapping" | "offset" | "hidden") => void
```

### action: toggleCenterLine

```js
// Type signature
toggleCenterLine: () => void
```

### action: setDisplayedRegions

```js
// Type signature
setDisplayedRegions: (regions: Region[]) => void
```

### action: activateTrackSelector

```js
// Type signature
activateTrackSelector: () => Widget
```

### method: getSelectedRegions

Helper method for the fetchSequence.
Retrieves the corresponding regions that were selected by the rubberband

```js
// Type signature
getSelectedRegions: (leftOffset?: BpOffset, rightOffset?: BpOffset) => BaseBlock[]
```

### action: afterDisplayedRegionsSet

schedule something to be run after the next time displayedRegions is set

```js
// Type signature
afterDisplayedRegionsSet: (cb: Function) => void
```

### action: horizontalScroll

```js
// Type signature
horizontalScroll: (distance: number) => number
```

### action: center

```js
// Type signature
center: () => void
```

### action: showAllRegions

```js
// Type signature
showAllRegions: () => void
```

### action: showAllRegionsInAssembly

```js
// Type signature
showAllRegionsInAssembly: (assemblyName?: string) => void
```

### action: setDraggingTrackId

```js
// Type signature
setDraggingTrackId: (idx?: string) => void
```

### action: setScaleFactor

```js
// Type signature
setScaleFactor: (factor: number) => void
```

### action: clearView

this "clears the view" and makes the view return to the import form

```js
// Type signature
clearView: () => void
```

### action: exportSvg

creates an svg export and save using FileSaver

```js
// Type signature
exportSvg: (opts?: ExportSvgOptions) => Promise<void>
```

### action: slide

perform animated slide

```js
// Type signature
slide: (viewWidths: number) => void
```

### action: zoom

perform animated zoom

```js
// Type signature
zoom: (targetBpPerPx: number) => void
```

### getter: canShowCytobands

```js
// Type
any
```

### getter: showCytobands

```js
// Type
boolean
```

### getter: anyCytobandsExist

```js
// Type
boolean
```

### getter: cytobandOffset

the cytoband is displayed to the right of the chromosome name,
and that offset is calculated manually with this method

```js
// Type
number
```

### method: menuItems

return the view menu items

```js
// Type signature
menuItems: () => MenuItem[]
```

### getter: staticBlocks

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

### getter: dynamicBlocks

dynamic blocks represent the exact coordinates of the currently
visible genome regions on the screen. they are similar to static
blocks, but statcic blocks can go offscreen while dynamic blocks
represent exactly what is on screen

```js
// Type
BlockSet
```

### getter: roundedDynamicBlocks

rounded dynamic blocks are dynamic blocks without fractions of bp

```js
// Type
any
```

### getter: visibleLocStrings

a single "combo-locstring" representing all the regions visible
on the screen

```js
// Type
string
```

### getter: coarseVisibleLocStrings

same as visibleLocStrings, but only updated every 300ms

```js
// Type
string
```

### action: setCoarseDynamicBlocks

```js
// Type signature
setCoarseDynamicBlocks: (blocks: BlockSet) => void
```

### action: moveTo

offset is the base-pair-offset in the displayed region, index is the index of the
displayed region in the linear genome view

```js
// Type signature
moveTo: (start?: BpOffset, end?: BpOffset) => void
```

### action: navToLocString

navigate to the given locstring

```js
// Type signature
navToLocString: (locString: string, optAssemblyName?: string) => void
```

### action: navTo

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

### action: navToMultiple

```js
// Type signature
navToMultiple: (locations: NavLocation[]) => void
```

### method: rubberBandMenuItems

```js
// Type signature
rubberBandMenuItems: () => MenuItem[]
```

### method: bpToPx

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

### method: centerAt

scrolls the view to center on the given bp. if that is not in any
of the displayed regions, does nothing

```js
// Type signature
centerAt: (coord: number, refName: string, regionNumber: number) => void
```

### method: pxToBp

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

### getter: centerLineInfo

```js
// Type
any
```

## DotplotView

### property: id

```js
/**
 * !property
 */
id: ElementId
```

### property: type

```js
/**
 * !property
 */
type: types.literal('DotplotView')
```

### property: height

```js
/**
 * !property
 */
height: 600
```

### property: borderSize

```js
/**
 * !property
 */
borderSize: 20
```

### property: tickSize

```js
/**
 * !property
 */
tickSize: 5
```

### property: vtextRotation

```js
/**
 * !property
 */
vtextRotation: 0
```

### property: htextRotation

```js
/**
 * !property
 */
htextRotation: -90
```

### property: fontSize

```js
/**
 * !property
 */
fontSize: 15
```

### property: trackSelectorType

```js
/**
 * !property
 */
trackSelectorType: 'hierarchical'
```

### property: assemblyNames

```js
/**
 * !property
 */
assemblyNames: types.array(types.string)
```

### property: drawCigar

```js
/**
 * !property
 */
drawCigar: true
```

### property: hview

```js
/**
 * !property
 */
hview: types.optional(DotplotHView, {})
```

### property: vview

```js
/**
 * !property
 */
vview: types.optional(DotplotVView, {})
```

### property: cursorMode

```js
/**
 * !property
 */
cursorMode: 'crosshair'
```

### property: tracks

```js


        /**
         * !property
         */
        tracks: types.array(
          pm.pluggableMstType('track', 'stateModel') as BaseTrackStateModel,
        )
```

### property: viewTrackConfigs

```js
/**
 * !property
 * this represents tracks specific to this view specifically used
 * for read vs ref dotplots where this track would not really apply
 * elsewhere
 */
viewTrackConfigs: types.array(pm.pluggableConfigSchemaType('track'))
```

### getter: width

```js
// Type
number
```

### getter: assemblyErrors

```js
// Type
string
```

### getter: assembliesInitialized

```js
// Type
boolean
```

### getter: initialized

```js
// Type
boolean
```

### getter: hticks

```js
// Type
any[]
```

### getter: vticks

```js
// Type
any[]
```

### getter: loading

```js
// Type
boolean
```

### getter: viewWidth

```js
// Type
number
```

### getter: viewHeight

```js
// Type
number
```

### getter: views

```js
// Type
(({ id: string; displayedRegions: IMSTArray<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; bpPerPx: number; offsetPx: number; interRegionPaddingWidth: numbe...
```

### method: renderProps

```js
// Type signature
renderProps: () => any
```

### action: setCursorMode

```js
// Type signature
setCursorMode: (str: string) => void
```

### action: setDrawCigar

```js
// Type signature
setDrawCigar: (flag: boolean) => void
```

### action: clearView

returns to the import form

```js
// Type signature
clearView: () => void
```

### action: setBorderX

```js
// Type signature
setBorderX: (n: number) => void
```

### action: setBorderY

```js
// Type signature
setBorderY: (n: number) => void
```

### action: setWidth

```js
// Type signature
setWidth: (newWidth: number) => number
```

### action: setHeight

```js
// Type signature
setHeight: (newHeight: number) => number
```

### action: setError

```js
// Type signature
setError: (e: unknown) => void
```

### action: closeView

removes the view itself from the state tree entirely by calling the parent removeView

```js
// Type signature
closeView: () => void
```

### action: zoomOutButton

```js
// Type signature
zoomOutButton: () => void
```

### action: zoomInButton

```js
// Type signature
zoomInButton: () => void
```

### action: activateTrackSelector

```js
// Type signature
activateTrackSelector: () => any
```

### action: showTrack

```js
// Type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
```

### action: hideTrack

```js
// Type signature
hideTrack: (trackId: string) => number
```

### action: toggleTrack

```js
// Type signature
toggleTrack: (trackId: string) => void
```

### action: setAssemblyNames

```js
// Type signature
setAssemblyNames: (target: string, query: string) => void
```

### action: setViews

```js
// Type signature
setViews: (arr: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IArrayType<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<...>; reversed: IOptionalIType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>; bpPerPx...
```

### action: getCoords

```js
// Type signature
getCoords: (mousedown: Coord, mouseup: Coord) => { coord: number; index: number; refName: string; oob: boolean; assemblyName: string; offset: number; start: number; end: number; reversed: boolean; }[]
```

### action: zoomIn

zooms into clicked and dragged region

```js
// Type signature
zoomIn: (mousedown: Coord, mouseup: Coord) => void
```

### action: onDotplotView

creates a linear synteny view from the clicked and dragged region

```js
// Type signature
onDotplotView: (mousedown: Coord, mouseup: Coord) => void
```

### action: squareView

```js
// Type signature
squareView: () => void
```

### action: squareViewProportional

```js
// Type signature
squareViewProportional: () => void
```

### method: menuItems

```js
// Type signature
menuItems: () => ({ label: string; onClick: () => void; icon?: undefined; } | { label: string; onClick: () => any; icon: any; })[]
```

### getter: error

```js
// Type
unknown
```

## LinearBareDisplay

extends `BaseLinearDisplay`

### property: type

```js
/**
 * !property
 */
type: types.literal('LinearBareDisplay')
```

### property: configuration

```js
/**
 * !property
 */
configuration: ConfigurationReference(configSchema)
```

### method: renderProps

```js
// Type signature
renderProps: () => any
```

### property: rpcDriverName

```js
self.rpcDriverName
```

### getter: rendererTypeName

```js
// Type
any
```

## LinearBasicDisplay

used by `FeatureTrack`, has simple settings like "show/hide feature labels", etc.

### property: type

```js
/**
 * !property
 */
type: types.literal('LinearBasicDisplay')
```

### property: trackShowLabels

```js
/**
 * !property
 */
trackShowLabels: types.maybe(types.boolean)
```

### property: trackShowDescriptions

```js
/**
 * !property
 */
trackShowDescriptions: types.maybe(types.boolean)
```

### property: trackDisplayMode

```js
/**
 * !property
 */
trackDisplayMode: types.maybe(types.string)
```

### property: trackMaxHeight

```js
/**
 * !property
 */
trackMaxHeight: types.maybe(types.number)
```

### property: configuration

```js
/**
 * !property
 */
configuration: ConfigurationReference(configSchema)
```

### getter: rendererTypeName

```js
// Type
any
```

### getter: showLabels

```js
// Type
any
```

### getter: showDescriptions

```js
// Type
any
```

### getter: maxHeight

```js
// Type
any
```

### getter: displayMode

```js
// Type
any
```

### getter: rendererConfig

```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

### getter: rendererType

the pluggable element type object for this display's
renderer

```js
// Type
RendererType
```

### action: toggleShowLabels

```js
// Type signature
toggleShowLabels: () => void
```

### action: toggleShowDescriptions

```js
// Type signature
toggleShowDescriptions: () => void
```

### action: setDisplayMode

```js
// Type signature
setDisplayMode: (val: string) => void
```

### action: setMaxHeight

```js
// Type signature
setMaxHeight: (val: number) => void
```

### method: renderProps

```js
// Type signature
renderProps: () => { config: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>; }
```

### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => MenuItem[]
```

### action: navToLocString

navigate to the given locstring

```js
// Type signature
navToLocString: (locString: string, optAssemblyName?: string) => void
```

### action: showTrack

```js
// Type signature
showTrack: (
  trackId: string,
  initialSnapshot?: {},
  displayInitialSnapshot?: {},
) => any
```

## LinearComparativeView

### property: id

```js
/**
 * !property
 */
id: ElementId
```

### property: type

```js
/**
 * !property
 */
type: types.literal('LinearComparativeView')
```

### property: height

```js
/**
 * !property
 */
height: defaultHeight
```

### property: trackSelectorType

```js
/**
 * !property
 */
trackSelectorType: 'hierarchical'
```

### property: showIntraviewLinks

```js
/**
 * !property
 */
showIntraviewLinks: true
```

### property: linkViews

```js
/**
 * !property
 */
linkViews: false
```

### property: interactToggled

```js
/**
 * !property
 */
interactToggled: false
```

### property: middleComparativeHeight

```js
/**
 * !property
 */
middleComparativeHeight: 100
```

### property: tracks

```js
/**
 * !property
 */
tracks: types.array(pluginManager.pluggableMstType('track', 'stateModel'))
```

### property: views

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

### property: viewTrackConfigs

```js
/**
 * !property
 * this represents tracks specific to this view specifically used
 * for read vs ref dotplots where this track would not really apply
 * elsewhere
 */
viewTrackConfigs: types.array(pluginManager.pluggableConfigSchemaType('track'))
```

### getter: highResolutionScaling

```js
// Type
number
```

### getter: initialized

```js
// Type
boolean
```

### getter: refNames

```js
// Type
any[][]
```

### getter: staticBlocks

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

### getter: assemblyNames

```js
// Type
any[]
```

### action: setWidth

```js
// Type signature
setWidth: (newWidth: number) => void
```

### action: setHeight

```js
// Type signature
setHeight: (newHeight: number) => void
```

### action: setViews

```js
// Type signature
setViews: (views: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; } & { id: IOptionalIType<ISimpleType<string>, [...]>; ... 12 more ...; showGridlines: IType<...>; }>>[]) => void
```

### action: removeView

```js
// Type signature
removeView: (view: { id: string; displayName: string; type: "LinearGenomeView"; offsetPx: number; bpPerPx: number; displayedRegions: IMSTArray<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<...>; reversed: IOptionalIType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>> & IS...
```

### action: closeView

removes the view itself from the state tree entirely by calling the parent removeView

```js
// Type signature
closeView: () => void
```

### action: setMiddleComparativeHeight

```js
// Type signature
setMiddleComparativeHeight: (n: number) => number
```

### action: toggleLinkViews

```js
// Type signature
toggleLinkViews: () => void
```

### action: activateTrackSelector

```js
// Type signature
activateTrackSelector: () => Widget
```

### action: toggleTrack

```js
// Type signature
toggleTrack: (trackId: string) => void
```

### action: showTrack

```js
// Type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
```

### action: hideTrack

```js
// Type signature
hideTrack: (trackId: string) => number
```

### action: squareView

```js
// Type signature
squareView: () => void
```

### property: bpPerPx

```js
v.bpPerPx
```

### method: pxToBp

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

### getter: width

```js
// Type
any
```

### action: setNewView

```js
// Type signature
setNewView: (bpPerPx: number, offsetPx: number) => void
```

### property: offsetPx

```js
view.offsetPx
```

### method: centerAt

scrolls the view to center on the given bp. if that is not in any
of the displayed regions, does nothing

```js
// Type signature
centerAt: (coord: number, refName: string, regionNumber: number) => void
```

### action: clearView

```js
// Type signature
clearView: () => void
```

### method: menuItems

```js
// Type signature
menuItems: () => MenuItem[]
```

### method: rubberBandMenuItems

```js
// Type signature
rubberBandMenuItems: () => { label: string; onClick: () => void; }[]
```

### action: moveTo

offset is the base-pair-offset in the displayed region, index is the index of the
displayed region in the linear genome view

```js
// Type signature
moveTo: (start?: BpOffset, end?: BpOffset) => void
```

## LinearSyntenyView

extends the LinearComparativeView base model

### property: type

```js
/**
 * !property
 */
type: types.literal('LinearSyntenyView')
```

### property: drawCurves

```js
/**
 * !property
 */
drawCurves: false
```

### action: toggleCurves

```js
// Type signature
toggleCurves: () => void
```

### method: menuItems

```js
// Type signature
menuItems: any
```

### action: squareView

```js
// Type signature
squareView: () => void
```

### property: linkViews

```js
self.linkViews
```

### action: toggleLinkViews

```js
// Type signature
toggleLinkViews: () => void
```

## BaseDisplay

### property: id

```js
/**
 * !property
 */
id: ElementId
```

### property: type

```js
/**
 * !property
 */
type: types.string
```

### property: rpcDriverName

```js
/**
 * !property
 */
rpcDriverName: types.maybe(types.string)
```

### getter: RenderingComponent

```js
// Type
React.FC<{ model: { id: string; type: string; rpcDriverName: string; } & NonEmptyObject & { rendererTypeName: string; error: unknown; } & IStateTreeNode<IModelType<{ id: IOptionalIType<ISimpleType<string>, [...]>; type: ISimpleType<...>; rpcDriverName: IMaybe<...>; }, { ...; }, _NotCustomized, _NotCustomized>>; onHo...
```

### getter: DisplayBlurb

```js
// Type
any
```

### getter: adapterConfig

```js
// Type
any
```

### getter: parentTrack

```js
// Type
any
```

### method: renderProps

the react props that are passed to the Renderer when data
is rendered in this display

```js
// Type signature
renderProps: () => any
```

### getter: rendererType

the pluggable element type object for this display's
renderer

```js
// Type
RendererType
```

### getter: DisplayMessageComponent

if a display-level message should be displayed instead,
make this return a react component

```js
// Type
any
```

### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => MenuItem[]
```

### getter: viewMenuActions

```js
// Type
MenuItem[]
```

### method: regionCannotBeRendered

```js
// Type signature
regionCannotBeRendered: () => any
```

### action: setError

```js
// Type signature
setError: (error?: unknown) => void
```

### action: setRpcDriverName

```js
// Type signature
setRpcDriverName: (rpcDriverName: string) => void
```

### action: reload

base display reload does nothing, see specialized displays for details

```js
// Type signature
reload: () => void
```

## LinearAlignmentsDisplay

extends `BaseDisplay`

### property: PileupDisplay

```js
/**
 * !property
 * refers to LinearPileupDisplay sub-display model
 */
PileupDisplay: types.maybe(
  pluginManager.getDisplayType('LinearPileupDisplay').stateModel,
)
```

### property: SNPCoverageDisplay

```js
/**
 * !property
 * refers to LinearSNPCoverageDisplay sub-display model
 */
SNPCoverageDisplay: types.maybe(
  pluginManager.getDisplayType('LinearSNPCoverageDisplay').stateModel,
)
```

### property: snpCovHeight

```js
/**
 * !property
 */
snpCovHeight: 45
```

### property: type

```js
/**
 * !property
 */
type: types.literal('LinearAlignmentsDisplay')
```

### property: configuration

```js
/**
 * !property
 */
configuration: ConfigurationReference(configSchema)
```

### property: height

```js
/**
 * !property
 */
height: 250
```

### property: showCoverage

```js
/**
 * !property
 */
showCoverage: true
```

### property: showPileup

```js
/**
 * !property
 */
showPileup: true
```

### property: userFeatureScreenDensity

```js
/**
 * !property
 */
userFeatureScreenDensity: types.maybe(types.number)
```

### action: toggleCoverage

```js
// Type signature
toggleCoverage: () => void
```

### action: togglePileup

```js
// Type signature
togglePileup: () => void
```

### action: setScrollTop

```js
// Type signature
setScrollTop: (scrollTop: number) => void
```

### action: setSNPCoverageHeight

```js
// Type signature
setSNPCoverageHeight: (n: number) => void
```

### getter: pileupDisplayConfig

```js
// Type
any
```

### method: getFeatureByID

```js
// Type signature
getFeatureByID: (blockKey: string, id: string) => any
```

### method: searchFeatureByID

```js
// Type signature
searchFeatureByID: (id: string) => any
```

### getter: features

```js
// Type
any
```

### getter: DisplayBlurb

```js
// Type
any
```

### getter: sortedBy

```js
// Type
any
```

### getter: sortedByPosition

```js
// Type
any
```

### getter: sortedByRefName

```js
// Type
any
```

### getter: snpCoverageDisplayConfig

```js
// Type
any
```

### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => MenuItem[]
```

### action: setSNPCoverageDisplay

```js
// Type signature
setSNPCoverageDisplay: (displayConfig: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

### action: setUserFeatureScreenDensity

```js
// Type signature
setUserFeatureScreenDensity: (limit: number) => void
```

### action: setPileupDisplay

```js
// Type signature
setPileupDisplay: (displayConfig: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

### action: setHeight

```js
// Type signature
setHeight: (displayHeight: number) => number
```

### action: resizeHeight

```js
// Type signature
resizeHeight: (distance: number) => number
```

### action: renderSvg

```js
// Type signature
renderSvg: (opts: { rasterizeLayers?: boolean; }) => Promise<Element>
```

## BaseLinearDisplay

extends `BaseDisplay`

### property: height

```js
/**
 * !property
 */
height: types.optional(
  types.refinement('displayHeight', types.number, n => n >= minDisplayHeight),
  defaultDisplayHeight,
)
```

### property: blockState

```js
/**
 * !property
 * updated via autorun
 */
blockState: types.map(BlockState)
```

### property: userBpPerPxLimit

```js
/**
 * !property
 */
userBpPerPxLimit: types.maybe(types.number)
```

### property: userByteSizeLimit

```js
/**
 * !property
 */
userByteSizeLimit: types.maybe(types.number)
```

### getter: blockType

```js
// Type
'dynamicBlocks' | 'staticBlocks'
```

### getter: blockDefinitions

```js
// Type
any
```

### getter: renderDelay

how many milliseconds to wait for the display to
"settle" before re-rendering a block

```js
// Type
number
```

### getter: TooltipComponent

```js
// Type
React.FC<any>
```

### getter: selectedFeatureId

returns a string feature ID if the globally-selected object
is probably a feature

```js
// Type
string
```

### getter: DisplayMessageComponent

if a display-level message should be displayed instead of the blocks,
make this return a react component

```js
// Type
any
```

### getter: features

a CompositeMap of `featureId -> feature obj` that
just looks in all the block data for that feature

```js
// Type
CompositeMap<unknown, unknown>
```

### getter: featureUnderMouse

```js
// Type
any
```

### getter: getFeatureOverlapping

```js
// Type
;(blockKey: string, x: number, y: number) => any
```

### getter: getFeatureByID

```js
// Type
;(blockKey: string, id: string) => LayoutRecord
```

### getter: searchFeatureByID

```js
// Type
;(id: string) => LayoutRecord
```

### getter: currentBytesRequested

```js
// Type
number
```

### getter: currentFeatureScreenDensity

```js
// Type
number
```

### property: bpPerPx

```js
view.bpPerPx
```

### getter: maxFeatureScreenDensity

```js
// Type
any
```

### getter: estimatedStatsReady

```js
// Type
boolean
```

### getter: maxAllowableBytes

```js
// Type
number
```

### action: setMessage

```js
// Type signature
setMessage: (message: string) => void
```

### action: estimateRegionsStats

```js
// Type signature
estimateRegionsStats: (regions: Region[], opts: { headers?: Record<string, string>; signal?: AbortSignal; filters?: string[]; }) => Promise<{}>
```

### action: setRegionStatsP

```js
// Type signature
setRegionStatsP: (p?: Promise<Stats>) => void
```

### action: setRegionStats

```js
// Type signature
setRegionStats: (estimatedRegionStats?: Stats) => void
```

### action: clearRegionStats

```js
// Type signature
clearRegionStats: () => void
```

### action: setHeight

```js
// Type signature
setHeight: (displayHeight: number) => number
```

### action: resizeHeight

```js
// Type signature
resizeHeight: (distance: number) => number
```

### action: setScrollTop

```js
// Type signature
setScrollTop: (scrollTop: number) => void
```

### action: updateStatsLimit

```js
// Type signature
updateStatsLimit: (stats: Stats) => void
```

### action: addBlock

```js
// Type signature
addBlock: (key: string, block: BaseBlock) => void
```

### action: setCurrBpPerPx

```js
// Type signature
setCurrBpPerPx: (n: number) => void
```

### action: deleteBlock

```js
// Type signature
deleteBlock: (key: string) => void
```

### action: selectFeature

```js
// Type signature
selectFeature: (feature: Feature) => void
```

### action: clearFeatureSelection

```js
// Type signature
clearFeatureSelection: () => void
```

### action: setFeatureIdUnderMouse

```js
// Type signature
setFeatureIdUnderMouse: (feature: string) => void
```

### action: reload

```js
// Type signature
reload: () => void
```

### action: setContextMenuFeature

```js
// Type signature
setContextMenuFeature: (feature?: Feature) => void
```

### getter: regionTooLarge

region is too large if:

- stats are ready
- region is greater than 20kb (don't warn when zoomed in less than that)
- and bytes is greater than max allowed bytes or density greater than max density

```js
// Type
boolean
```

### getter: dynamicBlocks

dynamic blocks represent the exact coordinates of the currently
visible genome regions on the screen. they are similar to static
blocks, but statcic blocks can go offscreen while dynamic blocks
represent exactly what is on screen

```js
// Type
BlockSet
```

### getter: regionTooLargeReason

only shows a message of bytes requested is defined, the feature density
based stats don't produce any helpful message besides to zoom in

```js
// Type
string
```

### action: setError

```js
// Type signature
setError: (error?: unknown) => void
```

### getter: staticBlocks

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

### method: regionCannotBeRenderedText

```js
// Type signature
regionCannotBeRenderedText: (_region: Region) =>
  '' | 'Force load to see features'
```

### method: regionCannotBeRendered

```js
// Type signature
regionCannotBeRendered: (_region: Region) => Element
```

### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => MenuItem[]
```

### method: contextMenuItems

```js
// Type signature
contextMenuItems: () => { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; }[]
```

### method: renderProps

```js
// Type signature
renderProps: () => any
```

### property: rpcDriverName

```js
self.rpcDriverName
```

### method: renderSvg

```js
// Type signature
renderSvg: (opts: ExportSvgOptions & { overrideHeight: number; }) => Promise<Element>
```

## LinearPileupDisplay

### property: type

```js
/**
 * !property
 */
type: types.literal('LinearPileupDisplay')
```

### property: configuration

```js
/**
 * !property
 */
configuration: ConfigurationReference(configSchema)
```

### property: showSoftClipping

```js
/**
 * !property
 */
showSoftClipping: false
```

### property: featureHeight

```js
/**
 * !property
 */
featureHeight: types.maybe(types.number)
```

### property: noSpacing

```js
/**
 * !property
 */
noSpacing: types.maybe(types.boolean)
```

### property: fadeLikelihood

```js
/**
 * !property
 */
fadeLikelihood: types.maybe(types.boolean)
```

### property: trackMaxHeight

```js
/**
 * !property
 */
trackMaxHeight: types.maybe(types.number)
```

### property: mismatchAlpha

```js
/**
 * !property
 */
mismatchAlpha: types.maybe(types.boolean)
```

### property: sortedBy

```js
/**
 * !property
 */
sortedBy: types.maybe(
  types.model({
    type: types.string,
    pos: types.number,
    tag: types.maybe(types.string),
    refName: types.string,
    assemblyName: types.string,
  }),
)
```

### property: colorBy

```js
/**
 * !property
 */
colorBy: types.maybe(
  types.model({
    type: types.string,
    tag: types.maybe(types.string),
    extra: types.frozen(),
  }),
)
```

### action: setReady

```js
// Type signature
setReady: (flag: boolean) => void
```

### action: setMaxHeight

```js
// Type signature
setMaxHeight: (n: number) => void
```

### action: setFeatureHeight

```js
// Type signature
setFeatureHeight: (n: number) => void
```

### action: setNoSpacing

```js
// Type signature
setNoSpacing: (flag: boolean) => void
```

### action: setColorScheme

```js
// Type signature
setColorScheme: (colorScheme: { type: string; tag?: string; }) => void
```

### action: updateModificationColorMap

```js
// Type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
```

### action: updateColorTagMap

```js
// Type signature
updateColorTagMap: (uniqueTag: string[]) => void
```

### action: setFeatureUnderMouse

```js
// Type signature
setFeatureUnderMouse: (feat?: Feature) => void
```

### getter: estimatedStatsReady

```js
// Type
boolean
```

### getter: regionTooLarge

region is too large if:

- stats are ready
- region is greater than 20kb (don't warn when zoomed in less than that)
- and bytes is greater than max allowed bytes or density greater than max density

```js
// Type
boolean
```

### getter: rendererType

the pluggable element type object for this display's
renderer

```js
// Type
RendererType
```

### property: id

```js
view.id
```

### method: renderProps

the react props that are passed to the Renderer when data
is rendered in this display

```js
// Type signature
renderProps: any
```

### action: setCurrBpPerPx

```js
// Type signature
setCurrBpPerPx: (n: number) => void
```

### action: setError

```js
// Type signature
setError: (error?: unknown) => void
```

### getter: featureUnderMouse

```js
// Type
any
```

### action: selectFeature

```js
// Type signature
selectFeature: (feature: Feature) => void
```

### action: clearSelected

```js
// Type signature
clearSelected: () => void
```

### action: copyFeatureToClipboard

uses copy-to-clipboard and generates notification

```js
// Type signature
copyFeatureToClipboard: (feature: Feature) => void
```

### action: toggleSoftClipping

```js
// Type signature
toggleSoftClipping: () => void
```

### action: toggleMismatchAlpha

```js
// Type signature
toggleMismatchAlpha: () => void
```

### action: setConfig

```js
// Type signature
setConfig: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

### action: setSortedBy

```js
// Type signature
setSortedBy: (type: string, tag?: string) => void
```

### action: reload

base display reload does nothing, see specialized displays for details

```js
// Type signature
reload: any
```

### getter: maxHeight

```js
// Type
any
```

### getter: rendererConfig

```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

### getter: featureHeightSetting

```js
// Type
any
```

### getter: mismatchAlphaSetting

```js
// Type
any
```

### getter: rendererTypeName

```js
// Type
string
```

### method: contextMenuItems

```js
// Type signature
contextMenuItems: () => { label: string; icon: any; onClick: () => void; }[]
```

### action: clearFeatureSelection

```js
// Type signature
clearFeatureSelection: () => void
```

### getter: DisplayBlurb

```js
// Type
any
```

### property: bpPerPx

```js
view.bpPerPx
```

### action: setContextMenuFeature

```js
// Type signature
setContextMenuFeature: (feature?: Feature) => void
```

### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => any[]
```

### getter: dynamicBlocks

dynamic blocks represent the exact coordinates of the currently
visible genome regions on the screen. they are similar to static
blocks, but statcic blocks can go offscreen while dynamic blocks
represent exactly what is on screen

```js
// Type
BlockSet
```

## LinearSNPCoverageDisplay

extends `LinearWiggleDisplay`

### property: type

```js
/**
 * !property
 */
type: types.literal('LinearSNPCoverageDisplay')
```

### property: drawInterbaseCounts

```js
/**
 * !property
 */
drawInterbaseCounts: types.maybe(types.boolean)
```

### property: drawIndicators

```js
/**
 * !property
 */
drawIndicators: types.maybe(types.boolean)
```

### property: drawArcs

```js
/**
 * !property
 */
drawArcs: types.maybe(types.boolean)
```

### property: filterBy

```js
/**
 * !property
 */
filterBy: types.optional(
  types.model({
    flagInclude: types.optional(types.number, 0),
    flagExclude: types.optional(types.number, 1540),
    readName: types.maybe(types.string),
    tagFilter: types.maybe(
      types.model({ tag: types.string, value: types.string }),
    ),
  }),
  {},
)
```

### property: colorBy

```js
/**
 * !property
 */
colorBy: types.maybe(
  types.model({
    type: types.string,
    tag: types.maybe(types.string),
  }),
)
```

### action: setConfig

```js
// Type signature
setConfig: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>) => void
```

### property: configuration

```js
self.configuration
```

### action: setFilterBy

```js
// Type signature
setFilterBy: (filter: { flagInclude: number; flagExclude: number; readName?: string; tagFilter?: { tag: string; value: string; }; }) => void
```

### action: setColorBy

```js
// Type signature
setColorBy: (colorBy?: { type: string; tag?: string; }) => void
```

### action: updateModificationColorMap

```js
// Type signature
updateModificationColorMap: (uniqueModifications: string[]) => void
```

### getter: rendererConfig

```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

### getter: rendererTypeName

```js
// Type
any
```

### getter: rendererType

the pluggable element type object for this display's
renderer

```js
// Type
RendererType
```

### getter: drawArcsSetting

```js
// Type
any
```

### getter: drawInterbaseCountsSetting

```js
// Type
any
```

### getter: drawIndicatorsSetting

```js
// Type
any
```

### getter: modificationsReady

```js
// Type
boolean
```

### method: renderProps

```js
// Type signature
renderProps: () => any
```

### action: toggleDrawIndicators

```js
// Type signature
toggleDrawIndicators: () => void
```

### action: toggleDrawInterbaseCounts

```js
// Type signature
toggleDrawInterbaseCounts: () => void
```

### action: toggleDrawArcs

```js
// Type signature
toggleDrawArcs: () => void
```

### getter: estimatedStatsReady

```js
// Type
boolean
```

### getter: regionTooLarge

region is too large if:

- stats are ready
- region is greater than 20kb (don't warn when zoomed in less than that)
- and bytes is greater than max allowed bytes or density greater than max density

```js
// Type
boolean
```

### getter: parentTrack

```js
// Type
any
```

### action: setError

```js
// Type signature
setError: (error?: unknown) => void
```

### getter: TooltipComponent

```js
// Type
any
```

### getter: adapterConfig

```js
// Type
{
  type: string
  subadapter: any
}
```

### getter: needsScalebar

```js
// Type
boolean
```

### method: contextMenuItems

```js
// Type signature
contextMenuItems: () => any[]
```

### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => any[]
```

## LinearWiggleDisplay

Extends `BaseLinearDisplay`

### property: type

```js
/**
 * !property
 */
type: types.literal('LinearWiggleDisplay')
```

### property: configuration

```js
/**
 * !property
 */
configuration: ConfigurationReference(configSchema)
```

### property: selectedRendering

```js
/**
 * !property
 */
selectedRendering: types.optional(types.string, '')
```

### property: resolution

```js
/**
 * !property
 */
resolution: types.optional(types.number, 1)
```

### property: fill

```js
/**
 * !property
 */
fill: types.maybe(types.boolean)
```

### property: minSize

```js
/**
 * !property
 */
minSize: types.maybe(types.number)
```

### property: color

```js
/**
 * !property
 */
color: types.maybe(types.string)
```

### property: posColor

```js
/**
 * !property
 */
posColor: types.maybe(types.string)
```

### property: negColor

```js
/**
 * !property
 */
negColor: types.maybe(types.string)
```

### property: summaryScoreMode

```js
/**
 * !property
 */
summaryScoreMode: types.maybe(types.string)
```

### property: rendererTypeNameState

```js
/**
 * !property
 */
rendererTypeNameState: types.maybe(types.string)
```

### property: scale

```js
/**
 * !property
 */
scale: types.maybe(types.string)
```

### property: autoscale

```js
/**
 * !property
 */
autoscale: types.maybe(types.string)
```

### property: displayCrossHatches

```js
/**
 * !property
 */
displayCrossHatches: types.maybe(types.boolean)
```

### property: constraints

```js
/**
 * !property
 */
constraints: types.optional(
  types.model({
    max: types.maybe(types.number),
    min: types.maybe(types.number),
  }),
  {},
)
```

### action: updateStats

```js
// Type signature
updateStats: (stats: { scoreMin: number; scoreMax: number; }) => void
```

### action: setColor

```js
// Type signature
setColor: (color?: string) => void
```

### action: setPosColor

```js
// Type signature
setPosColor: (color?: string) => void
```

### action: setNegColor

```js
// Type signature
setNegColor: (color?: string) => void
```

### action: setLoading

```js
// Type signature
setLoading: (aborter: AbortController) => void
```

### action: setResolution

```js
// Type signature
setResolution: (res: number) => void
```

### action: setFill

```js
// Type signature
setFill: (fill: number) => void
```

### action: toggleLogScale

```js
// Type signature
toggleLogScale: () => void
```

### action: setScaleType

```js
// Type signature
setScaleType: (scale?: string) => void
```

### action: setSummaryScoreMode

```js
// Type signature
setSummaryScoreMode: (val: string) => void
```

### action: setAutoscale

```js
// Type signature
setAutoscale: (val: string) => void
```

### action: setMaxScore

```js
// Type signature
setMaxScore: (val?: number) => void
```

### action: setRendererType

```js
// Type signature
setRendererType: (val: string) => void
```

### action: setMinScore

```js
// Type signature
setMinScore: (val?: number) => void
```

### action: toggleCrossHatches

```js
// Type signature
toggleCrossHatches: () => void
```

### action: setCrossHatches

```js
// Type signature
setCrossHatches: (cross: boolean) => void
```

### getter: TooltipComponent

```js
// Type
React.FC
```

### getter: adapterTypeName

```js
// Type
any
```

### getter: adapterConfig

```js
// Type
any
```

### getter: rendererTypeNameSimple

```js
// Type
any
```

### getter: rendererTypeName

```js
// Type
string
```

### getter: scaleType

```js
// Type
any
```

### getter: maxScore

```js
// Type
any
```

### getter: minScore

```js
// Type
any
```

### getter: rendererConfig

```js
// Type
{ [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>
```

### getter: rendererType

the pluggable element type object for this display's
renderer

```js
// Type
RendererType
```

### getter: filled

```js
// Type
any
```

### getter: summaryScoreModeSetting

```js
// Type
any
```

### getter: domain

```js
// Type
number[]
```

### getter: needsScalebar

```js
// Type
boolean
```

### getter: scaleOpts

```js
// Type
{
  domain: any
  stats: {
    scoreMin: number
    scoreMax: number
  }
  autoscaleType: any
  scaleType: any
  inverted: any
}
```

### getter: canHaveFill

```js
// Type
boolean
```

### getter: autoscaleType

```js
// Type
any
```

### getter: displayCrossHatchesSetting

```js
// Type
any
```

### getter: ticks

```js
// Type
{ range: number[]; values: number[]; format: (d: NumberValue) => string; position: ScaleLinear<number, number, never> | ScaleQuantize<number, never>; }
```

### getter: adapterCapabilities

```js
// Type
string[]
```

### method: renderProps

```js
// Type signature
renderProps: () => any
```

### property: rpcDriverName

```js
self.rpcDriverName
```

### getter: hasResolution

```js
// Type
boolean
```

### getter: hasGlobalStats

```js
// Type
boolean
```

### getter: fillSetting

```js
// Type
;2 | 0 | 1
```

### method: trackMenuItems

```js
// Type signature
trackMenuItems: () => any[]
```

### action: reload

re-runs stats and refresh whole display on reload

```js
// Type signature
reload: () => Promise<void>
```

### action: setError

```js
// Type signature
setError: (error?: unknown) => void
```

### action: renderSvg

```js
// Type signature
renderSvg: (opts: ExportSvgOptions & { overrideHeight: number; }) => Promise<Element>
```

### method: regionCannotBeRenderedText

```js
// Type signature
regionCannotBeRenderedText: (_region: Region) =>
  '' | 'Force load to see features'
```

## CircularView

extends `BaseViewModel`

### property: type

```js
/**
 * !property
 */
type: types.literal('CircularView')
```

### property: offsetRadians

```js
/**
 * !property
 * similar to offsetPx in linear genome view
 */
offsetRadians: -Math.PI / 2
```

### property: bpPerPx

```js
/**
 * !property
 */
bpPerPx: 2000000
```

### property: tracks

```js
/**
 * !property
 */
tracks: types.array(pluginManager.pluggableMstType('track', 'stateModel'))
```

### property: hideVerticalResizeHandle

```js
/**
 * !property
 */
hideVerticalResizeHandle: false
```

### property: hideTrackSelectorButton

```js
/**
 * !property
 */
hideTrackSelectorButton: false
```

### property: lockedFitToWindow

```js
/**
 * !property
 */
lockedFitToWindow: true
```

### property: disableImportForm

```js
/**
 * !property
 */
disableImportForm: false
```

### property: height

```js
/**
 * !property
 */
height: types.optional(
  types.refinement('trackHeight', types.number, n => n >= minHeight),
  defaultHeight,
)
```

### property: displayedRegions

```js
/**
 * !property
 */
displayedRegions: types.array(Region)
```

### property: scrollX

```js
/**
 * !property
 */
scrollX: 0
```

### property: scrollY

```js
/**
 * !property
 */
scrollY: 0
```

### getter: staticSlices

```js
// Type
any[]
```

### getter: visibleSection

```js
// Type
{
  rho: [number, number]
  theta: [number, number]
}
```

### getter: circumferencePx

```js
// Type
number
```

### getter: radiusPx

```js
// Type
number
```

### getter: bpPerRadian

```js
// Type
number
```

### getter: pxPerRadian

```js
// Type
any
```

### getter: centerXY

```js
// Type
;[number, number]
```

### getter: totalBp

```js
// Type
number
```

### getter: maximumRadiusPx

```js
// Type
number
```

### getter: maxBpPerPx

```js
// Type
number
```

### getter: minBpPerPx

```js
// Type
number
```

### getter: atMaxBpPerPx

```js
// Type
boolean
```

### getter: atMinBpPerPx

```js
// Type
boolean
```

### getter: tooSmallToLock

```js
// Type
boolean
```

### getter: figureDimensions

```js
// Type
;[number, number]
```

### getter: figureWidth

```js
// Type
any
```

### getter: figureHeight

```js
// Type
any
```

### getter: elidedRegions

this is displayedRegions, post-processed to
elide regions that are too small to see reasonably

```js
// Type
any[]
```

### getter: assemblyNames

```js
// Type
string[]
```

### getter: initialized

```js
// Type
any
```

### getter: visibleStaticSlices

```js
// Type
any[]
```

### action: setWidth

```js
// Type signature
setWidth: (newWidth: number) => number
```

### action: setHeight

```js
// Type signature
setHeight: (newHeight: number) => number
```

### action: resizeHeight

```js
// Type signature
resizeHeight: (distance: number) => number
```

### action: resizeWidth

```js
// Type signature
resizeWidth: (distance: number) => number
```

### action: rotateClockwiseButton

```js
// Type signature
rotateClockwiseButton: () => void
```

### action: rotateCounterClockwiseButton

```js
// Type signature
rotateCounterClockwiseButton: () => void
```

### action: rotateClockwise

```js
// Type signature
rotateClockwise: (distance?: number) => void
```

### action: rotateCounterClockwise

```js
// Type signature
rotateCounterClockwise: (distance?: number) => void
```

### action: zoomInButton

```js
// Type signature
zoomInButton: () => void
```

### action: zoomOutButton

```js
// Type signature
zoomOutButton: () => void
```

### action: setBpPerPx

```js
// Type signature
setBpPerPx: (newVal: number) => void
```

### action: setModelViewWhenAdjust

```js
// Type signature
setModelViewWhenAdjust: (secondCondition: boolean) => void
```

### action: closeView

```js
// Type signature
closeView: () => void
```

### action: setDisplayedRegions

```js
// Type signature
setDisplayedRegions: (regions: SnapshotOrInstance<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>[]) => void
```

### action: activateTrackSelector

```js
// Type signature
activateTrackSelector: () => Widget
```

### action: toggleTrack

```js
// Type signature
toggleTrack: (trackId: string) => void
```

### action: setError

```js
// Type signature
setError: (error: unknown) => void
```

### action: showTrack

```js
// Type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
```

### action: addTrackConf

```js
// Type signature
addTrackConf: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>, initialSnapshot?: {}) => void
```

### action: hideTrack

```js
// Type signature
hideTrack: (trackId: string) => number
```

### action: toggleFitToWindowLock

```js
// Type signature
toggleFitToWindowLock: () => boolean
```

## BaseChordDisplay

extends `BaseDisplay`

### property: bezierRadiusRatio

```js
/**
 * !property
 */
bezierRadiusRatio: 0.1
```

### property: assemblyName

```js
/**
 * !property
 */
assemblyName: types.maybe(types.string)
```

### action: onChordClick

```js
// Type signature
onChordClick: (feature: Feature) => void
```

### getter: blockDefinitions

```js
// Type
any
```

### getter: staticSlices

```js
// Type
any[]
```

### method: renderProps

```js
// Type signature
renderProps: () => any
```

### property: rpcDriverName

```js
self.rpcDriverName
```

### getter: radiusPx

```js
// Type
number
```

### getter: rendererType

the pluggable element type object for this diplay's
renderer

```js
// Type
RendererType
```

### method: isCompatibleWithRenderer

```js
// Type signature
isCompatibleWithRenderer: (renderer: RendererType) => boolean
```

### getter: selectedFeatureId

returns a string feature ID if the globally-selected object
is probably a feature

```js
// Type
string
```

### action: renderStarted

```js
// Type signature
renderStarted: () => void
```

### action: renderSuccess

```js
// Type signature
renderSuccess: ({ message, data, reactElement, renderingComponent, }: { message: string; data: any; reactElement: React.ReactElement; renderingComponent: React.ComponentType<any>; }) => void
```

### action: renderError

```js
// Type signature
renderError: (error: unknown) => void
```

### action: setRefNameMap

```js
// Type signature
setRefNameMap: (refNameMap: Record<string, string>) => void
```

### property: type

```js
self.type
```

### property: id

```js
self.id
```

### getter: parentTrack

```js
// Type
any
```

### action: setError

```js
// Type signature
setError: (error?: unknown) => void
```

### property: configuration

```js
/**
 * !property
 */
configuration: ConfigurationReference(configSchema)
```

### action: selectFeature

```js
// Type signature
selectFeature: (feature: Feature) => Promise<void>
```

### getter: initialized

```js
// Type
any
```

### action: setDisplayedRegions

```js
// Type signature
setDisplayedRegions: (regions: SnapshotOrInstance<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>[]) => void
```

### action: showTrack

```js
// Type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
```

## ChordVariantDisplay

extends `BaseChordDisplay`

### property: type

```js
/**
 * !property
 */
type: types.literal('ChordVariantDisplay')
```

### property: configuration

```js
/**
 * !property
 */
configuration: ConfigurationReference(configSchema)
```

### getter: rendererTypeName

```js
// Type
any
```

### method: renderProps

```js
// Type signature
renderProps: () => Record<string, unknown>
```

### property: rpcDriverName

```js
self.rpcDriverName
```

### property: bezierRadiusRatio

```js
self.bezierRadiusRatio
```

### action: onChordClick

```js
// Type signature
onChordClick: (feature: Feature) => void
```
