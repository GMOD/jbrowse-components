---
id: multisamplevariantbasemodel
title: MultiSampleVariantBaseModel
sidebar_label: Display -> MultiSampleVariantBaseModel
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`variants` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/shared/MultiSampleVariantBaseModel.ts).

## Example usage

`renderingMode`, `colorBy`, and `minorAlleleFrequencyFilter` are config slots
(see `SharedVariantConfigSchema`) read at runtime through `getConf` and written
through `self.configuration.setSlot` — they are NOT plain MST properties. Set
them in a track's `displays` array to change the default:

```js
displays: [
  {
    type: 'LinearMultiSampleVariantMatrixDisplay',
    displayId: 'my-matrix',
    renderingMode: 'phased',
  },
]
```

`runClustering` is a transient declarative launch spec, the same idea as
`LinearGenomeView`'s `init`: set it to run the real "Cluster by genotype" RPC
once automatically (no dialog) as soon as sources are available, and it clears
itself afterwards so a saved session never re-triggers it.

```js
displays: [
  {
    type: 'LinearMultiSampleVariantDisplay',
    runClustering: true,
  },
]
```

## Overview

## Members

| Member                                                                   | Kind       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                                   | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [configuration](#property-configuration)                                 | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [rowHeight](#property-rowheight)                                         | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [jexlFilters](#property-jexlfilters)                                     | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [lineZoneHeight](#property-linezoneheight)                               | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [runClustering](#property-runclustering)                                 | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [showLegend](#volatile-showlegend)                                       | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [dismissedLegendSections](#volatile-dismissedlegendsections)             | Volatiles  | Ids of legend sections the user has individually closed (e.g. 'genotypes' / 'group'); reset when the whole legend is re-shown.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [contextMenuFeature](#volatile-contextmenufeature)                       | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [sourcesVolatile](#volatile-sourcesvolatile)                             | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hoveredGenotype](#volatile-hoveredgenotype)                             | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [cellData](#volatile-celldata)                                           | Volatiles  | Single source of truth for fetched per-display data. hasPhased, sampleInfo, and featuresVolatile are derived from this via getters — fetchNeeded only needs to call setCellData(result).                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [loadedBpPerPx](#volatile-loadedbpperpx)                                 | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [reloadCount](#volatile-reloadcount)                                     | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [pendingClusterTree](#volatile-pendingclustertree)                       | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [featuresVolatile](#getter-featuresvolatile)                             | Getters    | SimpleFeature instances derived from the simplifiedFeatures list in the most recent cellData payload. Cached by MobX while cellData is unchanged. Named `featuresVolatile` for backwards-compat with consumers that originally read it as a volatile field. These carry ONLY positional fields (id/start/end/refName/name) — not ALT or genotypes. Don't re-derive feature-level facts from them (`.get('ALT')` etc. returns undefined); summary facts are computed in the worker and exposed as scalars (hasPhased/hasSecondaryAlt/ hasUnphased), and per-feature genotype info lives in the cell-data featureGenotypeMap/featureData. |
| [hasPhased](#getter-hasphased)                                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hasSecondaryAlt](#getter-hassecondaryalt)                               | Getters    | Whether any visible site is multiallelic (drives the "Other alt allele" legend entry). Computed in the worker since the simplified features sent to the client don't carry ALT.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hasUnphased](#getter-hasunphased)                                       | Getters    | Whether any genotype call is unphased (drives the "Unphased" legend entry in phased mode).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [hasConsequence](#getter-hasconsequence)                                 | Getters    | Whether any visible variant carries a SnpEff/VEP annotation, gating the "Color cells by consequence" menu option.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [sampleInfo](#getter-sampleinfo)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [renderingMode](#getter-renderingmode)                                   | Getters    | Returns the rendering mode config slot value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [colorBy](#getter-colorby)                                               | Getters    | The effective sample-grouping attribute (config default or runtime override). Drives the sidebar row coloring and the legend's group section; '' means no grouping.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [featureColor](#getter-featurecolor)                                     | Getters    | Optional per-variant cell color (jexl string or CSS color) applied to alt-carrying cells; '' means default genotype coloring. Reads the raw config value directly (not `getConf`, which evaluates a `jexl:...` string immediately with no `feature` bound) — this crosses the RPC boundary as-is and is evaluated once per feature in the worker (see `makeFeatureColor` in `executeVariantCellData.ts`).                                                                                                                                                                                                                               |
| [featureWidgetType](#getter-featurewidgettype)                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [fetchSizeLimit](#getter-fetchsizelimit)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [minorAlleleFrequencyFilter](#getter-minorallelefrequencyfilter)         | Getters    | Returns the minor allele frequency filter config slot value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [maxMissingnessFilter](#getter-maxmissingnessfilter)                     | Getters    | Max fraction of no-call genotypes a variant may have before it's hidden; 1 keeps every variant                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [filters](#getter-filters)                                               | Getters    | The jexl filter expressions (from the Edit filters dialog) as a SerializableFilterChain, ready to pass as the RPC `filters` arg. MultiSampleVariantGet{CellData,GenotypeMatrix,ClusterGenotypeMatrix} all extend RpcMethodTypeWithFiltersAndRenameRegions, which serializes this to string[] and rebuilds it in the worker with pluginManager.jexl.                                                                                                                                                                                                                                                                                     |
| [showSidebarLabels](#getter-showsidebarlabels)                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [showTree](#getter-showtree)                                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [showBranchLength](#getter-showbranchlength)                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [referenceDrawingMode](#getter-referencedrawingmode)                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [colorByAttributes](#getter-colorbyattributes)                           | Getters    | Distinct sample-metadata attributes (from samplesTsv) the user can color rows by — every key the sources carry except internal plumbing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [sourcesWithoutLayout](#getter-sourceswithoutlayout)                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [sourcesBase](#getter-sourcesbase)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [sources](#getter-sources)                                               | Getters    | sourcesBase expanded for phased rendering when sampleInfo is available. Sources already carrying HP (from clustering) pass through unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [editableSources](#getter-editablesources)                               | Getters    | Layout-merged, phased-expanded view for the Edit Color/Arrangement dialog. Does NOT apply the subtree filter — submitting the dialog persists every row back to `layout`, so filtered samples must be present or they would be wiped from layout on submit.                                                                                                                                                                                                                                                                                                                                                                             |
| [sourceMap](#getter-sourcemap)                                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [genotypeSampleIndex](#getter-genotypesampleindex)                       | Getters    | sampleName -> column index into each feature's interned `genotypeCodes`. Rebuilt only when cellData changes. Used by the tooltips to decode a hovered cell's genotype (see genotypeCodec.ts).                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [availableHeight](#getter-availableheight)                               | Getters    | Available height for rows (total height minus lineZoneHeight)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [nrow](#getter-nrow)                                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [autoRowHeight](#getter-autorowheight)                                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [effectiveRowHeight](#getter-effectiverowheight)                         | Getters    | Resolved per-row height. `rowHeight === 0` means auto-fit (computed from availableHeight / nrow); any positive value is a user-pinned height. `resizeHeight` scales pinned values proportionally so manual + display-resize stay in sync without snap-back fuzziness. Every consumer reads this, never the raw `rowHeight` property.                                                                                                                                                                                                                                                                                                    |
| [hierarchy](#getter-hierarchy)                                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [spatialIndex](#getter-spatialindex)                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hoveredTooltipSource](#getter-hoveredtooltipsource)                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [canDisplayLabels](#getter-candisplaylabels)                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [totalHeight](#getter-totalheight)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [hasOverflow](#getter-hasoverflow)                                       | Getters    | Whether the rows are taller than the viewport, i.e. the display scrolls. Drives native-scroll gating in displays that scroll their rows in a native overflow container (the plain display); auto-fit mode keeps this false since `rowHeight` derives from `availableHeight`.                                                                                                                                                                                                                                                                                                                                                            |
| [scrollableHeight](#getter-scrollableheight)                             | Getters    | Max valid `scrollTop`: how far the rows can scroll before the bottom row reaches the viewport floor. Zero when the rows fit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [featuresReady](#getter-featuresready)                                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [rpcProps](#method-rpcprops)                                             | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [showSubmenuItems](#method-showsubmenuitems)                             | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [trackMenuItems](#method-trackmenuitems)                                 | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [contextMenuItems](#method-contextmenuitems)                             | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [getPortableSettings](#method-getportablesettings)                       | Methods    | Called by BaseTrackModel.replaceDisplay when switching between the regular and matrix variant displays. The config-slot settings (colorBy, renderingMode, etc.) now live on each display's own config-schema node rather than a display-instance override map, so porting them means writing directly into the _target_ display's config (via setSlot) rather than spreading them into the new display's instance snapshot — hence the `newDisplayId` param. Only genuine display-instance state (not config-backed) is returned for the instance-snapshot spread.                                                                      |
| [legendSections](#method-legendsections)                                 | Methods    | Legend split into independently-closable sections: the genotype/cell coloring and (when colorBy is set) the sample-grouping coloring shown on the sidebar row labels. Dismissed sections are filtered out.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setCellData](#action-setcelldata)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setContextMenuFeature](#action-setcontextmenufeature)                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setLoadedBpPerPx](#action-setloadedbpperpx)                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [fetchMetadataDescriptions](#action-fetchmetadatadescriptions)           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setJexlFilters](#action-setjexlfilters)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setShowLegend](#action-setshowlegend)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [dismissLegendSection](#action-dismisslegendsection)                     | Actions    | Close a single legend section (leaving the others visible).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [selectFeature](#action-selectfeature)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setRowHeight](#action-setrowheight)                                     | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setHoveredGenotype](#action-sethoveredgenotype)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setSources](#action-setsources)                                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setColorBy](#action-setcolorby)                                         | Actions    | Recolor sample rows by a metadata attribute (e.g. 'population'), or pass '' to clear the grouping. Persists the colored arrangement as the layout and records the choice in the `colorBy` config slot so it survives a data refetch and serializes into the session.                                                                                                                                                                                                                                                                                                                                                                    |
| [clearLayout](#action-clearlayout)                                       | Actions    | Restore the configured default arrangement — empties the layout and clears the cluster tree, then re-applies the `colorBy` palette if one is configured. Overrides the mixin's `clearLayout` so the user gets the same starting state they had on initial load.                                                                                                                                                                                                                                                                                                                                                                         |
| [setMafFilter](#action-setmaffilter)                                     | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setMaxMissingnessFilter](#action-setmaxmissingnessfilter)               | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setShowSidebarLabels](#action-setshowsidebarlabels)                     | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setShowTree](#action-setshowtree)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setShowBranchLength](#action-setshowbranchlength)                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setLayoutAndPendingClusterTree](#action-setlayoutandpendingclustertree) | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setRunClustering](#action-setrunclustering)                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setPhasedMode](#action-setphasedmode)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setFitToHeight](#action-setfittoheight)                                 | Actions    | Enable fit-to-display-height mode: `rowHeight = 0` makes `effectiveRowHeight` divide `availableHeight` across the rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [resizeHeight](#action-resizeheight)                                     | Actions    | Override resizeHeight to scale a pinned row height proportionally when the display is vertically resized. Rows live in `availableHeight` (`height - lineZoneHeight`), not the full height, so scale by the available-height ratio — otherwise the visible fraction of rows drifts on resize whenever `lineZoneHeight` is non-zero (the matrix display).                                                                                                                                                                                                                                                                                 |
| [setReferenceDrawingMode](#action-setreferencedrawingmode)               | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setFeatureColor](#action-setfeaturecolor)                               | Actions    | Set the per-variant cell color override (jexl string or CSS color), or '' to restore default genotype coloring. A fetch input — recomputes cells in the worker.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [sortByGenotype](#action-sortbygenotype)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setScrollTop](#action-setscrolltop)                                     | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [isCacheValid](#action-iscachevalid)                                     | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [getByteEstimateConfig](#action-getbyteestimateconfig)                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [fetchNeeded](#action-fetchneeded)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [reload](#action-reload)                                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

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

### Available via [TreeSidebarMixin](../treesidebarmixin)

**Properties:** [layout](../treesidebarmixin#property-layout),
[clusterTree](../treesidebarmixin#property-clustertree),
[treeAreaWidth](../treesidebarmixin#property-treeareawidth),
[subtreeFilter](../treesidebarmixin#property-subtreefilter)

**Volatiles:** [hoveredTreeNode](../treesidebarmixin#volatile-hoveredtreenode),
[treeCanvas](../treesidebarmixin#volatile-treecanvas),
[mouseoverCanvas](../treesidebarmixin#volatile-mouseovercanvas)

**Getters:** [parsedTree](../treesidebarmixin#getter-parsedtree),
[root](../treesidebarmixin#getter-root),
[treeHasBranchLengths](../treesidebarmixin#getter-treehasbranchlengths)

**Methods:** [willClearTree](../treesidebarmixin#method-willcleartree)

**Actions:** [setLayout](../treesidebarmixin#action-setlayout),
[clearLayout](../treesidebarmixin#action-clearlayout),
[setClusterTree](../treesidebarmixin#action-setclustertree),
[setLayoutAndClusterTree](../treesidebarmixin#action-setlayoutandclustertree),
[setTreeAreaWidth](../treesidebarmixin#action-settreeareawidth),
[setSubtreeFilter](../treesidebarmixin#action-setsubtreefilter),
[setHoveredTreeNode](../treesidebarmixin#action-sethoveredtreenode),
[setTreeCanvasRef](../treesidebarmixin#action-settreecanvasref),
[setMouseoverCanvasRef](../treesidebarmixin#action-setmouseovercanvasref)

<details>
<summary>MultiSampleVariantBaseModel - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<string>
// code
type: types.string
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: rowHeight

```ts
// type signature
type rowHeight = IOptionalIType<ISimpleType<number>, [undefined]>
// code
rowHeight: types.stripDefault(types.number, 0)
```

#### property: jexlFilters

```ts
// type signature
type jexlFilters = IOptionalIType<
  IMaybe<IArrayType<ISimpleType<string>>>,
  [undefined]
>
// code
jexlFilters: types.stripDefault(
  types.maybe(types.array(types.string)),
  undefined,
)
```

#### property: lineZoneHeight

```ts
// type signature
type lineZoneHeight = IOptionalIType<ISimpleType<number>, [undefined]>
// code
lineZoneHeight: types.stripDefault(types.number, 0)
```

#### property: runClustering

```ts
// type signature
type runClustering = IMaybe<ISimpleType<boolean>>
// code
runClustering: types.maybe(types.boolean)
```

</details>

<details>
<summary>MultiSampleVariantBaseModel - Volatiles</summary>

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

</details>

<details>
<summary>MultiSampleVariantBaseModel - Volatiles (other undocumented members)</summary>

#### volatile: showLegend

```ts
// type signature
type showLegend = true
// code
showLegend: true
```

#### volatile: contextMenuFeature

```ts
// type signature
type contextMenuFeature = Feature | undefined
// code
contextMenuFeature: undefined as Feature | undefined
```

#### volatile: sourcesVolatile

```ts
// type signature
type sourcesVolatile = Source[] | undefined
// code
sourcesVolatile: undefined as Source[] | undefined
```

#### volatile: hoveredGenotype

```ts
// type signature
type hoveredGenotype =
  (Record<string, unknown> & { genotype: string; name: string }) | undefined
// code
hoveredGenotype: undefined as
  (Record<string, unknown> & { genotype: string; name: string }) | undefined
```

#### volatile: loadedBpPerPx

```ts
// type signature
type loadedBpPerPx = number | undefined
// code
loadedBpPerPx: undefined as number | undefined
```

#### volatile: reloadCount

```ts
// type signature
type reloadCount = number
// code
reloadCount: 0
```

#### volatile: pendingClusterTree

```ts
// type signature
type pendingClusterTree = string | undefined
// code
pendingClusterTree: undefined as string | undefined
```

</details>

<details>
<summary>MultiSampleVariantBaseModel - Getters</summary>

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

#### getter: hasConsequence

Whether any visible variant carries a SnpEff/VEP annotation, gating the "Color
cells by consequence" menu option.

```ts
type hasConsequence = boolean
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

#### getter: genotypeSampleIndex

sampleName -> column index into each feature's interned `genotypeCodes`. Rebuilt
only when cellData changes. Used by the tooltips to decode a hovered cell's
genotype (see genotypeCodec.ts).

```ts
type genotypeSampleIndex = Map<string, number> | undefined
```

#### getter: availableHeight

Available height for rows (total height minus lineZoneHeight)

```ts
type availableHeight = number
```

#### getter: effectiveRowHeight

Resolved per-row height. `rowHeight === 0` means auto-fit (computed from
availableHeight / nrow); any positive value is a user-pinned height.
`resizeHeight` scales pinned values proportionally so manual + display-resize
stay in sync without snap-back fuzziness. Every consumer reads this, never the
raw `rowHeight` property.

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

</details>

<details>
<summary>MultiSampleVariantBaseModel - Getters (other undocumented members)</summary>

#### getter: hasPhased

```ts
type hasPhased = boolean
```

#### getter: sampleInfo

```ts
type sampleInfo = Record<string, SampleInfo> | undefined
```

#### getter: featureWidgetType

```ts
type featureWidgetType = { type: string; id: string }
```

#### getter: fetchSizeLimit

```ts
type fetchSizeLimit = number
```

#### getter: showSidebarLabels

```ts
type showSidebarLabels = boolean
```

#### getter: showTree

```ts
type showTree = boolean
```

#### getter: showBranchLength

```ts
type showBranchLength = boolean
```

#### getter: referenceDrawingMode

```ts
type referenceDrawingMode = string
```

#### getter: sourcesWithoutLayout

```ts
type sourcesWithoutLayout = ProcessedSource[] | undefined
```

#### getter: sourcesBase

```ts
type sourcesBase = ProcessedSource[] | undefined
```

#### getter: sourceMap

```ts
type sourceMap = { [k: string]: Source } | undefined
```

#### getter: nrow

```ts
type nrow = number
```

#### getter: autoRowHeight

```ts
type autoRowHeight = number
```

#### getter: hierarchy

```ts
type hierarchy = PositionedHierarchyNode<NewickNode> | undefined
```

#### getter: spatialIndex

```ts
type spatialIndex =
  { index: Flatbush; nodes: ClusterHierarchyNode[] } | undefined
```

#### getter: hoveredTooltipSource

```ts
type hoveredTooltipSource =
  | {
      [x: string]: unknown
      genotype: string
      name: string
      baseUri?: string | undefined
      label?: string | undefined
      labelColor?: string | undefined
      sampleName?: string | undefined
      color?: string | undefined
      group?: string | undefined
      HP?: number | undefined
    }
  | undefined
```

#### getter: canDisplayLabels

```ts
type canDisplayLabels = boolean
```

#### getter: totalHeight

```ts
type totalHeight = number
```

#### getter: featuresReady

```ts
type featuresReady = boolean
```

</details>

<details>
<summary>MultiSampleVariantBaseModel - Methods</summary>

#### method: getPortableSettings

Called by BaseTrackModel.replaceDisplay when switching between the regular and
matrix variant displays. The config-slot settings (colorBy, renderingMode, etc.)
now live on each display's own config-schema node rather than a display-instance
override map, so porting them means writing directly into the _target_ display's
config (via setSlot) rather than spreading them into the new display's instance
snapshot — hence the `newDisplayId` param. Only genuine display-instance state
(not config-backed) is returned for the instance-snapshot spread.

```ts
type getPortableSettings = (newDisplayId?: string | undefined) => { jexlFilters: (IMSTArray<ISimpleType<string>> & IStateTreeNode<IOptionalIType<IMaybe<IArrayType<ISimpleType<string>>>, [...]>>) | undefined; clusterTree: string | undefined; treeAreaWidth: number; layout: Source[] & IStateTreeNode<...>; height: number; }
```

#### method: legendSections

Legend split into independently-closable sections: the genotype/cell coloring
and (when colorBy is set) the sample-grouping coloring shown on the sidebar row
labels. Dismissed sections are filtered out.

```ts
type legendSections = () => LegendSection[]
```

</details>

<details>
<summary>MultiSampleVariantBaseModel - Methods (other undocumented members)</summary>

#### method: rpcProps

```ts
type rpcProps = () => {
  sources: ProcessedSource[] | undefined
  minorAlleleFrequencyFilter: number
  maxMissingnessFilter: number
  filters: SerializableFilterChain | undefined
  renderingMode: string
  referenceDrawingMode: string
  featureColor: string
}
```

#### method: showSubmenuItems

```ts
type showSubmenuItems = () => MenuItem[]
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => MenuItem[]
```

#### method: contextMenuItems

```ts
type contextMenuItems = () => MenuItem[]
```

</details>

<details>
<summary>MultiSampleVariantBaseModel - Actions</summary>

#### action: dismissLegendSection

Close a single legend section (leaving the others visible).

```ts
type dismissLegendSection = (id: string) => void
```

#### action: setColorBy

Recolor sample rows by a metadata attribute (e.g. 'population'), or pass '' to
clear the grouping. Persists the colored arrangement as the layout and records
the choice in the `colorBy` config slot so it survives a data refetch and
serializes into the session.

```ts
type setColorBy = (colorBy: string) => void
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

</details>

<details>
<summary>MultiSampleVariantBaseModel - Actions (other undocumented members)</summary>

#### action: setCellData

```ts
type setCellData = (data: CellDataResult | undefined) => void
```

#### action: setContextMenuFeature

```ts
type setContextMenuFeature = (feature?: Feature | undefined) => void
```

#### action: setLoadedBpPerPx

```ts
type setLoadedBpPerPx = (bpPerPx: number | undefined) => void
```

#### action: fetchMetadataDescriptions

```ts
type fetchMetadataDescriptions = () => Promise<unknown>
```

#### action: setJexlFilters

```ts
type setJexlFilters = (f?: string[] | undefined) => void
```

#### action: setShowLegend

```ts
type setShowLegend = (s: boolean) => void
```

#### action: selectFeature

```ts
type selectFeature = (feature: Feature) => void
```

#### action: setRowHeight

```ts
type setRowHeight = (arg: number) => void
```

#### action: setHoveredGenotype

```ts
type setHoveredGenotype = (
  arg?:
    (Record<string, unknown> & { genotype: string; name: string }) | undefined,
) => void
```

#### action: setSources

```ts
type setSources = (sources: Source[]) => void
```

#### action: setMafFilter

```ts
type setMafFilter = (arg: number) => void
```

#### action: setMaxMissingnessFilter

```ts
type setMaxMissingnessFilter = (arg: number) => void
```

#### action: setShowSidebarLabels

```ts
type setShowSidebarLabels = (arg: boolean) => void
```

#### action: setShowTree

```ts
type setShowTree = (arg: boolean) => void
```

#### action: setShowBranchLength

```ts
type setShowBranchLength = (arg: boolean) => void
```

#### action: setLayoutAndPendingClusterTree

```ts
type setLayoutAndPendingClusterTree = (layout: Source[], tree: string) => void
```

#### action: setRunClustering

```ts
type setRunClustering = (arg?: boolean | undefined) => void
```

#### action: setPhasedMode

```ts
type setPhasedMode = (arg: string) => void
```

#### action: setReferenceDrawingMode

```ts
type setReferenceDrawingMode = (arg: string) => void
```

#### action: sortByGenotype

```ts
type sortByGenotype = (featureId: string) => void
```

#### action: setScrollTop

```ts
type setScrollTop = (scrollTop: number) => void
```

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

#### action: isCacheValid

```ts
type isCacheValid = (_displayedRegionIndex: number) => boolean
```

#### action: getByteEstimateConfig

```ts
type getByteEstimateConfig = () => ByteEstimateConfig | null
```

#### action: fetchNeeded

```ts
type fetchNeeded = (
  _needed: { region: Region; displayedRegionIndex: number }[],
) => Promise<void>
```

#### action: reload

```ts
type reload = () => void
```

</details>
