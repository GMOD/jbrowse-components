---
id: chordsyntenydisplay
title: ChordSyntenyDisplay
description: "Draws a SyntenyTrack in a CircularView, with a ribbon joining the two spans of each alignment."
sidebar_label: Display -> ChordSyntenyDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordSyntenyDisplay/models/stateModelFactory.ts).

Draws a `SyntenyTrack` in a `CircularView`, with a ribbon joining the two
spans of each alignment.

## Example usage

The circular-view display for a `SyntenyTrack`: each alignment is drawn as a
ribbon between its span on one side and its mate's span on the other, so an
inversion reads as a twist. The track config below is what creates it; its
colors are the config slots on [](/docs/config/chordsyntenydisplay):

```js
{
  type: 'SyntenyTrack',
  trackId: 'volvox_self',
  name: 'Volvox self-alignment',
  assemblyNames: ['volvox', 'volvox'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/volvox_self.paf',
    queryAssembly: 'volvox',
    targetAssembly: 'volvox',
  },
  displays: [
    {
      type: 'ChordSyntenyDisplay',
      displayId: 'volvox_self-ChordSyntenyDisplay',
    },
  ],
}
```

A track aligning two assemblies needs both of them on the circle, which is
the view's `assembly: ['hg38', 'mm39']` — see the
[synteny track guide](/docs/config_guides/synteny_track).

The configuration slots for this model are documented on its [config schema page](../../config/chordsyntenydisplay).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('ChordSyntenyDisplay')</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>1 inherited property from one model</summary>

From [BaseDisplay](../basedisplay): <span id="property-id">[`id`](../basedisplay#property-id)</span>

</details>

## Volatiles

<details class="inherited-members" data-pagefind-ignore>
<summary>5 inherited volatiles from 2 models</summary>

From [BaseChordDisplay](../basechorddisplay): <span id="volatile-features">[`features`](../basechorddisplay#volatile-features)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../basechorddisplay#volatile-reloadcounter)</span>

From [BaseDisplay](../basedisplay): <span id="volatile-error">[`error`](../basedisplay#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../basedisplay#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../basedisplay#volatile-statusprogress)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-ready">**ready**</span><br><code>boolean</code> | `loaded`, and no reorder this launch asked for still owed. Ribbons drawn before it would be drawn against the arcs it is about to move; a reorder that failed keeps this false and shows as `displayPhase` error, so a capture never commits the hairball |
| <span id="getter-displayerror">**displayError**</span><br><code>unknown</code> | the fetch's error, or else the owed reorder's |
| <span id="getter-featurenoun">**featureNoun**</span><br><code>string</code> |  |
| <span id="getter-attributeranges">**attributeRanges**</span><br><code>Record&lt;string, AttributeRange&gt;</code> | the span or label list each color channel covers over the held alignments, which the view's ramps and key scale to |
| <span id="getter-channelnames">**channelNames**</span><br><code>string[]</code> | the color channels the view's modes can paint: the preset measurements and the columns the adapter declares |
| <span id="getter-alignmentends">**alignmentEnds**</span><br><code>AlignmentEnds[]</code> | each held alignment's two ends by its place in `features`, on the circle's assemblies and in their canonical refNames: resolved once per fetch, which everything placing, coloring or reordering the alignments reads |
| <span id="getter-ribboncolors">**ribbonColors**</span><br><code>Uint32Array&lt;ArrayBufferLike&gt;</code> | each alignment's packed color under the view's `color`, by its place in `features`. A chromosome mode paints the ideogram color of the chromosome it joins, so a ribbon matches the arc it leaves; a label the view hides paints at zero alpha |
| <span id="getter-shapealpha">**shapeAlpha**</span><br><code>number</code> | the fill opacity every resting ribbon draws at, the view's `opacityLevel`; a ribbon's own color alpha (a `color.value`'s, an `opacity` field's fade) rides its lane |
| <span id="getter-ribbonfeet">**ribbonFeet**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ x1: Float32Array&lt;ArrayBuffer&gt;; x2: Float32Array&lt;ArrayBuffer&gt;;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ x1: Float32Array&lt;ArrayBuffer&gt;; x2: Float32Array&lt;ArrayBuffer&gt;; y1: Float32Array&lt;ArrayBuffer&gt;; y2: Float32Array&lt;ArrayBuffer&gt;; xGaps: Uint32Array&lt;ArrayBuffer&gt;; yGaps: Uint32Array&lt;ArrayBuffer&gt;; xSlice: Int32Array&lt;ArrayBuffer&gt;; ySlice: Int32Array&lt;ArrayBuffer&gt;; strand: Float32Array&lt;ArrayBuffer&gt;; }</code></pre></dialog></span> | every held alignment's feet on the circle's unrolled axis and the slice index of each end, -1 off the circle, by its place in `features`: rebuilt by a fetch or a change to the regions, never by a recolor, a zoom or a rotation |
| <span id="getter-ribbonpicks">**ribbonPicks**</span><br><code>Uint32Array&lt;ArrayBufferLike&gt;</code> | the alignments the canvas draws, by their place in `features`, the widest first so every narrower ribbon draws over them: both ends on the circle, at least the view's `filter` bound on `length` long on each side, and not hidden by the view's color or its identity cut |
| <span id="getter-ribbonlanes">**ribbonLanes**</span><br><code>RibbonLanes</code> | the drawn alignments as the ribbon mark's lanes, each in its color at that color's own alpha |
| <span id="getter-paintedassemblyname">**paintedAssemblyName**</span><br><code>string &#124; undefined</code> | the genome whose ideogram this track paints: the second of the two it joins on the circle, none for a genome aligned to itself |
| <span id="getter-paintspans">**paintSpans**</span><br><code>ReadonlyMap&lt;number, PaintRun[]&gt;</code> | the stretches of each painted-genome slice covered by the drawn ribbons, by slice index, each in the ideogram color of the first genome's chromosome it comes from; what `ideogramPaint` bins, and unchanged by a zoom |
| <span id="getter-ideogrampaint">**ideogramPaint**</span><br><code>ReadonlyMap&lt;string, PaintRun[]&gt;</code> | the painted genome's ideogram, by slice key: each stretch in the color of the first genome's chromosome that the drawn ribbons over it mostly come from, one bin per CSS px |
| <span id="getter-drawncount">**drawnCount**</span><br><code>number</code> | how many alignments the canvas draws as ribbons |
| <span id="getter-cappedmeanspanpx">**cappedMeanSpanPx**</span><br><code>number</code> | the drawn alignments' mean span on screen, each counted at no more than the width the thin fade stops caring about, which the view's 'auto' fade is decided on |
| <span id="getter-laneindexbyid">**laneIndexById**</span><br><code>Map&lt;string, number&gt;</code> | each drawn feature's place in the lanes, by id |
| <span id="getter-shapes">**shapes**</span><br><code>RibbonShape[]</code> | every drawn alignment as the export draws it |
| <span id="getter-legendcolor">**legendColor**</span><br><code>string &#124; undefined</code> | the ribbon fill the circle's key shows: the one color every ribbon paints when the view's mode has no key of its own |
| <span id="getter-featurewidgettype">**featureWidgetType**</span><br><code>{ type: string; id: string; }</code> | the panel the linear synteny displays open for the same record, so a ribbon clicked on the circle and a ribbon clicked in a synteny view share one drawer entry |
| <span id="getter-partnerspansbyslice">**partnerSpansBySlice**</span><br><code>ReadonlyMap&lt;number, PartnerSpan[]&gt;</code> | each drawn alignment's stretch on each slice it touches, by slice index, named by the chromosome at its other end, with that chromosome's genome where the track joins two |
| <span id="getter-chordcell">**chordCell**</span><br><code>ChordCell &#124; undefined</code> | what the view's canvas draws for this display: its lanes while it is ready, nothing while its loading or error ring covers the circle |

<details class="inherited-members" data-pagefind-ignore>
<summary>26 inherited getters from 2 models</summary>

From [BaseChordDisplay](../basechorddisplay): <span id="getter-view">[`view`](../basechorddisplay#getter-view)</span>, <span id="getter-trackassemblynames">[`trackAssemblyNames`](../basechorddisplay#getter-trackassemblynames)</span>, <span id="getter-fetchinert">[`fetchInert`](../basechorddisplay#getter-fetchinert)</span>, <span id="getter-loaded">[`loaded`](../basechorddisplay#getter-loaded)</span>, <span id="getter-svgready">[`svgReady`](../basechorddisplay#getter-svgready)</span>, <span id="getter-displayphase">[`displayPhase`](../basechorddisplay#getter-displayphase)</span>, <span id="getter-radiuspx">[`radiusPx`](../basechorddisplay#getter-radiuspx)</span>, <span id="getter-curvedepth">[`curveDepth`](../basechorddisplay#getter-curvedepth)</span>, <span id="getter-bezierradius">[`bezierRadius`](../basechorddisplay#getter-bezierradius)</span>, <span id="getter-selectedfeatureid">[`selectedFeatureId`](../basechorddisplay#getter-selectedfeatureid)</span>, <span id="getter-hoveredfeatureid">[`hoveredFeatureId`](../basechorddisplay#getter-hoveredfeatureid)</span>, <span id="getter-figurestage">[`figureStage`](../basechorddisplay#getter-figurestage)</span>

From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-hoveredfeature">[`hoveredFeature`](../basedisplay#getter-hoveredfeature)</span>, <span id="getter-livenotices">[`liveNotices`](../basedisplay#getter-livenotices)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-confignotices">[`configNotices`](../basedisplay#getter-confignotices)</span>, <span id="getter-notices">[`notices`](../basedisplay#getter-notices)</span>, <span id="getter-cornernotices">[`cornerNotices`](../basedisplay#getter-cornernotices)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span>

</details>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-shapeat">**shapeAt**</span><br><code>(i: number) =&gt; RibbonShape</code> | lane `i` as the SVG side draws it, on the unrotated figure |
| <span id="method-shapefor">**shapeFor**</span><br><code>(featureId: string) =&gt; RibbonShape &#124; undefined</code> | the ribbon a drawn alignment's id names, as the SVG side draws it; undefined for an id the canvas draws no ribbon for |
| <span id="method-shapelabel">**shapeLabel**</span><br><code>(feature: Feature) =&gt; string</code> |  |
| <span id="method-shapepathfor">**shapePathFor**</span><br><code>(feature: Feature) =&gt; string &#124; undefined</code> | a drawn feature's outline as an SVG path on the unrotated figure, for anything that has to find a ribbon on screen without a DOM node to find |
| <span id="method-alignmentsbetween">**alignmentsBetween**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(referenceAssembly: string, currentAssembly: string) =&gt; Alignme…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(referenceAssembly: string, currentAssembly: string) =&gt; AlignmentData[]</code></pre></dialog></span> | the held alignments joining two assemblies on the circle, in canonical refNames and oriented reference side first, which is what the view's reorder reads instead of fetching the file again |
| <span id="method-partnerspans">**partnerSpans**</span><br><code>(index: number) =&gt; PartnerSpan[]</code> | each drawn alignment's stretch on slice `index`, named by the chromosome at its other end |
| <span id="method-hitat">**hitAt**</span><br><code>(dx: number, dy: number) =&gt; Feature &#124; undefined</code> | the alignment whose ribbon covers a point CSS px from the circle's centre in the screen frame, the topmost where several do. Measured on the unrotated figure, so a rotation keeps the held geometry |
| <span id="method-rendersvg">**renderSvg**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(_opts: ViewExportSvgOptions &amp; { theme?: ThemeOptions &#124; undefin…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(_opts: ViewExportSvgOptions &amp; { theme?: ThemeOptions &#124; undefined; }) =&gt; Promise&lt;Element &#124; null&gt;</code></pre></dialog></span> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>9 inherited methods from 2 models</summary>

From [BaseChordDisplay](../basechorddisplay): <span id="method-assemblyof">[`assemblyOf`](../basechorddisplay#method-assemblyof)</span>, <span id="method-canonicalrefname">[`canonicalRefName`](../basechorddisplay#method-canonicalrefname)</span>, <span id="method-axisslice">[`axisSlice`](../basechorddisplay#method-axisslice)</span>

From [BaseDisplay](../basedisplay): <span id="method-renderingprops">[`renderingProps`](../basedisplay#method-renderingprops)</span>, <span id="method-trackmenuitems">[`trackMenuItems`](../basedisplay#method-trackmenuitems)</span>, <span id="method-configproblemsof">[`configProblemsOf`](../basedisplay#method-configproblemsof)</span>, <span id="method-liftplot">[`liftPlot`](../basedisplay#method-liftplot)</span>, <span id="method-plotproblems">[`plotProblems`](../basedisplay#method-plotproblems)</span>, <span id="method-plotwrites">[`plotWrites`](../basedisplay#method-plotwrites)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-clickfeature">**clickFeature**</span><br><code>(feature: Feature) =&gt; void</code> | what a click on the canvas reaches: the alignment's details |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | refetch, and run a reorder this launch still owes, which is how the error ring's Retry reaches a reorder that failed |

<details class="inherited-members" data-pagefind-ignore>
<summary>7 inherited actions from 2 models</summary>

From [BaseChordDisplay](../basechorddisplay): <span id="action-openerrordialog">[`openErrorDialog`](../basechorddisplay#action-openerrordialog)</span>, <span id="action-setfeatures">[`setFeatures`](../basechorddisplay#action-setfeatures)</span>

From [BaseDisplay](../basedisplay): <span id="action-setstatusmessage">[`setStatusMessage`](../basedisplay#action-setstatusmessage)</span>, <span id="action-seterror">[`setError`](../basedisplay#action-seterror)</span>, <span id="action-clearhoveredfeature">[`clearHoveredFeature`](../basedisplay#action-clearhoveredfeature)</span>, <span id="action-applydisplaysettings">[`applyDisplaySettings`](../basedisplay#action-applydisplaysettings)</span>, <span id="action-applyplot">[`applyPlot`](../basedisplay#action-applyplot)</span>

</details>
