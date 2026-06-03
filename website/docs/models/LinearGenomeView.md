---
id: lineargenomeview
title: LinearGenomeView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/LinearGenomeView/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearGenomeView.md)

## Docs

extends

- [BaseViewModel](../baseviewmodel)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** id, displayName, minimized

**Getters:** menuItems

**Actions:** setDisplayName, setWidth, setMinimized

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
IOptionalIType<IType<Region[], Region[], Region[]>, [undefined]>
// code
displayedRegions: types.optional(types.frozen<Region[]>(), [])
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

#### property: showCenterLine

show the "center line"

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showCenterLine: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-showCenterLine', false),
        )
```

#### property: showCytobandsSetting

show the "cytobands" in the overview scale bar

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showCytobandsSetting: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-showCytobands', true),
        )
```

#### property: trackLabels

how to display the track labels, can be "overlapping", "offset", or "hidden", or
empty string "" (which results in conf being used). see LinearGenomeViewPlugin
https://jbrowse.org/jb2/docs/config/lineargenomeviewplugin/ docs for how conf is
used

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackLabels: types.optional(
          types.string,
          () => localStorageGetItem('lgv-trackLabels') ?? '',
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

#### property: highlight

highlights on the LGV from the URL parameters

```js
// type signature
IOptionalIType<IArrayType<IType<HighlightType, HighlightType, HighlightType>>, [undefined]>
// code
highlight: types.optional(
          types.array(types.frozen<HighlightType>()),
          [],
        )
```

#### property: highlightsVisible

controls whether view.highlight entries are rendered

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
highlightsVisible: types.optional(types.boolean, true)
```

#### property: labelsVisible

controls whether highlight/bookmark chip labels are shown inline

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
labelsVisible: types.optional(types.boolean, true)
```

#### property: colorByCDS

color by CDS

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
colorByCDS: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-colorByCDS', false),
        )
```

#### property: showTrackOutlines

show the track outlines

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showTrackOutlines: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-showTrackOutlines', true),
        )
```

#### property: scrollZoom

enable scroll-to-zoom on WebGL tracks

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
scrollZoom: types.optional(types.boolean, () =>
          localStorageGetBoolean('lgv-scrollZoom', false),
        )
```

#### property: scalebarOnly

when true, only the header and coordinate scalebar are rendered

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
scalebarOnly: types.optional(types.boolean, false)
```

#### property: init

transient declarative launch spec: assembly + optional location, tracks, and
highlights to apply once the view attaches. It is applied by the afterAttach
autorun and then cleared (setInit(undefined)), so a saved session never retains
it. Shared by all three launch surfaces — URL params, createViewState(), and
session/config JSON. example:

```json
{
  "assembly": "hg19",
  "loc": "chr1:1,000,000-2,000,000",
  "tracks": ["genes", "variants"]
}
```

```js
// type signature
IType<InitState | undefined, InitState | undefined, InitState | undefined>
// code
init: types.frozen<InitState | undefined>()
```

### LinearGenomeView - Volatiles

#### volatile: volatileWidth

```js
// type signature
number | undefined
// code
volatileWidth: undefined as number | undefined
```

#### volatile: minimumBlockWidth

```js
// type signature
number
// code
minimumBlockWidth: 3
```

#### volatile: draggingTrackId

```js
// type signature
string | undefined
// code
draggingTrackId: undefined as undefined | string
```

#### volatile: lastTrackDragY

```js
// type signature
number | undefined
// code
lastTrackDragY: undefined as undefined | number
```

#### volatile: volatileError

```js
// type signature
unknown
// code
volatileError
```

#### volatile: trackRefs

```js
// type signature
;(Record < string,
  HTMLDivElement >
    // code
    trackRefs)
```

#### volatile: coarseDynamicBlocks

```js
// type signature
ContentBlock[]
// code
coarseDynamicBlocks: [] as ContentBlock[]
```

#### volatile: coarseTotalBp

```js
// type signature
number
// code
coarseTotalBp: 0
```

#### volatile: coarseBpPerPx

```js
// type signature
number
// code
coarseBpPerPx: self.bpPerPx
```

#### volatile: leftOffset

```js
// type signature
BpOffset | undefined
// code
leftOffset: undefined as undefined | BpOffset
```

#### volatile: rightOffset

```js
// type signature
BpOffset | undefined
// code
rightOffset: undefined as undefined | BpOffset
```

#### volatile: isScalebarRefNameMenuOpen

```js
// type signature
false
// code
isScalebarRefNameMenuOpen: false
```

#### volatile: scalebarRefNameClickPending

```js
// type signature
false
// code
scalebarRefNameClickPending: false
```

#### volatile: volatileGuides

temporary vertical guides that can be set by displays (e.g., LD display hover)

```js
// type signature
VolatileGuide[]
// code
volatileGuides: [] as VolatileGuide[]
```

### LinearGenomeView - Getters

#### getter: pinnedTracks

```js
// type
any[]
```

#### getter: unpinnedTracks

```js
// type
any[]
```

#### getter: trackLabelsSetting

this is the effective value of the track labels setting, incorporating both the
config and view state. use this instead of view.trackLabels

```js
// type
any
```

#### getter: width

```js
// type
number
```

#### getter: trackWidthPx

width minus track outline borders (1px each side when shown)

```js
// type
number
```

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: assemblyDisplayNames

```js
// type
string[]
```

#### getter: isTopLevelView

checking if lgv is a 'top-level' view is used for toggling pin track capability,
sticky positioning

```js
// type
boolean
```

#### getter: stickyViewHeaders

only uses sticky view headers when it is a 'top-level' view and session allows
it

```js
// type
boolean
```

#### getter: rubberbandTop

```js
// type
number
```

#### getter: assembliesNotFound

```js
// type
string | undefined
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
boolean
```

#### getter: hasDisplayedRegions

```js
// type
boolean
```

#### getter: loadingMessage

```js
// type
'Loading' | undefined
```

#### getter: hasSomethingToShow

```js
// type
boolean
```

#### getter: showLoading

Whether to show a loading indicator instead of the import form or view

```js
// type
boolean
```

#### getter: showImportForm

Whether to show the import form

```js
// type
boolean
```

#### getter: scalebarHeight

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
number
```

#### getter: height

```js
// type
number
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
unknown
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

#### getter: trackMap

```js
// type
Map<any, any>
```

#### getter: trackTypeActions

```js
// type
Map<string, MenuItem[]>
```

#### getter: canShowCytobands

```js
// type
boolean
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

#### getter: overviewLayout

geometry of the overview scalebar — derived from displayedRegions, width, and
cytobandOffset so it stays cached by MobX

```js
// type
ViewLayout
```

#### getter: overviewScale

bp-per-px scale used by overview tick labels

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

#### getter: scalebarRegionEndPx

Max right-edge pixel position for each displayedRegionIndex, derived from
staticBlocks geometry. staticBlocks caches a stable reference when only offsetPx
changes, so this getter is also stable during normal scroll — avoiding a Map
rebuild every frame. Used by ScalebarRefNameLabels to clip chromosome name
labels.

```js
// type
Map<number, number>
```

#### getter: gridlineTicks

Gridline tick positions (x relative to the staticBlocks frame), derived from
staticBlocks + bpPerPx. Computed once and shared by every Gridlines instance
(scalebar, main view, each pinned track) rather than recomputing the makeTicks
loop per component.

```js
// type
{
  key: string
  x: number
  major: boolean
}
;[]
```

#### getter: totalWidthPx

Integer-rounded sum of all visible block widths. Slightly less than view.width
when the genome ends before the right edge; use view.width for SVG clip rects
(display boundary) and this for paint canvas sizing (actual content width).

```js
// type
number
```

#### getter: totalWidthPxWithoutBorders

Like totalWidthPx but excluding inter-region boundary blocks. Used when column
layout divides the canvas width by feature count.

```js
// type
number
```

#### getter: visibleBp

```js
// type
number
```

#### getter: roundedDynamicBlocks

rounded dynamic blocks are dynamic blocks without fractions of bp

```js
// type
{ start: number; end: number; type: "ContentBlock"; assemblyName: string; refName: string; key: string; offsetPx: number; widthPx: number; reversed?: boolean | undefined; displayedRegionIndex?: number | undefined; isLeftEndOfDisplayedRegion?: boolean | undefined; isRightEndOfDisplayedRegion?: boolean | undefined; va...
```

#### getter: visibleRegions

Returns the currently visible content blocks with screen pixel positions and
displayedRegionIndex guaranteed. Used by WebGL displays for per-region data
fetching and rendering.

```js
// type
{
  refName: string
  start: number
  end: number
  assemblyName: string
  reversed: boolean | undefined
  displayedRegionIndex: number
  offsetPx: number
  widthPx: number
  screenStartPx: number
  screenEndPx: number
}
;[]
```

#### getter: bufferedVisibleRegions

visibleRegions expanded by a half-screen buffer on each side, clamped to
displayedRegion bounds, with integer-rounded coordinates. Use this when fetching
data that should extend slightly beyond the viewport for smooth scrolling.

```js
// type
{
  region: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }
  displayedRegionIndex: number
}
;[]
```

#### getter: visibleLocStrings

a single "combo-locstring" representing all the regions visible on the screen

```js
// type
string
```

#### getter: coarseVisibleLocStrings

same as visibleLocStrings, but only updated every 500ms

```js
// type
string
```

#### getter: coarseTotalBpDisplayStr

```js
// type
string
```

#### getter: effectiveBpPerPx

```js
// type
number
```

#### getter: effectiveTotalBp

```js
// type
number
```

#### getter: effectiveTotalBpDisplayStr

```js
// type
string
```

#### getter: centerLineInfo

```js
// type
{ coord: number; index: number; refName: string; oob: boolean; assemblyName: string; offset: number; start: number; end: number; reversed?: boolean | undefined; } | undefined
```

### LinearGenomeView - Methods

#### method: scalebarDisplayPrefix

```js
// type signature
scalebarDisplayPrefix: () => string
```

#### method: MiniControlsComponent

```js
// type signature
MiniControlsComponent: () => FC<any>
```

#### method: HeaderComponent

```js
// type signature
HeaderComponent: () => FC<any>
```

#### method: getTrackYOffset

Y offset (in pixels, from the top of the view) where a track's rendering
container starts. Walks tracks in DOM render order (pinned first, then
unpinned), matching TrackContainer's layout and using the same constants it
renders with. Returns `undefined` if the track is not present in the view.

```js
// type signature
getTrackYOffset: (trackId: string) => number | undefined
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

#### method: getSelectedRegions

Helper method for the fetchSequence. Retrieves the corresponding regions that
were selected by the rubberband

```js
// type signature
getSelectedRegions: (leftOffset?: BpOffset | undefined, rightOffset?: BpOffset | undefined) => { assemblyName: string; refName: string; start: number; end: number; }[]
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
bpToPx: ({ refName, coord, displayedRegionIndex, }: { refName: string; coord: number; displayedRegionIndex?: number | undefined; }) => { index: number; offsetPx: number; } | undefined
```

#### method: getHighlightCoords

Map a highlight or bookmark region to its pixel position+width inside the tracks
container. Falls back to the raw refName if the region's assemblyName is missing
or unknown so highlights authored without an assembly still render in
single-assembly views.

```js
// type signature
getHighlightCoords: (region: { assemblyName?: string | undefined; refName: string; start: number; end: number; }) => { width: number; left: number; } | undefined
```

#### method: getOverviewHighlightCoords

like getHighlightCoords but laid out against the overview scalebar and shifted
by the cytoband offset

```js
// type signature
getOverviewHighlightCoords: (region: { assemblyName?: string | undefined; refName: string; start: number; end: number; }) => { left: number; width: number; } | undefined
```

#### method: centerAt

scrolls the view to center on the given bp. if that is not in any of the
displayed regions, does nothing

```js
// type signature
centerAt: (coord: number, refName: string, displayedRegionIndex?: number | undefined) => void
```

#### method: pxToBp

```js
// type signature
pxToBp: (px: number) => { coord: number; index: number; refName: string; oob: boolean; assemblyName: string; offset: number; start: number; end: number; reversed?: boolean | undefined; }
```

#### method: rubberbandClickMenuItems

```js
// type signature
rubberbandClickMenuItems: (clickOffset: BpOffset) => MenuItem[]
```

#### method: highlightMenuItems

returns menu items for a highlight context menu. plugins can extend this via
Core-extendPluggableElement to add their own items

```js
// type signature
highlightMenuItems: (_highlight: HighlightType) => MenuItem[]
```

### LinearGenomeView - Actions

#### action: setShowTrackOutlines

```js
// type signature
setShowTrackOutlines: (arg: boolean) => void
```

#### action: setScrollZoom

```js
// type signature
setScrollZoom: (flag: boolean) => void
```

#### action: setColorByCDS

```js
// type signature
setColorByCDS: (flag: boolean) => void
```

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
setError: (error: unknown) => void
```

#### action: setIsScalebarRefNameMenuOpen

```js
// type signature
setIsScalebarRefNameMenuOpen: (isOpen: boolean) => void
```

#### action: setScalebarRefNameClickPending

```js
// type signature
setScalebarRefNameClickPending: (pending: boolean) => void
```

#### action: setHideHeader

```js
// type signature
setHideHeader: (b: boolean) => void
```

#### action: setHideHeaderOverview

```js
// type signature
setHideHeaderOverview: (b: boolean) => void
```

#### action: setScalebarOnly

```js
// type signature
setScalebarOnly: (b: boolean) => void
```

#### action: setHideNoTracksActive

```js
// type signature
setHideNoTracksActive: (b: boolean) => void
```

#### action: setShowGridlines

```js
// type signature
setShowGridlines: (b: boolean) => void
```

#### action: addToHighlights

```js
// type signature
addToHighlights: (highlight: HighlightType) => void
```

#### action: setHighlight

```js
// type signature
setHighlight: (highlight?: HighlightType[] | undefined) => void
```

#### action: removeHighlight

```js
// type signature
removeHighlight: (highlight: HighlightType) => void
```

#### action: updateHighlight

```js
// type signature
updateHighlight: (old: HighlightType, updates: Partial<HighlightType>) => void
```

#### action: setHighlightsVisible

```js
// type signature
setHighlightsVisible: (arg: boolean) => void
```

#### action: setLabelsVisible

```js
// type signature
setLabelsVisible: (arg: boolean) => void
```

#### action: setVolatileGuides

set temporary vertical guides (e.g., for LD display hover)

```js
// type signature
setVolatileGuides: (guides: VolatileGuide[]) => void
```

#### action: scrollTo

```js
// type signature
scrollTo: (offsetPx: number) => number
```

#### action: zoomTo

```js
// type signature
zoomTo: (bpPerPx: number, offset?: any) => number
```

#### action: setOffsets

sets offsets of rubberband, used in the get sequence dialog can call
view.getSelectedRegions(view.leftOffset,view.rightOffset) to compute the
selected regions from the offsets

```js
// type signature
setOffsets: (left?: BpOffset | undefined, right?: BpOffset | undefined) => void
```

#### action: setSearchResults

```js
// type signature
setSearchResults: (searchResults: BaseResult[], searchQuery: string, assemblyName?: string | undefined) => void
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
showTrack: (trackId: string, initialSnapshot?: any, displayInitialSnapshot?: any) => any
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string) => 1 | 0
```

#### action: moveTrackDown

```js
// type signature
moveTrackDown: (id: string) => void
```

#### action: moveTrackUp

```js
// type signature
moveTrackUp: (id: string) => void
```

#### action: moveTrackToTop

```js
// type signature
moveTrackToTop: (id: string) => void
```

#### action: moveTrackToBottom

```js
// type signature
moveTrackToBottom: (id: string) => void
```

#### action: moveTrack

```js
// type signature
moveTrack: (movingId: string, targetId: string) => void
```

#### action: toggleTrack

```js
// type signature
toggleTrack: (trackId: string) => boolean
```

#### action: setTrackLabels

```js
// type signature
setTrackLabels: (setting: "overlapping" | "offset" | "hidden") => void
```

#### action: setShowCenterLine

```js
// type signature
setShowCenterLine: (b: boolean) => void
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

#### action: horizontalScroll

```js
// type signature
horizontalScroll: (distance: number) => number
```

#### action: showAllRegions

```js
// type signature
showAllRegions: () => void
```

#### action: showAllRegionsInAssembly

```js
// type signature
showAllRegionsInAssembly: (assemblyName?: string | undefined) => void
```

#### action: setDraggingTrackId

```js
// type signature
setDraggingTrackId: (idx?: string | undefined) => void
```

#### action: setLastTrackDragY

```js
// type signature
setLastTrackDragY: (y: number) => void
```

#### action: onTrackDragOver

called while dragging a track over the track at `targetId`; reorders once the
cursor has moved far enough (see shouldSwapTracks) to avoid jitter when a short
track is dragged over a tall one

```js
// type signature
onTrackDragOver: (targetId: string, currentY: number) => void
```

#### action: clearView

this "clears the view" and makes the view return to the import form

```js
// type signature
clearView: () => void
```

#### action: setInit

```js
// type signature
setInit: (arg?: InitState | undefined) => void
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
setCoarseDynamicBlocks: (blocks: BlockSet, bpPerPx: number) => void
```

#### action: moveTo

offset is the base-pair-offset in the displayed region, index is the index of
the displayed region in the linear genome view

```js
// type signature
moveTo: (start?: BpOffset | undefined, end?: BpOffset | undefined) => void
```

#### action: navToLocString

Navigate to the given locstring, will change displayed regions if needed, and
wait for assemblies to be initialized

```js
// type signature
navToLocString: (input: string, optAssemblyName?: string | undefined, grow?: number | undefined) => Promise<void>
```

#### action: navToLocations

Similar to `navToLocString`, but accepts a list of parsed location objects
instead of a locstring. Will try to perform `setDisplayedRegions` if changing
regions

```js
// type signature
navToLocations: (regions: ParsedLocString[], assemblyName?: string | undefined, grow?: number | undefined) => Promise<void>
```

#### action: navTo

Navigate to a location based on its refName and optionally start, end, and
assemblyName. Will not try to change displayed regions, use `navToLocations`
instead. Only navigates to a location if it is entirely within a
displayedRegion. Navigates to the first matching location encountered.

Throws an error if navigation was unsuccessful

```js
// type signature
navTo: (query: NavLocation, grow?: number | undefined) => void
```

#### action: navToMultiple

Navigate to a location based on its refName and optionally start, end, and
assemblyName. Will not try to change displayed regions, use navToLocations
instead. Only navigates to a location if it is entirely within a
displayedRegion. Navigates to the first matching location encountered.

Throws an error if navigation was unsuccessful

```js
// type signature
navToMultiple: (locations: NavLocation[], grow?: number | undefined) => void
```

#### action: navToLocation

Similar to `navToLocString`, but accepts a parsed location object instead of a
locstring. Will try to perform `setDisplayedRegions` if changing regions

```js
// type signature
navToLocation: (parsedLocString: ParsedLocString, assemblyName?: string | undefined, grow?: number | undefined) => Promise<void>
```
