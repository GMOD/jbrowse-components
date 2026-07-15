---
id: lineargenomeview
title: LinearGenomeView
sidebar_label: View -> LinearGenomeView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-genome-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/LinearGenomeView/model.ts).

## Example usage

A `LinearGenomeView` is what you hand-author under `defaultSession.views`. The
`init` shorthand fills in `displayedRegions`/`bpPerPx`/`offsetPx` for you:

```js
defaultSession: {
  name: 'My session',
  views: [
    {
      type: 'LinearGenomeView',
      // plain persisted props sit alongside init, not inside it
      colorByCDS: true,
      init: {
        assembly: 'hg38',
        loc: 'chr1:1,000,000-1,100,000',
        tracks: ['genes', 'alignments'],
      },
    },
  ],
}
```

`init` holds only keys that need on-attach resolution — also `tracklist`, `nav`,
`highlight` (see the `init` property below). Plain view props like `colorByCDS`,
`showCenterLine`, `trackLabels`, `showHighlightChips` are set directly on the
view (MST restores them natively). At runtime the same model is driven
imperatively — every property and action below is reachable on
`viewState.session.views[0]`:

```js
const view = viewState.session.views[0]
await view.navToLocString('chr1:2,000,000-2,100,000')
view.showTrack('alignments')
view.setBpPerPx(view.bpPerPx * 2) // zoom out 2x
```

## Overview

## Members

| Member                                                                   | Kind       | Defined by                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ---------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                                       | Properties | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [type](#property-type)                                                   | Properties | LinearGenomeView                      | this is a string instead of the const literal 'LinearGenomeView' to reduce some typescripting strictness, but you should pass the string 'LinearGenomeView' to the model explicitly                                                                                                                                                                                                                                                                     |
| [offsetPx](#property-offsetpx)                                           | Properties | LinearGenomeView                      | corresponds roughly to the horizontal scroll of the LGV                                                                                                                                                                                                                                                                                                                                                                                                 |
| [bpPerPx](#property-bpperpx)                                             | Properties | LinearGenomeView                      | corresponds roughly to the zoom level, base-pairs per pixel                                                                                                                                                                                                                                                                                                                                                                                             |
| [displayedRegions](#property-displayedregions)                           | Properties | LinearGenomeView                      | currently displayed regions, can be a single chromosome, arbitrary subsections, or the entire set of chromosomes in the genome, but it not advised to use the entire set of chromosomes if your assembly is very fragmented                                                                                                                                                                                                                             |
| [tracks](#property-tracks)                                               | Properties | LinearGenomeView                      | array of currently displayed tracks state models instances                                                                                                                                                                                                                                                                                                                                                                                              |
| [hideHeader](#property-hideheader)                                       | Properties | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hideHeaderOverview](#property-hideheaderoverview)                       | Properties | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hideNoTracksActive](#property-hidenotracksactive)                       | Properties | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [trackSelectorType](#property-trackselectortype)                         | Properties | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [showCenterLine](#property-showcenterline)                               | Properties | LinearGenomeView                      | show the "center line"                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [showCytobands](#property-showcytobands)                                 | Properties | LinearGenomeView                      | whether to show the "cytobands" in the overview scale bar (the resolved, capability-gated value is the `effectiveShowCytobands` getter)                                                                                                                                                                                                                                                                                                                 |
| [trackLabels](#property-tracklabels)                                     | Properties | LinearGenomeView                      | how to display the track labels, can be "overlapping", "offset", or "hidden", or empty string "" (which results in the LinearGenomeViewPlugin config default being used). the resolved value is the `effectiveTrackLabels` getter. see LinearGenomeViewPlugin https://jbrowse.org/jb2/docs/config/lineargenomeviewplugin/ docs for how conf is used                                                                                                     |
| [showGridlines](#property-showgridlines)                                 | Properties | LinearGenomeView                      | show the "gridlines" in the track area                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [labelsVisible](#property-labelsvisible)                                 | Properties | LinearGenomeView                      | controls whether highlight/bookmark chip labels are shown inline                                                                                                                                                                                                                                                                                                                                                                                        |
| [colorByCDS](#property-colorbycds)                                       | Properties | LinearGenomeView                      | color by CDS                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [showTrackOutlines](#property-showtrackoutlines)                         | Properties | LinearGenomeView                      | show the track outlines                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [scalebarOnly](#property-scalebaronly)                                   | Properties | LinearGenomeView                      | when true, only the header and coordinate scalebar are rendered                                                                                                                                                                                                                                                                                                                                                                                         |
| [init](#property-init)                                                   | Properties | LinearGenomeView                      | transient declarative launch spec: assembly + optional location, tracks, and highlights to apply once the view attaches. It is applied by the afterAttach autorun and then cleared (setInit(undefined)), so a saved session never retains it. Shared by all three launch surfaces — URL params, createViewState(), and session/config JSON. example: `json { "assembly": "hg19", "loc": "chr1:1,000,000-2,000,000", "tracks": ["genes", "variants"] } ` |
| [volatileWidth](#volatile-volatilewidth)                                 | Volatiles  | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [minimumBlockWidth](#volatile-minimumblockwidth)                         | Volatiles  | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [draggingTrackId](#volatile-draggingtrackid)                             | Volatiles  | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [lastTrackDragY](#volatile-lasttrackdragy)                               | Volatiles  | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [volatileError](#volatile-volatileerror)                                 | Volatiles  | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [trackRefs](#volatile-trackrefs)                                         | Volatiles  | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [coarseDynamicBlocks](#volatile-coarsedynamicblocks)                     | Volatiles  | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [coarseTotalBp](#volatile-coarsetotalbp)                                 | Volatiles  | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [coarseBpPerPx](#volatile-coarsebpperpx)                                 | Volatiles  | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [leftOffset](#volatile-leftoffset)                                       | Volatiles  | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [rightOffset](#volatile-rightoffset)                                     | Volatiles  | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [isScalebarRefNameMenuOpen](#volatile-isscalebarrefnamemenuopen)         | Volatiles  | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [scalebarRefNameClickPending](#volatile-scalebarrefnameclickpending)     | Volatiles  | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [volatileGuides](#volatile-volatileguides)                               | Volatiles  | LinearGenomeView                      | temporary vertical guides that can be set by displays (e.g., LD display hover)                                                                                                                                                                                                                                                                                                                                                                          |
| [scrollZoom](#getter-scrollzoom)                                         | Getters    | LinearGenomeView                      | scroll-to-zoom is a global, personal preference resolved from the session; toggling it in any view applies everywhere                                                                                                                                                                                                                                                                                                                                   |
| [pinnedTracks](#getter-pinnedtracks)                                     | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [unpinnedTracks](#getter-unpinnedtracks)                                 | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [effectiveTrackLabels](#getter-effectivetracklabels)                     | Getters    | LinearGenomeView                      | the effective track labels setting, resolving the stored `trackLabels` against the LinearGenomeViewPlugin config default                                                                                                                                                                                                                                                                                                                                |
| [width](#getter-width)                                                   | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [trackWidthPx](#getter-trackwidthpx)                                     | Getters    | LinearGenomeView                      | width minus track outline borders (1px each side when shown)                                                                                                                                                                                                                                                                                                                                                                                            |
| [assemblyNames](#getter-assemblynames)                                   | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [assemblyDisplayNames](#getter-assemblydisplaynames)                     | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [isTopLevelView](#getter-istoplevelview)                                 | Getters    | LinearGenomeView                      | checking if lgv is a 'top-level' view is used for toggling pin track capability, sticky positioning                                                                                                                                                                                                                                                                                                                                                     |
| [stickyViewHeaders](#getter-stickyviewheaders)                           | Getters    | LinearGenomeView                      | only uses sticky view headers when it is a 'top-level' view and session allows it                                                                                                                                                                                                                                                                                                                                                                       |
| [rubberbandTop](#getter-rubberbandtop)                                   | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [pinnedTracksTop](#getter-pinnedtrackstop)                               | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [scalebarDisplayPrefix](#getter-scalebardisplayprefix)                   | Getters    | LinearGenomeView                      | Assembly-name prefix for the scalebar refName labels, or undefined for none. A container view (e.g. LinearSyntenyView) opts its sub-views in by exposing showAssemblyNameInSubviewScalebar; duck-typed rather than matching a concrete view type so no upward plugin dependency is needed and any container can opt in. A wrong nesting depth simply yields no prefix.                                                                                  |
| [assembliesNotFound](#getter-assembliesnotfound)                         | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [assemblyErrors](#getter-assemblyerrors)                                 | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [assembliesInitialized](#getter-assembliesinitialized)                   | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [initialized](#getter-initialized)                                       | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hasDisplayedRegions](#getter-hasdisplayedregions)                       | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [loadingMessage](#getter-loadingmessage)                                 | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hasSomethingToShow](#getter-hassomethingtoshow)                         | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [showLoading](#getter-showloading)                                       | Getters    | LinearGenomeView                      | Whether to show a loading indicator instead of the import form or view                                                                                                                                                                                                                                                                                                                                                                                  |
| [showImportForm](#getter-showimportform)                                 | Getters    | LinearGenomeView                      | Whether to show the import form                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [scalebarHeight](#getter-scalebarheight)                                 | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [headerHeight](#getter-headerheight)                                     | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [trackHeights](#getter-trackheights)                                     | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [trackHeightsWithResizeHandles](#getter-trackheightswithresizehandles)   | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [height](#getter-height)                                                 | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [totalBp](#getter-totalbp)                                               | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [maxBpPerPx](#getter-maxbpperpx)                                         | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [minBpPerPx](#getter-minbpperpx)                                         | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [error](#getter-error)                                                   | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [maxOffset](#getter-maxoffset)                                           | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [minOffset](#getter-minoffset)                                           | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [displayedRegionsTotalPx](#getter-displayedregionstotalpx)               | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [trackMap](#getter-trackmap)                                             | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [canShowCytobands](#getter-canshowcytobands)                             | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [effectiveShowCytobands](#getter-effectiveshowcytobands)                 | Getters    | LinearGenomeView                      | the `showCytobands` setting gated by whether cytobands can be shown at all (single region + data present) — i.e. actually on screen                                                                                                                                                                                                                                                                                                                     |
| [anyCytobandsExist](#getter-anycytobandsexist)                           | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [cytobandOffset](#getter-cytobandoffset)                                 | Getters    | LinearGenomeView                      | the cytoband is displayed to the right of the chromosome name, and that offset is calculated manually with this method                                                                                                                                                                                                                                                                                                                                  |
| [isTrackSelectorOpen](#getter-istrackselectoropen)                       | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [overviewLayout](#getter-overviewlayout)                                 | Getters    | LinearGenomeView                      | geometry of the overview scalebar — derived from displayedRegions, width, and cytobandOffset so it stays cached by MobX                                                                                                                                                                                                                                                                                                                                 |
| [staticBlocks](#getter-staticblocks)                                     | Getters    | LinearGenomeView                      | static blocks are an important concept jbrowse uses to avoid re-rendering when you scroll to the side. when you horizontally scroll to the right, old blocks to the left may be removed, and new blocks may be instantiated on the right. tracks may use the static blocks to render their data for the region represented by the block                                                                                                                 |
| [dynamicBlocks](#getter-dynamicblocks)                                   | Getters    | LinearGenomeView                      | dynamic blocks represent the exact coordinates of the currently visible genome regions on the screen. they are similar to static blocks, but static blocks can go offscreen while dynamic blocks represent exactly what is on screen                                                                                                                                                                                                                    |
| [overviewBlocks](#getter-overviewblocks)                                 | Getters    | LinearGenomeView                      | all overview scalebar blocks (content + elided), laid out on the overviewLayout. memoized so the scalebar doesn't recompute it per render                                                                                                                                                                                                                                                                                                               |
| [overviewContentBlocksPxSpan](#getter-overviewcontentblockspxspan)       | Getters    | LinearGenomeView                      | leading/trailing pixel span of the visible content blocks projected onto the overviewLayout — the geometry shared by the overview's "you are here" rectangle and polygon                                                                                                                                                                                                                                                                                |
| [scalebarRegionEndPx](#getter-scalebarregionendpx)                       | Getters    | LinearGenomeView                      | Max right-edge pixel position for each displayedRegionIndex, derived from staticBlocks geometry. staticBlocks caches a stable reference when only offsetPx changes, so this getter is also stable during normal scroll — avoiding a Map rebuild every frame. Used by ScalebarRefNameLabels to clip chromosome name labels.                                                                                                                              |
| [gridlineTicks](#getter-gridlineticks)                                   | Getters    | LinearGenomeView                      | Gridline tick positions (x relative to the staticBlocks frame), derived from staticBlocks + bpPerPx. Computed once and shared by every Gridlines instance (scalebar, main view, each pinned track) rather than recomputing the makeTicks loop per component.                                                                                                                                                                                            |
| [scalebarLabels](#getter-scalebarlabels)                                 | Getters    | LinearGenomeView                      | Scalebar coordinate labels (x in the staticBlocks frame + display text). Sibling of gridlineTicks sharing the same makeBlockTicks formula, so labels line up exactly with their gridlines. staticBlocks chop a region into ~800px chunks; groupContiguousBlocks merges them back per region so a label on an internal chunk boundary isn't clipped away by both neighbors — only genuine region edges clip a label.                                     |
| [totalWidthPx](#getter-totalwidthpx)                                     | Getters    | LinearGenomeView                      | Integer-rounded sum of all visible block widths. Slightly less than view.width when the genome ends before the right edge; use view.width for SVG clip rects (display boundary) and this for paint canvas sizing (actual content width).                                                                                                                                                                                                                |
| [totalWidthPxWithoutBorders](#getter-totalwidthpxwithoutborders)         | Getters    | LinearGenomeView                      | Like totalWidthPx but excluding inter-region boundary blocks. Used when column layout divides the canvas width by feature count.                                                                                                                                                                                                                                                                                                                        |
| [visibleBp](#getter-visiblebp)                                           | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [visibleRegions](#getter-visibleregions)                                 | Getters    | LinearGenomeView                      | Returns the currently visible content blocks with screen pixel positions and displayedRegionIndex guaranteed. Used by WebGL displays for per-region data fetching and rendering.                                                                                                                                                                                                                                                                        |
| [bufferedVisibleRegions](#getter-bufferedvisibleregions)                 | Getters    | LinearGenomeView                      | visibleRegions expanded by a half-screen buffer on each side, clamped to displayedRegion bounds, with integer-rounded coordinates. Use this when fetching data that should extend slightly beyond the viewport for smooth scrolling.                                                                                                                                                                                                                    |
| [visibleLocStrings](#getter-visiblelocstrings)                           | Getters    | LinearGenomeView                      | a single "combo-locstring" representing all the regions visible on the screen                                                                                                                                                                                                                                                                                                                                                                           |
| [coarseVisibleLocStrings](#getter-coarsevisiblelocstrings)               | Getters    | LinearGenomeView                      | same as visibleLocStrings, but only updated every 500ms                                                                                                                                                                                                                                                                                                                                                                                                 |
| [coarseTotalBpDisplayStr](#getter-coarsetotalbpdisplaystr)               | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [effectiveTotalBp](#getter-effectivetotalbp)                             | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [effectiveTotalBpDisplayStr](#getter-effectivetotalbpdisplaystr)         | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [centerLineInfo](#getter-centerlineinfo)                                 | Getters    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [MiniControlsComponent](#method-minicontrolscomponent)                   | Methods    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [HeaderComponent](#method-headercomponent)                               | Methods    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [trackHeight](#method-trackheight)                                       | Methods    | LinearGenomeView                      | rendered height of a single track, collapsing to a fixed height when minimized. Shared by trackHeights and getTrackYOffset so the two can't disagree.                                                                                                                                                                                                                                                                                                   |
| [getTrackYOffset](#method-gettrackyoffset)                               | Methods    | LinearGenomeView                      | Y offset (in pixels, from the top of the view) where a track's rendering container starts. Walks tracks in DOM render order (pinned first, then unpinned), matching TrackContainer's layout and using the same constants it renders with. Returns `undefined` if the track is not present in the view.                                                                                                                                                  |
| [trackSection](#method-tracksection)                                     | Methods    | LinearGenomeView                      | the pinned or unpinned sibling list a track renders within; move up/down/top/bottom reorder inside this section rather than the full `tracks` array, since the two sections lay out independently                                                                                                                                                                                                                                                       |
| [searchScope](#method-searchscope)                                       | Methods    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [getTrack](#method-gettrack)                                             | Methods    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [getActiveDisplayId](#method-getactivedisplayid)                         | Methods    | LinearGenomeView                      | displayId of the active (shown) display for a track in this view, used by the config editor to expand the relevant display and collapse the track's other displays                                                                                                                                                                                                                                                                                      |
| [getSelectedRegions](#method-getselectedregions)                         | Methods    | LinearGenomeView                      | Helper method for the fetchSequence. Retrieves the corresponding regions that were selected by the rubberband                                                                                                                                                                                                                                                                                                                                           |
| [exportSvg](#method-exportsvg)                                           | Methods    | LinearGenomeView                      | creates an svg export and save using FileSaver                                                                                                                                                                                                                                                                                                                                                                                                          |
| [menuItems](#method-menuitems)                                           | Methods    | LinearGenomeView                      | return the view menu items                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [rubberBandMenuItems](#method-rubberbandmenuitems)                       | Methods    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [bpToPx](#method-bptopx)                                                 | Methods    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [getHighlightCoords](#method-gethighlightcoords)                         | Methods    | LinearGenomeView                      | Map a highlight or bookmark region to its pixel position+width inside the tracks container. Falls back to the raw refName if the region's assemblyName is missing or unknown so highlights authored without an assembly still render in single-assembly views.                                                                                                                                                                                          |
| [getOverviewHighlightCoords](#method-getoverviewhighlightcoords)         | Methods    | LinearGenomeView                      | like getHighlightCoords but laid out against the overview scalebar and shifted by the cytoband offset                                                                                                                                                                                                                                                                                                                                                   |
| [centerAt](#method-centerat)                                             | Methods    | LinearGenomeView                      | scrolls the view to center on the given bp. if that is not in any of the displayed regions, does nothing                                                                                                                                                                                                                                                                                                                                                |
| [pxToBp](#method-pxtobp)                                                 | Methods    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [rubberbandClickMenuItems](#method-rubberbandclickmenuitems)             | Methods    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [highlightMenuItems](#method-highlightmenuitems)                         | Methods    | LinearGenomeView                      | returns menu items for a highlight context menu. plugins can extend this via Core-extendPluggableElement to add their own items                                                                                                                                                                                                                                                                                                                         |
| [setShowTrackOutlines](#action-setshowtrackoutlines)                     | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setScrollZoom](#action-setscrollzoom)                                   | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setColorByCDS](#action-setcolorbycds)                                   | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setShowCytobands](#action-setshowcytobands)                             | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setWidth](#action-setwidth)                                             | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setError](#action-seterror)                                             | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setIsScalebarRefNameMenuOpen](#action-setisscalebarrefnamemenuopen)     | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setScalebarRefNameClickPending](#action-setscalebarrefnameclickpending) | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setHideHeader](#action-sethideheader)                                   | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setHideHeaderOverview](#action-sethideheaderoverview)                   | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setScalebarOnly](#action-setscalebaronly)                               | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setHideNoTracksActive](#action-sethidenotracksactive)                   | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setShowGridlines](#action-setshowgridlines)                             | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setLabelsVisible](#action-setlabelsvisible)                             | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setVolatileGuides](#action-setvolatileguides)                           | Actions    | LinearGenomeView                      | set temporary vertical guides (e.g., for LD display hover)                                                                                                                                                                                                                                                                                                                                                                                              |
| [scrollTo](#action-scrollto)                                             | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [zoomTo](#action-zoomto)                                                 | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setOffsets](#action-setoffsets)                                         | Actions    | LinearGenomeView                      | sets offsets of rubberband, used in the get sequence dialog can call view.getSelectedRegions(view.leftOffset,view.rightOffset) to compute the selected regions from the offsets                                                                                                                                                                                                                                                                         |
| [setSearchResults](#action-setsearchresults)                             | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setNewView](#action-setnewview)                                         | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [horizontallyFlip](#action-horizontallyflip)                             | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [showTrack](#action-showtrack)                                           | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hideTrack](#action-hidetrack)                                           | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [moveTrackDown](#action-movetrackdown)                                   | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [moveTrackUp](#action-movetrackup)                                       | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [moveTrackToTop](#action-movetracktotop)                                 | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [moveTrackToBottom](#action-movetracktobottom)                           | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [moveTrack](#action-movetrack)                                           | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [toggleTrack](#action-toggletrack)                                       | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setTrackLabels](#action-settracklabels)                                 | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setShowCenterLine](#action-setshowcenterline)                           | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setDisplayedRegions](#action-setdisplayedregions)                       | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [activateTrackSelector](#action-activatetrackselector)                   | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [toggleTrackSelector](#action-toggletrackselector)                       | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [horizontalScroll](#action-horizontalscroll)                             | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [showAllRegions](#action-showallregions)                                 | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [showAllRegionsInAssembly](#action-showallregionsinassembly)             | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setDraggingTrackId](#action-setdraggingtrackid)                         | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setLastTrackDragY](#action-setlasttrackdragy)                           | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [onTrackDragOver](#action-ontrackdragover)                               | Actions    | LinearGenomeView                      | called while dragging a track over the track at `targetId`; reorders once the cursor has moved far enough (see shouldSwapTracks) to avoid jitter when a short track is dragged over a tall one                                                                                                                                                                                                                                                          |
| [clearView](#action-clearview)                                           | Actions    | LinearGenomeView                      | this "clears the view" and makes the view return to the import form                                                                                                                                                                                                                                                                                                                                                                                     |
| [setInit](#action-setinit)                                               | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [slide](#action-slide)                                                   | Actions    | LinearGenomeView                      | perform animated slide                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [zoom](#action-zoom)                                                     | Actions    | LinearGenomeView                      | perform animated zoom                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [cancelZoomAnimation](#action-cancelzoomanimation)                       | Actions    | LinearGenomeView                      | cancel an in-flight animated zoom, e.g. when the user takes over with the zoom slider or another direct zoomTo. Without this a running spring keeps driving self.zoomTo from its own internal position and overwrites the direct interaction on the next frame.                                                                                                                                                                                         |
| [setCoarseDynamicBlocks](#action-setcoarsedynamicblocks)                 | Actions    | LinearGenomeView                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [moveTo](#action-moveto)                                                 | Actions    | LinearGenomeView                      | offset is the base-pair-offset in the displayed region, index is the index of the displayed region in the linear genome view                                                                                                                                                                                                                                                                                                                            |
| [navToLocString](#action-navtolocstring)                                 | Actions    | LinearGenomeView                      | Navigate to the given locstring, will change displayed regions if needed, and wait for assemblies to be initialized                                                                                                                                                                                                                                                                                                                                     |
| [navToLocations](#action-navtolocations)                                 | Actions    | LinearGenomeView                      | Similar to `navToLocString`, but accepts a list of parsed location objects instead of a locstring. Will try to perform `setDisplayedRegions` if changing regions                                                                                                                                                                                                                                                                                        |
| [navTo](#action-navto)                                                   | Actions    | LinearGenomeView                      | Navigate to a location based on its refName and optionally start, end, and assemblyName. Will not try to change displayed regions, use `navToLocations` instead. Only navigates to a location if it is entirely within a displayedRegion. Navigates to the first matching location encountered. Throws an error if navigation was unsuccessful                                                                                                          |
| [navToMultiple](#action-navtomultiple)                                   | Actions    | LinearGenomeView                      | Navigate to a location based on its refName and optionally start, end, and assemblyName. Will not try to change displayed regions, use navToLocations instead. Only navigates to a location if it is entirely within a displayedRegion. Navigates to the first matching location encountered. Throws an error if navigation was unsuccessful                                                                                                            |
| [navToLocation](#action-navtolocation)                                   | Actions    | LinearGenomeView                      | Similar to `navToLocString`, but accepts a parsed location object instead of a locstring. Will try to perform `setDisplayedRegions` if changing regions                                                                                                                                                                                                                                                                                                 |
| [displayName](#property-displayname)                                     | Properties | [BaseViewModel](../baseviewmodel)     | displayName is displayed in the header of the view, or assembly names being used if none is specified                                                                                                                                                                                                                                                                                                                                                   |
| [minimized](#property-minimized)                                         | Properties | [BaseViewModel](../baseviewmodel)     |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [width](#volatile-width)                                                 | Volatiles  | [BaseViewModel](../baseviewmodel)     |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setDisplayName](#action-setdisplayname)                                 | Actions    | [BaseViewModel](../baseviewmodel)     |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setMinimized](#action-setminimized)                                     | Actions    | [BaseViewModel](../baseviewmodel)     |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [highlight](#property-highlight)                                         | Properties | [HighlightsMixin](../highlightsmixin) | translucent highlight bands, seeded from URL params or session JSON and added interactively via the rubber-band menu                                                                                                                                                                                                                                                                                                                                    |
| [showHighlightChips](#property-showhighlightchips)                       | Properties | [HighlightsMixin](../highlightsmixin) | controls whether the interactive highlight chip (link icon + context menu) is drawn on each highlight band; off by default                                                                                                                                                                                                                                                                                                                              |
| [addToHighlights](#action-addtohighlights)                               | Actions    | [HighlightsMixin](../highlightsmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setHighlight](#action-sethighlight)                                     | Actions    | [HighlightsMixin](../highlightsmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [removeHighlight](#action-removehighlight)                               | Actions    | [HighlightsMixin](../highlightsmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [updateHighlight](#action-updatehighlight)                               | Actions    | [HighlightsMixin](../highlightsmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setShowHighlightChips](#action-setshowhighlightchips)                   | Actions    | [HighlightsMixin](../highlightsmixin) |                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

<details>
<summary>LinearGenomeView - Properties</summary>

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

#### property: showCytobands

whether to show the "cytobands" in the overview scale bar (the resolved,
capability-gated value is the `effectiveShowCytobands` getter)

```ts
// type signature
type showCytobands = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showCytobands: types.optional(types.boolean, () =>
  localStorageGetBoolean('lgv-showCytobands', true),
)
```

#### property: trackLabels

how to display the track labels, can be "overlapping", "offset", or "hidden", or
empty string "" (which results in the LinearGenomeViewPlugin config default
being used). the resolved value is the `effectiveTrackLabels` getter. see
LinearGenomeViewPlugin
https://jbrowse.org/jb2/docs/config/lineargenomeviewplugin/ docs for how conf is
used

```ts
// type signature
type trackLabels = IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackLabels: types.optional(
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

<details>
<summary>LinearGenomeView - Properties (other undocumented members)</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
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

</details>

<details>
<summary>LinearGenomeView - Volatiles</summary>

#### volatile: volatileGuides

temporary vertical guides that can be set by displays (e.g., LD display hover)

```ts
// type signature
type volatileGuides = VolatileGuide[]
// code
volatileGuides: [] as VolatileGuide[]
```

</details>

<details>
<summary>LinearGenomeView - Volatiles (other undocumented members)</summary>

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

</details>

<details>
<summary>LinearGenomeView - Getters</summary>

#### getter: scrollZoom

scroll-to-zoom is a global, personal preference resolved from the session;
toggling it in any view applies everywhere

```ts
type scrollZoom = boolean
```

#### getter: effectiveTrackLabels

the effective track labels setting, resolving the stored `trackLabels` against
the LinearGenomeViewPlugin config default

```ts
type effectiveTrackLabels = any
```

#### getter: trackWidthPx

width minus track outline borders (1px each side when shown)

```ts
type trackWidthPx = number
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

#### getter: scalebarDisplayPrefix

Assembly-name prefix for the scalebar refName labels, or undefined for none. A
container view (e.g. LinearSyntenyView) opts its sub-views in by exposing
showAssemblyNameInSubviewScalebar; duck-typed rather than matching a concrete
view type so no upward plugin dependency is needed and any container can opt in.
A wrong nesting depth simply yields no prefix.

```ts
type scalebarDisplayPrefix = string | undefined
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

#### getter: effectiveShowCytobands

the `showCytobands` setting gated by whether cytobands can be shown at all
(single region + data present) — i.e. actually on screen

```ts
type effectiveShowCytobands = boolean
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
  { leftPx: number; rightPx: number } | undefined
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

#### getter: scalebarLabels

Scalebar coordinate labels (x in the staticBlocks frame + display text). Sibling
of gridlineTicks sharing the same makeBlockTicks formula, so labels line up
exactly with their gridlines. staticBlocks chop a region into ~800px chunks;
groupContiguousBlocks merges them back per region so a label on an internal
chunk boundary isn't clipped away by both neighbors — only genuine region edges
clip a label.

```ts
type scalebarLabels = { x: number; label: string; key: string }[]
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

</details>

<details>
<summary>LinearGenomeView - Getters (other undocumented members)</summary>

#### getter: pinnedTracks

```ts
type pinnedTracks = any[]
```

#### getter: unpinnedTracks

```ts
type unpinnedTracks = any[]
```

#### getter: width

```ts
type width = number
```

#### getter: assemblyNames

```ts
type assemblyNames = string[]
```

#### getter: assemblyDisplayNames

```ts
type assemblyDisplayNames = string[]
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

#### getter: canShowCytobands

```ts
type canShowCytobands = boolean
```

#### getter: anyCytobandsExist

```ts
type anyCytobandsExist = boolean
```

#### getter: isTrackSelectorOpen

```ts
type isTrackSelectorOpen = boolean
```

#### getter: visibleBp

```ts
type visibleBp = number
```

#### getter: coarseTotalBpDisplayStr

```ts
type coarseTotalBpDisplayStr = string
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
type centerLineInfo = PxToBpResult | undefined
```

</details>

<details>
<summary>LinearGenomeView - Methods</summary>

#### method: trackHeight

rendered height of a single track, collapsing to a fixed height when minimized.
Shared by trackHeights and getTrackYOffset so the two can't disagree.

```ts
type trackHeight = (track: any) => any
```

#### method: getTrackYOffset

Y offset (in pixels, from the top of the view) where a track's rendering
container starts. Walks tracks in DOM render order (pinned first, then
unpinned), matching TrackContainer's layout and using the same constants it
renders with. Returns `undefined` if the track is not present in the view.

```ts
type getTrackYOffset = (trackId: string) => number | undefined
```

#### method: trackSection

the pinned or unpinned sibling list a track renders within; move
up/down/top/bottom reorder inside this section rather than the full `tracks`
array, since the two sections lay out independently

```ts
type trackSection = (id: string) => any[]
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

#### method: highlightMenuItems

returns menu items for a highlight context menu. plugins can extend this via
Core-extendPluggableElement to add their own items

```ts
type highlightMenuItems = (_highlight: HighlightType) => MenuItem[]
```

</details>

<details>
<summary>LinearGenomeView - Methods (other undocumented members)</summary>

#### method: MiniControlsComponent

```ts
type MiniControlsComponent = () => FC<any>
```

#### method: HeaderComponent

```ts
type HeaderComponent = () => FC<any>
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

#### method: pxToBp

```ts
type pxToBp = (px: number) => PxToBpResult
```

#### method: rubberbandClickMenuItems

```ts
type rubberbandClickMenuItems = (clickOffset: BpOffset) => MenuItem[]
```

</details>

<details>
<summary>LinearGenomeView - Actions</summary>

#### action: setVolatileGuides

set temporary vertical guides (e.g., for LD display hover)

```ts
type setVolatileGuides = (guides: VolatileGuide[]) => void
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

#### action: cancelZoomAnimation

cancel an in-flight animated zoom, e.g. when the user takes over with the zoom
slider or another direct zoomTo. Without this a running spring keeps driving
self.zoomTo from its own internal position and overwrites the direct interaction
on the next frame.

```ts
type cancelZoomAnimation = () => void
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

<details>
<summary>LinearGenomeView - Actions (other undocumented members)</summary>

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

#### action: setLabelsVisible

```ts
type setLabelsVisible = (arg: boolean) => void
```

#### action: scrollTo

```ts
type scrollTo = (offsetPx: number) => number
```

#### action: zoomTo

```ts
type zoomTo = (bpPerPx: number, offset?: any) => number
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

#### action: toggleTrackSelector

```ts
type toggleTrackSelector = () => Widget
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

#### action: setInit

```ts
type setInit = (arg?: InitState | undefined) => void
```

#### action: setCoarseDynamicBlocks

```ts
type setCoarseDynamicBlocks = (blocks: BlockSet, bpPerPx: number) => void
```

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseViewModel</summary>

[BaseViewModel →](../baseviewmodel)

**Properties**

#### property: displayName

displayName is displayed in the header of the view, or assembly names being used
if none is specified

```ts
// type signature
type displayName = IMaybe<ISimpleType<string>>
// code
displayName: types.maybe(types.string)
```

#### property: minimized

```ts
// type signature
type minimized = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.stripDefault(types.boolean, false)
```

**Volatiles**

#### volatile: width

```ts
// type signature
type width = number
// code
width: 800
```

**Actions**

#### action: setDisplayName

```ts
type setDisplayName = (name: string) => void
```

#### action: setMinimized

```ts
type setMinimized = (flag: boolean) => void
```

</details>

<details>
<summary>Derived from HighlightsMixin</summary>

[HighlightsMixin →](../highlightsmixin)

**Properties**

#### property: highlight

translucent highlight bands, seeded from URL params or session JSON and added
interactively via the rubber-band menu

```ts
// type signature
type highlight = IOptionalIType<
  IArrayType<IType<HighlightType, HighlightType, HighlightType>>,
  [undefined]
>
// code
highlight: types.stripDefault(types.array(types.frozen<HighlightType>()), [])
```

#### property: showHighlightChips

controls whether the interactive highlight chip (link icon + context menu) is
drawn on each highlight band; off by default

```ts
// type signature
type showHighlightChips = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showHighlightChips: types.stripDefault(types.boolean, false)
```

**Actions**

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

#### action: setShowHighlightChips

```ts
type setShowHighlightChips = (arg: boolean) => void
```

</details>
