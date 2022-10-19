---
id: lineargenomeview
title: LinearGenomeView
toplevel: true
---

#### property: id

```js
id: ElementId
```

#### property: type

```js
type: types.literal('LinearGenomeView')
```

#### property: offsetPx

bpPerPx corresponds roughly to the horizontal scroll of the LGV

```js
offsetPx: 0
```

#### property: bpPerPx

bpPerPx corresponds roughly to the zoom level, base-pairs per pixel

```js
bpPerPx: 1
```

#### property: displayedRegions

currently displayed region, can be a single chromosome, arbitrary subsections,
or the entire set of chromosomes in the genome, but it not advised to use the
entire set of chromosomes if your assembly is very fragmented

```js
displayedRegions: types.array(MUIRegion)
```

#### property: tracks

array of currently displayed tracks state models instances

```js
tracks: types.array(pluginManager.pluggableMstType('track', 'stateModel'))
```

#### property: hideHeader

array of currently displayed tracks state model's

```js
hideHeader: false
```

#### property: hideHeaderOverview

```js
hideHeaderOverview: false
```

#### property: hideNoTracksActive

```js
hideNoTracksActive: false
```

#### property: trackSelectorType

```js
trackSelectorType: types.optional(
  types.enumeration(['hierarchical']),
  'hierarchical',
)
```

#### property: trackLabels

how to display the track labels, can be "overlapping", "offset", or "hidden"

```js
trackLabels: types.optional(
  types.string,
  () => localStorageGetItem('lgv-trackLabels') || 'overlapping',
)
```

#### property: showCenterLine

show the "center line"

```js
showCenterLine: types.optional(types.boolean, () => {
  const setting = localStorageGetItem('lgv-showCenterLine')
  return setting !== undefined && setting !== null ? !!+setting : false
})
```

#### property: showCytobandsSetting

show the "cytobands" in the overview scale bar

```js
showCytobandsSetting: types.optional(types.boolean, () => {
  const setting = localStorageGetItem('lgv-showCytobands')
  return setting !== undefined && setting !== null ? !!+setting : true
})
```

#### property: showGridlines

show the "gridlines" in the track area

```js
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
