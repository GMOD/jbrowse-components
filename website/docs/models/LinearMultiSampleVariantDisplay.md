---
id: linearmultisamplevariantdisplay
title: LinearMultiSampleVariantDisplay
sidebar_label: Display -> LinearMultiSampleVariantDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`variants` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantDisplay/model.ts).

## Overview

Multi-sample variant display drawing one genotype row per sample, with a
per-cell feature widget on click.

## Members

| Member                                                                   | Kind       | Defined by                                                    | Description                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                                   | Properties | LinearMultiSampleVariantDisplay                               |                                                                                                                                                                                                                                                                   |
| [visibleRegions](#getter-visibleregions)                                 | Getters    | LinearMultiSampleVariantDisplay                               |                                                                                                                                                                                                                                                                   |
| [renderState](#getter-renderstate)                                       | Getters    | LinearMultiSampleVariantDisplay                               |                                                                                                                                                                                                                                                                   |
| [prefersOffset](#getter-prefersoffset)                                   | Getters    | LinearMultiSampleVariantDisplay                               |                                                                                                                                                                                                                                                                   |
| [perRegionCellMap](#getter-perregioncellmap)                             | Getters    | LinearMultiSampleVariantDisplay                               |                                                                                                                                                                                                                                                                   |
| [flatbushIndices](#getter-flatbushindices)                               | Getters    | LinearMultiSampleVariantDisplay                               |                                                                                                                                                                                                                                                                   |
| [showSubmenuItems](#method-showsubmenuitems)                             | Methods    | LinearMultiSampleVariantDisplay                               |                                                                                                                                                                                                                                                                   |
| [renderSvg](#method-rendersvg)                                           | Methods    | LinearMultiSampleVariantDisplay                               |                                                                                                                                                                                                                                                                   |
| [startRenderingBackend](#action-startrenderingbackend)                   | Actions    | LinearMultiSampleVariantDisplay                               |                                                                                                                                                                                                                                                                   |
| [configuration](#property-configuration)                                 | Properties | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [rowHeight](#property-rowheight)                                         | Properties | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [jexlFilters](#property-jexlfilters)                                     | Properties | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [lineZoneHeight](#property-linezoneheight)                               | Properties | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [runClustering](#property-runclustering)                                 | Properties | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [showLegend](#volatile-showlegend)                                       | Volatiles  | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [dismissedLegendSections](#volatile-dismissedlegendsections)             | Volatiles  | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Ids of legend sections the user has individually closed (e.g. 'genotypes' / 'group'); reset when the whole legend is re-shown.                                                                                                                                    |
| [contextMenuFeature](#volatile-contextmenufeature)                       | Volatiles  | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [sourcesVolatile](#volatile-sourcesvolatile)                             | Volatiles  | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [hoveredGenotype](#volatile-hoveredgenotype)                             | Volatiles  | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [cellData](#volatile-celldata)                                           | Volatiles  | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Single source of truth for fetched per-display data.                                                                                                                                                                                                              |
| [loadedBpPerPx](#volatile-loadedbpperpx)                                 | Volatiles  | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [reloadCount](#volatile-reloadcount)                                     | Volatiles  | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [pendingClusterTree](#volatile-pendingclustertree)                       | Volatiles  | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [featuresVolatile](#getter-featuresvolatile)                             | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | SimpleFeature instances derived from the simplifiedFeatures list in the most recent cellData payload.                                                                                                                                                             |
| [hasPhased](#getter-hasphased)                                           | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [hasSecondaryAlt](#getter-hassecondaryalt)                               | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Whether any visible site is multiallelic (drives the "Other alt allele" legend entry).                                                                                                                                                                            |
| [hasUnphased](#getter-hasunphased)                                       | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Whether any genotype call is unphased (drives the "Unphased" legend entry in phased mode).                                                                                                                                                                        |
| [hasNoCall](#getter-hasnocall)                                           | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Whether any genotype is a no-call (drives the "No call" legend entry in phased mode; allele-count mode always shows it).                                                                                                                                          |
| [hasConsequence](#getter-hasconsequence)                                 | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Whether any visible variant carries a SnpEff/VEP annotation, gating the "Color by...→Consequence impact" menu option.                                                                                                                                             |
| [hasSvType](#getter-hassvtype)                                           | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Whether any visible variant is a structural variant, gating the "Color by...→SV type" menu option.                                                                                                                                                                |
| [svTypeColors](#getter-svtypecolors)                                     | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | The color assigned to each present SV type, built in the worker so the legend swatches match the painted cells (drives the "SV type" legend section).                                                                                                             |
| [sampleInfo](#getter-sampleinfo)                                         | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [renderingMode](#getter-renderingmode)                                   | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Returns the rendering mode config slot value                                                                                                                                                                                                                      |
| [colorBy](#getter-colorby)                                               | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | The effective sample-grouping attribute (config default or runtime override).                                                                                                                                                                                     |
| [groupBy](#getter-groupby)                                               | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Sample-metadata attribute the rows are grouped (reordered) by; '' leaves the existing order alone.                                                                                                                                                                |
| [featureColor](#getter-featurecolor)                                     | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Optional per-variant cell color (jexl string or CSS color) applied to alt-carrying cells; '' means default genotype coloring.                                                                                                                                     |
| [featureWidgetType](#getter-featurewidgettype)                           | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [minorAlleleFrequencyFilter](#getter-minorallelefrequencyfilter)         | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Returns the minor allele frequency filter config slot value                                                                                                                                                                                                       |
| [maxMissingnessFilter](#getter-maxmissingnessfilter)                     | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Max fraction of no-call genotypes a variant may have before it's hidden; 1 keeps every variant                                                                                                                                                                    |
| [filters](#getter-filters)                                               | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | The jexl filter expressions (from the Edit filters dialog) as a SerializableFilterChain, ready to pass as the RPC `filters` arg.                                                                                                                                  |
| [showSidebarLabels](#getter-showsidebarlabels)                           | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [showTree](#getter-showtree)                                             | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [showBranchLength](#getter-showbranchlength)                             | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [referenceDrawingMode](#getter-referencedrawingmode)                     | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [colorByAttributes](#getter-colorbyattributes)                           | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Distinct sample-metadata attributes (from samplesTsv) the user can color rows by — every key the sources carry except internal plumbing.                                                                                                                          |
| [sourcesWithoutLayout](#getter-sourceswithoutlayout)                     | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [sourcesBase](#getter-sourcesbase)                                       | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [sources](#getter-sources)                                               | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | sourcesBase expanded for phased rendering when sampleInfo is available.                                                                                                                                                                                           |
| [editableSources](#getter-editablesources)                               | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Layout-merged, phased-expanded view for the Edit Color/Arrangement dialog.                                                                                                                                                                                        |
| [clusteringReady](#getter-clusteringready)                               | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Whether the fetched inputs clustering needs are present yet.                                                                                                                                                                                                      |
| [sourceMap](#getter-sourcemap)                                           | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [genotypeSampleIndex](#getter-genotypesampleindex)                       | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | sampleName -> column index into each feature's interned `genotypeCodes`.                                                                                                                                                                                          |
| [availableHeight](#getter-availableheight)                               | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Available height for rows (total height minus lineZoneHeight).                                                                                                                                                                                                    |
| [nrow](#getter-nrow)                                                     | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [autoRowHeight](#getter-autorowheight)                                   | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [effectiveRowHeight](#getter-effectiverowheight)                         | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Resolved per-row height.                                                                                                                                                                                                                                          |
| [hierarchy](#getter-hierarchy)                                           | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [spatialIndex](#getter-spatialindex)                                     | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [hoveredTooltipSource](#getter-hoveredtooltipsource)                     | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [canDisplayLabels](#getter-candisplaylabels)                             | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [totalHeight](#getter-totalheight)                                       | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [hasOverflow](#getter-hasoverflow)                                       | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Whether the rows are taller than the viewport, i.e. the display scrolls.                                                                                                                                                                                          |
| [scrollableHeight](#getter-scrollableheight)                             | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Max valid `scrollTop`: how far the rows can scroll before the bottom row reaches the viewport floor.                                                                                                                                                              |
| [featuresReady](#getter-featuresready)                                   | Getters    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [rpcProps](#method-rpcprops)                                             | Methods    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [trackMenuItems](#method-trackmenuitems)                                 | Methods    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [contextMenuItems](#method-contextmenuitems)                             | Methods    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [getPortableSettings](#method-getportablesettings)                       | Methods    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Called by BaseTrackModel.replaceDisplay when switching between the regular and matrix variant displays.                                                                                                                                                           |
| [legendSections](#method-legendsections)                                 | Methods    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Legend split into independently-closable sections: the genotype/cell coloring and (when colorBy is set) the sample-grouping coloring shown on the sidebar row labels.                                                                                             |
| [setCellData](#action-setcelldata)                                       | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setContextMenuFeature](#action-setcontextmenufeature)                   | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setLoadedBpPerPx](#action-setloadedbpperpx)                             | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [fetchMetadataDescriptions](#action-fetchmetadatadescriptions)           | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setJexlFilters](#action-setjexlfilters)                                 | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setShowLegend](#action-setshowlegend)                                   | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [dismissLegendSection](#action-dismisslegendsection)                     | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Close a single legend section (leaving the others visible).                                                                                                                                                                                                       |
| [selectFeature](#action-selectfeature)                                   | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setRowHeight](#action-setrowheight)                                     | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setHoveredGenotype](#action-sethoveredgenotype)                         | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setSources](#action-setsources)                                         | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setColorBy](#action-setcolorby)                                         | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Recolor sample rows by a metadata attribute (e.g. 'population'), or pass '' to clear the coloring.                                                                                                                                                                |
| [setGroupBy](#action-setgroupby)                                         | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Reorder sample rows so each value of a metadata attribute (e.g. 'population') is contiguous, or pass '' to clear the grouping.                                                                                                                                    |
| [clearLayout](#action-clearlayout)                                       | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Restore the configured default arrangement — empties the layout and clears the cluster tree, then re-applies the `colorBy` palette if one is configured.                                                                                                          |
| [setMafFilter](#action-setmaffilter)                                     | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setMaxMissingnessFilter](#action-setmaxmissingnessfilter)               | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setShowSidebarLabels](#action-setshowsidebarlabels)                     | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setShowTree](#action-setshowtree)                                       | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setShowBranchLength](#action-setshowbranchlength)                       | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setLayoutAndPendingClusterTree](#action-setlayoutandpendingclustertree) | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setRunClustering](#action-setrunclustering)                             | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setPhasedMode](#action-setphasedmode)                                   | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setFitToHeight](#action-setfittoheight)                                 | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Enable fit-to-display-height mode: `rowHeight = 0` makes `effectiveRowHeight` divide `availableHeight` across the rows.                                                                                                                                           |
| [resizeHeight](#action-resizeheight)                                     | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Override resizeHeight to scale a pinned row height proportionally when the display is vertically resized.                                                                                                                                                         |
| [setReferenceDrawingMode](#action-setreferencedrawingmode)               | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setFeatureColor](#action-setfeaturecolor)                               | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) | Set the per-variant cell color override (jexl string or CSS color), or '' to restore default genotype coloring.                                                                                                                                                   |
| [sortByGenotype](#action-sortbygenotype)                                 | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [setScrollTop](#action-setscrolltop)                                     | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)             | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [isCacheValid](#action-iscachevalid)                                     | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [getByteEstimateConfig](#action-getbyteestimateconfig)                   | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [fetchNeeded](#action-fetchneeded)                                       | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [reload](#action-reload)                                                 | Actions    | [MultiSampleVariantBaseModel](../multisamplevariantbasemodel) |                                                                                                                                                                                                                                                                   |
| [id](#property-id)                                                       | Properties | [BaseDisplay](../basedisplay)                                 |                                                                                                                                                                                                                                                                   |
| [rpcDriverName](#property-rpcdrivername)                                 | Properties | [BaseDisplay](../basedisplay)                                 |                                                                                                                                                                                                                                                                   |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)               | Properties | [BaseDisplay](../basedisplay)                                 | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL).                                                                                                                               |
| [error](#volatile-error)                                                 | Volatiles  | [BaseDisplay](../basedisplay)                                 |                                                                                                                                                                                                                                                                   |
| [statusMessage](#volatile-statusmessage)                                 | Volatiles  | [BaseDisplay](../basedisplay)                                 |                                                                                                                                                                                                                                                                   |
| [statusProgress](#volatile-statusprogress)                               | Volatiles  | [BaseDisplay](../basedisplay)                                 | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate.                                                                                                                                               |
| [parentTrack](#getter-parenttrack)                                       | Getters    | [BaseDisplay](../basedisplay)                                 |                                                                                                                                                                                                                                                                   |
| [parentDisplay](#getter-parentdisplay)                                   | Getters    | [BaseDisplay](../basedisplay)                                 | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                  |
| [RenderingComponent](#getter-renderingcomponent)                         | Getters    | [BaseDisplay](../basedisplay)                                 |                                                                                                                                                                                                                                                                   |
| [DisplayBlurb](#getter-displayblurb)                                     | Getters    | [BaseDisplay](../basedisplay)                                 |                                                                                                                                                                                                                                                                   |
| [adapterConfig](#getter-adapterconfig)                                   | Getters    | [BaseDisplay](../basedisplay)                                 |                                                                                                                                                                                                                                                                   |
| [isMinimized](#getter-isminimized)                                       | Getters    | [BaseDisplay](../basedisplay)                                 | Returns true if the parent track is minimized.                                                                                                                                                                                                                    |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)                 | Getters    | [BaseDisplay](../basedisplay)                                 | Returns the effective RPC driver name with hierarchical fallback: 1.                                                                                                                                                                                              |
| [DisplayMessageComponent](#getter-displaymessagecomponent)               | Getters    | [BaseDisplay](../basedisplay)                                 | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                                        |
| [renderingProps](#method-renderingprops)                                 | Methods    | [BaseDisplay](../basedisplay)                                 | props passed to the renderer's React "Rendering" component.                                                                                                                                                                                                       |
| [regionCannotBeRendered](#method-regioncannotberendered)                 | Methods    | [BaseDisplay](../basedisplay)                                 |                                                                                                                                                                                                                                                                   |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults)           | Actions    | [BaseDisplay](../basedisplay)                                 | see the `ignorePromotedDefaults` property                                                                                                                                                                                                                         |
| [setStatusMessage](#action-setstatusmessage)                             | Actions    | [BaseDisplay](../basedisplay)                                 |                                                                                                                                                                                                                                                                   |
| [setError](#action-seterror)                                             | Actions    | [BaseDisplay](../basedisplay)                                 |                                                                                                                                                                                                                                                                   |
| [setRpcDriverName](#action-setrpcdrivername)                             | Actions    | [BaseDisplay](../basedisplay)                                 |                                                                                                                                                                                                                                                                   |
| [scrollTop](#volatile-scrolltop)                                         | Volatiles  | [TrackHeightMixin](../trackheightmixin)                       |                                                                                                                                                                                                                                                                   |
| [height](#getter-height)                                                 | Getters    | [TrackHeightMixin](../trackheightmixin)                       |                                                                                                                                                                                                                                                                   |
| [setHeight](#action-setheight)                                           | Actions    | [TrackHeightMixin](../trackheightmixin)                       |                                                                                                                                                                                                                                                                   |
| [loadedRegions](#volatile-loadedregions)                                 | Volatiles  | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | regions whose data has been fetched and committed, keyed by displayedRegionIndex; populated only after the fetch work callback returns                                                                                                                            |
| [isReady](#getter-isready)                                               | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | true once the canvas has painted and no fetch is in flight                                                                                                                                                                                                        |
| [viewportWithinLoadedData](#getter-viewportwithinloadeddata)             | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | true when every visible block lies within an already-fetched region — i.e. the viewport shows data we actually loaded, not the stale fringe left after a zoom-out/pan.                                                                                            |
| [svgReady](#getter-svgready)                                             | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | true once an off-screen (SVG) export can safely read this display's data: every visible region has loaded, or the fetch reached a terminal error / too-large state.                                                                                               |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data.                                                                                                                |
| [layoutReady](#getter-layoutready)                                       | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | Overridable hook (default false): whether a searchable feature layout currently exists.                                                                                                                                                                           |
| [renderBlocks](#getter-renderblocks)                                     | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | Shared cached view for every LGV-based GPU display.                                                                                                                                                                                                               |
| [displayPhase](#getter-displayphase)                                     | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | The display's mutually-exclusive visual state, precedence single-sourced in `computeDisplayPhase`.                                                                                                                                                                |
| [rpcPropsCacheKey](#getter-rpcpropscachekey)                             | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | The RPC cache key: the subclass's `rpcProps()` payload serialized to a string, so this getter's value is a primitive and MobX invalidates its observers only when the payload actually changed.                                                                   |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)     | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | Derived opt-in for the region-too-large gate: a display that declares a pre-flight byte estimate (`getByteEstimateConfig`) gates on it — the two are one decision, so they can't desync (this replaces the old dev-time "config set but gate off" console.error). |
| [setLoadedRegion](#action-setloadedregion)                               | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | Action wrapper so callers after async boundaries stay in MST strict mode.                                                                                                                                                                                         |
| [clearAllRpcData](#action-clearallrpcdata)                               | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | full reset: cancels fetch, clears error, loadedRegions, display-specific data, and the canvas-drawn flag.                                                                                                                                                         |
| [invalidateLoadedRegions](#action-invalidateloadedregions)               | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | lighter reset: cancels fetch and clears loadedRegions, leaving error and regionTooLarge intact                                                                                                                                                                    |
| [onRegionTooLarge](#action-onregiontoolarge)                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | Overridable hook (no-op base): called when `regionTooLarge` transitions to true.                                                                                                                                                                                  |
| [fetchRegions](#action-fetchregions)                                     | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | Run a per-region fetch with byte-estimate gating.                                                                                                                                                                                                                 |
| [afterAttach](#action-afterattach)                                       | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin)         | installs the five fetch-lifecycle autoruns (DisplayedRegionsChange, FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange, ClearHoverOnRegionTooLarge)                                                                                      |
| [userByteLimit](#volatile-userbytelimit)                                 | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)                 | user-confirmed byte limit after a force-load, disabling the gate.                                                                                                                                                                                                 |
| [byteEstimate](#volatile-byteestimate)                                   | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)                 | Last byte estimate reported for this display, with the adapter's own `fetchSizeLimit` and `alwaysRender` flag.                                                                                                                                                    |
| [measuredSpanBp](#volatile-measuredspanbp)                               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)                 | The span the current `byteEstimate` was measured over, so the derived gate can rescale it to the span on screen now.                                                                                                                                              |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)                 | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                                               |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate)   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)                 | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                                              |
| [configForceLoad](#getter-configforceload)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)                 | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                                                 |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan)     | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)                 | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored estimate from the span it was measured over (`measuredSpanBp`).                                                                                   |
| [tooLargeStatus](#getter-toolargestatus)                                 | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)                 | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in.                                                                                      |
| [regionTooLarge](#getter-regiontoolarge)                                 | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)                 | The verdict the whole mixin exists to produce: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips.                                                                            |
| [regionTooLargeReason](#getter-regiontoolargereason)                     | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)                 | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                                          |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)         | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)                 | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                             |
| [setByteEstimate](#action-setbyteestimate)                               | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)                 | Commits the byte estimate and records the span it covers (`measuredSpanBp`) so the derived gate can rescale it to the span on screen.                                                                                                                             |
| [raiseForceLoadLimits](#action-raiseforceloadlimits)                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)                 | force-load: raise the byte limit past the current request so the gate releases.                                                                                                                                                                                   |
| [forceLoad](#action-forceload)                                           | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)                 | Raises the byte limit past the current estimate and triggers a reload.                                                                                                                                                                                            |
| [canvasDrawn](#volatile-canvasdrawn)                                     | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)               | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                |
| [currentRenderingBackend](#volatile-currentrenderingbackend)             | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)               | current backend reference, updated on context-loss recovery.                                                                                                                                                                                                      |
| [renderTick](#volatile-rendertick)                                       | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)               | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                  |
| [autorunsInstalled](#volatile-autorunsinstalled)                         | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)               | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                        |
| [renderError](#volatile-rendererror)                                     | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)               | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                                                                                                                                                       |
| [markCanvasDrawn](#action-markcanvasdrawn)                               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)               |                                                                                                                                                                                                                                                                   |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)               |                                                                                                                                                                                                                                                                   |
| [stopRenderingBackend](#action-stoprenderingbackend)                     | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)               |                                                                                                                                                                                                                                                                   |
| [renderNow](#action-rendernow)                                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)               |                                                                                                                                                                                                                                                                   |
| [setRenderError](#action-setrendererror)                                 | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)               | set/clear the render-backend error.                                                                                                                                                                                                                               |
| [attachRenderingBackend](#action-attachrenderingbackend)                 | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)               | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                       |
| [activeStopToken](#volatile-activestoptoken)                             | Volatiles  | [FetchMixin](../fetchmixin)                                   | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                         |
| [fetchGeneration](#volatile-fetchgeneration)                             | Volatiles  | [FetchMixin](../fetchmixin)                                   | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                  |
| [fetchCanceled](#volatile-fetchcanceled)                                 | Volatiles  | [FetchMixin](../fetchmixin)                                   | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                                        |
| [regionStatuses](#volatile-regionstatuses)                               | Volatiles  | [FetchMixin](../fetchmixin)                                   | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                                                    |
| [lastStatusMs](#volatile-laststatusms)                                   | Volatiles  | [FetchMixin](../fetchmixin)                                   | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                        |
| [isLoading](#getter-isloading)                                           | Getters    | [FetchMixin](../fetchmixin)                                   | true while a fetch is active                                                                                                                                                                                                                                      |
| [makeStatusCallback](#method-makestatuscallback)                         | Methods    | [FetchMixin](../fetchmixin)                                   | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op.                      |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)             | Methods    | [FetchMixin](../fetchmixin)                                   | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                                                  |
| [throttleStatus](#action-throttlestatus)                                 | Actions    | [FetchMixin](../fetchmixin)                                   | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write.                                                                                                                                                                         |
| [resetStatus](#action-resetstatus)                                       | Actions    | [FetchMixin](../fetchmixin)                                   | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                                      |
| [stopActiveFetch](#action-stopactivefetch)                               | Actions    | [FetchMixin](../fetchmixin)                                   | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                                          |
| [setRegionStatus](#action-setregionstatus)                               | Actions    | [FetchMixin](../fetchmixin)                                   | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                                         |
| [cancelFetch](#action-cancelfetch)                                       | Actions    | [FetchMixin](../fetchmixin)                                   | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                                      |
| [cancelFetchByUser](#action-cancelfetchbyuser)                           | Actions    | [FetchMixin](../fetchmixin)                                   | User-initiated cancel from the loading overlay.                                                                                                                                                                                                                   |
| [beforeDestroy](#action-beforedestroy)                                   | Actions    | [FetchMixin](../fetchmixin)                                   | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                                              |
| [runFetch](#action-runfetch)                                             | Actions    | [FetchMixin](../fetchmixin)                                   | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                                      |
| [layout](#property-layout)                                               | Properties | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [clusterTree](#property-clustertree)                                     | Properties | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [treeAreaWidth](#property-treeareawidth)                                 | Properties | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [subtreeFilter](#property-subtreefilter)                                 | Properties | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [hoveredTreeNode](#volatile-hoveredtreenode)                             | Volatiles  | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [treeCanvas](#volatile-treecanvas)                                       | Volatiles  | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [mouseoverCanvas](#volatile-mouseovercanvas)                             | Volatiles  | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [parsedTree](#getter-parsedtree)                                         | Getters    | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [root](#getter-root)                                                     | Getters    | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [treeHasBranchLengths](#getter-treehasbranchlengths)                     | Getters    | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [willClearTree](#method-willcleartree)                                   | Methods    | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [setLayout](#action-setlayout)                                           | Actions    | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [setClusterTree](#action-setclustertree)                                 | Actions    | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [setLayoutAndClusterTree](#action-setlayoutandclustertree)               | Actions    | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [setTreeAreaWidth](#action-settreeareawidth)                             | Actions    | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [setSubtreeFilter](#action-setsubtreefilter)                             | Actions    | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [setHoveredTreeNode](#action-sethoveredtreenode)                         | Actions    | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [setTreeCanvasRef](#action-settreecanvasref)                             | Actions    | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |
| [setMouseoverCanvasRef](#action-setmouseovercanvasref)                   | Actions    | [TreeSidebarMixin](../treesidebarmixin)                       |                                                                                                                                                                                                                                                                   |

### LinearMultiSampleVariantDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearmultisamplevariantdisplay).

<details>
<summary>LinearMultiSampleVariantDisplay - Properties</summary>

| Member                               | Type                                             |
| ------------------------------------ | ------------------------------------------------ |
| <span id="property-type">type</span> | `ISimpleType<"LinearMultiSampleVariantDisplay">` |

</details>

<details>
<summary>LinearMultiSampleVariantDisplay - Getters</summary>

| Member                                                     | Type                                                                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <span id="getter-visibleregions">visibleRegions</span>     | `{ refName: string; start: number; end: number; assemblyName: string; reversed: boolean \| undefined; displayedRegionIndex: number; screenStartPx: number; screenEndPx: number; }[]` |
| <span id="getter-renderstate">renderState</span>           | `{ canvasWidth: number; canvasHeight: number; rowHeight: number; scrollTop: number; } \| undefined`                                                                                  |
| <span id="getter-prefersoffset">prefersOffset</span>       | `boolean`                                                                                                                                                                            |
| <span id="getter-perregioncellmap">perRegionCellMap</span> | `Map<number, VariantUploadData>`                                                                                                                                                     |
| <span id="getter-flatbushindices">flatbushIndices</span>   | `Map<number, Flatbush>`                                                                                                                                                              |

</details>

<details>
<summary>LinearMultiSampleVariantDisplay - Methods</summary>

| Member                                                     | Type                                                                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <span id="method-showsubmenuitems">showSubmenuItems</span> | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| CustomMenuItem \| { ...; })[]`                 |
| <span id="method-rendersvg">renderSvg</span>               | `(opts?: ExportSvgDisplayOptions \| undefined) => Promise<ReactElement<unknown, string \| JSXElementConstructor<any>> \| Iterable<...> \| AwaitedReactNode>` |

</details>

<details>
<summary>LinearMultiSampleVariantDisplay - Actions</summary>

| Member                                                               | Type                                         |
| -------------------------------------------------------------------- | -------------------------------------------- |
| <span id="action-startrenderingbackend">startRenderingBackend</span> | `(backend: VariantRenderingBackend) => void` |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from MultiSampleVariantBaseModel</summary>

[MultiSampleVariantBaseModel →](../multisamplevariantbasemodel)

**Properties**

| Member                                                   | Type                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| <span id="property-configuration">configuration</span>   | `IConfigurationReference<ConfigurationSchemaType<…>>`                  |
| <span id="property-rowheight">rowHeight</span>           | `IOptionalIType<ISimpleType<number>, [undefined]>`                     |
| <span id="property-jexlfilters">jexlFilters</span>       | `IOptionalIType<IMaybe<IArrayType<ISimpleType<string>>>, [undefined]>` |
| <span id="property-linezoneheight">lineZoneHeight</span> | `IOptionalIType<ISimpleType<number>, [undefined]>`                     |
| <span id="property-runclustering">runClustering</span>   | `IMaybe<ISimpleType<boolean>>`                                         |

**Volatiles**

#### volatile: dismissedLegendSections

Ids of legend sections the user has individually closed (e.g. 'genotypes' /
'group'); reset when the whole legend is re-shown.

```ts
// type signature
type dismissedLegendSections = string[]
// code
dismissedLegendSections: [] as string[]
```

#### volatile: cellData

Single source of truth for fetched per-display data. hasPhased, sampleInfo, and
featuresVolatile are derived from this via getters — fetchNeeded only needs to
call setCellData(result).

```ts
// type signature
type cellData = CellDataResult | undefined
// code
cellData: undefined as CellDataResult | undefined
```

| Member                                                           | Type                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| <span id="volatile-showlegend">showLegend</span>                 | `true`                                                                         |
| <span id="volatile-contextmenufeature">contextMenuFeature</span> | `Feature \| undefined`                                                         |
| <span id="volatile-sourcesvolatile">sourcesVolatile</span>       | `Source[] \| undefined`                                                        |
| <span id="volatile-hoveredgenotype">hoveredGenotype</span>       | `(Record<string, unknown> & { genotype: string; name: string; }) \| undefined` |
| <span id="volatile-loadedbpperpx">loadedBpPerPx</span>           | `number \| undefined`                                                          |
| <span id="volatile-reloadcount">reloadCount</span>               | `number`                                                                       |
| <span id="volatile-pendingclustertree">pendingClusterTree</span> | `string \| undefined`                                                          |

**Getters**

#### getter: featuresVolatile

SimpleFeature instances derived from the simplifiedFeatures list in the most
recent cellData payload. Cached by MobX while cellData is unchanged. Named
`featuresVolatile` for backwards-compat with consumers that originally read it
as a volatile field.

These carry ONLY positional fields (id/start/end/refName/name) — not ALT or
genotypes. Don't re-derive feature-level facts from them (`.get('ALT')` etc.
returns undefined); summary facts are computed in the worker and exposed as
scalars (hasPhased/hasSecondaryAlt/ hasUnphased), and per-feature genotype info
lives in the cell-data featureGenotypeMap/featureData.

```ts
type featuresVolatile = Feature[] | undefined
```

#### getter: hasSecondaryAlt

Whether any visible site is multiallelic (drives the "Other alt allele" legend
entry). Computed in the worker since the simplified features sent to the client
don't carry ALT.

```ts
type hasSecondaryAlt = boolean
```

#### getter: hasUnphased

Whether any genotype call is unphased (drives the "Unphased" legend entry in
phased mode).

```ts
type hasUnphased = boolean
```

#### getter: hasNoCall

Whether any genotype is a no-call (drives the "No call" legend entry in phased
mode; allele-count mode always shows it).

```ts
type hasNoCall = boolean
```

#### getter: hasConsequence

Whether any visible variant carries a SnpEff/VEP annotation, gating the "Color
by...→Consequence impact" menu option.

```ts
type hasConsequence = boolean
```

#### getter: hasSvType

Whether any visible variant is a structural variant, gating the "Color by...→SV
type" menu option.

```ts
type hasSvType = boolean
```

#### getter: svTypeColors

The color assigned to each present SV type, built in the worker so the legend
swatches match the painted cells (drives the "SV type" legend section).

```ts
type svTypeColors = Record<string, string> | undefined
```

#### getter: renderingMode

Returns the rendering mode config slot value

```ts
type renderingMode = string
```

#### getter: colorBy

The effective sample-grouping attribute (config default or runtime override).
Drives the sidebar row coloring and the legend's group section; '' means no
grouping.

```ts
type colorBy = string
```

#### getter: groupBy

Sample-metadata attribute the rows are grouped (reordered) by; '' leaves the
existing order alone.

```ts
type groupBy = string
```

#### getter: featureColor

Optional per-variant cell color (jexl string or CSS color) applied to
alt-carrying cells; '' means default genotype coloring. Reads the raw config
value directly (not `getConf`, which evaluates a `jexl:...` string immediately
with no `feature` bound) — this crosses the RPC boundary as-is and is evaluated
once per feature in the worker (see `makeFeatureColor` in
`executeVariantCellData.ts`).

```ts
type featureColor = string
```

#### getter: minorAlleleFrequencyFilter

Returns the minor allele frequency filter config slot value

```ts
type minorAlleleFrequencyFilter = number
```

#### getter: maxMissingnessFilter

Max fraction of no-call genotypes a variant may have before it's hidden; 1 keeps
every variant

```ts
type maxMissingnessFilter = number
```

#### getter: filters

The jexl filter expressions (from the Edit filters dialog) as a
SerializableFilterChain, ready to pass as the RPC `filters` arg.
MultiSampleVariantGet{CellData,GenotypeMatrix,ClusterGenotypeMatrix} all extend
RpcMethodTypeWithFiltersAndRenameRegions, which serializes this to string[] and
rebuilds it in the worker with pluginManager.jexl.

```ts
type filters = SerializableFilterChain | undefined
```

#### getter: colorByAttributes

Distinct sample-metadata attributes (from samplesTsv) the user can color rows by
— every key the sources carry except internal plumbing.

```ts
type colorByAttributes = string[]
```

#### getter: sources

sourcesBase expanded for phased rendering when sampleInfo is available. Sources
already carrying HP (from clustering) pass through unchanged.

```ts
type sources = ProcessedSource[] | undefined
```

#### getter: editableSources

Layout-merged, phased-expanded view for the Edit Color/Arrangement dialog. Does
NOT apply the subtree filter — submitting the dialog persists every row back to
`layout`, so filtered samples must be present or they would be wiped from layout
on submit.

```ts
type editableSources = ProcessedSource[] | undefined
```

#### getter: clusteringReady

Whether the fetched inputs clustering needs are present yet. Phased clustering
clusters haplotypes, which needs per-sample ploidy from `sampleInfo`; that
arrives with `cellData`, later than the header-only `sourcesVolatile`. Gating
the auto-cluster run on this (not just `sourcesVolatile`) stops it racing ahead
and building a sample-level tree whose leaves ("HG001") never match the expanded
haplotype rows ("HG001 HP0").

```ts
type clusteringReady = boolean
```

#### getter: genotypeSampleIndex

sampleName -> column index into each feature's interned `genotypeCodes`. Rebuilt
only when cellData changes. Used by the tooltips to decode a hovered cell's
genotype (see genotypeCodec.ts).

```ts
type genotypeSampleIndex = Map<string, number> | undefined
```

#### getter: availableHeight

Available height for rows (total height minus lineZoneHeight). Floored at 0:
`lineZoneHeight` (matrix only, user-draggable up to 1000 independently of
`height`) can exceed a shrunk display height. Every consumer treats this as a
real pixel dimension (canvas height, CSS `height`, scroll viewport height), so
it must never go negative.

```ts
type availableHeight = number
```

#### getter: effectiveRowHeight

Resolved per-row height. `rowHeight === 0` means auto-fit (computed from
availableHeight / nrow); any positive value is a user-pinned height.
`resizeHeight` scales pinned values proportionally so manual + display-resize
stay in sync without snap-back fuzziness. Every consumer reads this, never the
raw `rowHeight` property.

Floored at 1px only when non-positive: `availableHeight` floors at 0 (see
above), so `autoRowHeight` can still be exactly 0 when `lineZoneHeight` swallows
the whole display — dividing by it elsewhere (`/ effectiveRowHeight` in
applyRowResizeWheel, the renderers) would propagate NaN/Infinity. A resolved
getter must never hand back a degenerate value. The floor must not catch
legitimate sub-1px auto-fit heights (many-sample tracks squeezed into a short
display) — that's the normal case `hasOverflow` relies on staying false for.

```ts
type effectiveRowHeight = number
```

#### getter: hasOverflow

Whether the rows are taller than the viewport, i.e. the display scrolls. Drives
native-scroll gating in displays that scroll their rows in a native overflow
container (the plain display); auto-fit mode keeps this false since `rowHeight`
derives from `availableHeight`.

```ts
type hasOverflow = boolean
```

#### getter: scrollableHeight

Max valid `scrollTop`: how far the rows can scroll before the bottom row reaches
the viewport floor. Zero when the rows fit.

```ts
type scrollableHeight = number
```

| Member                                                             | Type                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| <span id="getter-hasphased">hasPhased</span>                       | `boolean`                                                          |
| <span id="getter-sampleinfo">sampleInfo</span>                     | `Record<string, SampleInfo> \| undefined`                          |
| <span id="getter-featurewidgettype">featureWidgetType</span>       | `{ type: string; id: string; }`                                    |
| <span id="getter-showsidebarlabels">showSidebarLabels</span>       | `boolean`                                                          |
| <span id="getter-showtree">showTree</span>                         | `boolean`                                                          |
| <span id="getter-showbranchlength">showBranchLength</span>         | `boolean`                                                          |
| <span id="getter-referencedrawingmode">referenceDrawingMode</span> | `string`                                                           |
| <span id="getter-sourceswithoutlayout">sourcesWithoutLayout</span> | `ProcessedSource[] \| undefined`                                   |
| <span id="getter-sourcesbase">sourcesBase</span>                   | `ProcessedSource[] \| undefined`                                   |
| <span id="getter-sourcemap">sourceMap</span>                       | `{ [k: string]: Source; } \| undefined`                            |
| <span id="getter-nrow">nrow</span>                                 | `number`                                                           |
| <span id="getter-autorowheight">autoRowHeight</span>               | `number`                                                           |
| <span id="getter-hierarchy">hierarchy</span>                       | `ClusterHierarchyNode \| undefined`                                |
| <span id="getter-spatialindex">spatialIndex</span>                 | `{ index: Flatbush; nodes: ClusterHierarchyNode[]; } \| undefined` |
| <span id="getter-hoveredtooltipsource">hoveredTooltipSource</span> | `{…} \| undefined`                                                 |
| <span id="getter-candisplaylabels">canDisplayLabels</span>         | `boolean`                                                          |
| <span id="getter-totalheight">totalHeight</span>                   | `number`                                                           |
| <span id="getter-featuresready">featuresReady</span>               | `boolean`                                                          |

**Methods**

#### method: getPortableSettings

Called by BaseTrackModel.replaceDisplay when switching between the regular and
matrix variant displays. The config-slot settings (colorBy, renderingMode, etc.)
now live on each display's own config-schema node rather than a display-instance
override map, so porting them means writing directly into the _target_ display's
config (via setSlot) rather than spreading them into the new display's instance
snapshot — hence the `newDisplayId` param. Only genuine display-instance state
(not config-backed) is returned for the instance-snapshot spread.

```ts
type getPortableSettings = (newDisplayId?: string | undefined) => {…}
```

#### method: legendSections

Legend split into independently-closable sections: the genotype/cell coloring
and (when colorBy is set) the sample-grouping coloring shown on the sidebar row
labels. Dismissed sections are filtered out.

```ts
type legendSections = () => LegendSection[]
```

| Member                                                     | Type               |
| ---------------------------------------------------------- | ------------------ |
| <span id="method-rpcprops">rpcProps</span>                 | `() => {…}`        |
| <span id="method-trackmenuitems">trackMenuItems</span>     | `() => MenuItem[]` |
| <span id="method-contextmenuitems">contextMenuItems</span> | `() => MenuItem[]` |

**Actions**

#### action: dismissLegendSection

Close a single legend section (leaving the others visible).

```ts
type dismissLegendSection = (id: string) => void
```

#### action: setColorBy

Recolor sample rows by a metadata attribute (e.g. 'population'), or pass '' to
clear the coloring. Persists the arrangement as the layout and records the
choice in the `colorBy` config slot so it survives a data refetch and serializes
into the session. Re-applies `groupBy` in the same pass so recoloring doesn't
drop an existing grouping.

```ts
type setColorBy = (colorBy: string) => void
```

#### action: setGroupBy

Reorder sample rows so each value of a metadata attribute (e.g. 'population') is
contiguous, or pass '' to clear the grouping. Persists the arrangement as the
layout and records the choice in the `groupBy` config slot so it survives a data
refetch and serializes into the session. Re-applies `colorBy` in the same pass
so grouping doesn't drop an existing palette.

```ts
type setGroupBy = (groupBy: string) => void
```

#### action: clearLayout

Restore the configured default arrangement — empties the layout and clears the
cluster tree, then re-applies the `colorBy` palette if one is configured.
Overrides the mixin's `clearLayout` so the user gets the same starting state
they had on initial load.

```ts
type clearLayout = () => void
```

#### action: setFitToHeight

Enable fit-to-display-height mode: `rowHeight = 0` makes `effectiveRowHeight`
divide `availableHeight` across the rows.

```ts
type setFitToHeight = () => void
```

#### action: resizeHeight

Override resizeHeight to scale a pinned row height proportionally when the
display is vertically resized. Rows live in `availableHeight`
(`height - lineZoneHeight`), not the full height, so scale by the
available-height ratio — otherwise the visible fraction of rows drifts on resize
whenever `lineZoneHeight` is non-zero (the matrix display).

```ts
type resizeHeight = (distance: number) => number
```

#### action: setFeatureColor

Set the per-variant cell color override (jexl string or CSS color), or '' to
restore default genotype coloring. A fetch input — recomputes cells in the
worker.

```ts
type setFeatureColor = (arg: string) => void
```

| Member                                                                                 | Type                                                                                           |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| <span id="action-setcelldata">setCellData</span>                                       | `(data: CellDataResult \| undefined) => void`                                                  |
| <span id="action-setcontextmenufeature">setContextMenuFeature</span>                   | `(feature?: Feature \| undefined) => void`                                                     |
| <span id="action-setloadedbpperpx">setLoadedBpPerPx</span>                             | `(bpPerPx: number \| undefined) => void`                                                       |
| <span id="action-fetchmetadatadescriptions">fetchMetadataDescriptions</span>           | `() => Promise<unknown>`                                                                       |
| <span id="action-setjexlfilters">setJexlFilters</span>                                 | `(f?: string[] \| undefined) => void`                                                          |
| <span id="action-setshowlegend">setShowLegend</span>                                   | `(s: boolean) => void`                                                                         |
| <span id="action-selectfeature">selectFeature</span>                                   | `(feature: Feature) => void`                                                                   |
| <span id="action-setrowheight">setRowHeight</span>                                     | `(arg: number) => void`                                                                        |
| <span id="action-sethoveredgenotype">setHoveredGenotype</span>                         | `(arg?: (Record<string, unknown> & { genotype: string; name: string; }) \| undefined) => void` |
| <span id="action-setsources">setSources</span>                                         | `(sources: Source[]) => void`                                                                  |
| <span id="action-setmaffilter">setMafFilter</span>                                     | `(arg: number) => void`                                                                        |
| <span id="action-setmaxmissingnessfilter">setMaxMissingnessFilter</span>               | `(arg: number) => void`                                                                        |
| <span id="action-setshowsidebarlabels">setShowSidebarLabels</span>                     | `(arg: boolean) => void`                                                                       |
| <span id="action-setshowtree">setShowTree</span>                                       | `(arg: boolean) => void`                                                                       |
| <span id="action-setshowbranchlength">setShowBranchLength</span>                       | `(arg: boolean) => void`                                                                       |
| <span id="action-setlayoutandpendingclustertree">setLayoutAndPendingClusterTree</span> | `(layout: Source[], tree: string) => void`                                                     |
| <span id="action-setrunclustering">setRunClustering</span>                             | `(arg?: boolean \| undefined) => void`                                                         |
| <span id="action-setphasedmode">setPhasedMode</span>                                   | `(arg: string) => void`                                                                        |
| <span id="action-setreferencedrawingmode">setReferenceDrawingMode</span>               | `(arg: string) => void`                                                                        |
| <span id="action-sortbygenotype">sortByGenotype</span>                                 | `(featureId: string) => void`                                                                  |
| <span id="action-setscrolltop">setScrollTop</span>                                     | `(scrollTop: number) => void`                                                                  |
| <span id="action-cleardisplayspecificdata">clearDisplaySpecificData</span>             | `() => void`                                                                                   |
| <span id="action-iscachevalid">isCacheValid</span>                                     | `(_displayedRegionIndex: number) => boolean`                                                   |
| <span id="action-getbyteestimateconfig">getByteEstimateConfig</span>                   | `() => ByteEstimateConfig`                                                                     |
| <span id="action-fetchneeded">fetchNeeded</span>                                       | `(_needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void>`              |
| <span id="action-reload">reload</span>                                                 | `() => void`                                                                                   |

</details>

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

| Member                                                                 | Type         |
| ---------------------------------------------------------------------- | ------------ |
| <span id="method-regioncannotberendered">regionCannotBeRendered</span> | `() => null` |

**Actions**

#### action: setIgnorePromotedDefaults

see the `ignorePromotedDefaults` property

```ts
type setIgnorePromotedDefaults = (flag: boolean) => void
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

**Getters**

| Member                                 | Type     |
| -------------------------------------- | -------- |
| <span id="getter-height">height</span> | `number` |

**Actions**

| Member                                       | Type                                |
| -------------------------------------------- | ----------------------------------- |
| <span id="action-setheight">setHeight</span> | `(displayHeight: number) => number` |

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

#### getter: svgReady

true once an off-screen (SVG) export can safely read this display's data: every
visible region has loaded, or the fetch reached a terminal error / too-large
state. Off-screen renderers gate on it via `awaitSvgReady(model)` instead of
inlining the condition. Regions stream in one at a time, so gating on
`viewportWithinLoadedData` (not the first datum) is what keeps
multi-region/whole-genome exports complete; `loadedRegions.size` guards the
vacuously-true empty-viewport case.

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

The RPC cache key: the subclass's `rpcProps()` payload serialized to a string,
so this getter's value is a primitive and MobX invalidates its observers only
when the payload actually changed. Building the payload touches far more
observables than it returns — canvas builds it from a whole config snapshot
(`resolvePromotableConfigSnapshot`), which reads every slot on the display
config — so an observer of the raw call would refetch on purely main-thread
settings (showLabels, heightMode, a compact/normal displayMode flip) that the
payload deliberately excludes. A fresh object would also never compare equal.
`''` for a display with no `rpcProps` (the SettingsInvalidate autorun isn't
installed there).

```ts
type rpcPropsCacheKey = string
```

#### getter: derivedRegionTooLargeEnabled

Derived opt-in for the region-too-large gate: a display that declares a
pre-flight byte estimate (`getByteEstimateConfig`) gates on it — the two are one
decision, so they can't desync (this replaces the old dev-time "config set but
gate off" console.error). Displays that capture the estimate through a custom
fetch (LD, arc) or fold the byte check into their feature RPC (canvas) leave
`getByteEstimateConfig` null and flip this true themselves.

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

#### volatile: userByteLimit

user-confirmed byte limit after a force-load, disabling the gate. Volatile, not
persisted: the interactive force-load button is a transient "show me this now"
action and must not leak a raised gate into a saved or shared session. The
declarative, session-scoped escape hatch is instead the `forceLoad` config slot
(set per-session via a session spec, or baked into a track config for
embedded/notebook views).

```ts
// type signature
type userByteLimit = number | undefined
// code
userByteLimit: undefined as number | undefined
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

**Methods**

#### method: regionCannotBeRenderedText

Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the
display chrome via `TooLargeMessage`, not the model.

```ts
type regionCannotBeRenderedText = () => '' | 'Force load to see features'
```

**Actions**

#### action: setByteEstimate

Commits the byte estimate and records the span it covers (`measuredSpanBp`) so
the derived gate can rescale it to the span on screen. Harmless for non-gated
displays (they ignore it).

```ts
type setByteEstimate = (estimate?: RegionByteEstimate | undefined) => void
```

#### action: raiseForceLoadLimits

force-load: raise the byte limit past the current request so the gate releases.
Prefers the estimate for the span on screen now, so it clears even if the view
zoomed out since the measurement; a display with the derived gate off has no
such estimate and falls back to the measured-span number. Canvas (which also has
a density force-load) overrides this entirely.

```ts
type raiseForceLoadLimits = (estimate?: RegionByteEstimate | undefined) => void
```

#### action: forceLoad

Raises the byte limit past the current estimate and triggers a reload. The
display chrome calls this via TooLargeMessage's force-load button; concrete
display models override reload() to do the actual refetch.

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

#### volatile: lastStatusMs

Date.now() of the last applied status write; the status callbacks gate on it to
throttle a high-frequency progress stream.

```ts
// type signature
type lastStatusMs = number
// code
lastStatusMs: 0
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
status bar instead of clobbering each other. Same `isAlive` guard.

```ts
type makeRegionStatusCallback = (key: number) => (status: RpcStatus) => void
```

**Actions**

#### action: throttleStatus

Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last
status write. A leading-edge throttle: sparse updates pass straight through,
dense progress bursts are thinned so the loading overlay stops re-rendering
faster than the view animates. The final status doesn't need a trailing flush —
fetch completion clears it via `resetStatus`.

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
| <span id="action-setclustertree">setClusterTree</span>                   | `(tree?: string \| undefined) => void`              |
| <span id="action-setlayoutandclustertree">setLayoutAndClusterTree</span> | `(layout: S[], tree?: string \| undefined) => void` |
| <span id="action-settreeareawidth">setTreeAreaWidth</span>               | `(width: number) => void`                           |
| <span id="action-setsubtreefilter">setSubtreeFilter</span>               | `(names?: string[] \| undefined) => void`           |
| <span id="action-sethoveredtreenode">setHoveredTreeNode</span>           | `(node?: HoveredTreeNode \| undefined) => void`     |
| <span id="action-settreecanvasref">setTreeCanvasRef</span>               | `(ref: HTMLCanvasElement \| null) => void`          |
| <span id="action-setmouseovercanvasref">setMouseoverCanvasRef</span>     | `(ref: HTMLCanvasElement \| null) => void`          |

</details>
