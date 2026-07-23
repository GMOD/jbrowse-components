---
id: linearmafdisplay
title: LinearMafDisplay
sidebar_label: Display -> LinearMafDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`maf` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/stateModel.ts).

## Example usage

A complete `MafTrack` config to paste into `tracks`. `samples` lists the aligned
species in track order; `rowHeight` sets the per-sample band height in px (or
`0` to stretch rows to fill the track height):

```js
{
  type: 'MafTrack',
  trackId: 'multiz',
  name: 'Multiz alignment',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigMafAdapter',
    bigBedLocation: { uri: 'https://example.com/multiz.bb' },
    samples: ['hg38', 'panTro4', 'mm10'],
  },
  displays: [
    {
      type: 'LinearMafDisplay',
      displayId: 'multiz-LinearMafDisplay',
      rowHeight: 16,
      showCoverage: true,
    },
  ],
}
```

## Overview

## Members

| Member                                                                 | Kind       | Defined by                                            | Description                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------- | ---------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                                 | Properties | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [configuration](#property-configuration)                               | Properties | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [rpcDataMap](#volatile-rpcdatamap)                                     | Volatiles  | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [summaryDataMap](#volatile-summarydatamap)                             | Volatiles  | LinearMafDisplay                                      | Per-region `bigMafSummary` rows for the zoom-out path, populated by `fetchMafSummaryData` only while `showSummary` is active.                                                                                                                                                     |
| [framesDataMap](#volatile-framesdatamap)                               | Volatiles  | LinearMafDisplay                                      | Per-region CDS frame rows (UCSC `mafFrames`) for the annotation overlay, populated by the frames RPC in parallel with the main fetch.                                                                                                                                             |
| [prefersOffset](#volatile-prefersoffset)                               | Volatiles  | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [sourcesVolatile](#volatile-sourcesvolatile)                           | Volatiles  | LinearMafDisplay                                      | The worker's authoritative row set, in tree (leaf) order.                                                                                                                                                                                                                         |
| [treeNewickVolatile](#volatile-treenewickvolatile)                     | Volatiles  | LinearMafDisplay                                      | The worker's guide-tree Newick (the default, before any reorder).                                                                                                                                                                                                                 |
| [resizing](#volatile-resizing)                                         | Volatiles  | LinearMafDisplay                                      | True during an active height drag.                                                                                                                                                                                                                                                |
| [resizeSettleTimer](#volatile-resizesettletimer)                       | Volatiles  | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [rowHeight](#getter-rowheight)                                         | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [rowProportion](#getter-rowproportion)                                 | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [showAllLetters](#getter-showallletters)                               | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [mismatchRendering](#getter-mismatchrendering)                         | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [showAsUpperCase](#getter-showasuppercase)                             | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [showTree](#getter-showtree)                                           | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [showBranchLength](#getter-showbranchlength)                           | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [showCoverage](#getter-showcoverage)                                   | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [showAlignments](#getter-showalignments)                               | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [coverageHeight](#getter-coverageheight)                               | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [showConservation](#getter-showconservation)                           | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [conservationHeight](#getter-conservationheight)                       | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [conservationMode](#getter-conservationmode)                           | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [rowIdentityMode](#getter-rowidentitymode)                             | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [rowIdentityAutoZoom](#getter-rowidentityautozoom)                     | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [showAnnotations](#getter-showannotations)                             | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [showTranslation](#getter-showtranslation)                             | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [colorByChromosome](#getter-colorbychromosome)                         | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [showInversions](#getter-showinversions)                               | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [conf](#getter-conf)                                                   | Getters    | LinearMafDisplay                                      | the config typed off the concrete schema; `ConfigurationReference` erases `self.configuration` to `any`, so direct reads route through this to stay typed (same move as `BaseAdapter<CONF>`)                                                                                      |
| [lgv](#getter-lgv)                                                     | Getters    | LinearMafDisplay                                      | The containing LGV, typed once here so views/actions don't each repeat the `getContainingView(self) as LinearGenomeViewModel` cast.                                                                                                                                               |
| [annotationAdapterConfig](#getter-annotationadapterconfig)             | Getters    | LinearMafDisplay                                      | The configured CDS-frame annotation adapter snapshot (UCSC `mafFrames`), or undefined when unset.                                                                                                                                                                                 |
| [annotationsActive](#getter-annotationsactive)                         | Getters    | LinearMafDisplay                                      | Whether the per-species CDS frame _strip_ should draw: an annotation adapter is configured and the "Show CDS frames" toggle is on.                                                                                                                                                |
| [annotationDataActive](#getter-annotationdataactive)                   | Getters    | LinearMafDisplay                                      | Whether the frames data needs to be fetched: an annotation adapter is configured and either the strip or the codon view wants it.                                                                                                                                                 |
| [editableSources](#getter-editablesources)                             | Getters    | LinearMafDisplay                                      | The full row set with the user's arrangement applied: `layout` supplies order + label/color overrides, merged over the worker's `sourcesVolatile` by name.                                                                                                                        |
| [sources](#getter-sources)                                             | Getters    | LinearMafDisplay                                      | The display rows: `editableSources` narrowed to the selected subtree.                                                                                                                                                                                                             |
| [samples](#getter-samples)                                             | Getters    | LinearMafDisplay                                      | Sample list keyed by sample id (alias of `sources` mapped to the project's canonical `{ id, label, color }` shape).                                                                                                                                                               |
| [orderedSampleIds](#getter-orderedsampleids)                           | Getters    | LinearMafDisplay                                      | Display row order shipped to the worker so its block `rowIndex` matches the on-screen row.                                                                                                                                                                                        |
| [rowIndexBySrc](#getter-rowindexbysrc)                                 | Getters    | LinearMafDisplay                                      | Maps a `src` (species) to its display row index.                                                                                                                                                                                                                                  |
| [defaultCodonSpecies](#getter-defaultcodonspecies)                     | Getters    | LinearMafDisplay                                      | The anchor species whose `mafFrames` reading frame is used to translate every row (UCSC `codonDefault`).                                                                                                                                                                          |
| [coverageDisplayHeight](#getter-coveragedisplayheight)                 | Getters    | LinearMafDisplay                                      | Height of the coverage band above the rows (0 when hidden).                                                                                                                                                                                                                       |
| [conservationDisplayHeight](#getter-conservationdisplayheight)         | Getters    | LinearMafDisplay                                      | Height of the conservation (percent identity) band (0 when hidden).                                                                                                                                                                                                               |
| [rowsTopOffset](#getter-rowstopoffset)                                 | Getters    | LinearMafDisplay                                      | Top offset of the per-sample rows area = the stacked band heights above it (coverage + conservation).                                                                                                                                                                             |
| [nrow](#getter-nrow)                                                   | Getters    | LinearMafDisplay                                      | Number of displayed rows (at least 1, so the fit-mode division is safe).                                                                                                                                                                                                          |
| [maxRowsHeight](#getter-maxrowsheight)                                 | Getters    | LinearMafDisplay                                      | Max CSS-px height the rows canvas may take before its backing store (`× dpr`) hits the browser/GPU canvas limit.                                                                                                                                                                  |
| [fitTargetHeight](#getter-fittargetheight)                             | Getters    | LinearMafDisplay                                      | The track height that fit-to-height mode divides among rows.                                                                                                                                                                                                                      |
| [autoRowHeight](#getter-autorowheight)                                 | Getters    | LinearMafDisplay                                      | Per-row height in fit-to-height mode: the rows area (track height minus the fixed bands) split evenly across rows.                                                                                                                                                                |
| [effectiveRowHeight](#getter-effectiverowheight)                       | Getters    | LinearMafDisplay                                      | Resolved per-row height.                                                                                                                                                                                                                                                          |
| [rowsHeight](#getter-rowsheight)                                       | Getters    | LinearMafDisplay                                      | Height of the per-sample rows area (excludes the coverage band).                                                                                                                                                                                                                  |
| [totalHeight](#getter-totalheight)                                     | Getters    | LinearMafDisplay                                      | Full display height = rows area + stacked bands.                                                                                                                                                                                                                                  |
| [height](#getter-height)                                               | Getters    | LinearMafDisplay                                      | Override BaseLinearDisplay.height so the track container matches the rendering canvas height exactly (coverage band + rows × rowHeight).                                                                                                                                          |
| [hierarchy](#getter-hierarchy)                                         | Getters    | LinearMafDisplay                                      | Positioned tree hierarchy.                                                                                                                                                                                                                                                        |
| [spatialIndex](#getter-spatialindex)                                   | Getters    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [colorPalette](#getter-colorpalette)                                   | Getters    | LinearMafDisplay                                      | Theme-derived color palette (per-base colors + match/gap/mismatch/ unknown/insertion), read by `gpuProps()` and `renderState`.                                                                                                                                                    |
| [renderState](#getter-renderstate)                                     | Getters    | LinearMafDisplay                                      | Render state passed to GPU/Canvas2D backend each frame.                                                                                                                                                                                                                           |
| [coverageStats](#getter-coveragestats)                                 | Getters    | LinearMafDisplay                                      | Per-position depth stats across the currently visible content blocks, derived from the worker-shipped `coverage.coverageDepths` arrays (which already reflect the active subtree — see `rpcProps`).                                                                               |
| [coverageDomain](#getter-coveragedomain)                               | Getters    | LinearMafDisplay                                      | [min, max] coverage domain for the visible blocks.                                                                                                                                                                                                                                |
| [coverageTicks](#getter-coverageticks)                                 | Getters    | LinearMafDisplay                                      | Y-axis tick marks for the coverage band.                                                                                                                                                                                                                                          |
| [visibleEmptyLines](#getter-visibleemptylines)                         | Getters    | LinearMafDisplay                                      | Positioned bridge-line segments for `e`-line (empty/bridged) rows.                                                                                                                                                                                                                |
| [visibleInsertions](#getter-visibleinsertions)                         | Getters    | LinearMafDisplay                                      | Positioned insertion markers (interbase) for the visible aligned rows.                                                                                                                                                                                                            |
| [visibleDeletions](#getter-visibledeletions)                           | Getters    | LinearMafDisplay                                      | Positioned deletion runs for the visible aligned rows; the overlay draws the deleted-base count inside each run when it fits.                                                                                                                                                     |
| [visibleInversions](#getter-visibleinversions)                         | Getters    | LinearMafDisplay                                      | Positioned strand-flip (inversion) markers for the visible aligned rows.                                                                                                                                                                                                          |
| [showSummary](#getter-showsummary)                                     | Getters    | LinearMafDisplay                                      | Use the cheap summary path when a `bigMafSummary` sub-adapter is configured and the view is zoomed out past the force-load threshold — exactly where the full alignment fetch would be blocked by the byte gate.                                                                  |
| [zoomedToBaseLevel](#getter-zoomedtobaselevel)                         | Getters    | LinearMafDisplay                                      | At base level each reference base spans at least a pixel, so individual bases / SNP marks are legible (UCSC's `zoomedToBaseLevel`).                                                                                                                                               |
| [codonViewActive](#getter-codonviewactive)                             | Getters    | LinearMafDisplay                                      | The codon view is on: the toggle is set, frame data is available to define the reading frame, and we're zoomed to base level (so codons are meaningful) and not in the cheap summary path.                                                                                        |
| [activeRowRendering](#getter-activerowrendering)                       | Getters    | LinearMafDisplay                                      | Single source of truth for what the per-sample rows area draws right now: `bases` (the GPU SNP/base coloring), `codon` (per-codon change coloring from `mafFrames`), `sourceChrom` (color-by-source-chromosome SV mode), or a per-row identity style (`heatmap` / `xyplot`).      |
| [visibleLabels](#getter-visiblelabels)                                 | Getters    | LinearMafDisplay                                      | Positioned per-base SNP/sequence letters.                                                                                                                                                                                                                                         |
| [visibleSummaryBars](#getter-visiblesummarybars)                       | Getters    | LinearMafDisplay                                      | Positioned per-species presence bars for the zoom-out summary overlay.                                                                                                                                                                                                            |
| [visibleFrames](#getter-visibleframes)                                 | Getters    | LinearMafDisplay                                      | Positioned per-species CDS frame boxes for the annotation overlay.                                                                                                                                                                                                                |
| [visibleCodons](#getter-visiblecodons)                                 | Getters    | LinearMafDisplay                                      | Per-species codon cells for the codon view (the per-codon change coloring that replaces the SNP cells).                                                                                                                                                                           |
| [visibleCodonConservation](#getter-visiblecodonconservation)           | Getters    | LinearMafDisplay                                      | Per-codon amino-acid conservation bars for the conservation band's codon mode.                                                                                                                                                                                                    |
| [sourceChromLegend](#getter-sourcechromlegend)                         | Getters    | LinearMafDisplay                                      | Rank-based legend for the color-by-source-chromosome mode: one entry per source-chromosome rank actually present across the visible rows (rank 0 = each species' main chromosome, higher ranks = the minority chromosomes a row switches to at a rearrangement).                  |
| [msaHighlights](#getter-msahighlights)                                 | Getters    | LinearMafDisplay                                      | Get highlight regions from connected MSA views                                                                                                                                                                                                                                    |
| [gpuProps](#method-gpuprops)                                           | Methods    | LinearMafDisplay                                      | Inputs to the main-thread GPU instance encoder.                                                                                                                                                                                                                                   |
| [rpcProps](#method-rpcprops)                                           | Methods    | LinearMafDisplay                                      | Worker-fetch inputs that invalidate cached data when changed (tier-1, via MultiRegionDisplayMixin's `SettingsInvalidate` autorun → refetch).                                                                                                                                      |
| [rowHoverInfo](#method-rowhoverinfo)                                   | Methods    | LinearMafDisplay                                      | Resolve a hover hit on `rowIndex` at absolute genomic `bp` (uint32, per worker-output convention): an aligned base (`cell`) or a bridged/empty region (`empty`), each tagged with the sample label.                                                                               |
| [frameHoverInfo](#method-framehoverinfo)                               | Methods    | LinearMafDisplay                                      | The CDS frame record covering absolute genomic `bp` (uint32) on display `rowIndex`, or undefined when no frame overlaps there (or no frames data is loaded).                                                                                                                      |
| [coverageTooltipBin](#method-coveragetooltipbin)                       | Methods    | LinearMafDisplay                                      | Build a per-position coverage tooltip bin (depth + SNP base counts) for the given absolute genomic bp + region index.                                                                                                                                                             |
| [coverageInsertionHit](#method-coverageinsertionhit)                   | Methods    | LinearMafDisplay                                      | Hit-test an insertion bar in the coverage band at fractional genomic `gposFrac`.                                                                                                                                                                                                  |
| [codonHoverInfo](#method-codonhoverinfo)                               | Methods    | LinearMafDisplay                                      | The codon under the cursor on display `rowIndex` at absolute genomic `bp`, when the codon view is the active rendering: the species' codon + amino acid, the reference codon + amino acid, and the syn/nonsyn/stop classification.                                                |
| [trackMenuItems](#method-trackmenuitems)                               | Methods    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setRowHeight](#action-setrowheight)                                   | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setResizing](#action-setresizing)                                     | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setRowProportion](#action-setrowproportion)                           | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setShowAllLetters](#action-setshowallletters)                         | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setMismatchRendering](#action-setmismatchrendering)                   | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setSamples](#action-setsamples)                                       | Actions    | LinearMafDisplay                                      | Receive worker-authoritative `samples` + serialized Newick tree.                                                                                                                                                                                                                  |
| [setShowAsUpperCase](#action-setshowasuppercase)                       | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setShowTree](#action-setshowtree)                                     | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setShowBranchLength](#action-setshowbranchlength)                     | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setShowCoverage](#action-setshowcoverage)                             | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setShowAlignments](#action-setshowalignments)                         | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setCoverageHeight](#action-setcoverageheight)                         | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setShowConservation](#action-setshowconservation)                     | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setConservationMode](#action-setconservationmode)                     | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setRowIdentityMode](#action-setrowidentitymode)                       | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setRowIdentityAutoZoom](#action-setrowidentityautozoom)               | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setShowAnnotations](#action-setshowannotations)                       | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setShowTranslation](#action-setshowtranslation)                       | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setColorByChromosome](#action-setcolorbychromosome)                   | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setShowInversions](#action-setshowinversions)                         | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setConservationHeight](#action-setconservationheight)                 | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [clearLayout](#action-clearlayout)                                     | Actions    | LinearMafDisplay                                      | Drop the custom arrangement and restore the worker's guide tree (the base `clearLayout` only clears it — the worker tree lives in `treeNewickVolatile`).                                                                                                                          |
| [setFitToHeight](#action-setfittoheight)                               | Actions    | LinearMafDisplay                                      | Switch to fit-to-height mode: rows stretch to fill the track height.                                                                                                                                                                                                              |
| [resizeHeight](#action-resizeheight)                                   | Actions    | LinearMafDisplay                                      | Drag-resize.                                                                                                                                                                                                                                                                      |
| [setRpcData](#action-setrpcdata)                                       | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setSummaryData](#action-setsummarydata)                               | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [setFramesData](#action-setframesdata)                                 | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [clearAlignmentData](#action-clearalignmentdata)                       | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)           | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [startRenderingBackend](#action-startrenderingbackend)                 | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [fetchNeeded](#action-fetchneeded)                                     | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [isCacheValid](#action-iscachevalid)                                   | Actions    | LinearMafDisplay                                      | Force a refetch when the loaded data is the wrong kind for the current zoom: crossing the summary↔detail threshold within an already-loaded region wouldn't trip the bounds-based coverage check, so the mode is keyed on which map holds the region.                             |
| [getByteEstimateConfig](#action-getbyteestimateconfig)                 | Actions    | LinearMafDisplay                                      | Enable byte-estimate gating: above ~20kb visible, the adapter's MAF-aware byte estimate (per-species sequence × span) is checked against `fetchSizeLimit`, blocking the detail fetch with a force-load prompt rather than downloading hundreds of species' bases at genome scale. |
| [renderSvg](#action-rendersvg)                                         | Actions    | LinearMafDisplay                                      |                                                                                                                                                                                                                                                                                   |
| [id](#property-id)                                                     | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                   |
| [rpcDriverName](#property-rpcdrivername)                               | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                   |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)             | Properties | [BaseDisplay](../basedisplay)                         | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL).                                                                                                                                               |
| [error](#volatile-error)                                               | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                   |
| [statusMessage](#volatile-statusmessage)                               | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                   |
| [statusProgress](#volatile-statusprogress)                             | Volatiles  | [BaseDisplay](../basedisplay)                         | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate.                                                                                                                                                               |
| [parentTrack](#getter-parenttrack)                                     | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                   |
| [parentDisplay](#getter-parentdisplay)                                 | Getters    | [BaseDisplay](../basedisplay)                         | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                  |
| [RenderingComponent](#getter-renderingcomponent)                       | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                   |
| [DisplayBlurb](#getter-displayblurb)                                   | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                   |
| [adapterConfig](#getter-adapterconfig)                                 | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                   |
| [isMinimized](#getter-isminimized)                                     | Getters    | [BaseDisplay](../basedisplay)                         | Returns true if the parent track is minimized.                                                                                                                                                                                                                                    |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)               | Getters    | [BaseDisplay](../basedisplay)                         | Returns the effective RPC driver name with hierarchical fallback: 1.                                                                                                                                                                                                              |
| [DisplayMessageComponent](#getter-displaymessagecomponent)             | Getters    | [BaseDisplay](../basedisplay)                         | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                                                        |
| [renderingProps](#method-renderingprops)                               | Methods    | [BaseDisplay](../basedisplay)                         | props passed to the renderer's React "Rendering" component.                                                                                                                                                                                                                       |
| [regionCannotBeRendered](#method-regioncannotberendered)               | Methods    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                   |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults)         | Actions    | [BaseDisplay](../basedisplay)                         | see the `ignorePromotedDefaults` property                                                                                                                                                                                                                                         |
| [setStatusMessage](#action-setstatusmessage)                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                   |
| [setError](#action-seterror)                                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                   |
| [setRpcDriverName](#action-setrpcdrivername)                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                   |
| [reload](#action-reload)                                               | Actions    | [BaseDisplay](../basedisplay)                         | base display reload does nothing, see specialized displays for details                                                                                                                                                                                                            |
| [scrollTop](#volatile-scrolltop)                                       | Volatiles  | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                   |
| [setScrollTop](#action-setscrolltop)                                   | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                   |
| [setHeight](#action-setheight)                                         | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                   |
| [loadedRegions](#volatile-loadedregions)                               | Volatiles  | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | regions whose data has been fetched and committed, keyed by displayedRegionIndex; populated only after the fetch work callback returns                                                                                                                                            |
| [isReady](#getter-isready)                                             | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once the canvas has painted and no fetch is in flight                                                                                                                                                                                                                        |
| [viewportWithinLoadedData](#getter-viewportwithinloadeddata)           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true when every visible block lies within an already-fetched region — i.e. the viewport shows data we actually loaded, not the stale fringe left after a zoom-out/pan.                                                                                                            |
| [svgReady](#getter-svgready)                                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once an off-screen (SVG) export can safely read this display's data: every visible region has loaded, or the fetch reached a terminal error / too-large state.                                                                                                               |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)                 | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data.                                                                                                                                |
| [layoutReady](#getter-layoutready)                                     | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (default false): whether a searchable feature layout currently exists.                                                                                                                                                                                           |
| [renderBlocks](#getter-renderblocks)                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Shared cached view for every LGV-based GPU display.                                                                                                                                                                                                                               |
| [displayPhase](#getter-displayphase)                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The display's mutually-exclusive visual state, precedence single-sourced in `computeDisplayPhase`.                                                                                                                                                                                |
| [rpcPropsCacheKey](#getter-rpcpropscachekey)                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The RPC cache key: the subclass's `rpcProps()` payload serialized to a string, so this getter's value is a primitive and MobX invalidates its observers only when the payload actually changed.                                                                                   |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Derived opt-in for the region-too-large gate: a display that declares a pre-flight byte estimate (`getByteEstimateConfig`) gates on it — the two are one decision, so they can't desync (this replaces the old dev-time "config set but gate off" console.error).                 |
| [setLoadedRegion](#action-setloadedregion)                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Action wrapper so callers after async boundaries stay in MST strict mode.                                                                                                                                                                                                         |
| [clearAllRpcData](#action-clearallrpcdata)                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | full reset: cancels fetch, clears error, loadedRegions, display-specific data, and the canvas-drawn flag.                                                                                                                                                                         |
| [invalidateLoadedRegions](#action-invalidateloadedregions)             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | lighter reset: cancels fetch and clears loadedRegions, leaving error and regionTooLarge intact                                                                                                                                                                                    |
| [onRegionTooLarge](#action-onregiontoolarge)                           | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (no-op base): called when `regionTooLarge` transitions to true.                                                                                                                                                                                                  |
| [fetchRegions](#action-fetchregions)                                   | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Run a per-region fetch with byte-estimate gating.                                                                                                                                                                                                                                 |
| [afterAttach](#action-afterattach)                                     | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | installs the five fetch-lifecycle autoruns (DisplayedRegionsChange, FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange, ClearHoverOnRegionTooLarge)                                                                                                      |
| [userByteLimit](#volatile-userbytelimit)                               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | user-confirmed byte limit after a force-load, disabling the gate.                                                                                                                                                                                                                 |
| [byteEstimate](#volatile-byteestimate)                                 | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | Last byte estimate reported for this display, with the adapter's own `fetchSizeLimit` and `alwaysRender` flag.                                                                                                                                                                    |
| [measuredSpanBp](#volatile-measuredspanbp)                             | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | The span the current `byteEstimate` was measured over, so the derived gate can rescale it to the span on screen now.                                                                                                                                                              |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                                                               |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate) | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                                                              |
| [configForceLoad](#getter-configforceload)                             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                                                                 |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan)   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored estimate from the span it was measured over (`measuredSpanBp`).                                                                                                   |
| [tooLargeStatus](#getter-toolargestatus)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in.                                                                                                      |
| [regionTooLarge](#getter-regiontoolarge)                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The verdict the whole mixin exists to produce: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips.                                                                                            |
| [regionTooLargeReason](#getter-regiontoolargereason)                   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                                                          |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)       | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)         | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                             |
| [setByteEstimate](#action-setbyteestimate)                             | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Commits the byte estimate and records the span it covers (`measuredSpanBp`) so the derived gate can rescale it to the span on screen.                                                                                                                                             |
| [raiseForceLoadLimits](#action-raiseforceloadlimits)                   | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | force-load: raise the byte limit past the current request so the gate releases.                                                                                                                                                                                                   |
| [forceLoad](#action-forceload)                                         | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Raises the byte limit past the current estimate and triggers a reload.                                                                                                                                                                                                            |
| [canvasDrawn](#volatile-canvasdrawn)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                                |
| [currentRenderingBackend](#volatile-currentrenderingbackend)           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | current backend reference, updated on context-loss recovery.                                                                                                                                                                                                                      |
| [renderTick](#volatile-rendertick)                                     | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                                  |
| [autorunsInstalled](#volatile-autorunsinstalled)                       | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                                        |
| [renderError](#volatile-rendererror)                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                                                                                                                                                                       |
| [markCanvasDrawn](#action-markcanvasdrawn)                             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                   |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                   |
| [stopRenderingBackend](#action-stoprenderingbackend)                   | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                   |
| [renderNow](#action-rendernow)                                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                   |
| [setRenderError](#action-setrendererror)                               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | set/clear the render-backend error.                                                                                                                                                                                                                                               |
| [attachRenderingBackend](#action-attachrenderingbackend)               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                                       |
| [activeStopToken](#volatile-activestoptoken)                           | Volatiles  | [FetchMixin](../fetchmixin)                           | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                         |
| [fetchGeneration](#volatile-fetchgeneration)                           | Volatiles  | [FetchMixin](../fetchmixin)                           | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                  |
| [fetchCanceled](#volatile-fetchcanceled)                               | Volatiles  | [FetchMixin](../fetchmixin)                           | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                                                        |
| [regionStatuses](#volatile-regionstatuses)                             | Volatiles  | [FetchMixin](../fetchmixin)                           | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                                                                    |
| [lastStatusMs](#volatile-laststatusms)                                 | Volatiles  | [FetchMixin](../fetchmixin)                           | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                                        |
| [isLoading](#getter-isloading)                                         | Getters    | [FetchMixin](../fetchmixin)                           | true while a fetch is active                                                                                                                                                                                                                                                      |
| [makeStatusCallback](#method-makestatuscallback)                       | Methods    | [FetchMixin](../fetchmixin)                           | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op.                                      |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)           | Methods    | [FetchMixin](../fetchmixin)                           | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                                                                  |
| [throttleStatus](#action-throttlestatus)                               | Actions    | [FetchMixin](../fetchmixin)                           | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write.                                                                                                                                                                                         |
| [resetStatus](#action-resetstatus)                                     | Actions    | [FetchMixin](../fetchmixin)                           | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                                                      |
| [stopActiveFetch](#action-stopactivefetch)                             | Actions    | [FetchMixin](../fetchmixin)                           | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                                                          |
| [setRegionStatus](#action-setregionstatus)                             | Actions    | [FetchMixin](../fetchmixin)                           | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                                                         |
| [cancelFetch](#action-cancelfetch)                                     | Actions    | [FetchMixin](../fetchmixin)                           | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                                                      |
| [cancelFetchByUser](#action-cancelfetchbyuser)                         | Actions    | [FetchMixin](../fetchmixin)                           | User-initiated cancel from the loading overlay.                                                                                                                                                                                                                                   |
| [beforeDestroy](#action-beforedestroy)                                 | Actions    | [FetchMixin](../fetchmixin)                           | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                                                              |
| [runFetch](#action-runfetch)                                           | Actions    | [FetchMixin](../fetchmixin)                           | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                                                      |
| [layout](#property-layout)                                             | Properties | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [clusterTree](#property-clustertree)                                   | Properties | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [treeAreaWidth](#property-treeareawidth)                               | Properties | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [subtreeFilter](#property-subtreefilter)                               | Properties | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [hoveredTreeNode](#volatile-hoveredtreenode)                           | Volatiles  | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [treeCanvas](#volatile-treecanvas)                                     | Volatiles  | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [mouseoverCanvas](#volatile-mouseovercanvas)                           | Volatiles  | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [parsedTree](#getter-parsedtree)                                       | Getters    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [root](#getter-root)                                                   | Getters    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [treeHasBranchLengths](#getter-treehasbranchlengths)                   | Getters    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [willClearTree](#method-willcleartree)                                 | Methods    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [setLayout](#action-setlayout)                                         | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [setClusterTree](#action-setclustertree)                               | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [setLayoutAndClusterTree](#action-setlayoutandclustertree)             | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [setTreeAreaWidth](#action-settreeareawidth)                           | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [setSubtreeFilter](#action-setsubtreefilter)                           | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [setHoveredTreeNode](#action-sethoveredtreenode)                       | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [setTreeCanvasRef](#action-settreecanvasref)                           | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |
| [setMouseoverCanvasRef](#action-setmouseovercanvasref)                 | Actions    | [TreeSidebarMixin](../treesidebarmixin)               |                                                                                                                                                                                                                                                                                   |

### LinearMafDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearmafdisplay).

<details>
<summary>LinearMafDisplay - Properties</summary>

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-type">type</span>                   | `ISimpleType<"LinearMafDisplay">`                     |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<ConfigurationSchemaType<…>>` |

</details>

<details>
<summary>LinearMafDisplay - Volatiles</summary>

#### volatile: summaryDataMap

Per-region `bigMafSummary` rows for the zoom-out path, populated by
`fetchMafSummaryData` only while `showSummary` is active. Kept separate from
`rpcDataMap` so the GPU sequence canvas and the summary overlay never read each
other's data.

```ts
// type signature
type summaryDataMap = ObservableMap<number, MafSummaryRecord[]>
// code
summaryDataMap: observable.map<number, MafSummaryRecord[]>()
```

#### volatile: framesDataMap

Per-region CDS frame rows (UCSC `mafFrames`) for the annotation overlay,
populated by the frames RPC in parallel with the main fetch. Kept separate from
the alignment/summary maps so the overlay survives the summary↔detail data swap.

```ts
// type signature
type framesDataMap = ObservableMap<number, MafFrameRecord[]>
// code
framesDataMap: observable.map<number, MafFrameRecord[]>()
```

#### volatile: sourcesVolatile

The worker's authoritative row set, in tree (leaf) order. `layout` overlays any
user reorder/relabel on top; `editableSources` merges the two and `sources`
narrows that by the subtree filter.

```ts
// type signature
type sourcesVolatile = MafSource[]
// code
sourcesVolatile: [] as MafSource[]
```

#### volatile: treeNewickVolatile

The worker's guide-tree Newick (the default, before any reorder). The active
displayed tree lives in the mixin's `clusterTree`, which a reorder clears (rows
no longer match the dendrogram) and "Clear arrangement" restores from here — so
we keep the worker tree separately rather than re-fetching it.

```ts
// type signature
type treeNewickVolatile = string | undefined
// code
treeNewickVolatile: undefined as string | undefined
```

#### volatile: resizing

True during an active height drag. Gates the dense per-base letter overlay (a
Canvas2D pass that re-scans every visible cell and redraws thousands of glyphs
each frame) so the drag only restretches the cheap GPU cell canvas; letters snap
back when the drag settles.

```ts
// type signature
type resizing = false
// code
resizing: false
```

</details>

<details>
<summary>LinearMafDisplay - Volatiles (other undocumented members)</summary>

| Member                                                         | Type                                   |
| -------------------------------------------------------------- | -------------------------------------- |
| <span id="volatile-rpcdatamap">rpcDataMap</span>               | `ObservableMap<number, MafRegionData>` |
| <span id="volatile-prefersoffset">prefersOffset</span>         | `true`                                 |
| <span id="volatile-resizesettletimer">resizeSettleTimer</span> | `Timeout \| undefined`                 |

</details>

<details>
<summary>LinearMafDisplay - Getters</summary>

#### getter: conf

the config typed off the concrete schema; `ConfigurationReference` erases
`self.configuration` to `any`, so direct reads route through this to stay typed
(same move as `BaseAdapter<CONF>`)

```ts
type conf = ModelInstanceTypeProps<Record<…>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: lgv

The containing LGV, typed once here so views/actions don't each repeat the
`getContainingView(self) as LinearGenomeViewModel` cast.

```ts
type lgv = ModelInstanceTypeProps<_OverrideProps<_OverrideProps<…>, { ...; }>> & ... 21 more ... & IStateTreeNode<...>
```

#### getter: annotationAdapterConfig

The configured CDS-frame annotation adapter snapshot (UCSC `mafFrames`), or
undefined when unset. Read from the MAF _adapter_ config as a swappable
sub-adapter (alongside `summaryAdapter`), not the display — a frozen slot, so
this is a plain snapshot the frames RPC hands straight to `getAdapter`.

```ts
type annotationAdapterConfig = Record<string, unknown> | undefined
```

#### getter: annotationsActive

Whether the per-species CDS frame _strip_ should draw: an annotation adapter is
configured and the "Show CDS frames" toggle is on. The codon view consumes the
same frames data but is gated separately (see `annotationDataActive`), so the
strip can be off while codon view is on.

```ts
type annotationsActive = boolean
```

#### getter: annotationDataActive

Whether the frames data needs to be fetched: an annotation adapter is configured
and either the strip or the codon view wants it. Gates the frames RPC and keys
the fetch cache so toggling _either_ consumer on triggers the fetch.

```ts
type annotationDataActive = boolean
```

#### getter: editableSources

The full row set with the user's arrangement applied: `layout` supplies order +
label/color overrides, merged over the worker's `sourcesVolatile` by name. Empty
`layout` (no customization) passes the worker set through. Not subtree-filtered
— this is what the arrangement dialog edits. Undefined until the first fetch
populates the worker set.

```ts
type editableSources = MafSource[] | undefined
```

#### getter: sources

The display rows: `editableSources` narrowed to the selected subtree.

```ts
type sources = MafSource[] | undefined
```

#### getter: samples

Sample list keyed by sample id (alias of `sources` mapped to the project's
canonical `{ id, label, color }` shape). Consumed by MafSequenceWidget, color
legend, etc.

```ts
type samples = Sample[] | undefined
```

#### getter: orderedSampleIds

Display row order shipped to the worker so its block `rowIndex` matches the
on-screen row. Single source for both `rpcProps` (cache-invalidation key) and
the alignment-fetch RPC arg so the two can't drift.

```ts
type orderedSampleIds = string[] | undefined
```

#### getter: rowIndexBySrc

Maps a `src` (species) to its display row index. The single source for the
`src`→row projection used by the summary-bar and CDS-frame overlays and the
frame hover lookup, so they can't disagree on row placement.

```ts
type rowIndexBySrc = Map<string, number>
```

#### getter: defaultCodonSpecies

The anchor species whose `mafFrames` reading frame is used to translate every
row (UCSC `codonDefault`). Tied to the _reference assembly_, not the top display
row: every species' codon is compared against the reference sequence
(`block.refSeqBytes`), so the frame must be enumerated from the reference's own
frames. A row reorder (layout) can move a non-reference species to row 0 —
reading `sources[0]` there would enumerate codons in the wrong frame. Falls back
to the worker's canonical first row (pre-reorder) when the reference isn't
itself a listed sample.

```ts
type defaultCodonSpecies = string | undefined
```

#### getter: coverageDisplayHeight

Height of the coverage band above the rows (0 when hidden).

```ts
type coverageDisplayHeight = number
```

#### getter: conservationDisplayHeight

Height of the conservation (percent identity) band (0 when hidden).

```ts
type conservationDisplayHeight = number
```

#### getter: rowsTopOffset

Top offset of the per-sample rows area = the stacked band heights above it
(coverage + conservation). The single source of truth for "where the rows start"
— every rows hit-test / draw / export offset routes through this so adding a
band can't desync them.

```ts
type rowsTopOffset = number
```

#### getter: nrow

Number of displayed rows (at least 1, so the fit-mode division is safe).

```ts
type nrow = number
```

#### getter: maxRowsHeight

Max CSS-px height the rows canvas may take before its backing store (`× dpr`)
hits the browser/GPU canvas limit. The single ceiling both the fit-target sizing
and the `rowHeight` cap respect.

```ts
type maxRowsHeight = number
```

#### getter: fitTargetHeight

The track height that fit-to-height mode divides among rows. Once the user
drags, the explicit `height` config slot wins; before any drag we size to show
every row at the default px height, so a typical alignment looks exactly like
fixed mode. Huge alignments are bounded by the `rowHeight` cap, not here, so
this needs no cap of its own.

```ts
type fitTargetHeight = number
```

#### getter: autoRowHeight

Per-row height in fit-to-height mode: the rows area (track height minus the
fixed bands) split evenly across rows.

```ts
type autoRowHeight = number
```

#### getter: effectiveRowHeight

Resolved per-row height. `rowHeight === 0` is fit-to-height (rows stretch to the
dragged track height); any positive value is a pinned px height. Every consumer
reads this getter, never the raw `rowHeight` property.

Capped so the rows canvas backing store (`rowsHeight × dpr`) can never exceed
the browser/GPU max canvas size: a fixed px height across hundreds of species
would otherwise throw `Canvas exceeds max size`. The cap shrinks rows to fit
instead of crashing (or clipping); fit mode already stays small so it never
engages there. Bands have their own small canvases, so the rows-only ceiling is
the whole limit.

```ts
type effectiveRowHeight = number
```

#### getter: rowsHeight

Height of the per-sample rows area (excludes the coverage band). Zero when
alignments are hidden, collapsing the display to the coverage band.

```ts
type rowsHeight = number
```

#### getter: totalHeight

Full display height = rows area + stacked bands.

```ts
type totalHeight = number
```

#### getter: height

Override BaseLinearDisplay.height so the track container matches the rendering
canvas height exactly (coverage band + rows × rowHeight).

```ts
type height = number
```

#### getter: hierarchy

Positioned tree hierarchy. Coordinates are computed against
`(rowsHeight, treeAreaWidth)` so leaf rows align with row tops; the coverage
band is offset separately by the React layer.

```ts
type hierarchy = ClusterHierarchyNode | undefined
```

#### getter: colorPalette

Theme-derived color palette (per-base colors + match/gap/mismatch/
unknown/insertion), read by `gpuProps()` and `renderState`. Derived from the
session theme so it's always available — including headless SVG export and RPC,
where no component mounts to seed it. Theme changes trigger a main-thread
re-encode but never an RPC refetch.

```ts
type colorPalette = MafColorPalette
```

#### getter: renderState

Render state passed to GPU/Canvas2D backend each frame. Uses the rows- only
height so the GPU canvas only paints the per-sample band; the coverage band is
drawn on a separate Canvas2D overlay above.

```ts
type renderState = MafGPURenderState | undefined
```

#### getter: coverageStats

Per-position depth stats across the currently visible content blocks, derived
from the worker-shipped `coverage.coverageDepths` arrays (which already reflect
the active subtree — see `rpcProps`). Feeds `coverageDomain` → `coverageTicks`.

```ts
type coverageStats = ScoreStats | undefined
```

#### getter: coverageDomain

[min, max] coverage domain for the visible blocks. Linear scale only for MAF —
sample counts are already bounded and well-distributed.

```ts
type coverageDomain = [number, number] | undefined
```

#### getter: coverageTicks

Y-axis tick marks for the coverage band.

```ts
type coverageTicks = YScaleTicks | undefined
```

#### getter: visibleEmptyLines

Positioned bridge-line segments for `e`-line (empty/bridged) rows.

```ts
type visibleEmptyLines = EmptyLineSegment[]
```

#### getter: visibleInsertions

Positioned insertion markers (interbase) for the visible aligned rows.

```ts
type visibleInsertions = InsertionMarker[]
```

#### getter: visibleDeletions

Positioned deletion runs for the visible aligned rows; the overlay draws the
deleted-base count inside each run when it fits.

```ts
type visibleDeletions = DeletionMarker[]
```

#### getter: visibleInversions

Positioned strand-flip (inversion) markers for the visible aligned rows. Empty
unless the indicator is toggled on.

```ts
type visibleInversions = InversionMarker[]
```

#### getter: showSummary

Use the cheap summary path when a `bigMafSummary` sub-adapter is configured and
the view is zoomed out past the force-load threshold — exactly where the full
alignment fetch would be blocked by the byte gate. Tracks without a summary
never enter this path.

```ts
type showSummary = boolean
```

#### getter: zoomedToBaseLevel

At base level each reference base spans at least a pixel, so individual bases /
SNP marks are legible (UCSC's `zoomedToBaseLevel`). Read off the debounced
`coarseBpPerPx` so the rendering swap it gates doesn't thrash mid-zoom. False
until the view is initialized.

```ts
type zoomedToBaseLevel = boolean
```

#### getter: codonViewActive

The codon view is on: the toggle is set, frame data is available to define the
reading frame, and we're zoomed to base level (so codons are meaningful) and not
in the cheap summary path. When active it replaces the per-base SNP rendering
with per-codon change coloring.

```ts
type codonViewActive = boolean
```

#### getter: activeRowRendering

Single source of truth for what the per-sample rows area draws right now:
`bases` (the GPU SNP/base coloring), `codon` (per-codon change coloring from
`mafFrames`), `sourceChrom` (color-by-source-chromosome SV mode), or a per-row
identity style (`heatmap` / `xyplot`). Codon view takes precedence when on, then
color-by-chromosome (an explicit SV toggle, but not in the cheap summary path
which carries no per-row chr); otherwise, with `rowIdentityAutoZoom` (default)
it emulates UCSC `wigMaf` — bases at base level, the identity plot when zoomed
out; with auto off the selected mode is pinned. The GPU canvas, the
identity/chromosome canvases, the codon overlay, and SVG export all branch on
this one getter so they can't disagree about what's on screen.

```ts
type activeRowRendering = 'codon' | 'bases' | 'sourceChrom' | RowIdentityMode
```

#### getter: visibleLabels

Positioned per-base SNP/sequence letters. Suppressed in any non-base rendering
(the identity plot and codon view both replace the letters).

```ts
type visibleLabels = VisibleLabel[]
```

#### getter: visibleSummaryBars

Positioned per-species presence bars for the zoom-out summary overlay. Empty
unless `showSummary` is active. Unmatched `src` rows drop via the `sources`
index, keeping the render robust to summary files that list extra species.

```ts
type visibleSummaryBars = SummaryBar[]
```

#### getter: visibleFrames

Positioned per-species CDS frame boxes for the annotation overlay. Empty unless
an annotation adapter is configured and the overlay is on. Reuses the `src`→row
mapping the summary bars established, so frame rows for species the track
doesn't list drop out.

```ts
type visibleFrames = FrameMarker[]
```

#### getter: visibleCodons

Per-species codon cells for the codon view (the per-codon change coloring that
replaces the SNP cells). Empty unless codon view is the active rendering and an
anchor species is known.

```ts
type visibleCodons = CodonMarker[]
```

#### getter: visibleCodonConservation

Per-codon amino-acid conservation bars for the conservation band's codon mode.
Empty unless the band is on in `codon` mode, an anchor species is known, and
we're not in the cheap summary path (which ships no per-base blocks to
translate). Draws only inside the CDS (where frames define codons); everywhere
else the band is blank.

```ts
type visibleCodonConservation = CodonConservationBar[]
```

#### getter: sourceChromLegend

Rank-based legend for the color-by-source-chromosome mode: one entry per
source-chromosome rank actually present across the visible rows (rank 0 = each
species' main chromosome, higher ranks = the minority chromosomes a row switches
to at a rearrangement). Because coloring is by per-row rank rather than
chromosome name (see `perRowChromRanks`), the legend is this short fixed scheme,
not a per-scaffold rainbow. Empty unless the mode is active; a single "Main
chromosome" entry means nothing rearranges in view.

```ts
type sourceChromLegend = { label: string; color: string }[]
```

#### getter: msaHighlights

Get highlight regions from connected MSA views

```ts
type msaHighlights = MsaHighlight[]
```

</details>

<details>
<summary>LinearMafDisplay - Getters (other undocumented members)</summary>

| Member                                                           | Type                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| <span id="getter-rowheight">rowHeight</span>                     | `number`                                                           |
| <span id="getter-rowproportion">rowProportion</span>             | `number`                                                           |
| <span id="getter-showallletters">showAllLetters</span>           | `boolean`                                                          |
| <span id="getter-mismatchrendering">mismatchRendering</span>     | `boolean`                                                          |
| <span id="getter-showasuppercase">showAsUpperCase</span>         | `boolean`                                                          |
| <span id="getter-showtree">showTree</span>                       | `boolean`                                                          |
| <span id="getter-showbranchlength">showBranchLength</span>       | `boolean`                                                          |
| <span id="getter-showcoverage">showCoverage</span>               | `boolean`                                                          |
| <span id="getter-showalignments">showAlignments</span>           | `boolean`                                                          |
| <span id="getter-coverageheight">coverageHeight</span>           | `number`                                                           |
| <span id="getter-showconservation">showConservation</span>       | `boolean`                                                          |
| <span id="getter-conservationheight">conservationHeight</span>   | `number`                                                           |
| <span id="getter-conservationmode">conservationMode</span>       | `"base" \| "codon"`                                                |
| <span id="getter-rowidentitymode">rowIdentityMode</span>         | `"none" \| "xyplot" \| "heatmap"`                                  |
| <span id="getter-rowidentityautozoom">rowIdentityAutoZoom</span> | `boolean`                                                          |
| <span id="getter-showannotations">showAnnotations</span>         | `boolean`                                                          |
| <span id="getter-showtranslation">showTranslation</span>         | `boolean`                                                          |
| <span id="getter-colorbychromosome">colorByChromosome</span>     | `boolean`                                                          |
| <span id="getter-showinversions">showInversions</span>           | `boolean`                                                          |
| <span id="getter-spatialindex">spatialIndex</span>               | `{ index: Flatbush; nodes: ClusterHierarchyNode[]; } \| undefined` |

</details>

<details>
<summary>LinearMafDisplay - Methods</summary>

#### method: gpuProps

Inputs to the main-thread GPU instance encoder. Changes here re-encode in the
per-region encode autorun — no RPC roundtrip. Intentionally excludes
`showAsUpperCase` (label-only) and view-shape props (rowHeight, rowProportion —
driven by shader uniforms).

```ts
type gpuProps = () => MafGpuProps
```

#### method: rpcProps

Worker-fetch inputs that invalidate cached data when changed (tier-1, via
MultiRegionDisplayMixin's `SettingsInvalidate` autorun → refetch).
`orderedSampleIds` is the display row order (layout reorder + subtree filter);
the worker emits block rows in it so `rowIndex` is the on-screen row. Loop-safe
despite deriving from worker output: `sources` is set-stable (`sourcesVolatile`
deepEqual-guarded in `setSamples`, `layout`/`subtreeFilter` user-driven), so it
doesn't churn per fetch.

```ts
type rpcProps = () => {
  orderedSampleIds: string[] | undefined
  annotationDataActive: boolean
}
```

#### method: rowHoverInfo

Resolve a hover hit on `rowIndex` at absolute genomic `bp` (uint32, per
worker-output convention): an aligned base (`cell`) or a bridged/empty region
(`empty`), each tagged with the sample label. Returns undefined when no fetched
block covers the bp, the row is out of range, or the cell is a gap.

```ts
type rowHoverInfo = (displayedRegionIndex: number, gposFrac: number, rowIndex: number, bpPerPx: number) => {…} | { ...; } | { ...; } | { ...; } | undefined
```

#### method: frameHoverInfo

The CDS frame record covering absolute genomic `bp` (uint32) on display
`rowIndex`, or undefined when no frame overlaps there (or no frames data is
loaded). Gated on `annotationDataActive` not the strip toggle, so the gene name
still reads on hover in codon view with the strip off. The species is matched by
the same `src`→row projection the overlay draws with, so the tooltip and the
strip can't disagree about which row a gene is on.

```ts
type frameHoverInfo = (
  displayedRegionIndex: number,
  bp: number,
  rowIndex: number,
) => { name: string } | undefined
```

#### method: coverageTooltipBin

Build a per-position coverage tooltip bin (depth + SNP base counts) for the
given absolute genomic bp + region index. Delegates the math to
alignments-core's `buildCoverageTooltipBin` — same code path the alignments
display uses. Insertions are reported separately via `coverageInsertionHit`, so
they never mix into the depth/SNP table. Returns undefined when the region has
no fetched data or depth is zero.

```ts
type coverageTooltipBin = (displayedRegionIndex: number, position: number, bpPerPx: number) => {…} | undefined
```

#### method: coverageInsertionHit

Hit-test an insertion bar in the coverage band at fractional genomic `gposFrac`.
Returns the interbase summary (count + length range + interbaseDepth) when the
cursor is on the bar, else undefined — drives the dedicated interbase tooltip,
kept separate from the depth/SNP one.

```ts
type coverageInsertionHit = (
  displayedRegionIndex: number,
  gposFrac: number,
  bpPerPx: number,
) => CoverageInsertionHit | undefined
```

#### method: codonHoverInfo

The codon under the cursor on display `rowIndex` at absolute genomic `bp`, when
the codon view is the active rendering: the species' codon + amino acid, the
reference codon + amino acid, and the syn/nonsyn/stop classification. Reuses the
same anchor frames + reference comparison the colored cells are drawn from
(`findCodonAt`), so the tooltip and the cell agree. Undefined off codon view or
where no codon covers the row there.

```ts
type codonHoverInfo = (
  displayedRegionIndex: number,
  bp: number,
  rowIndex: number,
) => CodonHit | undefined
```

</details>

<details>
<summary>LinearMafDisplay - Methods (other undocumented members)</summary>

| Member                                                 | Type               |
| ------------------------------------------------------ | ------------------ |
| <span id="method-trackmenuitems">trackMenuItems</span> | `() => MenuItem[]` |

</details>

<details>
<summary>LinearMafDisplay - Actions</summary>

#### action: setSamples

Receive worker-authoritative `samples` + serialized Newick tree. Samples + tree
are config-derived and identical on every region fetch, so the deepEqual guard
makes this fire once and skips the redundant frozen-array reassignment (and
downstream `sources`/instance-buffer recompute) on later scroll/zoom. The active
`clusterTree` is set from the worker tree only when there's no custom
arrangement — a reorder has cleared it and must keep it cleared until the user
clears the layout.

```ts
type setSamples = ({
  samples,
  treeNewick,
}: {
  samples: Sample[]
  treeNewick: string | undefined
}) => void
```

#### action: clearLayout

Drop the custom arrangement and restore the worker's guide tree (the base
`clearLayout` only clears it — the worker tree lives in `treeNewickVolatile`).

```ts
type clearLayout = () => void
```

#### action: setFitToHeight

Switch to fit-to-height mode: rows stretch to fill the track height. Seeds the
`height` config slot from the current content height so toggling on doesn't
jump, then `rowHeight = 0` makes `effectiveRowHeight` derive from it.

```ts
type setFitToHeight = () => void
```

#### action: resizeHeight

Drag-resize. In fit mode the new height drives `autoRowHeight` (rows stretch).
In fixed mode the pinned `rowHeight` scales proportionally so dragging still
resizes rows. Mirrors the variants display.

Flips `resizing` for the duration of the drag (cleared a beat after the last
tick) so the dense letter overlay sits out the frame-by-frame restretch — see
the `resizing` volatile.

```ts
type resizeHeight = (distance: number) => number
```

#### action: isCacheValid

Force a refetch when the loaded data is the wrong kind for the current zoom:
crossing the summary↔detail threshold within an already-loaded region wouldn't
trip the bounds-based coverage check, so the mode is keyed on which map holds
the region.

```ts
type isCacheValid = (displayedRegionIndex: number) => boolean
```

#### action: getByteEstimateConfig

Enable byte-estimate gating: above ~20kb visible, the adapter's MAF-aware byte
estimate (per-species sequence × span) is checked against `fetchSizeLimit`,
blocking the detail fetch with a force-load prompt rather than downloading
hundreds of species' bases at genome scale.

Returns null in summary mode — the summary read is cheap (zoom-reduced BigBed),
so it must never be blocked by the gate.

```ts
type getByteEstimateConfig = () => {
  adapterConfig: any
  visibleBp: number
} | null
```

</details>

<details>
<summary>LinearMafDisplay - Actions (other undocumented members)</summary>

| Member                                                                     | Type                                                                                                                                                 |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-setrowheight">setRowHeight</span>                         | `(n: number) => void`                                                                                                                                |
| <span id="action-setresizing">setResizing</span>                           | `(arg: boolean) => void`                                                                                                                             |
| <span id="action-setrowproportion">setRowProportion</span>                 | `(n: number) => void`                                                                                                                                |
| <span id="action-setshowallletters">setShowAllLetters</span>               | `(f: boolean) => void`                                                                                                                               |
| <span id="action-setmismatchrendering">setMismatchRendering</span>         | `(f: boolean) => void`                                                                                                                               |
| <span id="action-setshowasuppercase">setShowAsUpperCase</span>             | `(arg: boolean) => void`                                                                                                                             |
| <span id="action-setshowtree">setShowTree</span>                           | `(arg: boolean) => void`                                                                                                                             |
| <span id="action-setshowbranchlength">setShowBranchLength</span>           | `(arg: boolean) => void`                                                                                                                             |
| <span id="action-setshowcoverage">setShowCoverage</span>                   | `(arg: boolean) => void`                                                                                                                             |
| <span id="action-setshowalignments">setShowAlignments</span>               | `(arg: boolean) => void`                                                                                                                             |
| <span id="action-setcoverageheight">setCoverageHeight</span>               | `(arg: number) => void`                                                                                                                              |
| <span id="action-setshowconservation">setShowConservation</span>           | `(arg: boolean) => void`                                                                                                                             |
| <span id="action-setconservationmode">setConservationMode</span>           | `(arg: "base" \| "codon") => void`                                                                                                                   |
| <span id="action-setrowidentitymode">setRowIdentityMode</span>             | `(arg: "none" \| "xyplot" \| "heatmap") => void`                                                                                                     |
| <span id="action-setrowidentityautozoom">setRowIdentityAutoZoom</span>     | `(arg: boolean) => void`                                                                                                                             |
| <span id="action-setshowannotations">setShowAnnotations</span>             | `(arg: boolean) => void`                                                                                                                             |
| <span id="action-setshowtranslation">setShowTranslation</span>             | `(arg: boolean) => void`                                                                                                                             |
| <span id="action-setcolorbychromosome">setColorByChromosome</span>         | `(arg: boolean) => void`                                                                                                                             |
| <span id="action-setshowinversions">setShowInversions</span>               | `(arg: boolean) => void`                                                                                                                             |
| <span id="action-setconservationheight">setConservationHeight</span>       | `(arg: number) => void`                                                                                                                              |
| <span id="action-setrpcdata">setRpcData</span>                             | `(regionIndex: number, data: MafRegionData) => void`                                                                                                 |
| <span id="action-setsummarydata">setSummaryData</span>                     | `(regionIndex: number, records: MafSummaryRecord[]) => void`                                                                                         |
| <span id="action-setframesdata">setFramesData</span>                       | `(regionIndex: number, records: MafFrameRecord[]) => void`                                                                                           |
| <span id="action-clearalignmentdata">clearAlignmentData</span>             | `() => void`                                                                                                                                         |
| <span id="action-cleardisplayspecificdata">clearDisplaySpecificData</span> | `() => void`                                                                                                                                         |
| <span id="action-startrenderingbackend">startRenderingBackend</span>       | `(backend: MafRenderingBackend) => void`                                                                                                             |
| <span id="action-fetchneeded">fetchNeeded</span>                           | `(needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void>`                                                                     |
| <span id="action-rendersvg">renderSvg</span>                               | `(opts: ExportSvgDisplayOptions) => Promise<ReactElement<unknown, string \| JSXElementConstructor<any>> \| Iterable<ReactNode> \| AwaitedReactNode>` |

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

| Member                                                                 | Type         |
| ---------------------------------------------------------------------- | ------------ |
| <span id="method-regioncannotberendered">regionCannotBeRendered</span> | `() => null` |

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

| Member                                             | Type                                |
| -------------------------------------------------- | ----------------------------------- |
| <span id="action-setscrolltop">setScrollTop</span> | `(scrollTop: number) => void`       |
| <span id="action-setheight">setHeight</span>       | `(displayHeight: number) => number` |

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
