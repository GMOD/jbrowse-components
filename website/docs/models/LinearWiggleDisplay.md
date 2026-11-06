---
id: linearwiggledisplay
title: LinearWiggleDisplay
description: "The quantitative display: one plot per rendering, drawn over one source or over many. rows: 'source' puts each source in a separate row, with the clustering sidebar, row labels and separators beside…"
sidebar_label: Display -> LinearWiggleDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/model.ts).

The quantitative display: one plot per rendering, drawn over one source or
over many. `rows: 'source'` puts each source in a separate row, with the
clustering sidebar, row labels and separators beside them, and holds the
arrangement a reader sets; unset, every source shares one plot box.

## Example usage

A complete `QuantitativeTrack` config to paste into `tracks`:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'coverage',
  name: 'Coverage',
  assemblyNames: ['hg38'],
  adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
  displays: [
    {
      type: 'LinearWiggleDisplay',
      displayId: 'coverage-LinearWiggleDisplay',
      height: 100,
    },
  ],
}
```

The two row-ordering triggers are display *properties*, not config slots, so
they go on the display node in a session — `defaultSession` here, and the
same shape a `session=spec-` link uses. Written in the track config's
`displays` entry they would be dropped as unknown slots.

`runClustering` is a transient declarative launch spec, the same idea as
`LinearGenomeView`'s `init`: it runs the real "Cluster columns" RPC once
automatically (no dialog) as soon as subtrack data is available, then clears
itself so a saved session never re-triggers it. `sortRowsBy` is the other
one, and the declarative form of the right-click "Sort rows by score here" —
where clustering orders rows by the whole region in view, this ranks them by
the score each has at one base, so a cohort can open already ranked at a
candidate locus with the surrounding context still on screen. Use one or the
other; whichever applies last owns the row order.

```js
defaultSession: {
  name: 'Copy number at CCL3L1',
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'hg38',
      loc: 'chr17:36,080,000-36,270,000',
      tracks: [
        {
          trackId: 'pur_copynumber_1000g',
          type: 'LinearWiggleDisplay',
          sortRowsBy: { refName: 'chr17', pos: 36180000 },
        },
      ],
    },
  ],
}
```

The configuration slots for this model are documented on its [config schema page](../../config/linearwiggledisplay).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>types.literal('LinearWiggleDisplay')</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>ConfigurationReference(configSchema)</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>5 inherited properties from 3 models</summary>

From [TreeSidebarMixin](../treesidebarmixin): <span id="property-runclustering">[`runClustering`](../treesidebarmixin#property-runclustering)</span>, <span id="property-clusterregion">[`clusterRegion`](../treesidebarmixin#property-clusterregion)</span>, <span id="property-sortrowsby">[`sortRowsBy`](../treesidebarmixin#property-sortrowsby)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="property-parkedcolors">[`parkedColors`](../parkedcolormixin#property-parkedcolors)</span>

From [BaseDisplay](../basedisplay): <span id="property-id">[`id`](../basedisplay#property-id)</span>

</details>

## Volatiles

<details class="inherited-members" data-pagefind-ignore>
<summary>29 inherited volatiles from 10 models</summary>

From [ContextMenuMixin](../contextmenumixin): <span id="volatile-contextmenuinfo">[`contextMenuInfo`](../contextmenumixin#volatile-contextmenuinfo)</span>

From [TreeSidebarMixin](../treesidebarmixin): <span id="volatile-hoveredtreenode">[`hoveredTreeNode`](../treesidebarmixin#volatile-hoveredtreenode)</span>, <span id="volatile-treecanvas">[`treeCanvas`](../treesidebarmixin#volatile-treecanvas)</span>, <span id="volatile-mouseovercanvas">[`mouseoverCanvas`](../treesidebarmixin#volatile-mouseovercanvas)</span>

From [LegendMixin](../legendmixin): <span id="volatile-dismissedlegendsections">[`dismissedLegendSections`](../legendmixin#volatile-dismissedlegendsections)</span>

From [StoredHoverMixin](../storedhovermixin): <span id="volatile-storedhoveredfeature">[`storedHoveredFeature`](../storedhovermixin#volatile-storedhoveredfeature)</span>

From [ScoreScaleMixin](../scorescalemixin): <span id="volatile-unclippedfencequantile">[`unclippedFenceQuantile`](../scorescalemixin#volatile-unclippedfencequantile)</span>

From [MultiRegionDisplayMixin](../multiregiondisplaymixin): <span id="volatile-loadedregions">[`loadedRegions`](../multiregiondisplaymixin#volatile-loadedregions)</span>

From [FetchMixin](../fetchmixin): <span id="volatile-activesignal">[`activeSignal`](../fetchmixin#volatile-activesignal)</span>, <span id="volatile-fetchgeneration">[`fetchGeneration`](../fetchmixin#volatile-fetchgeneration)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../fetchmixin#volatile-reloadcounter)</span>, <span id="volatile-statuswindow">[`statusWindow`](../fetchmixin#volatile-statuswindow)</span>, <span id="volatile-error">[`error`](../fetchmixin#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../fetchmixin#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../fetchmixin#volatile-statusprogress)</span>, <span id="volatile-fetchcanceled">[`fetchCanceled`](../fetchmixin#volatile-fetchcanceled)</span>, <span id="volatile-fetchrotation">[`fetchRotation`](../fetchmixin#volatile-fetchrotation)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="volatile-canvasdrawn">[`canvasDrawn`](../renderlifecyclemixin#volatile-canvasdrawn)</span>, <span id="volatile-paintcount">[`paintCount`](../renderlifecyclemixin#volatile-paintcount)</span>, <span id="volatile-currentrenderingbackend">[`currentRenderingBackend`](../renderlifecyclemixin#volatile-currentrenderingbackend)</span>, <span id="volatile-rendertick">[`renderTick`](../renderlifecyclemixin#volatile-rendertick)</span>, <span id="volatile-autorunsinstalled">[`autorunsInstalled`](../renderlifecyclemixin#volatile-autorunsinstalled)</span>, <span id="volatile-rendererror">[`renderError`](../renderlifecyclemixin#volatile-rendererror)</span>, <span id="volatile-offscreen">[`offScreen`](../renderlifecyclemixin#volatile-offscreen)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="volatile-forceloadtrack">[`forceLoadTrack`](../regiontoolargemixin#volatile-forceloadtrack)</span>, <span id="volatile-byteestimate">[`byteEstimate`](../regiontoolargemixin#volatile-byteestimate)</span>, <span id="volatile-gatemeasuredviewportkey">[`gateMeasuredViewportKey`](../regiontoolargemixin#volatile-gatemeasuredviewportkey)</span>

From [TrackHeightMixin](../trackheightmixin): <span id="volatile-scrolltop">[`scrollTop`](../trackheightmixin#volatile-scrolltop)</span>, <span id="volatile-hostheight">[`hostHeight`](../trackheightmixin#volatile-hostheight)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-rpcdatamap">**rpcDataMap**</span><br><code>ReadonlyMap&lt;number, WiggleDataResult&gt;</code> | The fetched scores, keyed by displayedRegionIndex — the foundation's per-region store, narrowed. |
| <span id="getter-resolution">**resolution**</span><br><code>number</code> | Points per pixel the fetch asks for, clamped to what the Resolution menu offers: the slot is reachable from a track config, which runs no setter, and `0` there divides by zero inside the adapter. |
| <span id="getter-origin">**origin**</span><br><code>number</code> | The value bars grow from, which a color scale also reads where its domain is unset. |
| <span id="getter-linewidth">**lineWidth**</span><br><code>number</code> | A line's width, `encoding.strokeWidth` or 1 px while unset. |
| <span id="getter-size">**size**</span><br><code>number</code> | A point's diameter, `encoding.size` or 2 px while unset. |
| <span id="getter-extent">**extent**</span><br><code>"min-max" &#124; "none"</code> |  |
| <span id="getter-renderingtype">**renderingType**</span><br><code>"density" &#124; "line" &#124; "linecenter" &#124; "scatter" &#124; "xyplot"</code> |  |
| <span id="getter-colorsetting">**colorSetting**</span><br><code>ColorSetting</code> | The `encoding.color` channel as written, `value` undefined while nothing names a color and the layout decides (`effectiveColor`). |
| <span id="getter-isrowlayout">**isRowLayout**</span><br><code>boolean</code> | Whether each source is drawn in a separate row, which is all that `rows.field` decides here: the tree sidebar, the row labels, the separators, the clustering menu and the row-order sort all hang off it. |
| <span id="getter-showrowseparators">**showRowSeparators**</span><br><code>boolean</code> |  |
| <span id="getter-isdensitymode">**isDensityMode**</span><br><code>boolean</code> |  |
| <span id="getter-colorkeytitle">**colorKeyTitle**</span><br><code>string</code> | The heading both color keys carry: `encoding.color.legend.title` as written (`''` draws none), else the y axis title the key replaces, else `Score`. |
| <span id="getter-isoverlay">**isOverlay**</span><br><code>boolean</code> | Every source in one plot box. The complement of the row layout, named for what is drawn rather than for the setting that is off. |
| <span id="getter-prefersoffset">**prefersOffset**</span><br><code>boolean</code> | Offset the track label above the plot so the left y-axis stays pinned to the content edge instead of dodging right of the label, and so a stack of rows is not hidden behind it. One density plot draws no left axis (just a top score legend), so there let the label overlap. |
| <span id="getter-hasresolution">**hasResolution**</span><br><code>boolean</code> | Asked of the display's own adapter, for the GC track the synthesized GCContentAdapter: the resolution slot it gates is passed to whatever this display fetches from. |
| <span id="getter-domain">**domain**</span><br><code>[number, number] &#124; undefined</code> |  |
| <span id="getter-defaultscoredomain">**defaultScoreDomain**</span><br><code>[number &#124; undefined, number &#124; undefined]</code> | The bounds the adapter declares its values lie in, where it declares any (`getValueDomain`): a GC content track's [0, 1], so its axis reads alike at every locus. Config bounds still win. |
| <span id="getter-discoveredrows">**discoveredRows**</span><br><code>Source[]</code> | `TreeSidebarMixin`'s hook: the adapter's sources, discovered from the loaded regions in adapter order. |
| <span id="getter-sharespanel">**sharesPanel**</span><br><code>boolean</code> | `TreeSidebarMixin`'s hook: whether several plots share one box, where only color tells the sources apart. A lone plot has nothing to be told apart from and is the pos/neg picture a quantitative track has always drawn. |
| <span id="getter-rownoun">**rowNoun**</span><br><code>string</code> | `TreeSidebarMixin`'s hook: the row color key over a shared panel lists subtracks. |
| <span id="getter-drawstree">**drawsTree**</span><br><code>boolean</code> | `TreeSidebarMixin`'s hook: off in overlay, which collapses every source onto one row, so a tree spreading its leaves over the full height would align to nothing. A subtree filter set in a row mode still applies and is still clearable from the track menu and WiggleHint. |
| <span id="getter-rowslistedupfront">**rowsListedUpFront**</span><br><code>boolean</code> | `TreeSidebarMixin`'s hook: the adapter lists its subtracks, so a `rows.kept` name no subtrack has is named. |
| <span id="getter-livenotices">**liveNotices**</span><br><code>string[]</code> | What the loaded sources said they could not serve, and `rowNarrowingNotices`. |
| <span id="getter-effectiveextent">**effectiveExtent**</span><br><code>"min-max" &#124; "none"</code> | The extent actually drawn. A heatmap maps score to color and has no min-max presentation, so the autoscale domain reads this rather than the raw slot; otherwise the color ramp spans the min and max while the plot paints one summary, and the score legend reports a range nothing on screen reaches. |
| <span id="getter-effectivecolor">**effectiveColor**</span><br><code>ColorSetting</code> | The color actually painted: what the config says, else the pos/neg pair about the `origin`. |
| <span id="getter-colorencoding">**colorEncoding**</span><br><code>string &#124; FieldColorEncoding &#124; undefined</code> | `effectiveColor` as it paints, through the one resolver every display's color object goes through. |
| <span id="getter-wigglecolor">**wiggleColor**</span><br><code>ResolvedWiggleColor</code> | `colorEncoding` as the encoder and both backends take it. |
| <span id="getter-markcoloring">**markColoring**</span><br><code>{ gradientPaints: boolean; rowColorPaintsMarks: boolean; }</code> | How the plot spends color (`wiggleMarkColoring`): whether the score gradient paints, whether row colors do, and which of a source's colors its marks take. |
| <span id="getter-scoregradientpaints">**scoreGradientPaints**</span><br><code>boolean</code> | Whether a gradient spends color on the score: any mark under a `linear` color, which a heatmap draws its unset pair as. |
| <span id="getter-rowcolorpaintsmarks">**rowColorPaintsMarks**</span><br><code>boolean</code> | `TreeSidebarMixin`'s hook: a subtrack's color paints its plot while the plot colors by `source` (`wiggleColorsBySource`). |
| <span id="getter-marksources">**markSources**</span><br><code>{ name: string; color?: string &#124; undefined; }[]</code> | Each source and the color its marks paint in (`wiggleMarkSources`), which the encoder and the tooltip read. |
| <span id="getter-scorerulevalues">**scoreRuleValues**</span><br><code>number[]</code> | Scores the axis must reach whatever the data does, so a rule drawn at one stays on it. Empty in density, where no rule is drawn: the domain is spent on the color ramp there, so widening it stretches the ramp over a range nothing on screen reaches. |
| <span id="getter-autoscalesourcenames">**autoscaleSourceNames**</span><br><code>Set&lt;string&gt;</code> | The sources the autoscale domain reads: the rows drawn, so a filter that hides sources leaves the axis scaled to the ones shown. |
| <span id="getter-legendcolor">**legendColor**</span><br><code>string</code> | The one color the circular view's key names this track by (`CircularLegendSource`), which a ring of this display answers where it draws no ramp. The positive side, which is the whole plot wherever nothing parts. |
| <span id="getter-tooltipshowsminmax">**tooltipShowsMinMax**</span><br><code>boolean</code> | Whether a summary bin's tooltip lists its min and max: where they are drawn, or where the bar is one of them rather than the mean. |
| <span id="getter-statsinview">**statsInView**</span><br><code>VisibleStats&lt;WiggleSourceData, ScoreStats&gt; &#124; undefined</code> | The stats of the sources visible in the settled blocks, `undefined` until the view and the data are ready. |
| <span id="getter-autoscalerange">**autoscaleRange**</span><br><code>[number, number] &#124; undefined</code> | What the sources visible in the settled blocks span, under the autoscale mode (`wiggleAutoscaleRange`). `undefined` until the view and the data are ready, which is not the `[0, 1]` a caller falls back to — see `visibleStats`. |
| <span id="getter-valuesinview">**valuesInView**</span><br><code>[number, number] &#124; undefined</code> | The least and greatest value the visible sources draw, unfenced. |
| <span id="getter-numsources">**numSources**</span><br><code>number</code> |  |
| <span id="getter-rowsheight">**rowsHeight**</span><br><code>number</code> | The height under `rowsTopOffset` the rows, or the one plot, fill. |
| <span id="getter-scorerampreplacesaxis">**scoreRampReplacesAxis**</span><br><code>boolean</code> | A density row has no y scale, so under the one ramp the ramp is the key and shows the domain; bars and points keep their axis beside it. |
| <span id="getter-effectiverowheight">**effectiveRowHeight**</span><br><code>number</code> | Resolved per-row height. This display is always fit-to-display-height — its rows declare no `step`, so there is no pinned height to resolve — but it uses the same name every row display exposes its resolved height under (see agent-docs/reference/ROW_HEIGHT_AND_FIT), which is also what tree-sidebar's `TreeDrawingModel` reads. |
| <span id="getter-numrows">**numRows**</span><br><code>number</code> | Rows actually drawn: overlay collapses every source onto one shared plot. Read by the render state and by everything that repeats itself per row (scalebars, cross hatches), so they can't disagree about how many rows exist. |
| <span id="getter-plotgeometry">**plotGeometry**</span><br><code>WigglePlotGeometry</code> | One row takes the scalebar-label gutter at top and bottom, so its end labels are never clipped; a stack of rows gives that up, because the axis is drawn per row and maximum density is the point. `ticks`, the render height, the on-screen canvas and the SVG clip all read this, so a tick stays on the data it labels. |
| <span id="getter-scorecolorscale">**scoreColorScale**</span><br><code>RampScale &#124; undefined</code> | The score ramp as a color scale, or undefined when there is no single ramp to describe or no domain yet. `LegendMixin`'s `colorScales` lists it, so the on-screen key and the export draw one bar. The bar is drawn from the resolved color — the same cached LUT bytes both renderers color through — so a declared ramp's key is what the track paints. |
| <span id="getter-thresholdcolorscale">**thresholdColorScale**</span><br><code>ColorScale &#124; undefined</code> | The key a threshold with declared cuts draws: one row per interval, labelled by the span it covers. A threshold cutting at the `origin` draws none, because the axis already shows where the origin is and a `< 0` / `≥ 0` key on every bigWig adds nothing a reader asked for. A heatmap has no axis, so its threshold keys the origin's cut too. |
| <span id="getter-renderstate">**renderState**</span><br><code>WiggleGPURenderState</code> |  |
| <span id="getter-autoclusterready">**autoClusterReady**</span><br><code>boolean</code> | `TreeSidebarMixin`'s hook. On a log or symlog axis it also waits for the domain the matrix places scores through, which lags the data until the view settles; with no scores loaded there is none to wait for. |
| <span id="getter-drawsrowlabels">**drawsRowLabels**</span><br><code>boolean</code> | Overlay draws every source on one row, so it names none. |
| <span id="getter-sidebarpanel">**sidebarPanel**</span><br><code>SvgSidebarProps</code> | The dendrogram and row labels at the display's left, which the axis sits past on screen and the export parks left of the figure. |
| <span id="getter-valuescales">**valueScales**</span><br><code>ValueScale[]</code> | The one scale every row shares, ruling a band per row stacked down the track, past the dendrogram where one is shown. Density rows, one color per row, map the scale to color rather than to y, so they rule no band and the chrome captions the domain instead; under the one ramp the ramp is the key and shows the domain itself. |
| <span id="getter-svgsidebar">**svgSidebar**</span><br><code>SvgSidebarProps</code> |  |
| <span id="getter-colorscales">**colorScales**</span><br><code>ColorScale[]</code> | `LegendMixin`'s hook: the score ramp or threshold key, then the row color key, except in a shared panel painting the score gradient, where no row color shows. |

<details class="inherited-members" data-pagefind-ignore>
<summary>171 inherited getters from 14 models</summary>

From [TreeSidebarMixin](../treesidebarmixin): <span id="getter-showtree">[`showTree`](../treesidebarmixin#getter-showtree)</span>, <span id="getter-showbranchlength">[`showBranchLength`](../treesidebarmixin#getter-showbranchlength)</span>, <span id="getter-showrowlabels">[`showRowLabels`](../treesidebarmixin#getter-showrowlabels)</span>, <span id="getter-treeareawidth">[`treeAreaWidth`](../treesidebarmixin#getter-treeareawidth)</span>, <span id="getter-baserowcolorchannel">[`baseRowColorChannel`](../treesidebarmixin#getter-baserowcolorchannel)</span>, <span id="getter-rowsort">[`rowSort`](../treesidebarmixin#getter-rowsort)</span>, <span id="getter-rowlabels">[`rowLabels`](../treesidebarmixin#getter-rowlabels)</span>, <span id="getter-storedrowtree">[`storedRowTree`](../treesidebarmixin#getter-storedrowtree)</span>, <span id="getter-rowtreeprovenance">[`rowTreeProvenance`](../treesidebarmixin#getter-rowtreeprovenance)</span>, <span id="getter-rowfocus">[`rowFocus`](../treesidebarmixin#getter-rowfocus)</span>, <span id="getter-rowfilter">[`rowFilter`](../treesidebarmixin#getter-rowfilter)</span>, <span id="getter-rowcolorchannel">[`rowColorChannel`](../treesidebarmixin#getter-rowcolorchannel)</span>, <span id="getter-rowcolorpins">[`rowColorPins`](../treesidebarmixin#getter-rowcolorpins)</span>, <span id="getter-guidetreenewick">[`guideTreeNewick`](../treesidebarmixin#getter-guidetreenewick)</span>, <span id="getter-finerrows">[`finerRows`](../treesidebarmixin#getter-finerrows)</span>, <span id="getter-unlistedrowssort">[`unlistedRowsSort`](../treesidebarmixin#getter-unlistedrowssort)</span>, <span id="getter-rowbanding">[`rowBanding`](../treesidebarmixin#getter-rowbanding)</span>, <span id="getter-rowsheaderheight">[`rowsHeaderHeight`](../treesidebarmixin#getter-rowsheaderheight)</span>, <span id="getter-baserowcolorsetting">[`baseRowColorSetting`](../treesidebarmixin#getter-baserowcolorsetting)</span>, <span id="getter-finertreehint">[`finerTreeHint`](../treesidebarmixin#getter-finertreehint)</span>, <span id="getter-expandedrows">[`expandedRows`](../treesidebarmixin#getter-expandedrows)</span>, <span id="getter-guidetree">[`guideTree`](../treesidebarmixin#getter-guidetree)</span>, <span id="getter-rowpalettedeals">[`rowPaletteDeals`](../treesidebarmixin#getter-rowpalettedeals)</span>, <span id="getter-rowcolorsetting">[`rowColorSetting`](../treesidebarmixin#getter-rowcolorsetting)</span>, <span id="getter-rowalias">[`rowAlias`](../treesidebarmixin#getter-rowalias)</span>, <span id="getter-rowforks">[`rowForks`](../treesidebarmixin#getter-rowforks)</span>, <span id="getter-guidetreehonoursdomain">[`guideTreeHonoursDomain`](../treesidebarmixin#getter-guidetreehonoursdomain)</span>, <span id="getter-rowcolordealrows">[`rowColorDealRows`](../treesidebarmixin#getter-rowcolordealrows)</span>, <span id="getter-rowcolorfield">[`rowColorField`](../treesidebarmixin#getter-rowcolorfield)</span>, <span id="getter-rownarrowing">[`rowNarrowing`](../treesidebarmixin#getter-rownarrowing)</span>, <span id="getter-rowtree">[`rowTree`](../treesidebarmixin#getter-rowtree)</span>, <span id="getter-parsedtree">[`parsedTree`](../treesidebarmixin#getter-parsedtree)</span>, <span id="getter-roworder">[`rowOrder`](../treesidebarmixin#getter-roworder)</span>, <span id="getter-dealtvaluecolors">[`dealtValueColors`](../treesidebarmixin#getter-dealtvaluecolors)</span>, <span id="getter-resolvedrowcolors">[`resolvedRowColors`](../treesidebarmixin#getter-resolvedrowcolors)</span>, <span id="getter-editablesources">[`editableSources`](../treesidebarmixin#getter-editablesources)</span>, <span id="getter-rowcolorkeyinputs">[`rowColorKeyInputs`](../treesidebarmixin#getter-rowcolorkeyinputs)</span>, <span id="getter-clusterablesources">[`clusterableSources`](../treesidebarmixin#getter-clusterablesources)</span>, <span id="getter-rowcolorscales">[`rowColorScales`](../treesidebarmixin#getter-rowcolorscales)</span>, <span id="getter-bandedrows">[`bandedRows`](../treesidebarmixin#getter-bandedrows)</span>, <span id="getter-bandedsources">[`bandedSources`](../treesidebarmixin#getter-bandedsources)</span>, <span id="getter-rowbands">[`rowBands`](../treesidebarmixin#getter-rowbands)</span>, <span id="getter-sources">[`sources`](../treesidebarmixin#getter-sources)</span>, <span id="getter-rownarrowingshows">[`rowNarrowingShows`](../treesidebarmixin#getter-rownarrowingshows)</span>, <span id="getter-rowfocuslineheight">[`rowFocusLineHeight`](../treesidebarmixin#getter-rowfocuslineheight)</span>, <span id="getter-rowstopoffset">[`rowsTopOffset`](../treesidebarmixin#getter-rowstopoffset)</span>, <span id="getter-internalrowfields">[`internalRowFields`](../treesidebarmixin#getter-internalrowfields)</span>, <span id="getter-rowcolorfields">[`rowColorFields`](../treesidebarmixin#getter-rowcolorfields)</span>, <span id="getter-baserowfilter">[`baseRowFilter`](../treesidebarmixin#getter-baserowfilter)</span>, <span id="getter-rowbandingnotices">[`rowBandingNotices`](../treesidebarmixin#getter-rowbandingnotices)</span>, <span id="getter-rowcoloriscustom">[`rowColorIsCustom`](../treesidebarmixin#getter-rowcoloriscustom)</span>, <span id="getter-rowcolorchoice">[`rowColorChoice`](../treesidebarmixin#getter-rowcolorchoice)</span>, <span id="getter-rowcolorfieldsoffered">[`rowColorFieldsOffered`](../treesidebarmixin#getter-rowcolorfieldsoffered)</span>, <span id="getter-rowarrangementiscustom">[`rowArrangementIsCustom`](../treesidebarmixin#getter-rowarrangementiscustom)</span>, <span id="getter-rotatablerowtree">[`rotatableRowTree`](../treesidebarmixin#getter-rotatablerowtree)</span>, <span id="getter-root">[`root`](../treesidebarmixin#getter-root)</span>, <span id="getter-treeroot">[`treeRoot`](../treesidebarmixin#getter-treeroot)</span>, <span id="getter-rowscontentheight">[`rowsContentHeight`](../treesidebarmixin#getter-rowscontentheight)</span>, <span id="getter-hierarchy">[`hierarchy`](../treesidebarmixin#getter-hierarchy)</span>, <span id="getter-sidebarbounds">[`sidebarBounds`](../treesidebarmixin#getter-sidebarbounds)</span>, <span id="getter-awaitingdependentdata">[`awaitingDependentData`](../treesidebarmixin#getter-awaitingdependentdata)</span>, <span id="getter-spatialindex">[`spatialIndex`](../treesidebarmixin#getter-spatialindex)</span>, <span id="getter-clusterpartition">[`clusterPartition`](../treesidebarmixin#getter-clusterpartition)</span>, <span id="getter-treelessbandcount">[`treelessBandCount`](../treesidebarmixin#getter-treelessbandcount)</span>, <span id="getter-rownarrowingclears">[`rowNarrowingClears`](../treesidebarmixin#getter-rownarrowingclears)</span>, <span id="getter-rownarrowingnotices">[`rowNarrowingNotices`](../treesidebarmixin#getter-rownarrowingnotices)</span>, <span id="getter-rownarrowinghint">[`rowNarrowingHint`](../treesidebarmixin#getter-rownarrowinghint)</span>, <span id="getter-treeonfinerrows">[`treeOnFinerRows`](../treesidebarmixin#getter-treeonfinerrows)</span>, <span id="getter-treehasbranchlengths">[`treeHasBranchLengths`](../treesidebarmixin#getter-treehasbranchlengths)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="getter-parkedcolor">[`parkedColor`](../parkedcolormixin#getter-parkedcolor)</span>, <span id="getter-parkedidentity">[`parkedIdentity`](../parkedcolormixin#getter-parkedidentity)</span>

From [LegendMixin](../legendmixin): <span id="getter-showlegend">[`showLegend`](../legendmixin#getter-showlegend)</span>, <span id="getter-legendright">[`legendRight`](../legendmixin#getter-legendright)</span>, <span id="getter-legendtop">[`legendTop`](../legendmixin#getter-legendtop)</span>, <span id="getter-legendspec">[`legendSpec`](../legendmixin#getter-legendspec)</span>, <span id="getter-haslegendkey">[`hasLegendKey`](../legendmixin#getter-haslegendkey)</span>

From [StoredHoverMixin](../storedhovermixin): <span id="getter-hoveredfeature">[`hoveredFeature`](../storedhovermixin#getter-hoveredfeature)</span>

From [YFieldConfigMixin](../yfieldconfigmixin): <span id="getter-yfield">[`yField`](../yfieldconfigmixin#getter-yfield)</span>, <span id="getter-summaryfield">[`summaryField`](../yfieldconfigmixin#getter-summaryfield)</span>

From [WiggleScoreConfigMixin](../wigglescoreconfigmixin): <span id="getter-axisreacheszero">[`axisReachesZero`](../wigglescoreconfigmixin#getter-axisreacheszero)</span>

From [ScoreScaleMixin](../scorescalemixin): <span id="getter-scaletype">[`scaleType`](../scorescalemixin#getter-scaletype)</span>, <span id="getter-scalezero">[`scaleZero`](../scorescalemixin#getter-scalezero)</span>, <span id="getter-fencequantile">[`fenceQuantile`](../scorescalemixin#getter-fencequantile)</span>, <span id="getter-clipfencequantile">[`clipFenceQuantile`](../scorescalemixin#getter-clipfencequantile)</span>, <span id="getter-symlogconstant">[`symlogConstant`](../scorescalemixin#getter-symlogconstant)</span>, <span id="getter-domainmin">[`domainMin`](../scorescalemixin#getter-domainmin)</span>, <span id="getter-domainmax">[`domainMax`](../scorescalemixin#getter-domainmax)</span>, <span id="getter-autoscalegroup">[`autoscaleGroup`](../scorescalemixin#getter-autoscalegroup)</span>, <span id="getter-scaletitle">[`scaleTitle`](../scorescalemixin#getter-scaletitle)</span>, <span id="getter-grid">[`grid`](../scorescalemixin#getter-grid)</span>, <span id="getter-showaxis">[`showAxis`](../scorescalemixin#getter-showaxis)</span>, <span id="getter-scorerulesdrawn">[`scoreRulesDrawn`](../scorescalemixin#getter-scorerulesdrawn)</span>, <span id="getter-scorerules">[`scoreRules`](../scorescalemixin#getter-scorerules)</span>, <span id="getter-axisguide">[`axisGuide`](../scorescalemixin#getter-axisguide)</span>

From [ScoreAxisMixin](../scoreaxismixin): <span id="getter-autoscaleddomain">[`autoscaledDomain`](../scoreaxismixin#getter-autoscaleddomain)</span>, <span id="getter-resolveddomainmin">[`resolvedDomainMin`](../scoreaxismixin#getter-resolveddomainmin)</span>, <span id="getter-resolveddomainmax">[`resolvedDomainMax`](../scoreaxismixin#getter-resolveddomainmax)</span>, <span id="getter-pinsdomain">[`pinsDomain`](../scoreaxismixin#getter-pinsdomain)</span>, <span id="getter-axes">[`axes`](../scoreaxismixin#getter-axes)</span>

From [MultiRegionDisplayMixin](../multiregiondisplaymixin): <span id="getter-host">[`host`](../multiregiondisplaymixin#getter-host)</span>, <span id="getter-canvaswidthpx">[`canvasWidthPx`](../multiregiondisplaymixin#getter-canvaswidthpx)</span>, <span id="getter-settledsubpixelbinbp">[`settledSubPixelBinBp`](../multiregiondisplaymixin#getter-settledsubpixelbinbp)</span>, <span id="getter-canrender">[`canRender`](../multiregiondisplaymixin#getter-canrender)</span>, <span id="getter-renderscanvas">[`rendersCanvas`](../multiregiondisplaymixin#getter-renderscanvas)</span>, <span id="getter-trackvisibleregions">[`trackVisibleRegions`](../multiregiondisplaymixin#getter-trackvisibleregions)</span>, <span id="getter-viewportwithinloadeddata">[`viewportWithinLoadedData`](../multiregiondisplaymixin#getter-viewportwithinloadeddata)</span>, <span id="getter-viewportempty">[`viewportEmpty`](../multiregiondisplaymixin#getter-viewportempty)</span>, <span id="getter-fetchsuspended">[`fetchSuspended`](../multiregiondisplaymixin#getter-fetchsuspended)</span>, <span id="getter-layoutready">[`layoutReady`](../multiregiondisplaymixin#getter-layoutready)</span>, <span id="getter-datasuperseded">[`dataSuperseded`](../multiregiondisplaymixin#getter-datasuperseded)</span>, <span id="getter-renderblocks">[`renderBlocks`](../multiregiondisplaymixin#getter-renderblocks)</span>, <span id="getter-fetchinputs">[`fetchInputs`](../multiregiondisplaymixin#getter-fetchinputs)</span>, <span id="getter-regionpayloads">[`regionPayloads`](../multiregiondisplaymixin#getter-regionpayloads)</span>, <span id="getter-hasregiondata">[`hasRegionData`](../multiregiondisplaymixin#getter-hasregiondata)</span>, <span id="getter-stalesettingsdrawn">[`staleSettingsDrawn`](../multiregiondisplaymixin#getter-stalesettingsdrawn)</span>, <span id="getter-datacurrent">[`dataCurrent`](../multiregiondisplaymixin#getter-datacurrent)</span>, <span id="getter-loadedassembly">[`loadedAssembly`](../multiregiondisplaymixin#getter-loadedassembly)</span>, <span id="getter-phaseviewportcurrent">[`phaseViewportCurrent`](../multiregiondisplaymixin#getter-phaseviewportcurrent)</span>, <span id="getter-svgready">[`svgReady`](../multiregiondisplaymixin#getter-svgready)</span>, <span id="getter-paintinert">[`paintInert`](../multiregiondisplaymixin#getter-paintinert)</span>, <span id="getter-paintsuperseded">[`paintSuperseded`](../multiregiondisplaymixin#getter-paintsuperseded)</span>, <span id="getter-displayphase">[`displayPhase`](../multiregiondisplaymixin#getter-displayphase)</span>

From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-fetchinert">[`fetchInert`](../fetchmixin#getter-fetchinert)</span>, <span id="getter-awaitingprerequisite">[`awaitingPrerequisite`](../fetchmixin#getter-awaitingprerequisite)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="getter-painted">[`painted`](../renderlifecyclemixin#getter-painted)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="getter-gateenabled">[`gateEnabled`](../regiontoolargemixin#getter-gateenabled)</span>, <span id="getter-bytegateadapterconfig">[`byteGateAdapterConfig`](../regiontoolargemixin#getter-bytegateadapterconfig)</span>, <span id="getter-densitytoolarge">[`densityTooLarge`](../regiontoolargemixin#getter-densitytoolarge)</span>, <span id="getter-bytegateadapterpath">[`byteGateAdapterPath`](../regiontoolargemixin#getter-bytegateadapterpath)</span>, <span id="getter-adapterfetchsizelimit">[`adapterFetchSizeLimit`](../regiontoolargemixin#getter-adapterfetchsizelimit)</span>, <span id="getter-gateviewportspanbp">[`gateViewportSpanBp`](../regiontoolargemixin#getter-gateviewportspanbp)</span>, <span id="getter-gateviewport">[`gateViewport`](../regiontoolargemixin#getter-gateviewport)</span>, <span id="getter-configuredfetchsizelimit">[`configuredFetchSizeLimit`](../regiontoolargemixin#getter-configuredfetchsizelimit)</span>, <span id="getter-configforceload">[`configForceLoad`](../regiontoolargemixin#getter-configforceload)</span>, <span id="getter-aboveforceloadfloor">[`aboveForceLoadFloor`](../regiontoolargemixin#getter-aboveforceloadfloor)</span>, <span id="getter-gateexempt">[`gateExempt`](../regiontoolargemixin#getter-gateexempt)</span>, <span id="getter-estimatedfetchbytes">[`estimatedFetchBytes`](../regiontoolargemixin#getter-estimatedfetchbytes)</span>, <span id="getter-gatebytelimit">[`gateByteLimit`](../regiontoolargemixin#getter-gatebytelimit)</span>, <span id="getter-gateactive">[`gateActive`](../regiontoolargemixin#getter-gateactive)</span>, <span id="getter-gatemeasurementstale">[`gateMeasurementStale`](../regiontoolargemixin#getter-gatemeasurementstale)</span>, <span id="getter-densitygateactive">[`densityGateActive`](../regiontoolargemixin#getter-densitygateactive)</span>, <span id="getter-toolargestatus">[`tooLargeStatus`](../regiontoolargemixin#getter-toolargestatus)</span>, <span id="getter-regiontoolarge">[`regionTooLarge`](../regiontoolargemixin#getter-regiontoolarge)</span>, <span id="getter-regiontoolargereason">[`regionTooLargeReason`](../regiontoolargemixin#getter-regiontoolargereason)</span>, <span id="getter-zoomcanreleasegate">[`zoomCanReleaseGate`](../regiontoolargemixin#getter-zoomcanreleasegate)</span>, <span id="getter-gateskipsmeasuredviewport">[`gateSkipsMeasuredViewport`](../regiontoolargemixin#getter-gateskipsmeasuredviewport)</span>

From [TrackHeightMixin](../trackheightmixin): <span id="getter-configuredheight">[`configuredHeight`](../trackheightmixin#getter-configuredheight)</span>, <span id="getter-allottedheight">[`allottedHeight`](../trackheightmixin#getter-allottedheight)</span>, <span id="getter-height">[`height`](../trackheightmixin#getter-height)</span>, <span id="getter-resizing">[`resizing`](../trackheightmixin#getter-resizing)</span>, <span id="getter-scrollcontentheight">[`scrollContentHeight`](../trackheightmixin#getter-scrollcontentheight)</span>, <span id="getter-scrollviewportheight">[`scrollViewportHeight`](../trackheightmixin#getter-scrollviewportheight)</span>, <span id="getter-scrollableheight">[`scrollableHeight`](../trackheightmixin#getter-scrollableheight)</span>

From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-selectedfeatureid">[`selectedFeatureId`](../basedisplay#getter-selectedfeatureid)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-featurenoun">[`featureNoun`](../basedisplay#getter-featurenoun)</span>, <span id="getter-featurewidgettype">[`featureWidgetType`](../basedisplay#getter-featurewidgettype)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-confignotices">[`configNotices`](../basedisplay#getter-confignotices)</span>, <span id="getter-notices">[`notices`](../basedisplay#getter-notices)</span>, <span id="getter-cornernotices">[`cornerNotices`](../basedisplay#getter-cornernotices)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span>

</details>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-gpuprops">**gpuProps**</span><br><code>() =&gt; WiggleGpuProps</code> | The row list is this display's own: the encoder places each payload source by its position here, so a filter or a reorder re-uploads bytes already in hand.<br><br>The color rides here and not in `rpcProps`: the worker ships one set of score arrays and the main thread colors each instance by its side of the cut, so a new color re-encodes and refetches nothing. |
| <span id="method-rpcprops">**rpcProps**</span><br><code>() =&gt; { resolution: number; yField: string; }</code> | `y` is a fetch key as written, so picking another stored summary refetches arrays the worker already shipped; `extent` is not (WIGGLE_DISPLAY.md, "`y`, `mark.extent`"). The color settings are not among the keys: every mode partitions by sign on the main thread, so moving the pivot re-encodes and refetches nothing. |
| <span id="method-configproblemsof">**configProblemsOf**</span><br><code>(conf: AnyConfigurationModel) =&gt; string[]</code> | The schema's rules, then what the plot cannot paint as written: threshold cuts past eight, and a gradient on a line. |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |
| <span id="method-contextmenuitems">**contextMenuItems**</span><br><code>() =&gt; MenuItem[]</code> | Right-click menu, built from the column under the click. The position is captured here rather than read inside the onClick, because `closeContextMenu` runs first when an item is clicked. |

<details class="inherited-members" data-pagefind-ignore>
<summary>24 inherited methods from 6 models</summary>

From [TreeSidebarMixin](../treesidebarmixin): <span id="method-rowfoundatsomeloci">[`rowFoundAtSomeLoci`](../treesidebarmixin#method-rowfoundatsomeloci)</span>, <span id="method-rowparent">[`rowParent`](../treesidebarmixin#method-rowparent)</span>, <span id="method-expandrows">[`expandRows`](../treesidebarmixin#method-expandrows)</span>, <span id="method-rowcolordeclaredvalues">[`rowColorDeclaredValues`](../treesidebarmixin#method-rowcolordeclaredvalues)</span>, <span id="method-rowband">[`rowBand`](../treesidebarmixin#method-rowband)</span>, <span id="method-dealtvaluecolorsfor">[`dealtValueColorsFor`](../treesidebarmixin#method-dealtvaluecolorsfor)</span>, <span id="method-narrowrows">[`narrowRows`](../treesidebarmixin#method-narrowrows)</span>, <span id="method-svgsidebarwidth">[`svgSidebarWidth`](../treesidebarmixin#method-svgsidebarwidth)</span>, <span id="method-unreadfilterfieldnotice">[`unreadFilterFieldNotice`](../treesidebarmixin#method-unreadfilterfieldnotice)</span>, <span id="method-rowcolorfor">[`rowColorFor`](../treesidebarmixin#method-rowcolorfor)</span>, <span id="method-orderdropsrowtree">[`orderDropsRowTree`](../treesidebarmixin#method-orderdropsrowtree)</span>, <span id="method-roworderwilldroptree">[`rowOrderWillDropTree`](../treesidebarmixin#method-roworderwilldroptree)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="method-parkedcolorof">[`parkedColorOf`](../parkedcolormixin#method-parkedcolorof)</span>

From [LegendMixin](../legendmixin): <span id="method-colorscalesin">[`colorScalesIn`](../legendmixin#method-colorscalesin)</span>, <span id="method-legendspecin">[`legendSpecIn`](../legendmixin#method-legendspecin)</span>

From [MultiRegionDisplayMixin](../multiregiondisplaymixin): <span id="method-regionhasdata">[`regionHasData`](../multiregiondisplaymixin#method-regionhasdata)</span>, <span id="method-iscachevalid">[`isCacheValid`](../multiregiondisplaymixin#method-iscachevalid)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="method-gatefetchstate">[`gateFetchState`](../regiontoolargemixin#method-gatefetchstate)</span>, <span id="method-resolvedbytelimit">[`resolvedByteLimit`](../regiontoolargemixin#method-resolvedbytelimit)</span>

From [BaseDisplay](../basedisplay): <span id="method-renderingprops">[`renderingProps`](../basedisplay#method-renderingprops)</span>, <span id="method-exportedfeatures">[`exportedFeatures`](../basedisplay#method-exportedfeatures)</span>, <span id="method-liftplot">[`liftPlot`](../basedisplay#method-liftplot)</span>, <span id="method-plotproblems">[`plotProblems`](../basedisplay#method-plotproblems)</span>, <span id="method-plotwrites">[`plotWrites`](../basedisplay#method-plotwrites)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setrpcdata">**setRpcData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(displayedRegionIndex: number, data: WiggleDataResult, region:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(displayedRegionIndex: number, data: WiggleDataResult, region: Region) =&gt; void</code></pre></dialog></span> | Stage a region as fetched, with this mixin's payload shape — so a test stands up a loaded display in one call. Production goes through `ctx.commitRegion`. |
| <span id="action-selectfeature">**selectFeature**</span><br><code>(feat: WiggleHoveredFeature) =&gt; void</code> |  |
| <span id="action-setresolution">**setResolution**</span><br><code>(res: number) =&gt; void</code> |  |
| <span id="action-setorigin">**setOrigin**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setmark">**setMark**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(mark: "bar" &#124; "line" &#124; "point" &#124; "rect", interpolate?: "linear…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(mark: "bar" &#124; "line" &#124; "point" &#124; "rect", interpolate?: "linear" &#124; "step" &#124; undefined) =&gt; void</code></pre></dialog></span> | The plot's `mark.type`, and a line's `mark.interpolate`; any other type resets `interpolate`, which only a line reads. |
| <span id="action-sety">**setY**</span><br><code>(field: string) =&gt; void</code> | The field plotted on the value axis: a stored summary (`score`, `minScore`, `maxScore`) or any feature field. |
| <span id="action-setextent">**setExtent**</span><br><code>(val: "min-max" &#124; "none") =&gt; void</code> |  |
| <span id="action-setpointsize">**setPointSize**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setstrokewidth">**setStrokeWidth**</span><br><code>(val?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-setrowlayout">**setRowLayout**</span><br><code>(on: boolean) =&gt; void</code> | The layout half of a Plot type leaf — `Multi-row` or `Overlapping`, each holding the five plot names. Writes the field alone, so the arrangement survives a trip through the shared plot and comes back with the rows. |
| <span id="action-startrenderingbackend">**startRenderingBackend**</span><br><code>(backend: WiggleRenderingBackend) =&gt; void</code> |  |
| <span id="action-setshowrowseparators">**setShowRowSeparators**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setplot">**setPlot**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>({ mark, rowLayout, }: { mark: WiggleMarkObject; rowLayout: boo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>({ mark, rowLayout, }: { mark: WiggleMarkObject; rowLayout: boolean; }) =&gt; void</code></pre></dialog></span> | A Plot type leaf whole: `setMark` then `setRowLayout` in one action, so the regions encode once and never as the new plot in the old layout. |
| <span id="action-openplotdialog">**openPlotDialog**</span><br><code>(seed?: Plot &#124; undefined) =&gt; void</code> | The arrangement dialog's "Edit plot..." button: the color object and the rows beside it as text, the escape for a ramp, several cut points or a typed row order, none of which the dialog's own controls offer. |
| <span id="action-sortrowsbyscoreat">**sortRowsByScoreAt**</span><br><code>(refName: string, pos: number) =&gt; boolean</code> | Rank the rows by each source's score at one genomic base. Reads the region data already in hand — no refetch, no RPC — and writes the order through `rows.sort`, the same channel clustering and the arrangement dialog write, so "Reset row order" undoes all three.<br><br>Named by coordinate rather than by loaded-region index because both entry points are: the right-click hit resolves to one, and a session's `sortRowsBy` holds one across a reload. Resolving that region and refusing the two cases where a sort would only cost a `rows.sort` write are `sortRowsAtColumn`'s, shared with the multi-row feature display's twin, and so is the returned "did it sort" the declarative entry point reads to decide whether to keep its trigger for a later fetch. |
| <span id="action-fetchneeded">**fetchNeeded**</span><br><code>(needed: IndexedRegion[]) =&gt; Promise&lt;void&gt;</code> |  |
| <span id="action-rendersvg">**renderSvg**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(opts?: ExportSvgDisplayOptions &#124; undefined) =&gt; Promise&lt;ReactEl…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(opts?: ExportSvgDisplayOptions &#124; undefined) =&gt; Promise&lt;ReactElement&lt;unknown, string &#124; JSXElementConstructor&lt;any&gt;&gt; &#124; Iterable&lt;ReactNode&gt; &#124; AwaitedReactNode&gt;</code></pre></dialog></span> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>75 inherited actions from 12 models</summary>

From [ContextMenuMixin](../contextmenumixin): <span id="action-opencontextmenu">[`openContextMenu`](../contextmenumixin#action-opencontextmenu)</span>, <span id="action-closecontextmenu">[`closeContextMenu`](../contextmenumixin#action-closecontextmenu)</span>

From [TreeSidebarMixin](../treesidebarmixin): <span id="action-setshowtree">[`setShowTree`](../treesidebarmixin#action-setshowtree)</span>, <span id="action-setshowbranchlength">[`setShowBranchLength`](../treesidebarmixin#action-setshowbranchlength)</span>, <span id="action-setshowrowlabels">[`setShowRowLabels`](../treesidebarmixin#action-setshowrowlabels)</span>, <span id="action-settreeareawidth">[`setTreeAreaWidth`](../treesidebarmixin#action-settreeareawidth)</span>, <span id="action-setrunclustering">[`setRunClustering`](../treesidebarmixin#action-setrunclustering)</span>, <span id="action-setclusterregion">[`setClusterRegion`](../treesidebarmixin#action-setclusterregion)</span>, <span id="action-setsortrowsby">[`setSortRowsBy`](../treesidebarmixin#action-setsortrowsby)</span>, <span id="action-sethoveredtreenode">[`setHoveredTreeNode`](../treesidebarmixin#action-sethoveredtreenode)</span>, <span id="action-settreecanvasref">[`setTreeCanvasRef`](../treesidebarmixin#action-settreecanvasref)</span>, <span id="action-setmouseovercanvasref">[`setMouseoverCanvasRef`](../treesidebarmixin#action-setmouseovercanvasref)</span>, <span id="action-setroworder">[`setRowOrder`](../treesidebarmixin#action-setroworder)</span>, <span id="action-setrowlabels">[`setRowLabels`](../treesidebarmixin#action-setrowlabels)</span>, <span id="action-setrowfocus">[`setRowFocus`](../treesidebarmixin#action-setrowfocus)</span>, <span id="action-showallrows">[`showAllRows`](../treesidebarmixin#action-showallrows)</span>, <span id="action-applyrowedits">[`applyRowEdits`](../treesidebarmixin#action-applyrowedits)</span>, <span id="action-resetrowarrangement">[`resetRowArrangement`](../treesidebarmixin#action-resetrowarrangement)</span>, <span id="action-setrowcolorchoice">[`setRowColorChoice`](../treesidebarmixin#action-setrowcolorchoice)</span>, <span id="action-focuslegendentry">[`focusLegendEntry`](../treesidebarmixin#action-focuslegendentry)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="action-parkcolor">[`parkColor`](../parkedcolormixin#action-parkcolor)</span>

From [LegendMixin](../legendmixin): <span id="action-setshowlegend">[`setShowLegend`](../legendmixin#action-setshowlegend)</span>, <span id="action-dismisslegendsection">[`dismissLegendSection`](../legendmixin#action-dismisslegendsection)</span>

From [StoredHoverMixin](../storedhovermixin): <span id="action-sethoveredfeature">[`setHoveredFeature`](../storedhovermixin#action-sethoveredfeature)</span>, <span id="action-clearhoveredfeature">[`clearHoveredFeature`](../storedhovermixin#action-clearhoveredfeature)</span>

From [ScoreScaleMixin](../scorescalemixin): <span id="action-setscaletype">[`setScaleType`](../scorescalemixin#action-setscaletype)</span>, <span id="action-setscalezero">[`setScaleZero`](../scorescalemixin#action-setscalezero)</span>, <span id="action-setfencequantile">[`setFenceQuantile`](../scorescalemixin#action-setfencequantile)</span>, <span id="action-setdomainmin">[`setDomainMin`](../scorescalemixin#action-setdomainmin)</span>, <span id="action-setdomainmax">[`setDomainMax`](../scorescalemixin#action-setdomainmax)</span>, <span id="action-setminscore">[`setMinScore`](../scorescalemixin#action-setminscore)</span>, <span id="action-setmaxscore">[`setMaxScore`](../scorescalemixin#action-setmaxscore)</span>, <span id="action-setautoscalegroup">[`setAutoscaleGroup`](../scorescalemixin#action-setautoscalegroup)</span>, <span id="action-setgrid">[`setGrid`](../scorescalemixin#action-setgrid)</span>, <span id="action-setscorerules">[`setScoreRules`](../scorescalemixin#action-setscorerules)</span>, <span id="action-resetyscale">[`resetYScale`](../scorescalemixin#action-resetyscale)</span>

From [MultiRegionDisplayMixin](../multiregiondisplaymixin): <span id="action-setloadedregion">[`setLoadedRegion`](../multiregiondisplaymixin#action-setloadedregion)</span>, <span id="action-evictregionstore">[`evictRegionStore`](../multiregiondisplaymixin#action-evictregionstore)</span>, <span id="action-droploadedregion">[`dropLoadedRegion`](../multiregiondisplaymixin#action-droploadedregion)</span>, <span id="action-cleardisplayspecificdata">[`clearDisplaySpecificData`](../multiregiondisplaymixin#action-cleardisplayspecificdata)</span>, <span id="action-clearsettingsbakeddata">[`clearSettingsBakedData`](../multiregiondisplaymixin#action-clearsettingsbakeddata)</span>, <span id="action-clearallrpcdata">[`clearAllRpcData`](../multiregiondisplaymixin#action-clearallrpcdata)</span>, <span id="action-invalidatesettings">[`invalidateSettings`](../multiregiondisplaymixin#action-invalidatesettings)</span>, <span id="action-reload">[`reload`](../multiregiondisplaymixin#action-reload)</span>, <span id="action-fetchregions">[`fetchRegions`](../multiregiondisplaymixin#action-fetchregions)</span>, <span id="action-afterattach">[`afterAttach`](../multiregiondisplaymixin#action-afterattach)</span>

From [FetchMixin](../fetchmixin): <span id="action-seterror">[`setError`](../fetchmixin#action-seterror)</span>, <span id="action-setstatusmessage">[`setStatusMessage`](../fetchmixin#action-setstatusmessage)</span>, <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span>

From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="action-markcanvasdrawn">[`markCanvasDrawn`](../renderlifecyclemixin#action-markcanvasdrawn)</span>, <span id="action-resetcanvasdrawn">[`resetCanvasDrawn`](../renderlifecyclemixin#action-resetcanvasdrawn)</span>, <span id="action-stoprenderingbackend">[`stopRenderingBackend`](../renderlifecyclemixin#action-stoprenderingbackend)</span>, <span id="action-rendernow">[`renderNow`](../renderlifecyclemixin#action-rendernow)</span>, <span id="action-setoffscreen">[`setOffScreen`](../renderlifecyclemixin#action-setoffscreen)</span>, <span id="action-setrendererror">[`setRenderError`](../renderlifecyclemixin#action-setrendererror)</span>, <span id="action-attachrenderingbackend">[`attachRenderingBackend`](../renderlifecyclemixin#action-attachrenderingbackend)</span>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="action-clearbyteestimate">[`clearByteEstimate`](../regiontoolargemixin#action-clearbyteestimate)</span>, <span id="action-cleargatemeasurements">[`clearGateMeasurements`](../regiontoolargemixin#action-cleargatemeasurements)</span>, <span id="action-setforceloadtrack">[`setForceLoadTrack`](../regiontoolargemixin#action-setforceloadtrack)</span>, <span id="action-commitfetchbytes">[`commitFetchBytes`](../regiontoolargemixin#action-commitfetchbytes)</span>, <span id="action-forceload">[`forceLoad`](../regiontoolargemixin#action-forceload)</span>

From [TrackHeightMixin](../trackheightmixin): <span id="action-setscrolltop">[`setScrollTop`](../trackheightmixin#action-setscrolltop)</span>, <span id="action-sethostheight">[`setHostHeight`](../trackheightmixin#action-sethostheight)</span>, <span id="action-setheight">[`setHeight`](../trackheightmixin#action-setheight)</span>, <span id="action-resizeheight">[`resizeHeight`](../trackheightmixin#action-resizeheight)</span>, <span id="action-expandtocontentheight">[`expandToContentHeight`](../trackheightmixin#action-expandtocontentheight)</span>

From [BaseDisplay](../basedisplay): <span id="action-applydisplaysettings">[`applyDisplaySettings`](../basedisplay#action-applydisplaysettings)</span>, <span id="action-applyplot">[`applyPlot`](../basedisplay#action-applyplot)</span>

</details>
