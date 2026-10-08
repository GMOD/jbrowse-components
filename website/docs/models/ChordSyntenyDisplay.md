---
id: chordsyntenydisplay
title: ChordSyntenyDisplay
description: "Properties, getters and actions of the ChordSyntenyDisplay state model."
sidebar_label: Display -> ChordSyntenyDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordSyntenyDisplay/models/stateModelFactory.ts).

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

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="property-id">[`id`](../basedisplay#property-id)</span></span>

## Volatiles

<span data-pagefind-ignore>From [BaseChordDisplay](../basechorddisplay): <span id="volatile-features">[`features`](../basechorddisplay#volatile-features)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../basechorddisplay#volatile-reloadcounter)</span></span>

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="volatile-error">[`error`](../basedisplay#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../basedisplay#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../basedisplay#volatile-statusprogress)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-ready">**ready**</span><br><code>boolean</code> | `loaded`, and no reorder this launch asked for still owed. Ribbons drawn before it would be drawn against the arcs it is about to move; a reorder that failed keeps this false and shows as `displayPhase` error, so a capture never commits the hairball |
| <span id="getter-displayerror">**displayError**</span><br><code>unknown</code> | the fetch's error, or else the owed reorder's |
| <span id="getter-featurenoun">**featureNoun**</span><br><code>string</code> |  |
| <span id="getter-attributeranges">**attributeRanges**</span><br><code>Record&lt;string, AttributeRange&gt;</code> | the span or label list each colour channel covers over the held alignments, which the view's ramps and key scale to |
| <span id="getter-channelnames">**channelNames**</span><br><code>string[]</code> | the colour channels the view's modes can paint: the preset measurements and the columns the adapter declares |
| <span id="getter-ribboncolors">**ribbonColors**</span><br><code>Map&lt;string, number&gt;</code> | each alignment's packed colour under the view's `color`, by feature id. A chromosome mode paints the ideogram colour of the chromosome it joins, so a ribbon matches the arc it leaves; a label the view hides paints at zero alpha |
| <span id="getter-ribbonfill">**ribbonFill**</span><br><code>(feature: Feature) =&gt; string</code> | the resting fill of each ribbon, opaque: the ribbons share one `ribbonOpacity`, so an opacity drag repaints no ribbon |
| <span id="getter-ribbonopacity">**ribbonOpacity**</span><br><code>number</code> | the fill opacity every resting ribbon draws at, the view's `opacityLevel`; a ribbon's own colour alpha (a `color.value`'s, an `opacity` field's fade) rides its lane |
| <span id="getter-drawnfeatures">**drawnFeatures**</span><br><code>Feature[] &#124; undefined</code> | what the ribbons draw: the held alignments at least the view's `minAlignmentLength` long on their own side, less those the view's colour hides |
| <span id="getter-shapealpha">**shapeAlpha**</span><br><code>number</code> | `ribbonOpacity`, as the canvas reads it |
| <span id="getter-ribbonfeet">**ribbonFeet**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ x1: Float32Array&lt;ArrayBuffer&gt;; x2: Float32Array&lt;ArrayBuffer&gt;;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ x1: Float32Array&lt;ArrayBuffer&gt;; x2: Float32Array&lt;ArrayBuffer&gt;; y1: Float32Array&lt;ArrayBuffer&gt;; y2: Float32Array&lt;ArrayBuffer&gt;; xGaps: Uint32Array&lt;ArrayBuffer&gt;; yGaps: Uint32Array&lt;ArrayBuffer&gt;; strand: Float32Array&lt;ArrayBuffer&gt;; placed: Uint8Array&lt;ArrayBuffer&gt;; index: Map&lt;Feature, number&gt;; }</code></pre></dialog></span> | every held alignment's feet on the circle's unrolled axis, by the feature's place in `features`: rebuilt by a fetch or a change to the regions, never by a recolour, a zoom or a rotation |
| <span id="getter-ribbonlanes">**ribbonLanes**</span><br><code>RibbonLanes</code> | the drawn alignments as the ribbon mark's lanes, each in its colour at that colour's own alpha |
| <span id="getter-paintedassemblyname">**paintedAssemblyName**</span><br><code>string &#124; undefined</code> | the genome whose ideogram this track paints: the second of the two it joins on the circle, none for a genome aligned to itself |
| <span id="getter-ideogrampaint">**ideogramPaint**</span><br><code>ReadonlyMap&lt;string, PaintRun[]&gt;</code> | the painted genome's ideogram, by slice key: each stretch in the colour of the first genome's chromosome that the drawn ribbons over it mostly come from, one bin per CSS px |
| <span id="getter-drawncount">**drawnCount**</span><br><code>number</code> | how many alignments the canvas draws as ribbons |
| <span id="getter-cappedmeanspanpx">**cappedMeanSpanPx**</span><br><code>number</code> | the drawn alignments' mean span on screen, each counted at no more than the width the thin fade stops caring about, which the view's 'auto' fade is decided on |
| <span id="getter-laneindexbyid">**laneIndexById**</span><br><code>Map&lt;string, number&gt;</code> | each drawn feature's place in the lanes, by id |
| <span id="getter-shapes">**shapes**</span><br><code>RibbonShape[]</code> | every drawn alignment as the export draws it |
| <span id="getter-legendcolor">**legendColor**</span><br><code>string &#124; undefined</code> | the ribbon fill the circle's key shows: the one colour every ribbon paints when the view's mode keys nothing of its own |
| <span id="getter-featurewidgettype">**featureWidgetType**</span><br><code>{ type: string; id: string; }</code> | the panel the linear synteny displays open for the same record, so a ribbon clicked on the circle and a ribbon clicked in a synteny view share one drawer entry |
| <span id="getter-chordcell">**chordCell**</span><br><code>ChordCell &#124; undefined</code> | what the view's canvas draws for this display: its lanes while it is ready, nothing while its loading or error ring covers the circle |

<span data-pagefind-ignore>From [BaseChordDisplay](../basechorddisplay): <span id="getter-view">[`view`](../basechorddisplay#getter-view)</span>, <span id="getter-trackassemblynames">[`trackAssemblyNames`](../basechorddisplay#getter-trackassemblynames)</span>, <span id="getter-fetchinert">[`fetchInert`](../basechorddisplay#getter-fetchinert)</span>, <span id="getter-loaded">[`loaded`](../basechorddisplay#getter-loaded)</span>, <span id="getter-svgready">[`svgReady`](../basechorddisplay#getter-svgready)</span>, <span id="getter-displayphase">[`displayPhase`](../basechorddisplay#getter-displayphase)</span>, <span id="getter-radiuspx">[`radiusPx`](../basechorddisplay#getter-radiuspx)</span>, <span id="getter-bezierradiusratio">[`bezierRadiusRatio`](../basechorddisplay#getter-bezierradiusratio)</span>, <span id="getter-bezierradius">[`bezierRadius`](../basechorddisplay#getter-bezierradius)</span>, <span id="getter-sliceindex">[`sliceIndex`](../basechorddisplay#getter-sliceindex)</span>, <span id="getter-selectedfeatureid">[`selectedFeatureId`](../basechorddisplay#getter-selectedfeatureid)</span>, <span id="getter-hoveredfeatureid">[`hoveredFeatureId`](../basechorddisplay#getter-hoveredfeatureid)</span>, <span id="getter-chordstage">[`chordStage`](../basechorddisplay#getter-chordstage)</span>, <span id="getter-figurestage">[`figureStage`](../basechorddisplay#getter-figurestage)</span></span>

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-hoveredfeature">[`hoveredFeature`](../basedisplay#getter-hoveredfeature)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-firstgenomeends">**firstGenomeEnds**</span><br><code>(feature: Feature) =&gt; readonly [string, string]</code> | an alignment's two refNames with the circle's first genome's end first, the order the view's `query` and `target` modes read them in |
| <span id="method-shapeat">**shapeAt**</span><br><code>(i: number) =&gt; RibbonShape</code> | lane `i` as the SVG side draws it, on the unrotated figure |
| <span id="method-shapefor">**shapeFor**</span><br><code>(featureId: string) =&gt; RibbonShape &#124; undefined</code> | the ribbon a drawn alignment's id names, as the SVG side draws it; undefined for an id the canvas draws no ribbon for |
| <span id="method-shapelabel">**shapeLabel**</span><br><code>(feature: Feature) =&gt; string</code> |  |
| <span id="method-shapepathfor">**shapePathFor**</span><br><code>(feature: Feature) =&gt; string &#124; undefined</code> | a drawn feature's outline as an SVG path on the unrotated figure, for anything that has to find a ribbon on screen without a DOM node to find |
| <span id="method-alignmentsbetween">**alignmentsBetween**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(referenceAssembly: string, currentAssembly: string) =&gt; Alignme…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(referenceAssembly: string, currentAssembly: string) =&gt; AlignmentData[]</code></pre></dialog></span> | the held alignments joining two assemblies on the circle, in canonical refNames and oriented reference side first, which is what the view's reorder reads instead of fetching the file again |
| <span id="method-partnerspans">**partnerSpans**</span><br><code>(index: number) =&gt; PartnerSpan[]</code> | each drawn alignment's stretch on slice `index`, named by the chromosome at its other end, with that chromosome's genome where the track joins two |
| <span id="method-hitat">**hitAt**</span><br><code>(dx: number, dy: number) =&gt; Feature &#124; undefined</code> | the alignment whose ribbon covers a point CSS px from the circle's centre in the screen frame, the topmost where several do |
| <span id="method-rendersvg">**renderSvg**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(_opts: ViewExportSvgOptions &amp; { theme?: ThemeOptions &#124; undefin…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(_opts: ViewExportSvgOptions &amp; { theme?: ThemeOptions &#124; undefined; }) =&gt; Promise&lt;Element &#124; null&gt;</code></pre></dialog></span> |  |

<span data-pagefind-ignore>From [BaseChordDisplay](../basechorddisplay): <span id="method-assemblyof">[`assemblyOf`](../basechorddisplay#method-assemblyof)</span>, <span id="method-canonicalrefname">[`canonicalRefName`](../basechorddisplay#method-canonicalrefname)</span>, <span id="method-slicefor">[`sliceFor`](../basechorddisplay#method-slicefor)</span>, <span id="method-axisslice">[`axisSlice`](../basechorddisplay#method-axisslice)</span></span>

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="method-renderingprops">[`renderingProps`](../basedisplay#method-renderingprops)</span>, <span id="method-trackmenuitems">[`trackMenuItems`](../basedisplay#method-trackmenuitems)</span>, <span id="method-liftplot">[`liftPlot`](../basedisplay#method-liftplot)</span>, <span id="method-plotproblems">[`plotProblems`](../basedisplay#method-plotproblems)</span>, <span id="method-plotwrites">[`plotWrites`](../basedisplay#method-plotwrites)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-clickfeature">**clickFeature**</span><br><code>(feature: Feature) =&gt; void</code> | what a click on the canvas reaches: the alignment's details |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> | refetch, and run a reorder this launch still owes, which is how the error ring's Retry reaches a reorder that failed |

<span data-pagefind-ignore>From [BaseChordDisplay](../basechorddisplay): <span id="action-openerrordialog">[`openErrorDialog`](../basechorddisplay#action-openerrordialog)</span>, <span id="action-setfeatures">[`setFeatures`](../basechorddisplay#action-setfeatures)</span></span>

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="action-setstatusmessage">[`setStatusMessage`](../basedisplay#action-setstatusmessage)</span>, <span id="action-seterror">[`setError`](../basedisplay#action-seterror)</span>, <span id="action-clearhoveredfeature">[`clearHoveredFeature`](../basedisplay#action-clearhoveredfeature)</span>, <span id="action-applydisplaysettings">[`applyDisplaySettings`](../basedisplay#action-applydisplaysettings)</span>, <span id="action-applyplot">[`applyPlot`](../basedisplay#action-applyplot)</span></span>
