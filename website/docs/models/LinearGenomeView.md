---
id: lineargenomeview
title: LinearGenomeView
toplevel: true
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

## Source file

[plugins/linear-genome-view/src/LinearGenomeView/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/LinearGenomeView/model.ts)

## Docs

### LinearGenomeView - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

this is a string instead of the const literal 'LinearGenomeView' to reduce some
typescripting strictness, but you should pass the string 'LinearGenomeView' to
the model explicitly

```js
// type signature
string
// code
type: types.literal('LinearGenomeView') as unknown as string
```

#### property: offsetPx

corresponds roughly to the horizontal scroll of the LGV

```js
// type signature
number
// code
offsetPx: 0
```

#### property: bpPerPx

corresponds roughly to the zoom level, base-pairs per pixel

```js
// type signature
number
// code
bpPerPx: 1
```

#### property: displayedRegions

currently displayed regions, can be a single chromosome, arbitrary subsections,
or the entire set of chromosomes in the genome, but it not advised to use the
entire set of chromosomes if your assembly is very fragmented

```js
// type signature
IArrayType<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>
// code
displayedRegions: types.array(MUIRegion)
```

#### property: tracks

array of currently displayed tracks state models instances

```js
// type signature
IArrayType<IAnyType>
// code
tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        )
```

#### property: hideHeader

array of currently displayed tracks state model's

```js
// type signature
false
// code
hideHeader: false
```

#### property: hideHeaderOverview

```js
// type signature
false
// code
hideHeaderOverview: false
```

#### property: hideNoTracksActive

```js
// type signature
false
// code
hideNoTracksActive: false
```

#### property: trackSelectorType

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackSelectorType: types.optional(
          types.enumeration(['hierarchical']),
          'hierarchical',
        )
```

#### property: trackLabels

how to display the track labels, can be "overlapping", "offset", or "hidden"

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackLabels: types.optional(
          types.string,
          () => localStorageGetItem('lgv-trackLabels') || 'overlapping',
        )
```

#### property: showCenterLine

show the "center line"

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showCenterLine: types.optional(types.boolean, () =>
          Boolean(
            JSON.parse(localStorageGetItem('lgv-showCenterLine') || 'false'),
          ),
        )
```

#### property: showCytobandsSetting

show the "cytobands" in the overview scale bar

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showCytobandsSetting: types.optional(types.boolean, () =>
          Boolean(
            JSON.parse(localStorageGetItem('lgv-showCytobands') || 'true'),
          ),
        )
```

#### property: showGridlines

show the "gridlines" in the track area

```js
// type signature
true
// code
showGridlines: true
```

### LinearGenomeView - Getters

#### getter: width

```js
// type
number
```

#### getter: interRegionPaddingWidth

```js
// type
number
```

#### getter: assemblyNames

```js
// type
any[]
```

#### getter: assemblyErrors

```js
// type
string
```

#### getter: assembliesInitialized

```js
// type
boolean
```

#### getter: initialized

```js
// type
any
```

#### getter: hasDisplayedRegions

```js
// type
boolean
```

#### getter: scaleBarHeight

```js
// type
number
```

#### getter: headerHeight

```js
// type
number
```

#### getter: trackHeights

```js
// type
number
```

#### getter: trackHeightsWithResizeHandles

```js
// type
any
```

#### getter: height

```js
// type
any
```

#### getter: totalBp

```js
// type
number
```

#### getter: maxBpPerPx

```js
// type
number
```

#### getter: minBpPerPx

```js
// type
number
```

#### getter: error

```js
// type
any
```

#### getter: maxOffset

```js
// type
number
```

#### getter: minOffset

```js
// type
number
```

#### getter: displayedRegionsTotalPx

```js
// type
number
```

#### getter: trackTypeActions

```js
// type
Map<string, MenuItem[]>
```

#### getter: canShowCytobands

```js
// type
any
```

#### getter: showCytobands

```js
// type
boolean
```

#### getter: anyCytobandsExist

```js
// type
boolean
```

#### getter: cytobandOffset

the cytoband is displayed to the right of the chromosome name, and that offset
is calculated manually with this method

```js
// type
number
```

#### getter: staticBlocks

static blocks are an important concept jbrowse uses to avoid re-rendering when
you scroll to the side. when you horizontally scroll to the right, old blocks to
the left may be removed, and new blocks may be instantiated on the right. tracks
may use the static blocks to render their data for the region represented by the
block

```js
// type
BlockSet
```

#### getter: dynamicBlocks

dynamic blocks represent the exact coordinates of the currently visible genome
regions on the screen. they are similar to static blocks, but static blocks can
go offscreen while dynamic blocks represent exactly what is on screen

```js
// type
BlockSet
```

#### getter: roundedDynamicBlocks

rounded dynamic blocks are dynamic blocks without fractions of bp

```js
// type
any
```

#### getter: visibleLocStrings

a single "combo-locstring" representing all the regions visible on the screen

```js
// type
string
```

#### getter: coarseVisibleLocStrings

same as visibleLocStrings, but only updated every 300ms

```js
// type
string
```

#### getter: centerLineInfo

```js
// type
any
```

### LinearGenomeView - Methods

#### method: MiniControlsComponent

```js
// type signature
MiniControlsComponent: () => React.FC<any>
```

#### method: HeaderComponent

```js
// type signature
HeaderComponent: () => React.FC<any>
```

#### method: renderProps

```js
// type signature
renderProps: () => any
```

#### method: searchScope

```js
// type signature
searchScope: (assemblyName: string) => { assemblyName: string; includeAggregateIndexes: boolean; tracks: IMSTArray<IAnyType> & IStateTreeNode<IArrayType<IAnyType>>; }
```

#### method: getTrack

```js
// type signature
getTrack: (id: string) => any
```

#### method: rankSearchResults

```js
// type signature
rankSearchResults: (results: BaseResult[]) => BaseResult[]
```

#### method: rewriteOnClicks

modifies view menu action onClick to apply to all tracks of same type

```js
// type signature
rewriteOnClicks: (trackType: string, viewMenuActions: MenuItem[]) => void
```

#### method: getSelectedRegions

Helper method for the fetchSequence. Retrieves the corresponding regions that
were selected by the rubberband

```js
// type signature
getSelectedRegions: (leftOffset?: BpOffset, rightOffset?: BpOffset) => { start: number; end: number; regionNumber?: number; reversed?: boolean; refName: string; assemblyName: string; key: string; offsetPx: number; widthPx: number; variant?: string; isLeftEndOfDisplayedRegion?: boolean; }[]
```

#### method: exportSvg

creates an svg export and save using FileSaver

```js
// type signature
exportSvg: (opts?: ExportSvgOptions) => Promise<void>
```

#### method: menuItems

return the view menu items

```js
// type signature
menuItems: () => MenuItem[]
```

#### method: rubberBandMenuItems

```js
// type signature
rubberBandMenuItems: () => MenuItem[]
```

#### method: bpToPx

```js
// type signature
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

scrolls the view to center on the given bp. if that is not in any of the
displayed regions, does nothing

```js
// type signature
centerAt: (coord: number, refName: string, regionNumber: number) => void
```

#### method: pxToBp

```js
// type signature
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

### LinearGenomeView - Actions

#### action: setShowCytobands

```js
// type signature
setShowCytobands: (flag: boolean) => void
```

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => void
```

#### action: setError

```js
// type signature
setError: (error: Error) => void
```

#### action: toggleHeader

```js
// type signature
toggleHeader: () => void
```

#### action: toggleHeaderOverview

```js
// type signature
toggleHeaderOverview: () => void
```

#### action: toggleNoTracksActive

```js
// type signature
toggleNoTracksActive: () => void
```

#### action: toggleShowGridlines

```js
// type signature
toggleShowGridlines: () => void
```

#### action: scrollTo

```js
// type signature
scrollTo: (offsetPx: number) => number
```

#### action: zoomTo

```js
// type signature
zoomTo: (bpPerPx: number, offset?: number, centerAtOffset?: boolean) => number
```

#### action: setOffsets

sets offsets of rubberband, used in the get sequence dialog can call
view.getSelectedRegions(view.leftOffset,view.rightOffset) to compute the
selected regions from the offsets

```js
// type signature
setOffsets: (left?: BpOffset, right?: BpOffset) => void
```

#### action: setSearchResults

```js
// type signature
setSearchResults: (searchResults: BaseResult[], searchQuery: string, assemblyName?: string) => void
```

#### action: setNewView

```js
// type signature
setNewView: (bpPerPx: number, offsetPx: number) => void
```

#### action: horizontallyFlip

```js
// type signature
horizontallyFlip: () => void
```

#### action: showTrack

```js
// type signature
showTrack: (
  trackId: string,
  initialSnapshot?: {},
  displayInitialSnapshot?: {},
) => any
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string) => number
```

#### action: moveTrack

```js
// type signature
moveTrack: (movingId: string, targetId: string) => void
```

#### action: closeView

```js
// type signature
closeView: () => void
```

#### action: toggleTrack

```js
// type signature
toggleTrack: (trackId: string) => void
```

#### action: setTrackLabels

```js
// type signature
setTrackLabels: (setting: "offset" | "hidden" | "overlapping") => void
```

#### action: toggleCenterLine

```js
// type signature
toggleCenterLine: () => void
```

#### action: setDisplayedRegions

```js
// type signature
setDisplayedRegions: (regions: Region[]) => void
```

#### action: activateTrackSelector

```js
// type signature
activateTrackSelector: () => Widget
```

#### action: afterDisplayedRegionsSet

schedule something to be run after the next time displayedRegions is set

```js
// type signature
afterDisplayedRegionsSet: (cb: Function) => void
```

#### action: horizontalScroll

```js
// type signature
horizontalScroll: (distance: number) => number
```

#### action: center

```js
// type signature
center: () => void
```

#### action: showAllRegions

```js
// type signature
showAllRegions: () => void
```

#### action: showAllRegionsInAssembly

```js
// type signature
showAllRegionsInAssembly: (assemblyName?: string) => void
```

#### action: setDraggingTrackId

```js
// type signature
setDraggingTrackId: (idx?: string) => void
```

#### action: setScaleFactor

```js
// type signature
setScaleFactor: (factor: number) => void
```

#### action: clearView

this "clears the view" and makes the view return to the import form

```js
// type signature
clearView: () => void
```

#### action: slide

perform animated slide

```js
// type signature
slide: (viewWidths: number) => void
```

#### action: zoom

perform animated zoom

```js
// type signature
zoom: (targetBpPerPx: number) => void
```

#### action: setCoarseDynamicBlocks

```js
// type signature
setCoarseDynamicBlocks: (blocks: BlockSet) => void
```

#### action: moveTo

offset is the base-pair-offset in the displayed region, index is the index of
the displayed region in the linear genome view

```js
// type signature
moveTo: (start?: BpOffset, end?: BpOffset) => void
```

#### action: navToLocString

Navigate to the given locstring, will change displayed regions if needed, and
wait for assemblies to be initialized

```js
// type signature
navToLocString: (input: string, optAssemblyName?: string) => Promise<any>
```

#### action: navToLocations

Similar to `navToLocString`, but accepts parsed location objects instead of
strings. Will try to perform `setDisplayedRegions` if changing regions

```js
// type signature
navToLocations: (parsedLocStrings: ParsedLocString[], assemblyName?: string) => Promise<void>
```

#### action: navTo

Navigate to a location based on its refName and optionally start, end, and
assemblyName. Will not try to change displayed regions, use `navToLocations`
instead. Only navigates to a location if it is entirely within a
displayedRegion. Navigates to the first matching location encountered.

Throws an error if navigation was unsuccessful

```js
// type signature
navTo: (query: NavLocation) => void
```

#### action: navToMultiple

Navigate to a location based on its refName and optionally start, end, and
assemblyName. Will not try to change displayed regions, use navToLocations
instead. Only navigates to a location if it is entirely within a
displayedRegion. Navigates to the first matching location encountered.

Throws an error if navigation was unsuccessful

```js
// type signature
navToMultiple: (locations: NavLocation[]) => void
```
