---
id: lineargenomeview
title: LinearGenomeView
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
         * currently displayed region, can be a single chromosome, arbitrary subsections,
         * or the entire  set of chromosomes in the genome, but it not advised to use the
         * entire set of chromosomes if your assembly is very fragmented
         */
        displayedRegions: types.array(MUIRegion)
```
#### property: tracks


```js


        /**
         * !property
         * array of currently displayed tracks state models instances
         */
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        )
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
#### property: displayedRegions


```js
self.displayedRegions
```
#### property: displayedRegions


```js
 self.displayedRegions
```
#### property: hideHeader


```js
self.hideHeader
```
#### property: hideHeaderOverview


```js
self.hideHeaderOverview
```
#### property: tracks


```js
 self.tracks
```
#### property: tracks


```js
 self.tracks
```
#### property: displayedRegions


```js
 self.displayedRegions
```
#### getter: width



```js
// Type
any
```
#### getter: width



```js
// Type
any
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### property: tracks


```js
 self.tracks
```
#### property: tracks


```js
 self.tracks
```
#### property: tracks


```js
 self.tracks
```
#### property: tracks


```js

              self.tracks
```
#### property: tracks


```js

        self.tracks
```
#### action: setShowCytobands



```js
// Type signature
setShowCytobands: (flag: boolean) => void
```
#### property: showCytobandsSetting


```js

        self.showCytobandsSetting
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
#### property: hideHeader


```js

        self.hideHeader
```
#### property: hideHeader


```js
self.hideHeader
```
#### action: toggleHeaderOverview



```js
// Type signature
toggleHeaderOverview: () => void
```
#### property: hideHeaderOverview


```js

        self.hideHeaderOverview
```
#### property: hideHeaderOverview


```js
self.hideHeaderOverview
```
#### action: toggleNoTracksActive



```js
// Type signature
toggleNoTracksActive: () => void
```
#### property: hideNoTracksActive


```js

        self.hideNoTracksActive
```
#### property: hideNoTracksActive


```js
self.hideNoTracksActive
```
#### action: toggleShowGridlines



```js
// Type signature
toggleShowGridlines: () => void
```
#### property: showGridlines


```js

        self.showGridlines
```
#### property: showGridlines


```js
self.showGridlines
```
#### action: scrollTo



```js
// Type signature
scrollTo: (offsetPx: number) => number
```
#### property: offsetPx


```js

        self.offsetPx
```
#### action: zoomTo



```js
// Type signature
zoomTo: (bpPerPx: number) => number
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### property: bpPerPx


```js

        self.bpPerPx
```
#### getter: width



```js
// Type
any
```
#### property: offsetPx


```js
self.offsetPx
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
#### property: displayedRegions


```js

        self.displayedRegions
```
#### property: displayedRegions


```js

          self.displayedRegions
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### property: offsetPx


```js
 self.offsetPx
```
#### getter: width



```js
// Type
any
```
#### action: showTrack



```js
// Type signature
showTrack: (trackId: string, initialSnapshot?: {}, displayInitialSnapshot?: {}) => any
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
#### property: tracks


```js

          self.tracks
```
#### property: tracks


```js
 self.tracks
```
#### property: tracks


```js
 self.tracks
```
#### action: moveTrack



```js
// Type signature
moveTrack: (movingId: string, targetId: string) => void
```
#### property: tracks


```js
 self.tracks
```
#### property: tracks


```js
 self.tracks
```
#### property: tracks


```js
self.tracks
```
#### property: tracks


```js

        self.tracks
```
#### property: tracks


```js

        self.tracks
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
#### action: showTrack



```js
// Type signature
showTrack: (trackId: string, initialSnapshot?: {}, displayInitialSnapshot?: {}) => any
```
#### action: setTrackLabels



```js
// Type signature
setTrackLabels: (setting: "overlapping" | "offset" | "hidden") => void
```
#### property: trackLabels


```js

        self.trackLabels
```
#### action: toggleCenterLine



```js
// Type signature
toggleCenterLine: () => void
```
#### property: showCenterLine


```js

        self.showCenterLine
```
#### property: showCenterLine


```js
self.showCenterLine
```
#### property: showCenterLine


```js
self.showCenterLine
```
#### action: setDisplayedRegions



```js
// Type signature
setDisplayedRegions: (regions: Region[]) => void
```
#### property: displayedRegions


```js

        self.displayedRegions
```
#### action: zoomTo



```js
// Type signature
zoomTo: (bpPerPx: number) => number
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
#### property: trackSelectorType


```js
self.trackSelectorType
```
#### property: trackSelectorType


```js
self.trackSelectorType
```
#### method: getSelectedRegions
Helper method for the fetchSequence.
Retrieves the corresponding regions that were selected by the rubberband
```js
// Type signature
getSelectedRegions: (leftOffset?: BpOffset, rightOffset?: BpOffset) => BaseBlock[]
```
#### getter: interRegionPaddingWidth



```js
// Type
number
```
#### getter: width



```js
// Type
any
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
#### property: offsetPx


```js
 self.offsetPx
```
#### action: scrollTo



```js
// Type signature
scrollTo: (offsetPx: number) => number
```
#### property: offsetPx


```js
self.offsetPx
```
#### action: center



```js
// Type signature
center: () => void
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### action: scrollTo



```js
// Type signature
scrollTo: (offsetPx: number) => number
```
#### getter: width



```js
// Type
any
```
#### action: showAllRegions



```js
// Type signature
showAllRegions: () => void
```
#### action: zoomTo



```js
// Type signature
zoomTo: (bpPerPx: number) => number
```
#### action: showAllRegionsInAssembly



```js
// Type signature
showAllRegionsInAssembly: (assemblyName?: string) => void
```
#### property: displayedRegions


```js

              self.displayedRegions
```
#### action: zoomTo



```js
// Type signature
zoomTo: (bpPerPx: number) => number
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
#### property: tracks


```js

        self.tracks
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
#### property: offsetPx


```js

          self.offsetPx
```
#### property: offsetPx


```js

          self.offsetPx
```
#### getter: width



```js
// Type
any
```
#### action: scrollTo



```js
// Type signature
scrollTo: (offsetPx: number) => number
```
#### action: zoom


perform animated zoom
```js
// Type signature
zoom: (targetBpPerPx: number) => void
```
#### action: zoomTo



```js
// Type signature
zoomTo: (bpPerPx: number) => number
```
#### property: bpPerPx


```js
self.bpPerPx
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### property: bpPerPx


```js
 self.bpPerPx
```
#### action: setScaleFactor



```js
// Type signature
setScaleFactor: (factor: number) => void
```
#### action: zoomTo



```js
// Type signature
zoomTo: (bpPerPx: number) => number
```
#### action: setScaleFactor



```js
// Type signature
setScaleFactor: (factor: number) => void
```
#### getter: canShowCytobands



```js
// Type
any
```
#### property: displayedRegions


```js
 self.displayedRegions
```
#### getter: showCytobands



```js
// Type
boolean
```
#### property: showCytobandsSetting


```js
 self.showCytobandsSetting
```
#### getter: anyCytobandsExist



```js
// Type
boolean
```
#### getter: assemblyNames



```js
// Type
any[]
```
#### getter: cytobandOffset


the cytoband is displayed to the right of the chromosome name,
and that offset is calculated manually with this method
```js
// Type
number
```
#### property: displayedRegions


```js
self.displayedRegions
```
#### method: menuItems
return the view menu items
```js
// Type signature
menuItems: () => MenuItem[]
```
#### action: activateTrackSelector



```js
// Type signature
activateTrackSelector: () => Widget
```
#### action: horizontallyFlip



```js
// Type signature
horizontallyFlip: () => void
```
#### action: showAllRegionsInAssembly



```js
// Type signature
showAllRegionsInAssembly: (assemblyName?: string) => void
```
#### property: showCenterLine


```js
 self.showCenterLine
```
#### action: toggleCenterLine



```js
// Type signature
toggleCenterLine: () => void
```
#### property: hideHeader


```js
self.hideHeader
```
#### action: toggleHeader



```js
// Type signature
toggleHeader: () => void
```
#### property: hideHeaderOverview


```js
self.hideHeaderOverview
```
#### action: toggleHeaderOverview



```js
// Type signature
toggleHeaderOverview: () => void
```
#### property: hideHeader


```js
 self.hideHeader
```
#### property: hideNoTracksActive


```js
self.hideNoTracksActive
```
#### action: toggleNoTracksActive



```js
// Type signature
toggleNoTracksActive: () => void
```
#### property: showGridlines


```js
 self.showGridlines
```
#### action: toggleShowGridlines



```js
// Type signature
toggleShowGridlines: () => void
```
#### getter: showCytobands



```js
// Type
boolean
```
#### action: setShowCytobands



```js
// Type signature
setShowCytobands: (flag: boolean) => void
```
#### property: trackLabels


```js
 self.trackLabels
```
#### action: setTrackLabels



```js
// Type signature
setTrackLabels: (setting: "overlapping" | "offset" | "hidden") => void
```
#### property: trackLabels


```js
 self.trackLabels
```
#### action: setTrackLabels



```js
// Type signature
setTrackLabels: (setting: "overlapping" | "offset" | "hidden") => void
```
#### property: trackLabels


```js
 self.trackLabels
```
#### action: setTrackLabels



```js
// Type signature
setTrackLabels: (setting: "overlapping" | "offset" | "hidden") => void
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
#### getter: dynamicBlocks


dynamic blocks represent the exact coordinates of the currently
visible genome regions on the screen. they are similar to static
blocks, but statcic blocks can go offscreen while dynamic blocks
represent exactly what is on screen
```js
// Type
BlockSet
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
#### action: setDisplayedRegions



```js
// Type signature
setDisplayedRegions: (regions: Region[]) => void
```
#### action: setDisplayedRegions



```js
// Type signature
setDisplayedRegions: (regions: Region[]) => void
```
#### action: showAllRegions



```js
// Type signature
showAllRegions: () => void
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
#### getter: assemblyNames



```js
// Type
any[]
```
#### property: displayedRegions


```js
self.displayedRegions
```
#### property: displayedRegions


```js
 self.displayedRegions
```
#### property: displayedRegions


```js
 self.displayedRegions
```
#### property: displayedRegions


```js
 self.displayedRegions
```
#### property: displayedRegions


```js
 self.displayedRegions
```
#### property: displayedRegions


```js

              self.displayedRegions
```
#### method: rubberBandMenuItems

```js
// Type signature
rubberBandMenuItems: () => MenuItem[]
```
#### action: moveTo


offset is the base-pair-offset in the displayed region, index is the index of the
displayed region in the linear genome view
```js
// Type signature
moveTo: (start?: BpOffset, end?: BpOffset) => void
```
#### action: setGetSequenceDialogOpen



```js
// Type signature
setGetSequenceDialogOpen: (open: boolean) => void
```
#### method: bpToPx

```js
// Type signature
bpToPx: ({ refName, coord, regionNumber, }: { refName: string; coord: number; regionNumber?: number; }) => { index: number; offsetPx: number; }
```
#### method: centerAt
scrolls the view to center on the given bp. if that is not in any
of the displayed regions, does nothing
```js
// Type signature
centerAt: (coord: number, refName: string, regionNumber: number) => void
```
#### action: scrollTo



```js
// Type signature
scrollTo: (offsetPx: number) => number
```
#### getter: width



```js
// Type
any
```
#### method: pxToBp

```js
// Type signature
pxToBp: (px: number) => { coord: number; index: number; refName: string; oob: boolean; assemblyName: string; offset: number; start: number; end: number; reversed: boolean; }
```
#### getter: centerLineInfo



```js
// Type
any
```
#### property: displayedRegions


```js
 self.displayedRegions
```
#### getter: width



```js
// Type
any
```
