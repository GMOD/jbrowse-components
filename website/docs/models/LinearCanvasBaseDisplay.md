---
id: linearcanvasbasedisplay
title: LinearCanvasBaseDisplay
sidebar_label: Display -> LinearCanvasBaseDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`canvas` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/baseModel.ts).

## Overview

Shared GPU-accelerated feature display base for canvas-rendered tracks. Handles
fetching, layout, the "Show labels" / "Show descriptions" UI, and the
fetch-invalidation autorun. Subclasses layer schema-specific properties and
menus via the showSubmenuMenuItems / trackMenuItems / contextMenuItems
super-extension pattern, and extend rpcProps() via the standard super-capture
pattern.

## Members

| Member                                                                   | Kind       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [refName](#property-refname)                                             | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [start](#property-start)                                                 | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [end](#property-end)                                                     | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [name](#property-name)                                                   | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [configuration](#property-configuration)                                 | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [jexlFiltersSetting](#property-jexlfilterssetting)                       | Properties | Runtime "Filter by..." override. When set (even to an empty list) it replaces the `jexlFilters` config slot; when undefined the config default applies. Stored as already-`jexl:`-prefixed expressions (runtime convention), unlike the deferred-evaluation config slot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [pinnedFeatureIds](#property-pinnedfeatureids)                           | Properties | Feature ids the user pinned to the top of the layout via the feature right-click menu. Pinned features are inserted first into the greedy row-packer, so they hold the topmost rows in their bp range across zoom re-packs (see packRef in layout.ts). stripDefault so a display with nothing pinned omits the empty array from its snapshot. Persisted by uniqueId, which resolves back to the same feature after a plain reload of the same remote file: every adapter id is `adp-<configHash>` (idMaker over the config) plus a file byte offset (tabix/BigBed) or a deterministic full-file parse index (plain GFF3/BED/VCF). Caveat: NOT robust to editing a file read by a plain (non-tabix) adapter (the indices shift), nor to local blob files (their handleId changes each session — but a blob can't reload its data across refresh anyway). Same basis for solo/hiddenFeatureIds. |
| [soloFeatureIds](#property-solofeatureids)                               | Properties | "Show only these features": the collected set the user builds by ctrl+clicking features (or via the right-click menu). Only isolates the view once `soloApplied` is true — before that it's a highlighted selection that hides nothing, so the candidates stay clickable. Persistent so a view can be opened pre-focused declaratively (e.g. collapse-introns seeds it in the new view's snapshot). stripDefault so an unfocused display omits the empty array from its snapshot.                                                                                                                                                                                                                                                                                                                                                                                                             |
| [soloApplied](#property-soloapplied)                                     | Properties | Whether the collected soloFeatureIds set is actually isolating the view (worker drops non-members). Decoupled from collection so building a multi-feature set doesn't hide the features mid-build.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [hiddenFeatureIds](#property-hiddenfeatureids)                           | Properties | "Hide this feature" exclusion set (inverse of solo): the worker drops these from layout/drawing. Applies immediately per feature — no collect-then-apply. Persistent like the solo set, so a hidden feature stays hidden across reload/session save. stripDefault so a display with nothing hidden omits the empty array from its snapshot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [featureHighlights](#property-featurehighlights)                         | Properties | Declarative feature highlights, typically seeded by a text search (highlight the gene you searched for). Each entry pins a feature by its span+name signature rather than its uniqueId — a search result carries no uniqueId to persist (unlike solo/hidden/pinned, which come from a click on a rendered feature and so DO have a reload-stable id) — and is resolved against rendered features on the main thread. stripDefault so a display with no highlights omits it from snapshot.                                                                                                                                                                                                                                                                                                                                                                                                     |
| [rpcDataMap](#volatile-rpcdatamap)                                       | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [densityStatsPerRegion](#volatile-densitystatsperregion)                 | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureIdUnderMouse](#volatile-featureidundermouse)                     | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [subfeatureIdUnderMouse](#volatile-subfeatureidundermouse)               | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [hoveredRegionIndex](#volatile-hoveredregionindex)                       | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [mouseoverExtraInformation](#volatile-mouseoverextrainformation)         | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [contextMenuInfo](#volatile-contextmenuinfo)                             | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [userFeatureDensityLimit](#volatile-userfeaturedensitylimit)             | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [byteEstimateVisibleBp](#volatile-byteestimatevisiblebp)                 | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [incrementalLayout](#volatile-incrementallayout)                         | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [incrementalLayoutLabelsOnly](#volatile-incrementallayoutlabelsonly)     | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [incrementalLayoutBodiesOnly](#volatile-incrementallayoutbodiesonly)     | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [morphFromTops](#volatile-morphfromtops)                                 | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [morphProgress](#volatile-morphprogress)                                 | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [morphStartMs](#volatile-morphstartms)                                   | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [morphFromMaxY](#volatile-morphfrommaxy)                                 | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [conf](#getter-conf)                                                     | Getters    | the config typed off the concrete schema; `ConfigurationReference` erases `self.configuration` to `any`, so direct reads route through this to stay typed (same move as `BaseAdapter<CONF>`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [visibleFeatureDensityPerPx](#getter-visiblefeaturedensityperpx)         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [renderState](#getter-renderstate)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [DisplayMessageComponent](#getter-displaymessagecomponent)               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [maxHeight](#getter-maxheight)                                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [autoHeight](#getter-autoheight)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [displayMode](#getter-displaymode)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [heightMode](#getter-heightmode)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [fitHeightToDisplay](#getter-fitheighttodisplay)                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [labelFontSize](#getter-labelfontsize)                                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showLabelsMode](#getter-showlabelsmode)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showLabels](#getter-showlabels)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showDescriptions](#getter-showdescriptions)                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showOutline](#getter-showoutline)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureColor](#getter-featurecolor)                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [utrColor](#getter-utrcolor)                                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [colorByMode](#getter-colorbymode)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [colorByAttribute](#getter-colorbyattribute)                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [effectiveShowDescriptions](#getter-effectiveshowdescriptions)           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [selectedFeatureId](#getter-selectedfeatureid)                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [maxFeatureDensity](#getter-maxfeaturedensity)                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [colorByCDS](#getter-colorbycds)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [sequenceAdapter](#getter-sequenceadapter)                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [regionKeys](#getter-regionkeys)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [reversedRegions](#getter-reversedregions)                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [pinnedFeatureIdSet](#getter-pinnedfeatureidset)                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [resolvedHighlights](#getter-resolvedhighlights)                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [highlightedFeatureIdSet](#getter-highlightedfeatureidset)               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [layoutPinnedFeatureIdSet](#getter-layoutpinnedfeatureidset)             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [soloFeatureIdSet](#getter-solofeatureidset)                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureWidgetType](#getter-featurewidgettype)                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [estimatedVisibleBytes](#getter-estimatedvisiblebytes)                   | Getters    | The cached byte estimate scaled from the span it was measured over (`byteEstimateVisibleBp`) to the currently visible span. The estimate is roughly proportional to span, so scaling makes it a pure function of the current view — mirroring densityTooLarge. Crucially it self-releases on zoom-in: without scaling, a large zoomed-out estimate stays above the limit forever and gates refetch (FetchVisibleRegions won't re-estimate while regionTooLarge holds) — a permanently stuck banner.                                                                                                                                                                                                                                                                                                                                                                                           |
| [densityTooLarge](#getter-densitytoolarge)                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [tooLargeStatus](#getter-toolargestatus)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [regionTooLarge](#getter-regiontoolarge)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [regionTooLargeReason](#getter-regiontoolargereason)                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [layoutInputs](#getter-layoutinputs)                                     | Getters    | Layout inputs shared by the base layout and every fit-escalation layout, minus the per-config label/description reservation flags. One source so the candidate layouts can't drift on bpPerPx / region keys / display mode / pins.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [baseLaidOutDataMap](#getter-baselaidoutdatamap)                         | Getters    | Full reservation (names + descriptions): rendered at fit stage `full` and in non-fit modes, and the first stack `fitStage` probes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [fitLabelsOnlyLayout](#getter-fitlabelsonlylayout)                       | Getters    | Names reserved, descriptions dropped — the `labels` stage's stack.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [fitBodiesOnlyLayout](#getter-fitbodiesonlylayout)                       | Getters    | Nothing reserved: bodies packed edge-to-edge (the tightest stack), labels hidden — the `bodies` stage's stack.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [fitMinScale](#getter-fitminscale)                                       | Getters    | Floor on the fit squeeze: the smallest vertical scale that still leaves a feature body at least `MIN_FIT_BOX_PX` tall. The unscaled body height is the configured `featureHeight` times the display-mode multiplier (what the layout already applied). When bodies would pack tighter than this the squeeze stops here and the surplus scrolls instead of vanishing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [fitStage](#getter-fitstage)                                             | Getters    | The resolved fit outcome — which reservation `level` survived, its unscaled `layout`, and the vertical `scale` to fill the track — bundled so the three can never disagree. The ladder keeps the least reduction whose _unscaled_ stack fits the track height: `full` (names + descriptions), else `labels` (drop descriptions), else `bodies` (drop names too, pack tight). Only `bodies` can still overflow, and only it scales; `full`/`labels` fit by construction. Non-fit modes stay at `full`, scale 1. Read off the unscaled candidate heights so it can't feed back on its own `scale`. The bodies squeeze is floored at `fitMinScale` (keeping boxes visible); a stack too dense to fit even there overflows and scrolls.                                                                                                                                                           |
| [fitScale](#getter-fitscale)                                             | Getters    | Uniform vertical shrink for fit mode; 1 unless the bodies stack is being squeezed to fill the track.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [laidOutDataMap](#getter-laidoutdatamap)                                 | Getters    | What every consumer (hit test, GPU upload, React render) reads: the resolved fit layout, cloned and scaled only while squeezing bodies. Returned by reference off the un-squeezed path so the incremental-layout upload diff and Y-morph idle check stay intact.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [renderedShowDescriptions](#getter-renderedshowdescriptions)             | Getters    | Descriptions are painted only at the `full` stage (and whenever fit is off). Every render-time consumer — label draw and the highlight/hit/SVG label-width reservation — reads this so a box never reserves width for a description it won't draw.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [renderedShowLabels](#getter-renderedshowlabels)                         | Getters    | Names are painted at the `full`/`labels` stages (and whenever fit is off), where the packer reserved their row height and overhang so they never overlap. At the `bodies` stage nothing is reserved, so names are hidden rather than drawn on top of the boxes. Every render-time consumer reads this so hidden names reserve nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [renderDataMap](#getter-renderdatamap)                                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [maxY](#getter-maxy)                                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [hasOverflow](#getter-hasoverflow)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [contentHeight](#getter-contentheight)                                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [scrollableHeight](#getter-scrollableheight)                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [fitHeight](#getter-fitheight)                                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [grownHeight](#getter-grownheight)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureIdIndex](#getter-featureidindex)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [subfeatureIdIndex](#getter-subfeatureidindex)                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [hoveredFeature](#getter-hoveredfeature)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [hoveredSubfeature](#getter-hoveredsubfeature)                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureItemMap](#getter-featureitemmap)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [highlightedFeatureIds](#getter-highlightedfeatureids)                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [flatbushIndexes](#getter-flatbushindexes)                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [observedMaxDensity](#method-observedmaxdensity)                         | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [activeFilters](#method-activefilters)                                   | Methods    | The filters actually applied, as `jexl:`-prefixed expressions. The runtime override shadows the config slot when set; otherwise the deferred-evaluation `jexlFilters` config slot is prefixed on read. This is the single source of truth for both the worker (via rpcProps) and the "Filter by..." dialog (so existing config filters show up and are editable).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [rpcProps](#method-rpcprops)                                             | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [fitLayoutAt](#method-fitlayoutat)                                       | Methods    | One fit-escalation candidate: the stack packed with the given label/description reservation, via that config's own memo instance so each keeps stable references across renders. Empty until initialized/in-bounds, so the GPU upload autorun has nothing to push.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [getFeatureById](#method-getfeaturebyid)                                 | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [searchFeatureByID](#method-searchfeaturebyid)                           | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [renderSvg](#method-rendersvg)                                           | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showSubmenuMenuItems](#method-showsubmenumenuitems)                     | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [contextMenuItems](#method-contextmenuitems)                             | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [colorBySubMenuItems](#method-colorbysubmenuitems)                       | Methods    | The "Color by..." radio choices (solid/strand/attribute). Split out so subclasses can reuse them while assembling their own color menu.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [colorMenuItems](#method-colormenuitems)                                 | Methods    | Color-related track menu entries: a single "Color by..." entry whose "Solid color..." choice opens the solid+UTR color picker. Subclasses (e.g. variants) override to drop the gene-oriented UTR picker.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [featureHeightMenuItems](#method-featureheightmenuitems)                 | Methods    | The "Feature height" submenu. The top level is only the three intuitive size presets (the one thing ~everyone wants). The less-obvious container-sizing strategy lives under a "Track height" nested entry with effect-describing labels, so a first-time user never has to parse "fixed/grow/fit". Shared by every canvas display (genes, variants).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [trackMenuItems](#method-trackmenuitems)                                 | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [beginYMorph](#action-beginymorph)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setMorphProgress](#action-setmorphprogress)                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [endYMorph](#action-endymorph)                                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setRpcData](#action-setrpcdata)                                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setDensityStats](#action-setdensitystats)                               | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [pruneRpcDataMapToVisible](#action-prunerpcdatamaptovisible)             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [startRenderingBackend](#action-startrenderingbackend)                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setFeatureDensityStatsLimit](#action-setfeaturedensitystatslimit)       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setHover](#action-sethover)                                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearHover](#action-clearhover)                                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [closeContextMenu](#action-closecontextmenu)                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [togglePinnedFeature](#action-togglepinnedfeature)                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [toggleSoloFeature](#action-togglesolofeature)                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearSolo](#action-clearsolo)                                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [hideFeature](#action-hidefeature)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [showAllHidden](#action-showallhidden)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setFeatureHighlights](#action-setfeaturehighlights)                     | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [addFeatureHighlightForItem](#action-addfeaturehighlightforitem)         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [removeFeatureHighlightsForItem](#action-removefeaturehighlightsforitem) | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearFeatureHighlights](#action-clearfeaturehighlights)                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [applySolo](#action-applysolo)                                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [soloFeature](#action-solofeature)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [clearAllFeatureFilters](#action-clearallfeaturefilters)                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [selectFeature](#action-selectfeature)                                   | Actions    | Open the feature-details widget. The adapter's header metadata (VCF INFO/FORMAT descriptions, etc.) is fetched first and passed as `descriptions` so the widget can label attribute rows and — for the variant widget — resolve the ANN/CSQ column names; without it that table renders headerless. CoreGetMetadata returns null for adapters that expose none, so this is a no-op for those tracks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [clearSelection](#action-clearselection)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setShowLabels](#action-setshowlabels)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setShowDescriptions](#action-setshowdescriptions)                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setJexlFilters](#action-setjexlfilters)                                 | Actions    | Sets the runtime filter override (already-`jexl:`-prefixed expressions). Pass undefined to clear it and fall back to the config `jexlFilters` slot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [setShowOutline](#action-setshowoutline)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setFeatureColor](#action-setfeaturecolor)                               | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setUtrColor](#action-setutrcolor)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [openContextMenu](#action-opencontextmenu)                               | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setDisplayMode](#action-setdisplaymode)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setHeightMode](#action-setheightmode)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [openSetColorDialog](#action-opensetcolordialog)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [openColorByAttributeDialog](#action-opencolorbyattributedialog)         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [openFilterDialog](#action-openfilterdialog)                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [fetchFullFeature](#action-fetchfullfeature)                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [isCacheValid](#action-iscachevalid)                                     | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [byteSizeLimit](#action-bytesizelimit)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [selectFeatureById](#action-selectfeaturebyid)                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [reload](#action-reload)                                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [fetchNeeded](#action-fetchneeded)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [setFeatureDensityStats](#action-setfeaturedensitystats)                 | Actions    | Records the span the byte estimate was measured at so `estimatedVisibleBytes` can scale it to the current view (see `byteEstimateVisibleBp`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [clearStaleDensityState](#action-clearstaledensitystate)                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [resizeHeight](#action-resizeheight)                                     | Actions    | A manual drag-resize means the user wants a fixed height; leave grow mode first, otherwise the CanvasAutoHeight autorun snaps the height back on the next layout change and the drag appears to do nothing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [afterAttach](#action-afterattach)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### LinearCanvasBaseDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearcanvasbasedisplay).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** [id](../basedisplay#property-id),
[type](../basedisplay#property-type),
[rpcDriverName](../basedisplay#property-rpcdrivername)

**Volatiles:** [error](../basedisplay#volatile-error),
[statusMessage](../basedisplay#volatile-statusmessage),
[statusProgress](../basedisplay#volatile-statusprogress)

**Getters:** [parentTrack](../basedisplay#getter-parenttrack),
[parentDisplay](../basedisplay#getter-parentdisplay),
[RenderingComponent](../basedisplay#getter-renderingcomponent),
[DisplayBlurb](../basedisplay#getter-displayblurb),
[adapterConfig](../basedisplay#getter-adapterconfig),
[isMinimized](../basedisplay#getter-isminimized),
[effectiveRpcDriverName](../basedisplay#getter-effectiverpcdrivername),
[DisplayMessageComponent](../basedisplay#getter-displaymessagecomponent),
[viewMenuActions](../basedisplay#getter-viewmenuactions)

**Methods:** [renderingProps](../basedisplay#method-renderingprops),
[trackMenuItems](../basedisplay#method-trackmenuitems),
[regionCannotBeRendered](../basedisplay#method-regioncannotberendered)

**Actions:** [setStatusMessage](../basedisplay#action-setstatusmessage),
[setError](../basedisplay#action-seterror),
[setRpcDriverName](../basedisplay#action-setrpcdrivername),
[reload](../basedisplay#action-reload)

### Available via [TrackHeightMixin](../trackheightmixin)

**Volatiles:** [scrollTop](../trackheightmixin#volatile-scrolltop)

**Getters:** [height](../trackheightmixin#getter-height)

**Actions:** [setScrollTop](../trackheightmixin#action-setscrolltop),
[setHeight](../trackheightmixin#action-setheight),
[resizeHeight](../trackheightmixin#action-resizeheight)

### Available via [MultiRegionDisplayMixin](../multiregiondisplaymixin)

**Volatiles:**
[loadedRegions](../multiregiondisplaymixin#volatile-loadedregions)

**Getters:** [isReady](../multiregiondisplaymixin#getter-isready),
[viewportWithinLoadedData](../multiregiondisplaymixin#getter-viewportwithinloadeddata),
[svgReady](../multiregiondisplaymixin#getter-svgready),
[svgReadyExtraTerminal](../multiregiondisplaymixin#getter-svgreadyextraterminal),
[renderBlocks](../multiregiondisplaymixin#getter-renderblocks),
[displayPhase](../multiregiondisplaymixin#getter-displayphase)

**Actions:**
[setLoadedRegion](../multiregiondisplaymixin#action-setloadedregion),
[clearDisplaySpecificData](../multiregiondisplaymixin#action-cleardisplayspecificdata),
[clearAllRpcData](../multiregiondisplaymixin#action-clearallrpcdata),
[reload](../multiregiondisplaymixin#action-reload),
[invalidateLoadedRegions](../multiregiondisplaymixin#action-invalidateloadedregions),
[fetchNeeded](../multiregiondisplaymixin#action-fetchneeded),
[isCacheValid](../multiregiondisplaymixin#action-iscachevalid),
[getByteEstimateConfig](../multiregiondisplaymixin#action-getbyteestimateconfig),
[fetchRegions](../multiregiondisplaymixin#action-fetchregions),
[afterAttach](../multiregiondisplaymixin#action-afterattach)

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:**
[userByteSizeLimit](../regiontoolargemixin#property-userbytesizelimit)

**Volatiles:**
[regionTooLargeState](../regiontoolargemixin#volatile-regiontoolargestate),
[regionTooLargeReasonState](../regiontoolargemixin#volatile-regiontoolargereasonstate),
[featureDensityStats](../regiontoolargemixin#volatile-featuredensitystats)

**Getters:** [regionTooLarge](../regiontoolargemixin#getter-regiontoolarge),
[regionTooLargeReason](../regiontoolargemixin#getter-regiontoolargereason)

**Methods:**
[regionCannotBeRenderedText](../regiontoolargemixin#method-regioncannotberenderedtext)

**Actions:**
[setRegionTooLarge](../regiontoolargemixin#action-setregiontoolarge),
[setFeatureDensityStats](../regiontoolargemixin#action-setfeaturedensitystats),
[setFeatureDensityStatsLimit](../regiontoolargemixin#action-setfeaturedensitystatslimit),
[reload](../regiontoolargemixin#action-reload),
[forceLoad](../regiontoolargemixin#action-forceload)

### Available via [RenderLifecycleMixin](../renderlifecyclemixin)

**Volatiles:** [canvasDrawn](../renderlifecyclemixin#volatile-canvasdrawn),
[currentRenderingBackend](../renderlifecyclemixin#volatile-currentrenderingbackend),
[renderTick](../renderlifecyclemixin#volatile-rendertick),
[autorunsInstalled](../renderlifecyclemixin#volatile-autorunsinstalled),
[renderError](../renderlifecyclemixin#volatile-rendererror)

**Actions:** [markCanvasDrawn](../renderlifecyclemixin#action-markcanvasdrawn),
[resetCanvasDrawn](../renderlifecyclemixin#action-resetcanvasdrawn),
[stopRenderingBackend](../renderlifecyclemixin#action-stoprenderingbackend),
[renderNow](../renderlifecyclemixin#action-rendernow),
[setRenderError](../renderlifecyclemixin#action-setrendererror),
[attachRenderingBackend](../renderlifecyclemixin#action-attachrenderingbackend)

### Available via [FetchMixin](../fetchmixin)

**Volatiles:** [activeStopToken](../fetchmixin#volatile-activestoptoken),
[fetchGeneration](../fetchmixin#volatile-fetchgeneration),
[error](../fetchmixin#volatile-error),
[statusMessage](../fetchmixin#volatile-statusmessage),
[statusProgress](../fetchmixin#volatile-statusprogress),
[fetchCanceled](../fetchmixin#volatile-fetchcanceled),
[regionStatuses](../fetchmixin#volatile-regionstatuses),
[lastStatusMs](../fetchmixin#volatile-laststatusms)

**Getters:** [isLoading](../fetchmixin#getter-isloading)

**Methods:** [makeStatusCallback](../fetchmixin#method-makestatuscallback),
[makeRegionStatusCallback](../fetchmixin#method-makeregionstatuscallback)

**Actions:** [setError](../fetchmixin#action-seterror),
[setStatusMessage](../fetchmixin#action-setstatusmessage),
[throttleStatus](../fetchmixin#action-throttlestatus),
[resetStatus](../fetchmixin#action-resetstatus),
[stopActiveFetch](../fetchmixin#action-stopactivefetch),
[setRegionStatus](../fetchmixin#action-setregionstatus),
[cancelFetch](../fetchmixin#action-cancelfetch),
[cancelFetchByUser](../fetchmixin#action-cancelfetchbyuser),
[runFetch](../fetchmixin#action-runfetch)

### Available via [PromotableDefaultsMixin](../promotabledefaultsmixin)

**Methods:**
[sessionDefaultChanges](../promotabledefaultsmixin#method-sessiondefaultchanges)

**Actions:**
[clearSessionDefaults](../promotabledefaultsmixin#action-clearsessiondefaults)

<details>
<summary>LinearCanvasBaseDisplay - Properties</summary>

#### property: jexlFiltersSetting

Runtime "Filter by..." override. When set (even to an empty list) it replaces
the `jexlFilters` config slot; when undefined the config default applies. Stored
as already-`jexl:`-prefixed expressions (runtime convention), unlike the
deferred-evaluation config slot.

```ts
// type signature
type jexlFiltersSetting = IMaybe<IArrayType<ISimpleType<string>>>
// code
jexlFiltersSetting: types.maybe(types.array(types.string))
```

#### property: pinnedFeatureIds

Feature ids the user pinned to the top of the layout via the feature right-click
menu. Pinned features are inserted first into the greedy row-packer, so they
hold the topmost rows in their bp range across zoom re-packs (see packRef in
layout.ts). stripDefault so a display with nothing pinned omits the empty array
from its snapshot.

Persisted by uniqueId, which resolves back to the same feature after a plain
reload of the same remote file: every adapter id is `adp-<configHash>` (idMaker
over the config) plus a file byte offset (tabix/BigBed) or a deterministic
full-file parse index (plain GFF3/BED/VCF). Caveat: NOT robust to editing a file
read by a plain (non-tabix) adapter (the indices shift), nor to local blob files
(their handleId changes each session — but a blob can't reload its data across
refresh anyway). Same basis for solo/hiddenFeatureIds.

```ts
// type signature
type pinnedFeatureIds = IOptionalIType<
  IArrayType<ISimpleType<string>>,
  [undefined]
>
// code
pinnedFeatureIds: types.stripDefault(types.array(types.string), [])
```

#### property: soloFeatureIds

"Show only these features": the collected set the user builds by ctrl+clicking
features (or via the right-click menu). Only isolates the view once
`soloApplied` is true — before that it's a highlighted selection that hides
nothing, so the candidates stay clickable. Persistent so a view can be opened
pre-focused declaratively (e.g. collapse-introns seeds it in the new view's
snapshot). stripDefault so an unfocused display omits the empty array from its
snapshot.

```ts
// type signature
type soloFeatureIds = IOptionalIType<
  IArrayType<ISimpleType<string>>,
  [undefined]
>
// code
soloFeatureIds: types.stripDefault(types.array(types.string), [])
```

#### property: soloApplied

Whether the collected soloFeatureIds set is actually isolating the view (worker
drops non-members). Decoupled from collection so building a multi-feature set
doesn't hide the features mid-build.

```ts
// type signature
type soloApplied = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
soloApplied: types.stripDefault(types.boolean, false)
```

#### property: hiddenFeatureIds

"Hide this feature" exclusion set (inverse of solo): the worker drops these from
layout/drawing. Applies immediately per feature — no collect-then-apply.
Persistent like the solo set, so a hidden feature stays hidden across
reload/session save. stripDefault so a display with nothing hidden omits the
empty array from its snapshot.

```ts
// type signature
type hiddenFeatureIds = IOptionalIType<
  IArrayType<ISimpleType<string>>,
  [undefined]
>
// code
hiddenFeatureIds: types.stripDefault(types.array(types.string), [])
```

#### property: featureHighlights

Declarative feature highlights, typically seeded by a text search (highlight the
gene you searched for). Each entry pins a feature by its span+name signature
rather than its uniqueId — a search result carries no uniqueId to persist
(unlike solo/hidden/pinned, which come from a click on a rendered feature and so
DO have a reload-stable id) — and is resolved against rendered features on the
main thread. stripDefault so a display with no highlights omits it from
snapshot.

```ts
// type signature
type featureHighlights = IOptionalIType<IArrayType<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; name: IMaybe<ISimpleType<string>>; }, {}, _NotCustomized, _NotCustomized>>, [...]>
// code
featureHighlights: types.stripDefault(
            types.array(FeatureHighlightModel),
            [],
          )
```

</details>

<details>
<summary>LinearCanvasBaseDisplay - Properties (other undocumented members)</summary>

#### property: refName

```ts
// type signature
type refName = ISimpleType<string>
// code
refName: types.string
```

#### property: start

```ts
// type signature
type start = ISimpleType<number>
// code
start: types.number
```

#### property: end

```ts
// type signature
type end = ISimpleType<number>
// code
end: types.number
```

#### property: name

```ts
// type signature
type name = IMaybe<ISimpleType<string>>
// code
name: types.maybe(types.string)
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details>
<summary>LinearCanvasBaseDisplay - Volatiles</summary>

#### volatile: rpcDataMap

```ts
// type signature
type rpcDataMap = ObservableMap<number, LoadedFeatureData>
// code
rpcDataMap: observable.map<number, LoadedFeatureData>()
```

#### volatile: densityStatsPerRegion

```ts
// type signature
type densityStatsPerRegion = ObservableMap<number, RegionDensityStats>
// code
densityStatsPerRegion: observable.map<number, RegionDensityStats>()
```

#### volatile: featureIdUnderMouse

```ts
// type signature
type featureIdUnderMouse = string | null
// code
featureIdUnderMouse: null as string | null
```

#### volatile: subfeatureIdUnderMouse

```ts
// type signature
type subfeatureIdUnderMouse = string | null
// code
subfeatureIdUnderMouse: null as string | null
```

#### volatile: hoveredRegionIndex

```ts
// type signature
type hoveredRegionIndex = number | undefined
// code
hoveredRegionIndex: undefined as number | undefined
```

#### volatile: mouseoverExtraInformation

```ts
// type signature
type mouseoverExtraInformation = string | undefined
// code
mouseoverExtraInformation: undefined as string | undefined
```

#### volatile: contextMenuInfo

```ts
// type signature
type contextMenuInfo =
  | {
      item: FlatbushItem
      displayedRegionIndex: number
      clientX: number
      clientY: number
    }
  | undefined
// code
contextMenuInfo: undefined as
  | {
      item: FlatbushItem
      displayedRegionIndex: number
      clientX: number
      clientY: number
    }
  | undefined
```

#### volatile: userFeatureDensityLimit

```ts
// type signature
type userFeatureDensityLimit = number | undefined
// code
userFeatureDensityLimit: undefined as number | undefined
```

#### volatile: byteEstimateVisibleBp

```ts
// type signature
type byteEstimateVisibleBp = number | undefined
// code
byteEstimateVisibleBp: undefined as number | undefined
```

#### volatile: incrementalLayout

```ts
// type signature
type incrementalLayout = (
  rpcDataMap: ReadonlyMap<number, FeatureDataResult>,
  inputs: LayoutInputs,
) => Map<number, FeatureDataResult>
// code
incrementalLayout: createIncrementalLayout()
```

#### volatile: incrementalLayoutLabelsOnly

```ts
// type signature
type incrementalLayoutLabelsOnly = (
  rpcDataMap: ReadonlyMap<number, FeatureDataResult>,
  inputs: LayoutInputs,
) => Map<number, FeatureDataResult>
// code
incrementalLayoutLabelsOnly: createIncrementalLayout()
```

#### volatile: incrementalLayoutBodiesOnly

```ts
// type signature
type incrementalLayoutBodiesOnly = (
  rpcDataMap: ReadonlyMap<number, FeatureDataResult>,
  inputs: LayoutInputs,
) => Map<number, FeatureDataResult>
// code
incrementalLayoutBodiesOnly: createIncrementalLayout()
```

#### volatile: morphFromTops

```ts
// type signature
type morphFromTops = Map<string, number> | undefined
// code
morphFromTops: undefined as Map<string, number> | undefined
```

#### volatile: morphProgress

```ts
// type signature
type morphProgress = number
// code
morphProgress: 1
```

#### volatile: morphStartMs

```ts
// type signature
type morphStartMs = number
// code
morphStartMs: 0
```

#### volatile: morphFromMaxY

```ts
// type signature
type morphFromMaxY = number
// code
morphFromMaxY: 0
```

</details>

<details>
<summary>LinearCanvasBaseDisplay - Getters</summary>

#### getter: conf

the config typed off the concrete schema; `ConfigurationReference` erases
`self.configuration` to `any`, so direct reads route through this to stay typed
(same move as `BaseAdapter<CONF>`).

```ts
type conf = ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: estimatedVisibleBytes

The cached byte estimate scaled from the span it was measured over
(`byteEstimateVisibleBp`) to the currently visible span. The estimate is roughly
proportional to span, so scaling makes it a pure function of the current view —
mirroring densityTooLarge. Crucially it self-releases on zoom-in: without
scaling, a large zoomed-out estimate stays above the limit forever and gates
refetch (FetchVisibleRegions won't re-estimate while regionTooLarge holds) — a
permanently stuck banner.

```ts
type estimatedVisibleBytes = number | undefined
```

#### getter: layoutInputs

Layout inputs shared by the base layout and every fit-escalation layout, minus
the per-config label/description reservation flags. One source so the candidate
layouts can't drift on bpPerPx / region keys / display mode / pins.

```ts
type layoutInputs = {
  bpPerPx: number
  regionKeys: Map<number, string>
  reversedRegions: Set<number>
  displayMode: DisplayMode
  pinnedFeatureIds: ReadonlySet<string>
}
```

#### getter: baseLaidOutDataMap

Full reservation (names + descriptions): rendered at fit stage `full` and in
non-fit modes, and the first stack `fitStage` probes.

```ts
type baseLaidOutDataMap = Map<number, FeatureDataResult>
```

#### getter: fitLabelsOnlyLayout

Names reserved, descriptions dropped — the `labels` stage's stack.

```ts
type fitLabelsOnlyLayout = Map<number, FeatureDataResult>
```

#### getter: fitBodiesOnlyLayout

Nothing reserved: bodies packed edge-to-edge (the tightest stack), labels hidden
— the `bodies` stage's stack.

```ts
type fitBodiesOnlyLayout = Map<number, FeatureDataResult>
```

#### getter: fitMinScale

Floor on the fit squeeze: the smallest vertical scale that still leaves a
feature body at least `MIN_FIT_BOX_PX` tall. The unscaled body height is the
configured `featureHeight` times the display-mode multiplier (what the layout
already applied). When bodies would pack tighter than this the squeeze stops
here and the surplus scrolls instead of vanishing.

```ts
type fitMinScale = number
```

#### getter: fitStage

The resolved fit outcome — which reservation `level` survived, its unscaled
`layout`, and the vertical `scale` to fill the track — bundled so the three can
never disagree. The ladder keeps the least reduction whose _unscaled_ stack fits
the track height: `full` (names + descriptions), else `labels` (drop
descriptions), else `bodies` (drop names too, pack tight). Only `bodies` can
still overflow, and only it scales; `full`/`labels` fit by construction. Non-fit
modes stay at `full`, scale 1. Read off the unscaled candidate heights so it
can't feed back on its own `scale`. The bodies squeeze is floored at
`fitMinScale` (keeping boxes visible); a stack too dense to fit even there
overflows and scrolls.

```ts
type fitStage = {
  level: 'labels' | 'full' | 'bodies'
  layout: Map<number, FeatureDataResult>
  scale: number
}
```

#### getter: fitScale

Uniform vertical shrink for fit mode; 1 unless the bodies stack is being
squeezed to fill the track.

```ts
type fitScale = number
```

#### getter: laidOutDataMap

What every consumer (hit test, GPU upload, React render) reads: the resolved fit
layout, cloned and scaled only while squeezing bodies. Returned by reference off
the un-squeezed path so the incremental-layout upload diff and Y-morph idle
check stay intact.

```ts
type laidOutDataMap = Map<number, FeatureDataResult>
```

#### getter: renderedShowDescriptions

Descriptions are painted only at the `full` stage (and whenever fit is off).
Every render-time consumer — label draw and the highlight/hit/SVG label-width
reservation — reads this so a box never reserves width for a description it
won't draw.

```ts
type renderedShowDescriptions = any
```

#### getter: renderedShowLabels

Names are painted at the `full`/`labels` stages (and whenever fit is off), where
the packer reserved their row height and overhang so they never overlap. At the
`bodies` stage nothing is reserved, so names are hidden rather than drawn on top
of the boxes. Every render-time consumer reads this so hidden names reserve
nothing.

```ts
type renderedShowLabels = boolean
```

</details>

<details>
<summary>LinearCanvasBaseDisplay - Getters (other undocumented members)</summary>

#### getter: visibleFeatureDensityPerPx

```ts
type visibleFeatureDensityPerPx = number
```

#### getter: renderState

```ts
type renderState = {
  scrollY: number
  canvasWidth: number
  canvasHeight: number
}
```

#### getter: DisplayMessageComponent

```ts
type DisplayMessageComponent = LazyExoticComponent<
  ({ model }: Props) => Element
>
```

#### getter: maxHeight

```ts
type maxHeight = any
```

#### getter: autoHeight

```ts
type autoHeight = boolean
```

#### getter: displayMode

```ts
type displayMode = DisplayMode
```

#### getter: heightMode

```ts
type heightMode = HeightMode
```

#### getter: fitHeightToDisplay

```ts
type fitHeightToDisplay = boolean
```

#### getter: labelFontSize

```ts
type labelFontSize = number
```

#### getter: showLabelsMode

```ts
type showLabelsMode = any
```

#### getter: showLabels

```ts
type showLabels = boolean
```

#### getter: showDescriptions

```ts
type showDescriptions = any
```

#### getter: showOutline

```ts
type showOutline = boolean
```

#### getter: featureColor

```ts
type featureColor = any
```

#### getter: utrColor

```ts
type utrColor = any
```

#### getter: colorByMode

```ts
type colorByMode = 'strand' | 'attribute' | 'solid'
```

#### getter: colorByAttribute

```ts
type colorByAttribute = string
```

#### getter: effectiveShowDescriptions

```ts
type effectiveShowDescriptions = any
```

#### getter: selectedFeatureId

```ts
type selectedFeatureId = string | undefined
```

#### getter: maxFeatureDensity

```ts
type maxFeatureDensity = any
```

#### getter: colorByCDS

```ts
type colorByCDS = boolean
```

#### getter: sequenceAdapter

```ts
type sequenceAdapter = any
```

#### getter: regionKeys

```ts
type regionKeys = Map<number, string>
```

#### getter: reversedRegions

```ts
type reversedRegions = Set<number>
```

#### getter: pinnedFeatureIdSet

```ts
type pinnedFeatureIdSet = ReadonlySet<string>
```

#### getter: resolvedHighlights

```ts
type resolvedHighlights = { box: ReadonlySet<string>; pin: ReadonlySet<string> }
```

#### getter: highlightedFeatureIdSet

```ts
type highlightedFeatureIdSet = ReadonlySet<string>
```

#### getter: layoutPinnedFeatureIdSet

```ts
type layoutPinnedFeatureIdSet = ReadonlySet<string>
```

#### getter: soloFeatureIdSet

```ts
type soloFeatureIdSet = ReadonlySet<string>
```

#### getter: featureWidgetType

```ts
type featureWidgetType = { type: string; id: string }
```

#### getter: densityTooLarge

```ts
type densityTooLarge = boolean
```

#### getter: tooLargeStatus

```ts
type tooLargeStatus = RegionTooLargeStatus
```

#### getter: regionTooLarge

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

```ts
type regionTooLargeReason = string
```

#### getter: renderDataMap

```ts
type renderDataMap = Map<number, FeatureDataResult>
```

#### getter: maxY

```ts
type maxY = number
```

#### getter: hasOverflow

```ts
type hasOverflow = boolean
```

#### getter: contentHeight

```ts
type contentHeight = number
```

#### getter: scrollableHeight

```ts
type scrollableHeight = number
```

#### getter: fitHeight

```ts
type fitHeight = number
```

#### getter: grownHeight

```ts
type grownHeight = number
```

#### getter: featureIdIndex

```ts
type featureIdIndex = Map<string, FlatbushItem>
```

#### getter: subfeatureIdIndex

```ts
type subfeatureIdIndex = Map<string, SubfeatureInfo>
```

#### getter: hoveredFeature

```ts
type hoveredFeature = FlatbushItem | null
```

#### getter: hoveredSubfeature

```ts
type hoveredSubfeature = SubfeatureInfo | null
```

#### getter: featureItemMap

```ts
type featureItemMap = Map<string, FeatureItemEntry>
```

#### getter: highlightedFeatureIds

```ts
type highlightedFeatureIds = string[]
```

#### getter: flatbushIndexes

```ts
type flatbushIndexes = Map<number, FlatbushRegionIndexes>
```

</details>

<details>
<summary>LinearCanvasBaseDisplay - Methods</summary>

#### method: activeFilters

The filters actually applied, as `jexl:`-prefixed expressions. The runtime
override shadows the config slot when set; otherwise the deferred-evaluation
`jexlFilters` config slot is prefixed on read. This is the single source of
truth for both the worker (via rpcProps) and the "Filter by..." dialog (so
existing config filters show up and are editable).

```ts
type activeFilters = () => string[]
```

#### method: fitLayoutAt

One fit-escalation candidate: the stack packed with the given label/description
reservation, via that config's own memo instance so each keeps stable references
across renders. Empty until initialized/in-bounds, so the GPU upload autorun has
nothing to push.

```ts
type fitLayoutAt = (memo: (rpcDataMap: ReadonlyMap<number, FeatureDataResult>, inputs: LayoutInputs) => Map<number, FeatureDataResult>, showLabels: boolean, showDescriptions: boolean) => Map<...>
```

#### method: colorBySubMenuItems

The "Color by..." radio choices (solid/strand/attribute). Split out so
subclasses can reuse them while assembling their own color menu.

```ts
type colorBySubMenuItems = () => {
  label: string
  type: 'radio'
  checked: boolean
  onClick: () => void
}[]
```

#### method: colorMenuItems

Color-related track menu entries: a single "Color by..." entry whose "Solid
color..." choice opens the solid+UTR color picker. Subclasses (e.g. variants)
override to drop the gene-oriented UTR picker.

```ts
type colorMenuItems = () => {
  label: string
  icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & { muiName: string }
  subMenu: {
    label: string
    type: 'radio'
    checked: boolean
    onClick: () => void
  }[]
}[]
```

#### method: featureHeightMenuItems

The "Feature height" submenu. The top level is only the three intuitive size
presets (the one thing ~everyone wants). The less-obvious container-sizing
strategy lives under a "Track height" nested entry with effect-describing
labels, so a first-time user never has to parse "fixed/grow/fit". Shared by
every canvas display (genes, variants).

```ts
type featureHeightMenuItems = () => { label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; subMenu: (RadioMenuItem | { ...; } | { ...; })[]; }[]
```

</details>

<details>
<summary>LinearCanvasBaseDisplay - Methods (other undocumented members)</summary>

#### method: observedMaxDensity

```ts
type observedMaxDensity = (bpPerPx: number) => number
```

#### method: rpcProps

```ts
type rpcProps = () => { displayConfig: DisplayConfig; maxFeatureDensity: any; colorByCDS: boolean; soloFeatureIds: (IMSTArray<ISimpleType<string>> & IStateTreeNode<IOptionalIType<...>>) | undefined; hiddenFeatureIds: (IMSTArray<...> & IStateTreeNode<...>) | undefined; theme: SerializableThemeArgs | undefined; }
```

#### method: getFeatureById

```ts
type getFeatureById = (featureId: string) => FlatbushItem | undefined
```

#### method: searchFeatureByID

```ts
type searchFeatureByID = (
  id: string,
) => readonly [number, number, number, number] | undefined
```

#### method: renderSvg

```ts
type renderSvg = (opts?: ExportSvgDisplayOptions | undefined) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<...> | AwaitedReactNode>
```

#### method: showSubmenuMenuItems

```ts
type showSubmenuMenuItems = () => (
  | {
      label: string
      subMenu: {
        label: string
        type: 'radio'
        checked: boolean
        onClick: () => void
      }[]
    }
  | { label: string; type: 'checkbox'; checked: any; onClick: () => void }
)[]
```

#### method: contextMenuItems

```ts
type contextMenuItems = () => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; subMenu?: undefined; } | { ...; } | { ...; })[]
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => MenuItem[]
```

</details>

<details>
<summary>LinearCanvasBaseDisplay - Actions</summary>

#### action: selectFeature

Open the feature-details widget. The adapter's header metadata (VCF INFO/FORMAT
descriptions, etc.) is fetched first and passed as `descriptions` so the widget
can label attribute rows and — for the variant widget — resolve the ANN/CSQ
column names; without it that table renders headerless. CoreGetMetadata returns
null for adapters that expose none, so this is a no-op for those tracks.

```ts
type selectFeature = (feature: Feature) => void
```

#### action: setJexlFilters

Sets the runtime filter override (already-`jexl:`-prefixed expressions). Pass
undefined to clear it and fall back to the config `jexlFilters` slot.

```ts
type setJexlFilters = (filters?: string[] | undefined) => void
```

#### action: setFeatureDensityStats

Records the span the byte estimate was measured at so `estimatedVisibleBytes`
can scale it to the current view (see `byteEstimateVisibleBp`).

```ts
type setFeatureDensityStats = (stats?: FeatureDensityStats | undefined) => void
```

#### action: resizeHeight

A manual drag-resize means the user wants a fixed height; leave grow mode first,
otherwise the CanvasAutoHeight autorun snaps the height back on the next layout
change and the drag appears to do nothing.

```ts
type resizeHeight = (distance: number) => number
```

</details>

<details>
<summary>LinearCanvasBaseDisplay - Actions (other undocumented members)</summary>

#### action: beginYMorph

```ts
type beginYMorph = (fromTops: Map<string, number>, fromMaxY: number) => void
```

#### action: setMorphProgress

```ts
type setMorphProgress = (t: number) => void
```

#### action: endYMorph

```ts
type endYMorph = () => void
```

#### action: setRpcData

```ts
type setRpcData = (
  displayedRegionIndex: number,
  data: FeatureDataResult,
  loadedBpPerPx: number,
  region: Region,
) => void
```

#### action: setDensityStats

```ts
type setDensityStats = (
  displayedRegionIndex: number,
  stats: RegionDensityStats,
) => void
```

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

#### action: pruneRpcDataMapToVisible

```ts
type pruneRpcDataMapToVisible = (
  visibleDisplayedRegionIndices: Set<number>,
) => void
```

#### action: startRenderingBackend

```ts
type startRenderingBackend = (backend: CanvasFeatureRenderingBackend) => void
```

#### action: setFeatureDensityStatsLimit

```ts
type setFeatureDensityStatsLimit = (
  stats?:
    | { bytes?: number | undefined; fetchSizeLimit?: number | undefined }
    | undefined,
) => void
```

#### action: setHover

```ts
type setHover = (
  featureId: string | null,
  subfeatureId: string | null,
  tooltip: string | undefined,
  displayedRegionIndex: number,
) => void
```

#### action: clearHover

```ts
type clearHover = () => void
```

#### action: closeContextMenu

```ts
type closeContextMenu = () => void
```

#### action: togglePinnedFeature

```ts
type togglePinnedFeature = (featureId: string) => void
```

#### action: toggleSoloFeature

```ts
type toggleSoloFeature = (featureId: string) => void
```

#### action: clearSolo

```ts
type clearSolo = () => void
```

#### action: hideFeature

```ts
type hideFeature = (featureId: string) => void
```

#### action: showAllHidden

```ts
type showAllHidden = () => void
```

#### action: setFeatureHighlights

```ts
type setFeatureHighlights = (highlights: FeatureHighlight[]) => void
```

#### action: addFeatureHighlightForItem

```ts
type addFeatureHighlightForItem = (
  item: Pick<FlatbushItem, 'name' | 'startBp' | 'endBp'>,
  refName: string,
) => void
```

#### action: removeFeatureHighlightsForItem

```ts
type removeFeatureHighlightsForItem = (
  item: Pick<FlatbushItem, 'name' | 'startBp' | 'endBp'>,
  refName: string,
) => void
```

#### action: clearFeatureHighlights

```ts
type clearFeatureHighlights = () => void
```

#### action: applySolo

```ts
type applySolo = () => void
```

#### action: soloFeature

```ts
type soloFeature = (featureId: string) => void
```

#### action: clearAllFeatureFilters

```ts
type clearAllFeatureFilters = () => void
```

#### action: clearSelection

```ts
type clearSelection = () => void
```

#### action: setShowLabels

```ts
type setShowLabels = (value: 'auto' | 'off' | 'on') => void
```

#### action: setShowDescriptions

```ts
type setShowDescriptions = (value: boolean) => void
```

#### action: setShowOutline

```ts
type setShowOutline = (value: boolean) => void
```

#### action: setFeatureColor

```ts
type setFeatureColor = (color?: string | undefined) => void
```

#### action: setUtrColor

```ts
type setUtrColor = (color?: string | undefined) => void
```

#### action: openContextMenu

```ts
type openContextMenu = (
  featureInfo: FlatbushItem,
  displayedRegionIndex: number,
  clientX: number,
  clientY: number,
) => void
```

#### action: setDisplayMode

```ts
type setDisplayMode = (value: DisplayMode) => void
```

#### action: setHeightMode

```ts
type setHeightMode = (mode: HeightMode) => void
```

#### action: openSetColorDialog

```ts
type openSetColorDialog = (showUtrColor?: any) => void
```

#### action: openColorByAttributeDialog

```ts
type openColorByAttributeDialog = () => void
```

#### action: openFilterDialog

```ts
type openFilterDialog = () => void
```

#### action: fetchFullFeature

```ts
type fetchFullFeature = (
  featureId: string,
  displayedRegionIndex: number,
) => Promise<SimpleFeature | undefined>
```

#### action: isCacheValid

```ts
type isCacheValid = (displayedRegionIndex: number) => boolean
```

#### action: byteSizeLimit

```ts
type byteSizeLimit = () => number | undefined
```

#### action: selectFeatureById

```ts
type selectFeatureById = (
  featureId: string,
  subfeatureInfo: SubfeatureInfo | undefined,
  displayedRegionIndex: number,
) => void
```

#### action: reload

```ts
type reload = () => Promise<void>
```

#### action: fetchNeeded

```ts
type fetchNeeded = (
  needed: { region: Region; displayedRegionIndex: number }[],
) => void
```

#### action: clearStaleDensityState

```ts
type clearStaleDensityState = () => void
```

#### action: afterAttach

```ts
type afterAttach = () => void
```

</details>
