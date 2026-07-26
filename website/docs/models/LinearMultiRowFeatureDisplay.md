---
id: linearmultirowfeaturedisplay
title: LinearMultiRowFeatureDisplay
sidebar_label: Display -> LinearMultiRowFeatureDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`canvas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearMultiRowFeatureDisplay/model.ts).

## Overview

Multi-row interval painter (chromosome / ancestry painting). Partitions a single
feature track into stacked rows by a feature attribute and paints each feature
as a colored block on its row. GPU-rendered (WebGL/Canvas2D fallback) via the
shared per-region lifecycle. Rows are a `sources` chain (discovered →
layout-reconciled → subtree-filtered) and the left sidebar (labels +
dendrogram + reorder) is the shared `TreeSidebarMixin`.

## Members

| Member                                                                 | Kind       | Defined by                                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------- | ---------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                                 | Properties | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [configuration](#property-configuration)                               | Properties | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [runClustering](#property-runclustering)                               | Properties | LinearMultiRowFeatureDisplay                          | Transient declarative launch spec (like LinearGenomeView's `init`): set true — from the track menu or a saved session — to run row clustering once as soon as the display is ready; getMultiRowClusterAutorun clears it afterward so a saved session never re-triggers.                                                                                                                                                                       |
| [sortRowsBy](#property-sortrowsby)                                     | Properties | LinearMultiRowFeatureDisplay                          | Transient declarative launch spec (like `runClustering`): set `{refName, pos}` to sort the rows once by the value each carries at that genomic position — the in-app, session-expressible equivalent of a hand-computed `rowOrder`.                                                                                                                                                                                                           |
| [hiddenCategories](#property-hiddencategories)                         | Properties | LinearMultiRowFeatureDisplay                          | Legend categories toggled off (by label).                                                                                                                                                                                                                                                                                                                                                                                                     |
| [rpcDataMap](#volatile-rpcdatamap)                                     | Volatiles  | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [prefersOffset](#volatile-prefersoffset)                               | Volatiles  | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [hoveredFeature](#volatile-hoveredfeature)                             | Volatiles  | LinearMultiRowFeatureDisplay                          | The feature under the mouse, or undefined when not hovering a block.                                                                                                                                                                                                                                                                                                                                                                          |
| [contextMenuInfo](#volatile-contextmenuinfo)                           | Volatiles  | LinearMultiRowFeatureDisplay                          | Right-click context menu anchor + the genomic position clicked (and the feature there, if any).                                                                                                                                                                                                                                                                                                                                               |
| [conf](#getter-conf)                                                   | Getters    | LinearMultiRowFeatureDisplay                          | config typed off the concrete schema (ConfigurationReference erases it to any); direct reads route through here to stay typed                                                                                                                                                                                                                                                                                                                 |
| [densityGateEnabled](#getter-densitygateenabled)                       | Getters    | LinearMultiRowFeatureDisplay                          | Multi-row paints features into fixed lanes, so a high total feature count (e.g. a whole-chromosome haplotype painting with many segments per row) is not a per-glyph render cost — only the byte/download budget should gate it.                                                                                                                                                                                                              |
| [showLegend](#getter-showlegend)                                       | Getters    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showTree](#getter-showtree)                                           | Getters    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showBranchLength](#getter-showbranchlength)                           | Getters    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [partitionField](#getter-partitionfield)                               | Getters    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [lengthField](#getter-lengthfield)                                     | Getters    | LinearMultiRowFeatureDisplay                          | Feature attribute holding a signed bp length change vs the reference.                                                                                                                                                                                                                                                                                                                                                                         |
| [rowOrder](#getter-roworder)                                           | Getters    | LinearMultiRowFeatureDisplay                          | Optional explicit row order from config; values listed here are placed first, remaining discovered values follow in sorted order.                                                                                                                                                                                                                                                                                                             |
| [colorConfig](#getter-colorconfig)                                     | Getters    | LinearMultiRowFeatureDisplay                          | Raw `color` slot (a CSS color or `jexl:` string, or undefined when unset), forwarded to the worker which resolves it per feature.                                                                                                                                                                                                                                                                                                             |
| [sampleColorMap](#getter-samplecolormap)                               | Getters    | LinearMultiRowFeatureDisplay                          | Map of partition value → color, forwarded to the worker which applies it over the per-feature `color`.                                                                                                                                                                                                                                                                                                                                        |
| [rowProportion](#getter-rowproportion)                                 | Getters    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [sourcesWithoutLayout](#getter-sourceswithoutlayout)                   | Getters    | LinearMultiRowFeatureDisplay                          | Rows discovered in the loaded data: the distinct partition values across all loaded regions, ordered by the config `rowOrder` then sorted.                                                                                                                                                                                                                                                                                                    |
| [usedItemRgb](#getter-useditemrgb)                                     | Getters    | LinearMultiRowFeatureDisplay                          | Whether the loaded data colored itself via `itemRgb` (only possible with the `color` slot at its default).                                                                                                                                                                                                                                                                                                                                    |
| [editableSources](#getter-editablesources)                             | Getters    | LinearMultiRowFeatureDisplay                          | Discovered rows with the user's arrangement (reorder/relabel) applied — what the arrangement dialog edits.                                                                                                                                                                                                                                                                                                                                    |
| [sources](#getter-sources)                                             | Getters    | LinearMultiRowFeatureDisplay                          | The display rows: `editableSources` narrowed by the active subtree filter.                                                                                                                                                                                                                                                                                                                                                                    |
| [rowIndexByValue](#getter-rowindexbyvalue)                             | Getters    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [rowColorsByIndex](#getter-rowcolorsbyindex)                           | Getters    | LinearMultiRowFeatureDisplay                          | Per-row color (ABGR) by display row — the single per-row resolver (dialog color > config `sampleColorMap` > palette-when-default).                                                                                                                                                                                                                                                                                                            |
| [nrow](#getter-nrow)                                                   | Getters    | LinearMultiRowFeatureDisplay                          | Number of displayed rows (at least 1, so the auto-fit division is safe and the canvas mounts before data arrives).                                                                                                                                                                                                                                                                                                                            |
| [fitTargetHeight](#getter-fittargetheight)                             | Getters    | LinearMultiRowFeatureDisplay                          | The track height that auto-fit mode divides among rows: the `height` config slot (its default, or a drag-resized value written to it).                                                                                                                                                                                                                                                                                                        |
| [rowHeightSetting](#getter-rowheightsetting)                           | Getters    | LinearMultiRowFeatureDisplay                          | Resolved fixed row-height setting: `0` is auto-fit, any positive value is a pinned px height.                                                                                                                                                                                                                                                                                                                                                 |
| [colorLegend](#getter-colorlegend)                                     | Getters    | LinearMultiRowFeatureDisplay                          | Categorical color key.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [hiddenCategorySet](#getter-hiddencategoryset)                         | Getters    | LinearMultiRowFeatureDisplay                          | `hiddenCategories` as a Set for O(1) membership; shared by the on-screen and SVG-export legends (dimmed rows) and by `hiddenColors`.                                                                                                                                                                                                                                                                                                          |
| [hiddenColors](#getter-hiddencolors)                                   | Getters    | LinearMultiRowFeatureDisplay                          | ABGR colors currently hidden via the legend's category toggles: the `colorLegend` colors whose label is in `hiddenCategories`.                                                                                                                                                                                                                                                                                                                |
| [rowHeight](#getter-rowheight)                                         | Getters    | LinearMultiRowFeatureDisplay                          | Resolved per-row height.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [effectiveRowHeight](#getter-effectiverowheight)                       | Getters    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [height](#getter-height)                                               | Getters    | LinearMultiRowFeatureDisplay                          | Override BaseLinearDisplay.height so the track container matches the rendering canvas (numRows × rowHeight).                                                                                                                                                                                                                                                                                                                                  |
| [hierarchy](#getter-hierarchy)                                         | Getters    | LinearMultiRowFeatureDisplay                          | Positioned dendrogram (when a cluster tree exists and rows are loaded).                                                                                                                                                                                                                                                                                                                                                                       |
| [sidebarOffset](#getter-sidebaroffset)                                 | Getters    | LinearMultiRowFeatureDisplay                          | Pixel width reserved on the left for the tree (0 when no tree shows).                                                                                                                                                                                                                                                                                                                                                                         |
| [spatialIndex](#getter-spatialindex)                                   | Getters    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [renderState](#getter-renderstate)                                     | Getters    | LinearMultiRowFeatureDisplay                          | Render state passed to the GPU/Canvas2D backend each frame.                                                                                                                                                                                                                                                                                                                                                                                   |
| [indelGlyphRegions](#getter-indelglyphregions)                         | Getters    | LinearMultiRowFeatureDisplay                          | Per-region data for the indel-glyph overlay, or undefined when the `lengthField` slot is unset and there is no glyph pass.                                                                                                                                                                                                                                                                                                                    |
| [highlightedBlockRect](#getter-highlightedblockrect)                   | Getters    | LinearMultiRowFeatureDisplay                          | Screen box of the block to mark, or undefined when there's nothing to mark.                                                                                                                                                                                                                                                                                                                                                                   |
| [rpcProps](#method-rpcprops)                                           | Methods    | LinearMultiRowFeatureDisplay                          | Fetch-input cache keys (tier-1, via SettingsInvalidate → refetch).                                                                                                                                                                                                                                                                                                                                                                            |
| [featureAt](#method-featureat)                                         | Methods    | LinearMultiRowFeatureDisplay                          | Hit-test the feature under a display-relative pixel: row from `mouseY / rowHeight`, genomic bp from the view, then the first feature on that row whose `[start,end)` covers the bp.                                                                                                                                                                                                                                                           |
| [isCacheValid](#method-iscachevalid)                                   | Methods    | LinearMultiRowFeatureDisplay                          | A region is cache-valid only once its features are committed.                                                                                                                                                                                                                                                                                                                                                                                 |
| [contextMenuItems](#method-contextmenuitems)                           | Methods    | LinearMultiRowFeatureDisplay                          | Items for the right-click context menu, built from the clicked position (contextMenuInfo).                                                                                                                                                                                                                                                                                                                                                    |
| [trackMenuItems](#method-trackmenuitems)                               | Methods    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setRowHeight](#action-setrowheight)                                   | Actions    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setShowLegend](#action-setshowlegend)                                 | Actions    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [toggleCategory](#action-togglecategory)                               | Actions    | LinearMultiRowFeatureDisplay                          | Show/hide a legend category by label (render-time, no refetch).                                                                                                                                                                                                                                                                                                                                                                               |
| [setHiddenCategories](#action-sethiddencategories)                     | Actions    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setShowTree](#action-setshowtree)                                     | Actions    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setShowBranchLength](#action-setshowbranchlength)                     | Actions    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setRunClustering](#action-setrunclustering)                           | Actions    | LinearMultiRowFeatureDisplay                          | Trigger (or clear) a one-shot row clustering run; consumed and reset by getMultiRowClusterAutorun.                                                                                                                                                                                                                                                                                                                                            |
| [setSortRowsBy](#action-setsortrowsby)                                 | Actions    | LinearMultiRowFeatureDisplay                          | Trigger (or clear) a one-shot declarative row sort; consumed and reset by getMultiRowSortAutorun.                                                                                                                                                                                                                                                                                                                                             |
| [sortRowsByValueAt](#action-sortrowsbyvalueat)                         | Actions    | LinearMultiRowFeatureDisplay                          | Reorder the rows by the value each carries at (refName, pos) — the feature covering that position on each row.                                                                                                                                                                                                                                                                                                                                |
| [openContextMenu](#action-opencontextmenu)                             | Actions    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [closeContextMenu](#action-closecontextmenu)                           | Actions    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setHoveredFeature](#action-sethoveredfeature)                         | Actions    | LinearMultiRowFeatureDisplay                          | Writes only when the hovered block actually changes, so a mouse moving within one block (blocks are many px wide) doesn't invalidate the observers watching this.                                                                                                                                                                                                                                                                             |
| [selectFeatureById](#action-selectfeaturebyid)                         | Actions    | LinearMultiRowFeatureDisplay                          | Re-fetch the full clicked feature by id and open it in the feature details widget.                                                                                                                                                                                                                                                                                                                                                            |
| [setRpcData](#action-setrpcdata)                                       | Actions    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)           | Actions    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setHeight](#action-setheight)                                         | Actions    | LinearMultiRowFeatureDisplay                          | Set the track height.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [resizeHeight](#action-resizeheight)                                   | Actions    | LinearMultiRowFeatureDisplay                          | Drag-resize.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [setFitToHeight](#action-setfittoheight)                               | Actions    | LinearMultiRowFeatureDisplay                          | Switch to auto-fit: seed the `height` config slot from the current content height (so toggling on doesn't jump), then `rowHeight = 0` makes `rowHeight` derive from it.                                                                                                                                                                                                                                                                       |
| [startRenderingBackend](#action-startrenderingbackend)                 | Actions    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [fetchNeeded](#action-fetchneeded)                                     | Actions    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [renderSvg](#action-rendersvg)                                         | Actions    | LinearMultiRowFeatureDisplay                          |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [id](#property-id)                                                     | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [rpcDriverName](#property-rpcdrivername)                               | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)             | Properties | [BaseDisplay](../basedisplay)                         | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL).                                                                                                                                                                                                                                                                                                           |
| [error](#volatile-error)                                               | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [statusMessage](#volatile-statusmessage)                               | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [statusProgress](#volatile-statusprogress)                             | Volatiles  | [BaseDisplay](../basedisplay)                         | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate.                                                                                                                                                                                                                                                                                                                           |
| [parentTrack](#getter-parenttrack)                                     | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [parentDisplay](#getter-parentdisplay)                                 | Getters    | [BaseDisplay](../basedisplay)                         | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                                                                                                                                                                              |
| [RenderingComponent](#getter-renderingcomponent)                       | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [DisplayBlurb](#getter-displayblurb)                                   | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [adapterConfig](#getter-adapterconfig)                                 | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [isMinimized](#getter-isminimized)                                     | Getters    | [BaseDisplay](../basedisplay)                         | Returns true if the parent track is minimized.                                                                                                                                                                                                                                                                                                                                                                                                |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)               | Getters    | [BaseDisplay](../basedisplay)                         | Returns the effective RPC driver name with hierarchical fallback: 1.                                                                                                                                                                                                                                                                                                                                                                          |
| [DisplayMessageComponent](#getter-displaymessagecomponent)             | Getters    | [BaseDisplay](../basedisplay)                         | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                                                                                                                                                                                                                    |
| [renderingProps](#method-renderingprops)                               | Methods    | [BaseDisplay](../basedisplay)                         | props passed to the renderer's React "Rendering" component.                                                                                                                                                                                                                                                                                                                                                                                   |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults)         | Actions    | [BaseDisplay](../basedisplay)                         | see the `ignorePromotedDefaults` property                                                                                                                                                                                                                                                                                                                                                                                                     |
| [setStatusMessage](#action-setstatusmessage)                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setError](#action-seterror)                                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setRpcDriverName](#action-setrpcdrivername)                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [reload](#action-reload)                                               | Actions    | [BaseDisplay](../basedisplay)                         | base display reload does nothing, see specialized displays for details                                                                                                                                                                                                                                                                                                                                                                        |
| [scrollTop](#volatile-scrolltop)                                       | Volatiles  | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setScrollTop](#action-setscrolltop)                                   | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [loadedRegions](#volatile-loadedregions)                               | Volatiles  | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | regions whose data has been fetched and committed, keyed by displayedRegionIndex; populated only after the fetch work callback returns                                                                                                                                                                                                                                                                                                        |
| [canRender](#getter-canrender)                                         | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The render-lifecycle precondition for every LGV display (overrides `RenderLifecycleMixin`'s default-true hook): don't run the upload/render callbacks until the view is measured.                                                                                                                                                                                                                                                             |
| [isReady](#getter-isready)                                             | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once the canvas has painted and no fetch is in flight                                                                                                                                                                                                                                                                                                                                                                                    |
| [viewportWithinLoadedData](#getter-viewportwithinloadeddata)           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true when every visible block lies within an already-fetched region — i.e. the viewport shows data we actually loaded, not the stale fringe left after a zoom-out/pan.                                                                                                                                                                                                                                                                        |
| [dataCurrent](#getter-datacurrent)                                     | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | This family's answer to the shared freshness question every display foundation must answer (`dataCurrent`): the held data corresponds to what is on screen right now.                                                                                                                                                                                                                                                                         |
| [svgReady](#getter-svgready)                                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once an off-screen (SVG) export can safely read this display's data.                                                                                                                                                                                                                                                                                                                                                                     |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)                 | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data.                                                                                                                                                                                                                                                                                            |
| [layoutReady](#getter-layoutready)                                     | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (default false): whether a searchable feature layout currently exists.                                                                                                                                                                                                                                                                                                                                                       |
| [renderBlocks](#getter-renderblocks)                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Shared cached view for every LGV-based GPU display.                                                                                                                                                                                                                                                                                                                                                                                           |
| [displayPhase](#getter-displayphase)                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The display's mutually-exclusive visual state, precedence single-sourced in `computeDisplayPhase`.                                                                                                                                                                                                                                                                                                                                            |
| [rpcPropsCacheKey](#getter-rpcpropscachekey)                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The RPC cache key watched by `SettingsInvalidate` — the subclass's `rpcProps()` payload serialized to a string.                                                                                                                                                                                                                                                                                                                               |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Derived opt-in for the region-too-large gate: a display that declares a pre-flight byte estimate (`getByteEstimateConfig`) gates on it — the two are one decision, so they can't desync (this replaces the old dev-time "config set but gate off" console.error).                                                                                                                                                                             |
| [setLoadedRegion](#action-setloadedregion)                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Action wrapper so callers after async boundaries stay in MST strict mode.                                                                                                                                                                                                                                                                                                                                                                     |
| [clearAllRpcData](#action-clearallrpcdata)                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | full reset: cancels fetch, clears error, loadedRegions, display-specific data, and the canvas-drawn flag.                                                                                                                                                                                                                                                                                                                                     |
| [invalidateLoadedRegions](#action-invalidateloadedregions)             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | lighter reset: cancels fetch and clears loadedRegions, leaving error and regionTooLarge intact                                                                                                                                                                                                                                                                                                                                                |
| [isCacheValid](#action-iscachevalid)                                   | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook: return `false` to force re-fetch at the current zoom (wiggle uses this for zoom-level changes).                                                                                                                                                                                                                                                                                                                             |
| [getByteEstimateConfig](#action-getbyteestimateconfig)                 | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook: return config to enable byte-estimate gating before fetch.                                                                                                                                                                                                                                                                                                                                                                  |
| [onRegionTooLarge](#action-onregiontoolarge)                           | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (no-op base): called when `regionTooLarge` transitions to true.                                                                                                                                                                                                                                                                                                                                                              |
| [fetchRegions](#action-fetchregions)                                   | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Run a per-region fetch with byte-estimate gating.                                                                                                                                                                                                                                                                                                                                                                                             |
| [afterAttach](#action-afterattach)                                     | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | installs the five fetch-lifecycle autoruns (DisplayedRegionsChange, FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange, ClearHoverOnRegionTooLarge)                                                                                                                                                                                                                                                                  |
| [forceLoadTrack](#volatile-forceloadtrack)                             | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | The force-load button's answer: render this track regardless of region size or feature density.                                                                                                                                                                                                                                                                                                                                               |
| [byteEstimate](#volatile-byteestimate)                                 | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | Last byte estimate reported for this display, with the adapter's own `fetchSizeLimit` and `alwaysRender` flag.                                                                                                                                                                                                                                                                                                                                |
| [measuredSpanBp](#volatile-measuredspanbp)                             | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | The span the current `byteEstimate` was measured over, so the derived gate can rescale it to the span on screen now.                                                                                                                                                                                                                                                                                                                          |
| [gateFoldedIntoFetch](#getter-gatefoldedintofetch)                     | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Additive opt-in for displays that measure the estimate inside their own feature RPC instead of a pre-flight (canvas).                                                                                                                                                                                                                                                                                                                         |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                                                                                                                                                                                                                           |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                                                                                                                                                                                                                          |
| [adapterFetchSizeLimit](#getter-adapterfetchsizelimit)                 | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The adapter's own `fetchSizeLimit` slot (undefined when the adapter type declares none); `resolveByteLimit` prefers it over the display config.                                                                                                                                                                                                                                                                                               |
| [configForceLoad](#getter-configforceload)                             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                                                                                                                                                                                                                             |
| [resolvedAdapterByteLimit](#getter-resolvedadapterbytelimit)           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The adapter's byte budget, preferring one the estimate computed dynamically over the static `fetchSizeLimit` slot.                                                                                                                                                                                                                                                                                                                            |
| [byteGateExempt](#getter-bytegateexempt)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | True when nothing may gate, on either axis and in both the worker and the banner: a self-summarizing adapter (BigWig/HiC cap what they return at screen resolution), the declarative `forceLoad` slot, or the force-load button.                                                                                                                                                                                                              |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan)   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored estimate from the span it was measured over (`measuredSpanBp`).                                                                                                                                                                                                                                                               |
| [gateByteLimit](#getter-gatebytelimit)                                 | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The byte budget the gate enforces: the adapter's limit, else the display config.                                                                                                                                                                                                                                                                                                                                                              |
| [tooLargeStatus](#getter-toolargestatus)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in.                                                                                                                                                                                                                                                                  |
| [regionTooLarge](#getter-regiontoolarge)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The verdict the whole mixin exists to produce: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips.                                                                                                                                                                                                                                                        |
| [regionTooLargeReason](#getter-regiontoolargereason)                   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                                                                                                                                                                                                                      |
| [setByteEstimate](#action-setbyteestimate)                             | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Commits the byte estimate together with the span it covers, so the derived gate can rescale it to the span on screen.                                                                                                                                                                                                                                                                                                                         |
| [clearByteEstimate](#action-clearbyteestimate)                         | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Drops the cached estimate.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setForceLoadTrack](#action-setforceloadtrack)                         | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Exempt this track from the gate (or put it back under it).                                                                                                                                                                                                                                                                                                                                                                                    |
| [forceLoad](#action-forceload)                                         | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Force-load: exempt this track from the gate and refetch.                                                                                                                                                                                                                                                                                                                                                                                      |
| [canvasDrawn](#volatile-canvasdrawn)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                                                                                                                                                                                            |
| [currentRenderingBackend](#volatile-currentrenderingbackend)           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | current backend reference, updated on context-loss recovery.                                                                                                                                                                                                                                                                                                                                                                                  |
| [renderTick](#volatile-rendertick)                                     | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                                                                                                                                                                                              |
| [autorunsInstalled](#volatile-autorunsinstalled)                       | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                                                                                                                                                                                                    |
| [renderError](#volatile-rendererror)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                                                                                                                                                                                                                                                                                                                                   |
| [markCanvasDrawn](#action-markcanvasdrawn)                             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [stopRenderingBackend](#action-stoprenderingbackend)                   | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [renderNow](#action-rendernow)                                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setRenderError](#action-setrendererror)                               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | set/clear the render-backend error.                                                                                                                                                                                                                                                                                                                                                                                                           |
| [attachRenderingBackend](#action-attachrenderingbackend)               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                                                                                                                                                                                                   |
| [activeStopToken](#volatile-activestoptoken)                           | Volatiles  | [FetchMixin](../fetchmixin)                           | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                                                                                                                                                                                     |
| [fetchGeneration](#volatile-fetchgeneration)                           | Volatiles  | [FetchMixin](../fetchmixin)                           | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                                                                                                                                                                              |
| [fetchCanceled](#volatile-fetchcanceled)                               | Volatiles  | [FetchMixin](../fetchmixin)                           | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                                                                                                                                                                                                                    |
| [regionStatuses](#volatile-regionstatuses)                             | Volatiles  | [FetchMixin](../fetchmixin)                           | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                                                                                                                                                                                                                                |
| [isLoading](#getter-isloading)                                         | Getters    | [FetchMixin](../fetchmixin)                           | true while a fetch is active                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [makeStatusCallback](#method-makestatuscallback)                       | Methods    | [FetchMixin](../fetchmixin)                           | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op.                                                                                                                                                                                                  |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)           | Methods    | [FetchMixin](../fetchmixin)                           | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                                                                                                                                                                                                                              |
| [throttleStatus](#action-throttlestatus)                               | Actions    | [FetchMixin](../fetchmixin)                           | Run `apply` only if the throttle window has elapsed.                                                                                                                                                                                                                                                                                                                                                                                          |
| [resetStatus](#action-resetstatus)                                     | Actions    | [FetchMixin](../fetchmixin)                           | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                                                                                                                                                                                                                  |
| [stopActiveFetch](#action-stopactivefetch)                             | Actions    | [FetchMixin](../fetchmixin)                           | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                                                                                                                                                                                                                      |
| [setRegionStatus](#action-setregionstatus)                             | Actions    | [FetchMixin](../fetchmixin)                           | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                                                                                                                                                                                                                     |
| [cancelFetch](#action-cancelfetch)                                     | Actions    | [FetchMixin](../fetchmixin)                           | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                                                                                                                                                                                                                  |
| [cancelFetchByUser](#action-cancelfetchbyuser)                         | Actions    | [FetchMixin](../fetchmixin)                           | User-initiated cancel from the loading overlay.                                                                                                                                                                                                                                                                                                                                                                                               |
| [beforeDestroy](#action-beforedestroy)                                 | Actions    | [FetchMixin](../fetchmixin)                           | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                                                                                                                                                                                                                          |
| [runFetch](#action-runfetch)                                           | Actions    | [FetchMixin](../fetchmixin)                           | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                                                                                                                                                                                                                  |
| [densityStatsPerRegion](#volatile-densitystatsperregion)               | Volatiles  | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | per-region feature counts (keyed by displayedRegionIndex), so the density verdict is a live max over the visible regions at the current bpPerPx — never a stale fetch-time snapshot.                                                                                                                                                                                                                                                          |
| [visibleFeatureDensityPerPx](#getter-visiblefeaturedensityperpx)       | Getters    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | Current density across the visible regions at the debounced coarseBpPerPx, so the verdict shares the layout cadence and doesn't flicker mid-zoom.                                                                                                                                                                                                                                                                                             |
| [gateInactive](#getter-gateinactive)                                   | Getters    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | No axis gates at all: an exempt adapter / declarative force-load, or a span under the AUTO_FORCE_LOAD_BP floor.                                                                                                                                                                                                                                                                                                                               |
| [maxFeatureDensity](#getter-maxfeaturedensity)                         | Getters    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | The density budget passed to the worker and used by the derived verdict: undefined (gate off) when nothing gates, otherwise the config.                                                                                                                                                                                                                                                                                                       |
| [densityTooLarge](#getter-densitytoolarge)                             | Getters    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [observedMaxDensity](#method-observedmaxdensity)                       | Methods    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | Highest features-per-pixel across the visible regions at `bpPerPx`, from the cached per-region counts.                                                                                                                                                                                                                                                                                                                                        |
| [resolvedByteLimit](#method-resolvedbytelimit)                         | Methods    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | The byte budget the fetch RPC enforces, short-circuiting an over-budget region before downloading features.                                                                                                                                                                                                                                                                                                                                   |
| [setDensityStats](#action-setdensitystats)                             | Actions    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearGateMeasurements](#action-cleargatemeasurements)                 | Actions    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | Drop the cached per-region density stats on chromosome navigation (displayedRegion indices get reused, so a stale entry would gate the new region against the wrong stats).                                                                                                                                                                                                                                                                   |
| [commitGateMeasurements](#action-commitgatemeasurements)               | Actions    | [CanvasFeatureGateMixin](../canvasfeaturegatemixin)   | Commit a batch of per-region fetch outcomes: record the per-region byte **max** (not sum — each region is gated against the same per-region budget, so a multi-region view where every region individually fits is never blanked by the cross-region total) and the per-region density, then publish the byte estimate + adapter limit to `RegionTooLargeMixin` so the banner's `resolveByteLimit` picks the same budget the worker gated on. |
| [layout](#property-layout)                                             | Properties | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clusterTree](#property-clustertree)                                   | Properties | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [treeAreaWidth](#property-treeareawidth)                               | Properties | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [subtreeFilter](#property-subtreefilter)                               | Properties | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [hoveredTreeNode](#volatile-hoveredtreenode)                           | Volatiles  | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [treeCanvas](#volatile-treecanvas)                                     | Volatiles  | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [mouseoverCanvas](#volatile-mouseovercanvas)                           | Volatiles  | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [parsedTree](#getter-parsedtree)                                       | Getters    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [root](#getter-root)                                                   | Getters    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [treeHasBranchLengths](#getter-treehasbranchlengths)                   | Getters    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [willClearTree](#method-willcleartree)                                 | Methods    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setLayout](#action-setlayout)                                         | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearLayout](#action-clearlayout)                                     | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setClusterTree](#action-setclustertree)                               | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setLayoutAndClusterTree](#action-setlayoutandclustertree)             | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setTreeAreaWidth](#action-settreeareawidth)                           | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setSubtreeFilter](#action-setsubtreefilter)                           | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setHoveredTreeNode](#action-sethoveredtreenode)                       | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setTreeCanvasRef](#action-settreecanvasref)                           | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setMouseoverCanvasRef](#action-setmouseovercanvasref)                 | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### LinearMultiRowFeatureDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearmultirowfeaturedisplay).

<details>
<summary>LinearMultiRowFeatureDisplay - Properties</summary>

#### property: runClustering

Transient declarative launch spec (like LinearGenomeView's `init`): set true —
from the track menu or a saved session — to run row clustering once as soon as
the display is ready; getMultiRowClusterAutorun clears it afterward so a saved
session never re-triggers.

```ts
// type signature
type runClustering = IMaybe<ISimpleType<boolean>>
// code
runClustering: types.maybe(types.boolean)
```

#### property: sortRowsBy

Transient declarative launch spec (like `runClustering`): set `{refName, pos}`
to sort the rows once by the value each carries at that genomic position — the
in-app, session-expressible equivalent of a hand-computed `rowOrder`.
getMultiRowSortAutorun applies it (once the region is loaded) and clears it, so
the resulting `layout` persists but the trigger never re-fires.

```ts
// type signature
type sortRowsBy = IMaybe<
  IType<
    { refName: string; pos: number },
    { refName: string; pos: number },
    { refName: string; pos: number }
  >
>
// code
sortRowsBy: types.maybe(types.frozen<{ refName: string; pos: number }>())
```

#### property: hiddenCategories

Legend categories toggled off (by label). Features painted in a hidden
category's color are dropped from both render paths and the hit-test. See
`hiddenColors` / `toggleCategory`.

```ts
// type signature
type hiddenCategories = IArrayType<ISimpleType<string>>
// code
hiddenCategories: types.array(types.string)
```

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Properties (other undocumented members)</summary>

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-type">type</span>                   | `ISimpleType<"LinearMultiRowFeatureDisplay">`         |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<ConfigurationSchemaType<…>>` |

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Volatiles</summary>

#### volatile: hoveredFeature

The feature under the mouse, or undefined when not hovering a block. Pure hover
identity — the cursor position that places the tooltip is component state, so
moving inside one block doesn't invalidate this.

```ts
// type signature
type hoveredFeature = MultiRowHit | undefined
// code
hoveredFeature: undefined as MultiRowHit | undefined
```

#### volatile: contextMenuInfo

Right-click context menu anchor + the genomic position clicked (and the feature
there, if any). Undefined when the menu is closed.

```ts
// type signature
type contextMenuInfo =
  | {
      clientX: number
      clientY: number
      refName: string
      pos: number
      hit?: MultiRowHit | undefined
    }
  | undefined
// code
contextMenuInfo: undefined as
  | {
      clientX: number
      clientY: number
      refName: string
      pos: number
      hit?: MultiRowHit
    }
  | undefined
```

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Volatiles (other undocumented members)</summary>

| Member                                                 | Type                                               |
| ------------------------------------------------------ | -------------------------------------------------- |
| <span id="volatile-rpcdatamap">rpcDataMap</span>       | `ObservableMap<number, MultiRowGetFeaturesResult>` |
| <span id="volatile-prefersoffset">prefersOffset</span> | `true`                                             |

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Getters</summary>

#### getter: conf

config typed off the concrete schema (ConfigurationReference erases it to any);
direct reads route through here to stay typed

```ts
type conf = ModelInstanceTypeProps<Record<…>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: densityGateEnabled

Multi-row paints features into fixed lanes, so a high total feature count (e.g.
a whole-chromosome haplotype painting with many segments per row) is not a
per-glyph render cost — only the byte/download budget should gate it. Disable
the density axis of CanvasFeatureGateMixin so the "too many features" banner
never shows here.

```ts
type densityGateEnabled = boolean
```

#### getter: lengthField

Feature attribute holding a signed bp length change vs the reference. Empty =
the indel-glyph pass is off. A fetch input: it decides whether the worker packs
`featureDeltas` at all.

```ts
type lengthField = string
```

#### getter: rowOrder

Optional explicit row order from config; values listed here are placed first,
remaining discovered values follow in sorted order.

```ts
type rowOrder = string[]
```

#### getter: colorConfig

Raw `color` slot (a CSS color or `jexl:` string, or undefined when unset),
forwarded to the worker which resolves it per feature.

```ts
type colorConfig = string | undefined
```

#### getter: sampleColorMap

Map of partition value → color, forwarded to the worker which applies it over
the per-feature `color`.

```ts
type sampleColorMap = Record<string, string>
```

#### getter: sourcesWithoutLayout

Rows discovered in the loaded data: the distinct partition values across all
loaded regions, ordered by the config `rowOrder` then sorted. The pre-layout,
pre-filter input to the arrangement dialog and to clustering.

```ts
type sourcesWithoutLayout = MultiRowSource[]
```

#### getter: usedItemRgb

Whether the loaded data colored itself via `itemRgb` (only possible with the
`color` slot at its default). Suppresses the per-row palette, which would
otherwise paint over those colors.

```ts
type usedItemRgb = boolean
```

#### getter: editableSources

Discovered rows with the user's arrangement (reorder/relabel) applied — what the
arrangement dialog edits. Not subtree-filtered.

```ts
type editableSources = MultiRowSource[]
```

#### getter: sources

The display rows: `editableSources` narrowed by the active subtree filter.
Render order, label order, and `rowIndexByValue` all key off this, so
reordering/filtering flows through to the painting.

```ts
type sources = MultiRowSource[]
```

#### getter: rowColorsByIndex

Per-row color (ABGR) by display row — the single per-row resolver (dialog
color > config `sampleColorMap` > palette-when-default). Applied at render time
over the worker-baked per-feature `color` slot, so any color change repaints
without a refetch.

```ts
type rowColorsByIndex = (number | undefined)[]
```

#### getter: nrow

Number of displayed rows (at least 1, so the auto-fit division is safe and the
canvas mounts before data arrives).

```ts
type nrow = number
```

#### getter: fitTargetHeight

The track height that auto-fit mode divides among rows: the `height` config slot
(its default, or a drag-resized value written to it).

```ts
type fitTargetHeight = number
```

#### getter: rowHeightSetting

Resolved fixed row-height setting: `0` is auto-fit, any positive value is a
pinned px height. Drag-resize / fit-toggle write it via `setSlot`.

```ts
type rowHeightSetting = number
```

#### getter: colorLegend

Categorical color key. The explicit `legend` config slot wins when set (for
color-encoded categories with no feature attribute to key on, e.g. an itemRgb
ancestry painting); otherwise it's auto-derived from the loaded data as distinct
`(featureName -> per-feature color)` pairs among per-feature-colored rows. Empty
in per-row palette / sampleColorMap mode (where the sidebar labels are the key)
and for non-categorical (unnamed / all-distinct) data. See
resolveConfiguredLegend / buildColorLegend.

```ts
type colorLegend = LegendEntry[]
```

#### getter: hiddenCategorySet

`hiddenCategories` as a Set for O(1) membership; shared by the on-screen and
SVG-export legends (dimmed rows) and by `hiddenColors`.

```ts
type hiddenCategorySet = ReadonlySet<string>
```

#### getter: hiddenColors

ABGR colors currently hidden via the legend's category toggles: the
`colorLegend` colors whose label is in `hiddenCategories`. Both render paths and
the hit-test skip features painted in one of these, so toggling a category off
drops it everywhere without a refetch. `colorLegend` has one entry per distinct
color (see buildColorLegend), so each toggle maps to exactly one color.

```ts
type hiddenColors = ReadonlySet<number>
```

#### getter: rowHeight

Resolved per-row height. `rowHeightSetting === 0` auto-fits: the display height
split evenly across rows so all rows stay visible as the row count grows. Any
positive value is a pinned px height. Every consumer reads this, never
`rowHeightSetting`.

```ts
type rowHeight = number
```

#### getter: height

Override BaseLinearDisplay.height so the track container matches the rendering
canvas (numRows × rowHeight). In auto-fit mode this resolves to
`fitTargetHeight`; in fixed mode it grows with the row count.

```ts
type height = number
```

#### getter: hierarchy

Positioned dendrogram (when a cluster tree exists and rows are loaded). Leaves
spaced over `height`, branches over `treeAreaWidth`.

```ts
type hierarchy = ClusterHierarchyNode | undefined
```

#### getter: sidebarOffset

Pixel width reserved on the left for the tree (0 when no tree shows).

```ts
type sidebarOffset = number
```

#### getter: renderState

Render state passed to the GPU/Canvas2D backend each frame.

```ts
type renderState = MultiRowRenderState
```

#### getter: indelGlyphRegions

Per-region data for the indel-glyph overlay, or undefined when the `lengthField`
slot is unset and there is no glyph pass.

A computed returning a plain `Map` rather than `rpcDataMap` itself: the overlay
draws inside an effect, so nothing it touches there is tracked, and handing it
the ObservableMap would mean a refetch never redrew the glyphs. Rebuilding here
makes the read happen where MobX sees it and gives the overlay a value whose
identity changes exactly when the data does.

```ts
type indelGlyphRegions = Map<number, MultiRowGetFeaturesResult> | undefined
```

#### getter: highlightedBlockRect

Screen box of the block to mark, or undefined when there's nothing to mark. The
hover drops when a right-click menu opens (else its tooltip sticks under the
menu), so the menu's own feature stands in — the block a menu is acting on is
exactly the one that should stay marked.

```ts
type highlightedBlockRect =
  { left: number; width: number; top: number; height: number } | undefined
```

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Getters (other undocumented members)</summary>

| Member                                                         | Type                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| <span id="getter-showlegend">showLegend</span>                 | `boolean`                                                          |
| <span id="getter-showtree">showTree</span>                     | `boolean`                                                          |
| <span id="getter-showbranchlength">showBranchLength</span>     | `boolean`                                                          |
| <span id="getter-partitionfield">partitionField</span>         | `string`                                                           |
| <span id="getter-rowproportion">rowProportion</span>           | `number`                                                           |
| <span id="getter-rowindexbyvalue">rowIndexByValue</span>       | `Map<string, number>`                                              |
| <span id="getter-effectiverowheight">effectiveRowHeight</span> | `number`                                                           |
| <span id="getter-spatialindex">spatialIndex</span>             | `{ index: Flatbush; nodes: ClusterHierarchyNode[]; } \| undefined` |

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Methods</summary>

#### method: rpcProps

Fetch-input cache keys (tier-1, via SettingsInvalidate → refetch). Color is
resolved in the worker, so the raw color slot is a key.

```ts
type rpcProps = () => {
  partitionField: string
  lengthField: string
  colorConfig: string | undefined
}
```

#### method: featureAt

Hit-test the feature under a display-relative pixel: row from
`mouseY / rowHeight`, genomic bp from the view, then the first feature on that
row whose `[start,end)` covers the bp. Returns undefined over the sidebar,
off-row, out-of-bounds, or over a gap.

The sidebar bound is `treeSidebarRightEdge`, not `sidebarOffset`: the latter is
where labels are _drawn_ from, while the resize handle sitting in the 4px past
it is the sidebar's interactive edge, and a hit under the handle would fight the
drag. Same bound the wiggle family hit-tests against, and the same one the
crosshair's guide stops at.

```ts
type featureAt = (mouseX: number, mouseY: number) => MultiRowHit | undefined
```

#### method: isCacheValid

A region is cache-valid only once its features are committed. A too-large region
is marked loaded (so the fetch autorun doesn't spin) but stores no rpcData, so
this returns false and the region refetches the moment the gate releases
(zoom-in or force-load).

```ts
type isCacheValid = (displayedRegionIndex: number) => boolean
```

#### method: contextMenuItems

Items for the right-click context menu, built from the clicked position
(contextMenuInfo). "Sort rows by color here" is the interactive twin of the
declarative `sortRowsBy`.

```ts
type contextMenuItems = () => MenuItem[]
```

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Methods (other undocumented members)</summary>

| Member                                                 | Type               |
| ------------------------------------------------------ | ------------------ |
| <span id="method-trackmenuitems">trackMenuItems</span> | `() => MenuItem[]` |

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Actions</summary>

#### action: toggleCategory

Show/hide a legend category by label (render-time, no refetch).

```ts
type toggleCategory = (label: string) => void
```

#### action: setRunClustering

Trigger (or clear) a one-shot row clustering run; consumed and reset by
getMultiRowClusterAutorun.

```ts
type setRunClustering = (arg?: boolean | undefined) => void
```

#### action: setSortRowsBy

Trigger (or clear) a one-shot declarative row sort; consumed and reset by
getMultiRowSortAutorun. The right-click menu calls `sortRowsByValueAt` directly
(instant, data already loaded); this prop is the session-level entry point.

```ts
type setSortRowsBy = (
  arg?: { refName: string; pos: number } | undefined,
) => void
```

#### action: sortRowsByValueAt

Reorder the rows by the value each carries at (refName, pos) — the feature
covering that position on each row. Reads the already-loaded region data (no
refetch/RPC) and writes the new order via `layout`.

```ts
type sortRowsByValueAt = (refName: string, pos: number) => void
```

#### action: setHoveredFeature

Writes only when the hovered block actually changes, so a mouse moving within
one block (blocks are many px wide) doesn't invalidate the observers watching
this.

```ts
type setHoveredFeature = (arg?: MultiRowHit | undefined) => void
```

#### action: selectFeatureById

Re-fetch the full clicked feature by id and open it in the feature details
widget. The painting ships only the slim render arrays, so the complete feature
is fetched on demand (GetCanvasFeatureDetails).

```ts
type selectFeatureById = (
  featureId: string,
  displayedRegionIndex: number,
) => void
```

#### action: setHeight

Set the track height. In auto-fit mode the rows restretch to it; in fixed mode
it's distributed across the current rows as a pinned row height.

```ts
type setHeight = (newHeight: number) => number
```

#### action: resizeHeight

Drag-resize. Defers to `setHeight`, which restretches rows in auto-fit mode and
re-pins the row height in fixed mode.

```ts
type resizeHeight = (distance: number) => number
```

#### action: setFitToHeight

Switch to auto-fit: seed the `height` config slot from the current content
height (so toggling on doesn't jump), then `rowHeight = 0` makes `rowHeight`
derive from it.

```ts
type setFitToHeight = () => void
```

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Actions (other undocumented members)</summary>

| Member                                                                     | Type                                                                                                                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| <span id="action-setrowheight">setRowHeight</span>                         | `(n: number) => void`                                                                                                 |
| <span id="action-setshowlegend">setShowLegend</span>                       | `(f: boolean) => void`                                                                                                |
| <span id="action-sethiddencategories">setHiddenCategories</span>           | `(labels: string[]) => void`                                                                                          |
| <span id="action-setshowtree">setShowTree</span>                           | `(f: boolean) => void`                                                                                                |
| <span id="action-setshowbranchlength">setShowBranchLength</span>           | `(f: boolean) => void`                                                                                                |
| <span id="action-opencontextmenu">openContextMenu</span>                   | `(info: { clientX: number; clientY: number; refName: string; pos: number; hit?: MultiRowHit \| undefined; }) => void` |
| <span id="action-closecontextmenu">closeContextMenu</span>                 | `() => void`                                                                                                          |
| <span id="action-setrpcdata">setRpcData</span>                             | `(regionIndex: number, data: MultiRowGetFeaturesResult) => void`                                                      |
| <span id="action-cleardisplayspecificdata">clearDisplaySpecificData</span> | `() => void`                                                                                                          |
| <span id="action-startrenderingbackend">startRenderingBackend</span>       | `(backend: MultiRowRenderingBackend) => void`                                                                         |
| <span id="action-fetchneeded">fetchNeeded</span>                           | `(needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void>`                                      |
| <span id="action-rendersvg">renderSvg</span>                               | `(opts: ExportSvgDisplayOptions) => Promise<ReactNode>`                                                               |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseDisplay</summary>

[BaseDisplay →](../basedisplay)

**Properties**

#### property: ignorePromotedDefaults

true for a display that arrived inside a session received from someone else (a
share link, an encoded/json session, a `spec-` URL). Such a display resolves its
`promotable` config slots from its own config only, never from this browser's
promoted display-type defaults (see `configuration/promotableDefaults.ts`) — the
received session is a record of what the sender saw, and a local preference
silently repainting it would make it a lie. A track opened _afterwards_ in that
same session is a fresh track of this user's, so it never gets the flag and
picks up their defaults normally. Cleared by `resetSlotsToInherit` when the user
deliberately makes the display follow a default.

```ts
// type signature
type ignorePromotedDefaults = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
ignorePromotedDefaults: types.stripDefault(types.boolean, false)
```

| Member                                                 | Type                                               |
| ------------------------------------------------------ | -------------------------------------------------- |
| <span id="property-id">id</span>                       | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-rpcdrivername">rpcDriverName</span> | `IMaybe<ISimpleType<string>>`                      |

**Volatiles**

#### volatile: statusProgress

determinate progress fraction [0,1] for the current status, or undefined when
the in-flight phase is indeterminate. Set alongside `statusMessage` by
`setStatusMessage`; a display that never shows a bar simply leaves it undefined.

```ts
// type signature
type statusProgress = number | undefined
// code
statusProgress: undefined as number | undefined
```

| Member                                                 | Type                  |
| ------------------------------------------------------ | --------------------- |
| <span id="volatile-error">error</span>                 | `unknown`             |
| <span id="volatile-statusmessage">statusMessage</span> | `string \| undefined` |

**Getters**

#### getter: parentDisplay

Returns the parent display if this display is nested within another display
(e.g., PileupDisplay inside LinearAlignmentsDisplay)

```ts
type parentDisplay =
  | { type?: string | undefined; effectiveRpcDriverName?: string | undefined }
  | undefined
```

#### getter: isMinimized

Returns true if the parent track is minimized. Used to skip expensive operations
like autoruns when track is not visible.

```ts
type isMinimized = boolean
```

#### getter: effectiveRpcDriverName

Returns the effective RPC driver name with hierarchical fallback:

1. This display's explicit rpcDriverName
2. Parent display's effectiveRpcDriverName (for nested displays)
3. Track config's rpcDriverName

```ts
type effectiveRpcDriverName = any
```

#### getter: DisplayMessageComponent

if a display-level message should be displayed instead, make this return a react
component

```ts
type DisplayMessageComponent = FC<any> | undefined
```

| Member                                                         | Type                                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| <span id="getter-parenttrack">parentTrack</span>               | `AbstractTrackModel`                                                                            |
| <span id="getter-renderingcomponent">RenderingComponent</span> | `FC<…>`                                                                                         |
| <span id="getter-displayblurb">DisplayBlurb</span>             | `FC<{ model: ModelInstanceTypeProps<…> & { ...; } & { ...; } & IStateTreeNode<...>; }> \| null` |
| <span id="getter-adapterconfig">adapterConfig</span>           | `any`                                                                                           |

**Methods**

#### method: renderingProps

props passed to the renderer's React "Rendering" component. these are
client-side only and never sent to the worker. includes displayModel and
callbacks

```ts
type renderingProps = () => { displayModel: ModelInstanceTypeProps<…> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>; }
```

**Actions**

#### action: setIgnorePromotedDefaults

see the `ignorePromotedDefaults` property

```ts
type setIgnorePromotedDefaults = (flag: boolean) => void
```

#### action: reload

base display reload does nothing, see specialized displays for details

```ts
type reload = () => void
```

| Member                                                     | Type                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| <span id="action-setstatusmessage">setStatusMessage</span> | `(status?: RpcStatus \| undefined) => void` |
| <span id="action-seterror">setError</span>                 | `(error?: unknown) => void`                 |
| <span id="action-setrpcdrivername">setRpcDriverName</span> | `(rpcDriverName: string) => void`           |

</details>

<details>
<summary>Derived from TrackHeightMixin</summary>

[TrackHeightMixin →](../trackheightmixin)

**Volatiles**

| Member                                         | Type     |
| ---------------------------------------------- | -------- |
| <span id="volatile-scrolltop">scrollTop</span> | `number` |

**Actions**

| Member                                             | Type                          |
| -------------------------------------------------- | ----------------------------- |
| <span id="action-setscrolltop">setScrollTop</span> | `(scrollTop: number) => void` |

</details>

<details>
<summary>Derived from MultiRegionDisplayMixin</summary>

[MultiRegionDisplayMixin →](../multiregiondisplaymixin)

**Volatiles**

#### volatile: loadedRegions

regions whose data has been fetched and committed, keyed by
displayedRegionIndex; populated only after the fetch work callback returns

```ts
// type signature
type loadedRegions = ObservableMap<number, Region>
// code
loadedRegions: observable.map<number, Region>()
```

**Getters**

#### getter: canRender

The render-lifecycle precondition for every LGV display (overrides
`RenderLifecycleMixin`'s default-true hook): don't run the upload/render
callbacks until the view is measured. Before that, `renderBlocks` →
`visibleRegions` → `view.width` throws by design, and the render autorun's catch
would show that as a GPU render-error banner. Gating here — once, for all of
them — is what lets a display's `renderState` be a plain resolved getter and its
render callback gate only on its own data. The render-lifecycle twin of
`autorunOnReadyView`.

```ts
type canRender = boolean
```

#### getter: isReady

true once the canvas has painted and no fetch is in flight

```ts
type isReady = boolean
```

#### getter: viewportWithinLoadedData

true when every visible block lies within an already-fetched region — i.e. the
viewport shows data we actually loaded, not the stale fringe left after a
zoom-out/pan. Drives the loading overlay through the pre-refetch debounce.
Spatial only; see CLAUDE.md for why this is exact and for the
resolution-staleness gap.

```ts
type viewportWithinLoadedData = boolean
```

#### getter: dataCurrent

This family's answer to the shared freshness question every display foundation
must answer (`dataCurrent`): the held data corresponds to what is on screen
right now. Here that is spatial — every visible block lies within a fetched
region — plus `loadedRegions.size`, which rules out the vacuously-true empty
viewport. Regions stream in one at a time, so this (not "the first datum
arrived") is what keeps a multi-region/whole-genome export complete.

Distinct from `viewportWithinLoadedData`, which is the raw coverage predicate
the fetch autorun and the loading overlay use.

```ts
type dataCurrent = boolean
```

#### getter: svgReady

true once an off-screen (SVG) export can safely read this display's data. Policy
single-sourced in `computeSvgReady`; this family supplies only its `dataCurrent`
predicate. Off-screen renderers gate on it via `awaitSvgReady(model)` instead of
inlining the condition.

```ts
type svgReady = boolean
```

#### getter: svgReadyExtraTerminal

Overridable hook (default false): a subclass returns true to mark an extra
terminal state where off-screen export can proceed with no loaded data. Sequence
sets it when zoomed past base resolution — it renders a static "zoom in" message
and fetches nothing, so `svgReady` would otherwise never resolve.

```ts
type svgReadyExtraTerminal = boolean
```

#### getter: layoutReady

Overridable hook (default false): whether a searchable feature layout currently
exists. Any display defining a feature-lookup method (`searchFeatureByID`,
`getFeatureById`) must override it, so callers can tell "laid out, but
off-display" from "no layout exists yet" — a distinction only the display can
make. See BaseLinearDisplay/CLAUDE.md, "The three readiness axes".

```ts
type layoutReady = boolean
```

#### getter: renderBlocks

Shared cached view for every LGV-based GPU display. A single displayedRegion may
produce multiple render blocks (shared GPU buffer, different scissor clips on
screen). Plugins that want to suppress rendering in certain states (e.g. no
domain yet) can override this getter to return [] — the autorun lifecycle will
then issue an empty-blocks render that clears the canvas.

```ts
type renderBlocks = RenderBlock[]
```

#### getter: displayPhase

The display's mutually-exclusive visual state, precedence single-sourced in
`computeDisplayPhase`. Here `loading` means data isn't ready yet, or stale data
(viewport past loaded) is still on screen through the pre-refetch debounce.

```ts
type displayPhase = DisplayPhase
```

#### getter: rpcPropsCacheKey

The RPC cache key watched by `SettingsInvalidate` — the subclass's `rpcProps()`
payload serialized to a string. `serializeRpcProps` owns the why;
`installGlobalFetchAutorun` keys its global-family counterpart on the same
function, so the two families invalidate on the same axis.

```ts
type rpcPropsCacheKey = string
```

#### getter: derivedRegionTooLargeEnabled

Derived opt-in for the region-too-large gate: a display that declares a
pre-flight byte estimate (`getByteEstimateConfig`) gates on it — the two are one
decision, so they can't desync (this replaces the old dev-time "config set but
gate off" console.error). Displays that capture the estimate through a custom
fetch (LD, arc) or fold the byte check into their feature RPC (canvas) leave
`getByteEstimateConfig` null and contribute through `gateFoldedIntoFetch`, which
this ORs in — so a gate mixin's opt-in survives regardless of which side of
`.compose()` it lands on.

Guarded on `view.initialized`: `getByteEstimateConfig` reads `visibleBp` (which
throws pre-init), and this getter is read from menu code before first paint.
Pre-init the banner never shows anyway, so `false` is right.

```ts
type derivedRegionTooLargeEnabled = boolean
```

**Actions**

#### action: setLoadedRegion

Action wrapper so callers after async boundaries stay in MST strict mode.

```ts
type setLoadedRegion = (displayedRegionIndex: number, region: Region) => void
```

#### action: clearAllRpcData

full reset: cancels fetch, clears error, loadedRegions, display-specific data,
and the canvas-drawn flag. The too-large gate is derived (a pure function of the
cached estimate × viewport), so it needs no explicit clear here — it
self-releases when the viewport changes.

```ts
type clearAllRpcData = () => void
```

#### action: invalidateLoadedRegions

lighter reset: cancels fetch and clears loadedRegions, leaving error and
regionTooLarge intact

```ts
type invalidateLoadedRegions = () => void
```

#### action: isCacheValid

Overridable hook: return `false` to force re-fetch at the current zoom (wiggle
uses this for zoom-level changes).

```ts
type isCacheValid = (_displayedRegionIndex: number) => boolean
```

#### action: getByteEstimateConfig

Overridable hook: return config to enable byte-estimate gating before fetch.

```ts
type getByteEstimateConfig = () => ByteEstimateConfig | null
```

#### action: onRegionTooLarge

Overridable hook (no-op base): called when `regionTooLarge` transitions to true.
Displays with transient hover/tooltip state override it to clear that state —
the too-large banner replaces the rendered content, so a lingering hover would
otherwise pin to a now-hidden feature. Wired to the `ClearHoverOnRegionTooLarge`
autorun, fired by the derived too-large gate.

```ts
type onRegionTooLarge = () => void
```

#### action: fetchRegions

Run a per-region fetch with byte-estimate gating. Marks regions as loaded only
AFTER the work callback has populated display-specific data (rpcDataMap,
cellData, etc) so the GPU upload autorun sees committed data when it observes
loadedRegions.

```ts
type fetchRegions = (
  needed: { region: Region; displayedRegionIndex: number }[],
  work: (ctx: FetchContext) => Promise<void>,
) => Promise<void>
```

#### action: afterAttach

installs the five fetch-lifecycle autoruns (DisplayedRegionsChange,
FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange,
ClearHoverOnRegionTooLarge)

```ts
type afterAttach = () => void
```

</details>

<details>
<summary>Derived from RegionTooLargeMixin</summary>

[RegionTooLargeMixin →](../regiontoolargemixin)

**Volatiles**

#### volatile: forceLoadTrack

The force-load button's answer: render this track regardless of region size or
feature density. One boolean for the whole track, not a raised ceiling per
region — the banner already tells the user how much data is involved, so one
informed click approves the track and they never have to re-approve it per
locus.

Volatile, not persisted, so it can't leak a disabled gate into a saved or shared
session (a recipient would download the same data with no warning and no way to
see why). A page load re-arms the gate. The durable, declarative equivalent is
the `forceLoad` config slot, for session specs, embeds and
`jbrowse-img --force`.

```ts
// type signature
type forceLoadTrack = false
// code
forceLoadTrack: false
```

#### volatile: byteEstimate

Last byte estimate reported for this display, with the adapter's own
`fetchSizeLimit` and `alwaysRender` flag. Its `bytes` covers `measuredSpanBp`,
not the span on screen now. Survives `clearAllRpcData` so an ordinary viewport
change doesn't flicker the banner; only chromosome navigation drops it.

```ts
// type signature
type byteEstimate = RegionByteEstimate | undefined
// code
byteEstimate: undefined as RegionByteEstimate | undefined
```

#### volatile: measuredSpanBp

The span the current `byteEstimate` was measured over, so the derived gate can
rescale it to the span on screen now. Written by `setByteEstimate`; ignored
unless `derivedRegionTooLargeEnabled`.

```ts
// type signature
type measuredSpanBp = number | undefined
// code
measuredSpanBp: undefined as number | undefined
```

**Getters**

#### getter: gateFoldedIntoFetch

Additive opt-in for displays that measure the estimate inside their own feature
RPC instead of a pre-flight (canvas). Kept separate from
`derivedRegionTooLargeEnabled` so a gate mixin contributes by setting _this_
rather than overriding the verdict switch — the two would otherwise race on
composition order, and the later `.compose()` argument silently winning is
invisible to both the type system and the tests.

```ts
type gateFoldedIntoFetch = boolean
```

#### getter: configuredFetchSizeLimit

The composing display's configured `fetchSizeLimit`, read straight from its
config. Only evaluated when the derived gate is enabled (guarded by
`derivedRegionTooLargeEnabled`), and every derived display extends
`baseLinearDisplayConfigSchema`, which owns the slot — so the read is always
valid where it fires. A display with a bespoke source can still override it.

```ts
type configuredFetchSizeLimit = number
```

#### getter: densityTooLargeForDerivedGate

Extra (non-byte) too-large axis folded into the derived verdict — canvas
overrides it with its feature-density gate. Byte-only derived displays leave it
false.

```ts
type densityTooLargeForDerivedGate = boolean
```

#### getter: adapterFetchSizeLimit

The adapter's own `fetchSizeLimit` slot (undefined when the adapter type
declares none); `resolveByteLimit` prefers it over the display config. Read on
the main thread rather than trusted only from the estimate: the three adapters
that attach one (BAM/CRAM/VCF) just echo this same static slot back across the
worker boundary, and a display whose adapter never attaches it would otherwise
silently ignore a configured limit. `byteEstimate.fetchSizeLimit` still wins
where present, so an adapter that computes a limit dynamically keeps the last
word.

```ts
type adapterFetchSizeLimit = number | undefined
```

#### getter: configForceLoad

Declarative force-load: when true the display always renders regardless of
region size / feature density (the config-driven equivalent of the force-load
button). Read straight from the `forceLoad` config slot on
`baseLinearDisplayConfigSchema` (same guard/ownership as
`configuredFetchSizeLimit`), so every opt-in display honors it without
per-display wiring.

```ts
type configForceLoad = boolean
```

#### getter: resolvedAdapterByteLimit

The adapter's byte budget, preferring one the estimate computed dynamically over
the static `fetchSizeLimit` slot. One getter, because the banner, the force-load
baseline and the canvas worker budget each spelling "the adapter's limit" for
itself is how the worker ends up rejecting a region the banner considers fine —
a silently blank display with nothing to refetch it.

```ts
type resolvedAdapterByteLimit = number | undefined
```

#### getter: byteGateExempt

True when nothing may gate, on either axis and in both the worker and the
banner: a self-summarizing adapter (BigWig/HiC cap what they return at screen
resolution), the declarative `forceLoad` slot, or the force-load button. One
boolean is the whole force-load mechanism — there is no per-region ceiling to
carry, expire, or reconcile between the two axes.

```ts
type byteGateExempt = boolean
```

#### getter: estimatedBytesForVisibleSpan

How many bytes we estimate a fetch of the span on screen right now would pull,
obtained by rescaling the stored estimate from the span it was measured over
(`measuredSpanBp`). Rescaling is what makes the derived verdict a pure function
of the current view and lets it self-release on zoom-in — without it a large
zoomed-out estimate stays above the limit forever and gates refetch. Only
meaningful when `derivedRegionTooLargeEnabled`.

```ts
type estimatedBytesForVisibleSpan = number | undefined
```

#### getter: gateByteLimit

The byte budget the gate enforces: the adapter's limit, else the display config.
Also what canvas hands the worker, so the two can't gate against different
numbers. Force-load doesn't raise this — it exempts the track outright via
`byteGateExempt`.

```ts
type gateByteLimit = number
```

#### getter: tooLargeStatus

Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then
bytes-over-limit, then the density axis), fed the scaled estimate so the byte
gate self-releases on zoom-in. Same helper as every other gating path so the
banner text can't drift.

```ts
type tooLargeStatus = RegionTooLargeStatus
```

#### getter: regionTooLarge

The verdict the whole mixin exists to produce: true when the estimated download
for the span on screen exceeds the resolved byte budget, or when the display's
own density axis trips. Derived, so it releases itself on zoom-in. Always false
for a display that hasn't opted in via `derivedRegionTooLargeEnabled`. The fetch
autoruns hold off while it is true, and `DisplayChrome` renders the banner from
it.

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

Which axis tripped, as banner text: the estimated download size, or "Too many
features". Empty string when the region isn't too large.

```ts
type regionTooLargeReason = string
```

**Actions**

#### action: setByteEstimate

Commits the byte estimate together with the span it covers, so the derived gate
can rescale it to the span on screen. `measuredSpanBp` must be the `visibleBp`
captured when the measurement was _requested_, not read at commit time: a view
that zoomed during the in-flight fetch would otherwise anchor the estimate to
the wrong span, and since `FetchVisibleRegions` skips while `regionTooLarge`
holds, an over-anchored estimate wedges the banner with no refetch to correct
it. Harmless for non-gated displays (they ignore it).

```ts
type setByteEstimate = (
  estimate: RegionByteEstimate,
  measuredSpanBp: number,
) => void
```

#### action: clearByteEstimate

Drops the cached estimate. Chromosome navigation only: the estimate
intentionally survives `clearAllRpcData` so an ordinary viewport change doesn't
flicker the banner.

`forceLoadTrack` deliberately survives: it is a track-wide approval, so expiring
it on navigation is exactly the per-locus re-approval the button exists to
avoid.

```ts
type clearByteEstimate = () => void
```

#### action: setForceLoadTrack

Exempt this track from the gate (or put it back under it). Separate from
`forceLoad` so turning the gate off and refetching stay separable — a caller
that just wants the flag (a revoke, a test) doesn't trigger a fetch, and
`forceLoad` doesn't have to inline a volatile write.

```ts
type setForceLoadTrack = (flag: boolean) => void
```

#### action: forceLoad

Force-load: exempt this track from the gate and refetch. One click covers every
region and both axes, informed by the size the banner just quoted. The display
chrome calls this from TooLargeMessage's button; concrete display models
override `reload()` to do the actual refetch.

```ts
type forceLoad = () => void
```

</details>

<details>
<summary>Derived from RenderLifecycleMixin</summary>

[RenderLifecycleMixin →](../renderlifecyclemixin)

**Volatiles**

#### volatile: canvasDrawn

flips true on first paint; read by test selectors to detect render

```ts
// type signature
type canvasDrawn = false
// code
canvasDrawn: false
```

#### volatile: currentRenderingBackend

current backend reference, updated on context-loss recovery. Typed `unknown`
(not generic `B`) on purpose: this mixin is composed by every display via a
non-generic factory, so the per-display backend type `B` isn't known here — it's
supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the
autoruns. Don't "fix" the cast.

```ts
// type signature
type currentRenderingBackend = undefined
// code
currentRenderingBackend: undefined
```

#### volatile: renderTick

counter the render autorun observes; bumped to force a re-render

```ts
// type signature
type renderTick = number
// code
renderTick: 0
```

#### volatile: autorunsInstalled

guards attachRenderingBackend so the autorun pair spawns once per instance

```ts
// type signature
type autorunsInstalled = false
// code
autorunsInstalled: false
```

#### volatile: renderError

the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.
Single source of truth for the render-error terminal state:
`useRenderingBackend` writes it from the canvas-init mechanism so the model —
not React-local hook state — owns every terminal state. Read by `displayPhase`
(whose `renderError` term outranks `loading`, suppressing the scrim) and by
`DisplayChrome` (shows the retry overlay).

```ts
// type signature
type renderError = undefined
// code
renderError: undefined
```

**Actions**

#### action: setRenderError

set/clear the render-backend error. Called by `useRenderingBackend`: with the
error when the canvas factory rejects (or context-loss re-init fails), and with
`undefined` on successful (re)init and on retry.

```ts
type setRenderError = (error: unknown) => void
```

#### action: attachRenderingBackend

attach a GPU/Canvas2D backend and install the upload + render autorun pair
(idempotent — re-calling only swaps the backend)

```ts
type attachRenderingBackend = <B>(
  backend: B,
  cbs: RenderingBackendCallbacks<B>,
) => void
```

| Member                                                             | Type         |
| ------------------------------------------------------------------ | ------------ |
| <span id="action-markcanvasdrawn">markCanvasDrawn</span>           | `() => void` |
| <span id="action-resetcanvasdrawn">resetCanvasDrawn</span>         | `() => void` |
| <span id="action-stoprenderingbackend">stopRenderingBackend</span> | `() => void` |
| <span id="action-rendernow">renderNow</span>                       | `() => void` |

</details>

<details>
<summary>Derived from FetchMixin</summary>

[FetchMixin →](../fetchmixin)

**Volatiles**

#### volatile: activeStopToken

stop token of the in-flight fetch, or undefined when idle

```ts
// type signature
type activeStopToken = StopToken | undefined
// code
activeStopToken: undefined as StopToken | undefined
```

#### volatile: fetchGeneration

bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the
staleness epoch inside runFetch

```ts
// type signature
type fetchGeneration = number
// code
fetchGeneration: 0
```

#### volatile: fetchCanceled

true after the user explicitly cancels a load (the loading overlay's cancel
button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`,
it does not retrigger the fetch autoruns — so the load stays stopped until the
user retries (`reload`) or the viewport changes. Any new fetch clears it
(`runFetch` resets it at the start).

```ts
// type signature
type fetchCanceled = false
// code
fetchCanceled: false
```

#### volatile: regionStatuses

latest status of each concurrent in-flight operation, keyed by an arbitrary id
(the canvas display uses displayedRegionIndex). Plain bookkeeping — not read
reactively; setRegionStatus derives the observable statusMessage/statusProgress
from it on every update so N parallel region fetches aggregate into one bar
instead of clobbering.

```ts
// type signature
type regionStatuses = Map<number, RpcStatus>
// code
regionStatuses: new Map<number, RpcStatus>()
```

**Getters**

#### getter: isLoading

true while a fetch is active

```ts
type isLoading = boolean
```

**Methods**

#### method: makeStatusCallback

An RPC `statusCallback` bound to this display: forwards progress to the shared
`statusMessage`, guarded by `isAlive` so a callback that fires after the node is
torn down (RPCs resolve their status stream asynchronously) is a safe no-op.
Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard
at every call site.

```ts
type makeStatusCallback = () => (status: RpcStatus) => void
```

#### method: makeRegionStatusCallback

Per-region variant of `makeStatusCallback`: routes progress through
`setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one
status bar instead of clobbering each other. Same `isAlive` guard;
`setRegionStatus` owns the throttling (it has to thin only the bar write, not
the per-region bookkeeping).

```ts
type makeRegionStatusCallback = (key: number) => (status: RpcStatus) => void
```

**Actions**

#### action: throttleStatus

Run `apply` only if the throttle window has elapsed.

```ts
type throttleStatus = (apply: () => void) => void
```

#### action: resetStatus

Drop the active stop token and clear all status bookkeeping. Shared by both
cancel paths and runFetch's cleanup.

```ts
type resetStatus = () => void
```

#### action: stopActiveFetch

Abort the in-flight fetch (if any) and clear its status. The shared preamble of
both cancel paths; the difference between them is only what they do to
`fetchCanceled` / `fetchGeneration` afterward.

```ts
type stopActiveFetch = () => void
```

#### action: setRegionStatus

Record one concurrent operation's latest status (keyed) and recompute the shared
statusMessage/statusProgress as the aggregate across all in-flight keys. Pass
undefined to drop a key. Used by displays that fan a single fetch out into
parallel per-region RPCs.

```ts
type setRegionStatus = (key: number, status?: RpcStatus | undefined) => void
```

#### action: cancelFetch

cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers
can retrigger fetch autoruns even when nothing was in flight). This is the
_internal_ reset used by clearAllRpcData/invalidateLoadedRegions — it clears any
user-cancel flag so the retrigger actually re-fetches.

```ts
type cancelFetch = () => void
```

#### action: cancelFetchByUser

User-initiated cancel from the loading overlay. Stops the in-flight fetch and
lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump
fetchGeneration — so the fetch autoruns don't immediately restart the load. The
user retries via `reload` (the overlay's retry button), or it clears on the next
viewport change.

```ts
type cancelFetchByUser = () => void
```

#### action: beforeDestroy

Release an in-flight fetch's stop token on teardown. Without this, a display
destroyed mid-fetch (track/view closed while loading) never revokes its token —
a blob-URL leak on the non-SAB fallback path — and never signals the worker to
abort the now-useless work. MST auto-chains lifecycle hooks, so a composing
display can still define its own beforeDestroy.

```ts
type beforeDestroy = () => void
```

#### action: runFetch

Run a cancel-safe fetch (cancels any prior). The work callback gets a
FetchContext with a stopToken to forward to the RPC and an isStale() check to
short-circuit commits once the user has moved on. Abort errors are swallowed;
others are stored in `error` if not stale.

```ts
type runFetch = (work: (ctx: FetchContext) => Promise<void>) => Promise<void>
```

</details>

<details>
<summary>Derived from CanvasFeatureGateMixin</summary>

[CanvasFeatureGateMixin →](../canvasfeaturegatemixin)

**Volatiles**

#### volatile: densityStatsPerRegion

per-region feature counts (keyed by displayedRegionIndex), so the density
verdict is a live max over the visible regions at the current bpPerPx — never a
stale fetch-time snapshot. Survives viewport-change clears; dropped on
chromosome nav by `clearGateMeasurements`.

```ts
// type signature
type densityStatsPerRegion = ObservableMap<number, RegionDensityStats>
// code
densityStatsPerRegion: observable.map<number, RegionDensityStats>()
```

**Getters**

#### getter: visibleFeatureDensityPerPx

Current density across the visible regions at the debounced coarseBpPerPx, so
the verdict shares the layout cadence and doesn't flicker mid-zoom.

```ts
type visibleFeatureDensityPerPx = number
```

#### getter: gateInactive

No axis gates at all: an exempt adapter / declarative force-load, or a span
under the AUTO_FORCE_LOAD_BP floor. Both worker budgets go undefined here, so
the fetch skips the estimate rather than paying for one the verdict ignores.

```ts
type gateInactive = boolean
```

#### getter: maxFeatureDensity

The density budget passed to the worker and used by the derived verdict:
undefined (gate off) when nothing gates, otherwise the config. Force-load
reaches this through `gateInactive`, so approving a track's _size_ no longer
half-disables its _density_ axis by side effect — both axes are the one boolean
now.

```ts
type maxFeatureDensity = number | undefined
```

| Member                                                   | Type      |
| -------------------------------------------------------- | --------- |
| <span id="getter-densitytoolarge">densityTooLarge</span> | `boolean` |

**Methods**

#### method: observedMaxDensity

Highest features-per-pixel across the visible regions at `bpPerPx`, from the
cached per-region counts.

```ts
type observedMaxDensity = (bpPerPx: number) => number
```

#### method: resolvedByteLimit

The byte budget the fetch RPC enforces, short-circuiting an over-budget region
before downloading features. Undefined (unlimited) when nothing gates; otherwise
the very number the banner compares against, so the worker can't reject a region
the banner then calls fine.

```ts
type resolvedByteLimit = () => number | undefined
```

**Actions**

#### action: clearGateMeasurements

Drop the cached per-region density stats on chromosome navigation
(displayedRegion indices get reused, so a stale entry would gate the new region
against the wrong stats). Driven by the mixin's own `afterAttach` below — no
composing display has to wire it up. The byte estimate is dropped by
`MultiRegionDisplayMixin`'s `DisplayedRegionsChange` autorun on the same
trigger.

Measurements only. Force-load is a track-wide boolean that deliberately outlives
navigation, so there is no per-region ceiling to expire here.

```ts
type clearGateMeasurements = () => void
```

#### action: commitGateMeasurements

Commit a batch of per-region fetch outcomes: record the per-region byte **max**
(not sum — each region is gated against the same per-region budget, so a
multi-region view where every region individually fits is never blanked by the
cross-region total) and the per-region density, then publish the byte estimate +
adapter limit to `RegionTooLargeMixin` so the banner's `resolveByteLimit` picks
the same budget the worker gated on.

```ts
type commitGateMeasurements = (
  measurements: RegionGateMeasurement[],
  measuredSpanBp: number,
) => void
```

| Member                                                   | Type                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| <span id="action-setdensitystats">setDensityStats</span> | `(displayedRegionIndex: number, stats: RegionDensityStats) => void` |

</details>

<details>
<summary>Derived from TreeSidebarMixin</summary>

[TreeSidebarMixin →](../treesidebarmixin)

**Properties**

| Member                                                 | Type                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| <span id="property-layout">layout</span>               | `IOptionalIType<IType<S[], S[], S[]>, [undefined]>`                    |
| <span id="property-clustertree">clusterTree</span>     | `IOptionalIType<IMaybe<ISimpleType<string>>, [undefined]>`             |
| <span id="property-treeareawidth">treeAreaWidth</span> | `IOptionalIType<ISimpleType<number>, [undefined]>`                     |
| <span id="property-subtreefilter">subtreeFilter</span> | `IOptionalIType<IMaybe<IArrayType<ISimpleType<string>>>, [undefined]>` |

**Volatiles**

| Member                                                     | Type                           |
| ---------------------------------------------------------- | ------------------------------ |
| <span id="volatile-hoveredtreenode">hoveredTreeNode</span> | `HoveredTreeNode \| undefined` |
| <span id="volatile-treecanvas">treeCanvas</span>           | `HTMLCanvasElement \| null`    |
| <span id="volatile-mouseovercanvas">mouseoverCanvas</span> | `HTMLCanvasElement \| null`    |

**Getters**

| Member                                                             | Type                                     |
| ------------------------------------------------------------------ | ---------------------------------------- |
| <span id="getter-parsedtree">parsedTree</span>                     | `HierarchyNode<NewickNode> \| undefined` |
| <span id="getter-root">root</span>                                 | `HierarchyNode<NewickNode> \| undefined` |
| <span id="getter-treehasbranchlengths">treeHasBranchLengths</span> | `boolean`                                |

**Methods**

| Member                                               | Type                     |
| ---------------------------------------------------- | ------------------------ |
| <span id="method-willcleartree">willClearTree</span> | `(next: S[]) => boolean` |

**Actions**

| Member                                                                   | Type                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------- |
| <span id="action-setlayout">setLayout</span>                             | `(layout: S[]) => void`                             |
| <span id="action-clearlayout">clearLayout</span>                         | `() => void`                                        |
| <span id="action-setclustertree">setClusterTree</span>                   | `(tree?: string \| undefined) => void`              |
| <span id="action-setlayoutandclustertree">setLayoutAndClusterTree</span> | `(layout: S[], tree?: string \| undefined) => void` |
| <span id="action-settreeareawidth">setTreeAreaWidth</span>               | `(width: number) => void`                           |
| <span id="action-setsubtreefilter">setSubtreeFilter</span>               | `(names?: string[] \| undefined) => void`           |
| <span id="action-sethoveredtreenode">setHoveredTreeNode</span>           | `(node?: HoveredTreeNode \| undefined) => void`     |
| <span id="action-settreecanvasref">setTreeCanvasRef</span>               | `(ref: HTMLCanvasElement \| null) => void`          |
| <span id="action-setmouseovercanvasref">setMouseoverCanvasRef</span>     | `(ref: HTMLCanvasElement \| null) => void`          |

</details>
