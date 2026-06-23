---
id: lineargenomeview
title: LinearGenomeView
sidebar_label: View -> LinearGenomeView
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

## Example usage

A `LinearGenomeView` is what you hand-author under `defaultSession.views`. The
`init` shorthand fills in `displayedRegions`/`bpPerPx`/`offsetPx` for you:

```js
defaultSession: {
  name: 'My session',
  views: [
    {
      type: 'LinearGenomeView',
      init: {
        assembly: 'hg38',
        loc: 'chr1:1,000,000-1,100,000',
        tracks: ['genes', 'alignments'],
      },
    },
  ],
}
```

At runtime the same model is driven imperatively — every property and action
below is reachable on `viewState.session.views[0]`:

```js
const view = viewState.session.views[0]
await view.navToLocString('chr1:2,000,000-2,100,000')
view.showTrack('alignments')
view.setBpPerPx(view.bpPerPx * 2) // zoom out 2x
```

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** [id](../baseviewmodel#property-id),
[displayName](../baseviewmodel#property-displayname),
[minimized](../baseviewmodel#property-minimized)

**Volatiles:** [width](../baseviewmodel#volatile-width)

**Getters:** [menuItems](../baseviewmodel#getter-menuitems)

**Actions:** [setDisplayName](../baseviewmodel#action-setdisplayname),
[setWidth](../baseviewmodel#action-setwidth),
[setMinimized](../baseviewmodel#action-setminimized)

<details open>
<summary>LinearGenomeView - Properties</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

this is a string instead of the const literal 'LinearGenomeView' to reduce some
typescripting strictness, but you should pass the string 'LinearGenomeView' to
the model explicitly

```ts
// type signature
type type = string
// code
type: types.literal('LinearGenomeView') as unknown as string
```

#### property: offsetPx

corresponds roughly to the horizontal scroll of the LGV

```ts
// type signature
type offsetPx = IOptionalIType<ISimpleType<number>, [undefined]>
// code
offsetPx: types.stripDefault(types.number, 0)
```

#### property: bpPerPx

corresponds roughly to the zoom level, base-pairs per pixel

```ts
// type signature
type bpPerPx = IOptionalIType<ISimpleType<number>, [undefined]>
// code
bpPerPx: types.stripDefault(types.number, 1)
```

#### property: displayedRegions

currently displayed regions, can be a single chromosome, arbitrary subsections,
or the entire set of chromosomes in the genome, but it not advised to use the
entire set of chromosomes if your assembly is very fragmented

```ts
// type signature
type displayedRegions = IOptionalIType<
  IType<Region[], Region[], Region[]>,
  [undefined]
>
// code
displayedRegions: types.stripDefault(types.frozen<Region[]>(), [])
```

#### property: tracks

array of currently displayed tracks state models instances

```ts
// type signature
type tracks = IArrayType<IAnyType>
// code
tracks: types.array(pluginManager.pluggableMstType('track', 'stateModel'))
```

#### property: hideHeader

```ts
// type signature
type hideHeader = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
hideHeader: types.stripDefault(types.boolean, false)
```

#### property: hideHeaderOverview

```ts
// type signature
type hideHeaderOverview = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
hideHeaderOverview: types.stripDefault(types.boolean, false)
```

#### property: hideNoTracksActive

```ts
// type signature
type hideNoTracksActive = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
hideNoTracksActive: types.stripDefault(types.boolean, false)
```

#### property: trackSelectorType

```ts
// type signature
type trackSelectorType = IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackSelectorType: types.stripDefault(
  types.enumeration(['hierarchical']),
  'hierarchical',
)
```

#### property: showCenterLine

show the "center line"

```ts
// type signature
type showCenterLine = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showCenterLine: types.optional(types.boolean, () =>
  localStorageGetBoolean('lgv-showCenterLine', false),
)
```

#### property: showCytobandsSetting

show the "cytobands" in the overview scale bar

```ts
// type signature
type showCytobandsSetting = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showCytobandsSetting: types.optional(types.boolean, () =>
  localStorageGetBoolean('lgv-showCytobands', true),
)
```

#### property: trackLabelsOverride

how to display the track labels, can be "overlapping", "offset", or "hidden", or
empty string "" (which results in conf being used). see LinearGenomeViewPlugin
https://jbrowse.org/jb2/docs/config/lineargenomeviewplugin/ docs for how conf is
used

```ts
// type signature
type trackLabelsOverride = IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackLabelsOverride: types.optional(
  types.string,
  () => localStorageGetItem('lgv-trackLabels') ?? '',
)
```

#### property: showGridlines

show the "gridlines" in the track area

```ts
// type signature
type showGridlines = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showGridlines: types.stripDefault(types.boolean, true)
```

#### property: highlight

highlights on the LGV from the URL parameters

```ts
// type signature
type highlight = IOptionalIType<
  IArrayType<IType<HighlightType, HighlightType, HighlightType>>,
  [undefined]
>
// code
highlight: types.stripDefault(types.array(types.frozen<HighlightType>()), [])
```

#### property: highlightsVisible

controls whether view.highlight entries are rendered

```ts
// type signature
type highlightsVisible = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
highlightsVisible: types.stripDefault(types.boolean, true)
```

#### property: labelsVisible

controls whether highlight/bookmark chip labels are shown inline

```ts
// type signature
type labelsVisible = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
labelsVisible: types.stripDefault(types.boolean, true)
```

#### property: colorByCDS

color by CDS

```ts
// type signature
type colorByCDS = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
colorByCDS: types.optional(types.boolean, () =>
  localStorageGetBoolean('lgv-colorByCDS', false),
)
```

#### property: showTrackOutlines

show the track outlines

```ts
// type signature
type showTrackOutlines = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showTrackOutlines: types.optional(types.boolean, () =>
  localStorageGetBoolean('lgv-showTrackOutlines', true),
)
```

#### property: scalebarOnly

when true, only the header and coordinate scalebar are rendered

```ts
// type signature
type scalebarOnly = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
scalebarOnly: types.stripDefault(types.boolean, false)
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

```ts
// type signature
type init = IType<
  InitState | undefined,
  InitState | undefined,
  InitState | undefined
>
// code
init: types.frozen<InitState | undefined>()
```

</details>

<details open>
<summary>LinearGenomeView - Volatiles</summary>

#### volatile: volatileWidth

```ts
// type signature
type volatileWidth = number | undefined
// code
volatileWidth: undefined as number | undefined
```

#### volatile: minimumBlockWidth

```ts
// type signature
type minimumBlockWidth = number
// code
minimumBlockWidth: 3
```

#### volatile: draggingTrackId

```ts
// type signature
type draggingTrackId = string | undefined
// code
draggingTrackId: undefined as undefined | string
```

#### volatile: lastTrackDragY

```ts
// type signature
type lastTrackDragY = number | undefined
// code
lastTrackDragY: undefined as undefined | number
```

#### volatile: volatileError

```ts
// type signature
type volatileError = unknown
// code
volatileError
```

#### volatile: trackRefs

```ts
// type signature
type trackRefs = Record<string, HTMLDivElement>
// code
trackRefs
```

#### volatile: coarseDynamicBlocks

```ts
// type signature
type coarseDynamicBlocks = ContentBlock[]
// code
coarseDynamicBlocks: [] as ContentBlock[]
```

#### volatile: coarseTotalBp

```ts
// type signature
type coarseTotalBp = number
// code
coarseTotalBp: 0
```

#### volatile: coarseBpPerPx

```ts
// type signature
type coarseBpPerPx = number
// code
coarseBpPerPx: self.bpPerPx
```

#### volatile: leftOffset

```ts
// type signature
type leftOffset = BpOffset | undefined
// code
leftOffset: undefined as undefined | BpOffset
```

#### volatile: rightOffset

```ts
// type signature
type rightOffset = BpOffset | undefined
// code
rightOffset: undefined as undefined | BpOffset
```

#### volatile: isScalebarRefNameMenuOpen

```ts
// type signature
type isScalebarRefNameMenuOpen = false
// code
isScalebarRefNameMenuOpen: false
```

#### volatile: scalebarRefNameClickPending

```ts
// type signature
type scalebarRefNameClickPending = false
// code
scalebarRefNameClickPending: false
```

#### volatile: volatileGuides

temporary vertical guides that can be set by displays (e.g., LD display hover)

```ts
// type signature
type volatileGuides = VolatileGuide[]
// code
volatileGuides: [] as VolatileGuide[]
```

</details>

<details open>
<summary>LinearGenomeView - Getters</summary>

#### getter: scrollZoom

scroll-to-zoom is a global, personal preference resolved from the session;
toggling it in any view applies everywhere

```ts
type scrollZoom = boolean
```

#### getter: pinnedTracks

```ts
type pinnedTracks = any[]
```

#### getter: unpinnedTracks

```ts
type unpinnedTracks = any[]
```

#### getter: trackLabels

the effective track labels setting, resolving the stored `trackLabelsOverride`
against the LinearGenomeViewPlugin config default

```ts
type trackLabels = any
```

#### getter: width

```ts
type width = number
```

#### getter: trackWidthPx

width minus track outline borders (1px each side when shown)

```ts
type trackWidthPx = number
```

#### getter: assemblyNames

```ts
type assemblyNames = string[]
```

#### getter: assemblyDisplayNames

```ts
type assemblyDisplayNames = string[]
```

#### getter: isTopLevelView

checking if lgv is a 'top-level' view is used for toggling pin track capability,
sticky positioning

```ts
type isTopLevelView = boolean
```

#### getter: stickyViewHeaders

only uses sticky view headers when it is a 'top-level' view and session allows
it

```ts
type stickyViewHeaders = boolean
```

#### getter: rubberbandTop

```ts
type rubberbandTop = number
```

#### getter: pinnedTracksTop

```ts
type pinnedTracksTop = number
```

#### getter: assembliesNotFound

```ts
type assembliesNotFound = string | undefined
```

#### getter: assemblyErrors

```ts
type assemblyErrors = string
```

#### getter: assembliesInitialized

```ts
type assembliesInitialized = boolean
```

#### getter: initialized

```ts
type initialized = boolean
```

#### getter: hasDisplayedRegions

```ts
type hasDisplayedRegions = boolean
```

#### getter: loadingMessage

```ts
type loadingMessage = 'Loading' | undefined
```

#### getter: hasSomethingToShow

```ts
type hasSomethingToShow = boolean
```

#### getter: showLoading

Whether to show a loading indicator instead of the import form or view

```ts
type showLoading = boolean
```

#### getter: showImportForm

Whether to show the import form

```ts
type showImportForm = boolean
```

#### getter: scalebarHeight

```ts
type scalebarHeight = number
```

#### getter: headerHeight

```ts
type headerHeight = number
```

#### getter: trackHeights

```ts
type trackHeights = number
```

#### getter: trackHeightsWithResizeHandles

```ts
type trackHeightsWithResizeHandles = number
```

#### getter: height

```ts
type height = number
```

#### getter: totalBp

```ts
type totalBp = number
```

#### getter: maxBpPerPx

```ts
type maxBpPerPx = number
```

#### getter: minBpPerPx

```ts
type minBpPerPx = number
```

#### getter: error

```ts
type error = unknown
```

#### getter: maxOffset

```ts
type maxOffset = number
```

#### getter: minOffset

```ts
type minOffset = number
```

#### getter: displayedRegionsTotalPx

```ts
type displayedRegionsTotalPx = number
```

#### getter: trackMap

```ts
type trackMap = Map<any, any>
```

#### getter: trackTypeActions

```ts
type trackTypeActions = Map<string, MenuItem[]>
```

#### getter: canShowCytobands

```ts
type canShowCytobands = boolean
```

#### getter: showCytobands

```ts
type showCytobands = boolean
```

#### getter: anyCytobandsExist

```ts
type anyCytobandsExist = boolean
```

#### getter: cytobandOffset

the cytoband is displayed to the right of the chromosome name, and that offset
is calculated manually with this method

```ts
type cytobandOffset = number
```

#### getter: overviewLayout

geometry of the overview scalebar — derived from displayedRegions, width, and
cytobandOffset so it stays cached by MobX

```ts
type overviewLayout = ViewLayout
```

#### getter: overviewScale

bp-per-px scale used by overview tick labels

```ts
type overviewScale = number
```

#### getter: staticBlocks

static blocks are an important concept jbrowse uses to avoid re-rendering when
you scroll to the side. when you horizontally scroll to the right, old blocks to
the left may be removed, and new blocks may be instantiated on the right. tracks
may use the static blocks to render their data for the region represented by the
block

```ts
type staticBlocks = BlockSet
```

#### getter: dynamicBlocks

dynamic blocks represent the exact coordinates of the currently visible genome
regions on the screen. they are similar to static blocks, but static blocks can
go offscreen while dynamic blocks represent exactly what is on screen

```ts
type dynamicBlocks = BlockSet
```

#### getter: overviewBlocks

all overview scalebar blocks (content + elided), laid out on the overviewLayout.
memoized so the scalebar doesn't recompute it per render

```ts
type overviewBlocks = BaseBlock[]
```

#### getter: overviewContentBlocksPxSpan

leading/trailing pixel span of the visible content blocks projected onto the
overviewLayout — the geometry shared by the overview's "you are here" rectangle
and polygon

```ts
type overviewContentBlocksPxSpan =
  | { leftPx: number; rightPx: number }
  | undefined
```

#### getter: scalebarRegionEndPx

Max right-edge pixel position for each displayedRegionIndex, derived from
staticBlocks geometry. staticBlocks caches a stable reference when only offsetPx
changes, so this getter is also stable during normal scroll — avoiding a Map
rebuild every frame. Used by ScalebarRefNameLabels to clip chromosome name
labels.

```ts
type scalebarRegionEndPx = Map<number, number>
```

#### getter: gridlineTicks

Gridline tick positions (x relative to the staticBlocks frame), derived from
staticBlocks + bpPerPx. Computed once and shared by every Gridlines instance
(scalebar, main view, each pinned track) rather than recomputing the makeTicks
loop per component.

```ts
type gridlineTicks = { x: number; major: boolean }[]
```

#### getter: totalWidthPx

Integer-rounded sum of all visible block widths. Slightly less than view.width
when the genome ends before the right edge; use view.width for SVG clip rects
(display boundary) and this for paint canvas sizing (actual content width).

```ts
type totalWidthPx = number
```

#### getter: totalWidthPxWithoutBorders

Like totalWidthPx but excluding inter-region boundary blocks. Used when column
layout divides the canvas width by feature count.

```ts
type totalWidthPxWithoutBorders = number
```

#### getter: visibleBp

```ts
type visibleBp = number
```

#### getter: roundedDynamicBlocks

rounded dynamic blocks are dynamic blocks without fractions of bp

```ts
type roundedDynamicBlocks = { start: number; end: number; type: "ContentBlock"; assemblyName: string; refName: string; key: string; offsetPx: number; widthPx: number; reversed?: boolean | undefined; displayedRegionIndex?: number | undefined; isLeftEndOfDisplayedRegion?: boolean | undefined; isRightEndOfDisplayedRegion?: boolean | undefined; va...
```

#### getter: visibleRegions

Returns the currently visible content blocks with screen pixel positions and
displayedRegionIndex guaranteed. Used by WebGL displays for per-region data
fetching and rendering.

```ts
type visibleRegions = {
  refName: string
  start: number
  end: number
  assemblyName: string
  reversed: boolean | undefined
  displayedRegionIndex: number
  screenStartPx: number
  screenEndPx: number
}[]
```

#### getter: bufferedVisibleRegions

visibleRegions expanded by a half-screen buffer on each side, clamped to
displayedRegion bounds, with integer-rounded coordinates. Use this when fetching
data that should extend slightly beyond the viewport for smooth scrolling.

```ts
type bufferedVisibleRegions = {
  region: { refName: string; start: number; end: number; assemblyName: string }
  displayedRegionIndex: number
}[]
```

#### getter: visibleLocStrings

a single "combo-locstring" representing all the regions visible on the screen

```ts
type visibleLocStrings = string
```

#### getter: coarseVisibleLocStrings

same as visibleLocStrings, but only updated every 500ms

```ts
type coarseVisibleLocStrings = string
```

#### getter: coarseTotalBpDisplayStr

```ts
type coarseTotalBpDisplayStr = string
```

#### getter: effectiveBpPerPx

```ts
type effectiveBpPerPx = number
```

#### getter: effectiveTotalBp

```ts
type effectiveTotalBp = number
```

#### getter: effectiveTotalBpDisplayStr

```ts
type effectiveTotalBpDisplayStr = string
```

#### getter: centerLineInfo

```ts
type centerLineInfo =
  | {
      coord: number
      index: number
      refName: string
      oob: boolean
      assemblyName: string
      offset: number
      start: number
      end: number
      reversed?: boolean | undefined
    }
  | undefined
```

</details>

<details open>
<summary>LinearGenomeView - Methods</summary>

#### method: scalebarDisplayPrefix

```ts
type scalebarDisplayPrefix = () => string
```

#### method: MiniControlsComponent

```ts
type MiniControlsComponent = () => FC<any>
```

#### method: HeaderComponent

```ts
type HeaderComponent = () => FC<any>
```

#### method: getTrackYOffset

Y offset (in pixels, from the top of the view) where a track's rendering
container starts. Walks tracks in DOM render order (pinned first, then
unpinned), matching TrackContainer's layout and using the same constants it
renders with. Returns `undefined` if the track is not present in the view.

```ts
type getTrackYOffset = (trackId: string) => number | undefined
```

#### method: renderProps

```ts
type renderProps = () => { bpPerPx: number; colorByCDS: boolean }
```

#### method: searchScope

```ts
type searchScope = (assemblyName: string) => {
  assemblyName: string
  includeAggregateIndexes: boolean
  tracks: IMSTArray<IAnyType> & IStateTreeNode<IArrayType<IAnyType>>
}
```

#### method: getTrack

```ts
type getTrack = (id: string) => any
```

#### method: getActiveDisplayId

displayId of the active (shown) display for a track in this view, used by the
config editor to expand the relevant display and collapse the track's other
displays

```ts
type getActiveDisplayId = (trackId: string) => string | undefined
```

#### method: getSelectedRegions

Helper method for the fetchSequence. Retrieves the corresponding regions that
were selected by the rubberband

```ts
type getSelectedRegions = (
  leftOffset?: BpOffset | undefined,
  rightOffset?: BpOffset | undefined,
) => { assemblyName: string; refName: string; start: number; end: number }[]
```

#### method: exportSvg

creates an svg export and save using FileSaver

```ts
type exportSvg = (opts?: ExportSvgOptions) => Promise<void>
```

#### method: menuItems

return the view menu items

```ts
type menuItems = () => MenuItem[]
```

#### method: rubberBandMenuItems

```ts
type rubberBandMenuItems = () => MenuItem[]
```

#### method: bpToPx

```ts
type bpToPx = ({
  refName,
  coord,
  displayedRegionIndex,
}: {
  refName: string
  coord: number
  displayedRegionIndex?: number | undefined
}) => { index: number; offsetPx: number } | undefined
```

#### method: getHighlightCoords

Map a highlight or bookmark region to its pixel position+width inside the tracks
container. Falls back to the raw refName if the region's assemblyName is missing
or unknown so highlights authored without an assembly still render in
single-assembly views.

```ts
type getHighlightCoords = (region: {
  assemblyName?: string | undefined
  refName: string
  start: number
  end: number
}) => { width: number; left: number } | undefined
```

#### method: getOverviewHighlightCoords

like getHighlightCoords but laid out against the overview scalebar and shifted
by the cytoband offset

```ts
type getOverviewHighlightCoords = (region: {
  assemblyName?: string | undefined
  refName: string
  start: number
  end: number
}) => { left: number; width: number } | undefined
```

#### method: centerAt

scrolls the view to center on the given bp. if that is not in any of the
displayed regions, does nothing

```ts
type centerAt = (
  coord: number,
  refName: string,
  displayedRegionIndex?: number | undefined,
) => void
```

#### method: pxToBp

```ts
type pxToBp = (px: number) => {
  coord: number
  index: number
  refName: string
  oob: boolean
  assemblyName: string
  offset: number
  start: number
  end: number
  reversed?: boolean | undefined
}
```

#### method: rubberbandClickMenuItems

```ts
type rubberbandClickMenuItems = (clickOffset: BpOffset) => MenuItem[]
```

#### method: highlightMenuItems

returns menu items for a highlight context menu. plugins can extend this via
Core-extendPluggableElement to add their own items

```ts
type highlightMenuItems = (_highlight: HighlightType) => MenuItem[]
```

</details>

<details open>
<summary>LinearGenomeView - Actions</summary>

#### action: setShowTrackOutlines

```ts
type setShowTrackOutlines = (arg: boolean) => void
```

#### action: setScrollZoom

```ts
type setScrollZoom = (flag: boolean) => void
```

#### action: setColorByCDS

```ts
type setColorByCDS = (flag: boolean) => void
```

#### action: setShowCytobands

```ts
type setShowCytobands = (flag: boolean) => void
```

#### action: setWidth

```ts
type setWidth = (newWidth: number) => void
```

#### action: setError

```ts
type setError = (error: unknown) => void
```

#### action: setIsScalebarRefNameMenuOpen

```ts
type setIsScalebarRefNameMenuOpen = (isOpen: boolean) => void
```

#### action: setScalebarRefNameClickPending

```ts
type setScalebarRefNameClickPending = (pending: boolean) => void
```

#### action: setHideHeader

```ts
type setHideHeader = (b: boolean) => void
```

#### action: setHideHeaderOverview

```ts
type setHideHeaderOverview = (b: boolean) => void
```

#### action: setScalebarOnly

```ts
type setScalebarOnly = (b: boolean) => void
```

#### action: setHideNoTracksActive

```ts
type setHideNoTracksActive = (b: boolean) => void
```

#### action: setShowGridlines

```ts
type setShowGridlines = (b: boolean) => void
```

#### action: addToHighlights

```ts
type addToHighlights = (highlight: HighlightType) => void
```

#### action: setHighlight

```ts
type setHighlight = (highlight?: HighlightType[] | undefined) => void
```

#### action: removeHighlight

```ts
type removeHighlight = (highlight: HighlightType) => void
```

#### action: updateHighlight

```ts
type updateHighlight = (
  old: HighlightType,
  updates: Partial<HighlightType>,
) => void
```

#### action: setHighlightsVisible

```ts
type setHighlightsVisible = (arg: boolean) => void
```

#### action: setLabelsVisible

```ts
type setLabelsVisible = (arg: boolean) => void
```

#### action: setVolatileGuides

set temporary vertical guides (e.g., for LD display hover)

```ts
type setVolatileGuides = (guides: VolatileGuide[]) => void
```

#### action: scrollTo

```ts
type scrollTo = (offsetPx: number) => number
```

#### action: zoomTo

```ts
type zoomTo = (bpPerPx: number, offset?: any) => number
```

#### action: setOffsets

sets offsets of rubberband, used in the get sequence dialog can call
view.getSelectedRegions(view.leftOffset,view.rightOffset) to compute the
selected regions from the offsets

```ts
type setOffsets = (
  left?: BpOffset | undefined,
  right?: BpOffset | undefined,
) => void
```

#### action: setSearchResults

```ts
type setSearchResults = (
  searchResults: BaseResult[],
  searchQuery: string,
  assemblyName?: string | undefined,
) => void
```

#### action: setNewView

```ts
type setNewView = (bpPerPx: number, offsetPx: number) => void
```

#### action: horizontallyFlip

```ts
type horizontallyFlip = () => void
```

#### action: showTrack

```ts
type showTrack = (
  trackId: string,
  initialSnapshot?: any,
  displayInitialSnapshot?: any,
) => any
```

#### action: hideTrack

```ts
type hideTrack = (trackId: string) => boolean
```

#### action: moveTrackDown

```ts
type moveTrackDown = (id: string) => void
```

#### action: moveTrackUp

```ts
type moveTrackUp = (id: string) => void
```

#### action: moveTrackToTop

```ts
type moveTrackToTop = (id: string) => void
```

#### action: moveTrackToBottom

```ts
type moveTrackToBottom = (id: string) => void
```

#### action: moveTrack

```ts
type moveTrack = (movingId: string, targetId: string) => void
```

#### action: toggleTrack

```ts
type toggleTrack = (trackId: string) => boolean
```

#### action: setTrackLabels

```ts
type setTrackLabels = (setting: 'offset' | 'hidden' | 'overlapping') => void
```

#### action: setShowCenterLine

```ts
type setShowCenterLine = (b: boolean) => void
```

#### action: setDisplayedRegions

```ts
type setDisplayedRegions = (regions: Region[]) => void
```

#### action: activateTrackSelector

```ts
type activateTrackSelector = () => Widget
```

#### action: horizontalScroll

```ts
type horizontalScroll = (distance: number) => number
```

#### action: showAllRegions

```ts
type showAllRegions = () => void
```

#### action: showAllRegionsInAssembly

```ts
type showAllRegionsInAssembly = (assemblyName?: string | undefined) => void
```

#### action: setDraggingTrackId

```ts
type setDraggingTrackId = (idx?: string | undefined) => void
```

#### action: setLastTrackDragY

```ts
type setLastTrackDragY = (y: number) => void
```

#### action: onTrackDragOver

called while dragging a track over the track at `targetId`; reorders once the
cursor has moved far enough (see shouldSwapTracks) to avoid jitter when a short
track is dragged over a tall one

```ts
type onTrackDragOver = (targetId: string, currentY: number) => void
```

#### action: clearView

this "clears the view" and makes the view return to the import form

```ts
type clearView = () => void
```

#### action: setInit

```ts
type setInit = (arg?: InitState | undefined) => void
```

#### action: slide

perform animated slide

```ts
type slide = (viewWidths: number) => void
```

#### action: zoom

perform animated zoom

```ts
type zoom = (targetBpPerPx: number) => void
```

#### action: setCoarseDynamicBlocks

```ts
type setCoarseDynamicBlocks = (blocks: BlockSet, bpPerPx: number) => void
```

#### action: moveTo

offset is the base-pair-offset in the displayed region, index is the index of
the displayed region in the linear genome view

```ts
type moveTo = (start?: BpOffset | undefined, end?: BpOffset | undefined) => void
```

#### action: navToLocString

Navigate to the given locstring, will change displayed regions if needed, and
wait for assemblies to be initialized

```ts
type navToLocString = (
  input: string,
  optAssemblyName?: string | undefined,
  grow?: number | undefined,
) => Promise<void>
```

#### action: navToLocations

Similar to `navToLocString`, but accepts a list of parsed location objects
instead of a locstring. Will try to perform `setDisplayedRegions` if changing
regions

```ts
type navToLocations = (
  regions: ParsedLocString[],
  assemblyName?: string | undefined,
  grow?: number | undefined,
) => Promise<void>
```

#### action: navTo

Navigate to a location based on its refName and optionally start, end, and
assemblyName. Will not try to change displayed regions, use `navToLocations`
instead. Only navigates to a location if it is entirely within a
displayedRegion. Navigates to the first matching location encountered.

Throws an error if navigation was unsuccessful

```ts
type navTo = (query: NavLocation, grow?: number | undefined) => void
```

#### action: navToMultiple

Navigate to a location based on its refName and optionally start, end, and
assemblyName. Will not try to change displayed regions, use navToLocations
instead. Only navigates to a location if it is entirely within a
displayedRegion. Navigates to the first matching location encountered.

Throws an error if navigation was unsuccessful

```ts
type navToMultiple = (
  locations: NavLocation[],
  grow?: number | undefined,
) => void
```

#### action: navToLocation

Similar to `navToLocString`, but accepts a parsed location object instead of a
locstring. Will try to perform `setDisplayedRegions` if changing regions

```ts
type navToLocation = (
  parsedLocString: ParsedLocString,
  assemblyName?: string | undefined,
  grow?: number | undefined,
) => Promise<void>
```

</details>
