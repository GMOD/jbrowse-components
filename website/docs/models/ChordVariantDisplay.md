---
id: chordvariantdisplay
title: ChordVariantDisplay
description: "Draws the structural variants of a VariantTrack in a CircularView, each translocation as a chord across the circle."
sidebar_label: Display -> ChordVariantDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordVariantDisplay/models/stateModelFactory.ts).

Draws the structural variants of a `VariantTrack` in a `CircularView`, each
translocation as a chord across the circle.

## Example usage

The circular-view display for a `VariantTrack` of structural variants;
translocations are drawn as chords across the circle. The track config below
is what creates it; its colors are the config slots on
[](/docs/config/chordvariantdisplay):

```js
{
  type: 'VariantTrack',
  trackId: 'sv',
  name: 'Structural variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/sv.vcf.gz',
  },
  displays: [
    {
      type: 'ChordVariantDisplay',
      displayId: 'sv-ChordVariantDisplay',
    },
  ],
}
```

The configuration slots for this model are documented on its [config schema page](../../config/chordvariantdisplay).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('ChordVariantDisplay')</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>2 inherited properties from 2 models</summary>

From [ParkedColorMixin](../parkedcolormixin): <span id="property-parkedcolors">[`parkedColors`](../parkedcolormixin#property-parkedcolors)</span>

From [BaseDisplay](../basedisplay): <span id="property-id">[`id`](../basedisplay#property-id)</span>

</details>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-highlightedfeatureids">**highlightedFeatureIds**</span><br><code>string[] &#124; undefined</code> | ids of the records to keep at full strength while the rest dim; undefined dims nothing. The SV inspector writes the selected record's event here |
| <span id="volatile-visiblefeatureids">**visibleFeatureIds**</span><br><code>string[] &#124; undefined</code> | ids of the records to draw; undefined draws them all. The SV inspector writes the rows its sheet's filters leave here, so a filter change is a redraw and no refetch |

<details class="inherited-members" data-pagefind-ignore>
<summary>5 inherited volatiles from 2 models</summary>

From [BaseChordDisplay](../basechorddisplay): <span id="volatile-features">[`features`](../basechorddisplay#volatile-features)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../basechorddisplay#volatile-reloadcounter)</span>

From [BaseDisplay](../basedisplay): <span id="volatile-error">[`error`](../basedisplay#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../basedisplay#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../basedisplay#volatile-statusprogress)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-drawnfeatures">**drawnFeatures**</span><br><code>Feature[] &#124; undefined</code> | the held records `visibleFeatureIds` leaves |
| <span id="getter-highlightedfeatureidset">**highlightedFeatureIdSet**</span><br><code>Set&lt;string&gt; &#124; undefined</code> |  |
| <span id="getter-featurewidgettype">**featureWidgetType**</span><br><code>{ type: string; id: string; }</code> | the panel the linear variant displays open for the same record |
| <span id="getter-chordfeet">**chordFeet**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ x: Float32Array&lt;ArrayBuffer&gt;; x2: Float32Array&lt;ArrayBuffer&gt;;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ x: Float32Array&lt;ArrayBuffer&gt;; x2: Float32Array&lt;ArrayBuffer&gt;; xGaps: Uint32Array&lt;ArrayBuffer&gt;; x2Gaps: Uint32Array&lt;ArrayBuffer&gt;; placed: Uint8Array&lt;ArrayBuffer&gt;; junction: string[]; index: Map&lt;Feature, number&gt;; }</code></pre></dialog></span> | every held record's two ends on the circle's unrolled axis, by the record's place in `features`: its start, and its mate's position where it has one, else its end. `junction` is the two ends unordered, which a breakend pair's two records share. |
| <span id="getter-colorsetting">**colorSetting**</span><br><code>ColorSetting</code> | `encoding.color` as written |
| <span id="getter-paintedcolorfield">**paintedColorField**</span><br><code>CategoricalField &#124; undefined</code> | the field the chords paint by, undefined for a constant or callback |
| <span id="getter-chordstrokes">**chordStrokes**</span><br><code>Map&lt;Feature, string&gt;</code> | each drawn record's color: its field's value through the scale, or the `value` the color channel answers for it |
| <span id="getter-chordpicks">**chordPicks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ picked: number[]; features: Feature[]; laneOfId: Map&lt;string,…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ picked: number[]; features: Feature[]; laneOfId: Map&lt;string, number&gt;; }</code></pre></dialog></span> | the drawn records a chord stands for, one per junction: the first record of a breakend pair draws it, and `laneOfId` sends both records' ids to that lane |
| <span id="getter-chordlanes">**chordLanes**</span><br><code>ChordLanes</code> | the drawn records as the chord mark's lanes, each in its color with the alpha the SV inspector's dimming leaves it |
| <span id="getter-drawnlanes">**drawnLanes**</span><br><code>ChordLanes</code> | the chord lanes, the ones whose ends are under a pixel apart included |
| <span id="getter-laneindexbyid">**laneIndexById**</span><br><code>ReadonlyMap&lt;string, number&gt;</code> | each drawn record's lane by id, a breakend pair's twin included |
| <span id="getter-shapealpha">**shapeAlpha**</span><br><code>number</code> | `encoding.opacity`, over each chord's color's own alpha |
| <span id="getter-chordcell">**chordCell**</span><br><code>ChordCell &#124; undefined</code> | what the view's canvas draws for this display: its lanes while it is ready, nothing while its loading or error ring covers the circle |
| <span id="getter-legendcolor">**legendColor**</span><br><code>string &#124; undefined</code> | the chord color the circle's key shows, when every chord shares one |
| <span id="getter-colorscales">**colorScales**</span><br><code>ColorScale[]</code> | the key of the values the drawn chords paint, while they paint a field |
| <span id="getter-legendspec">**legendSpec**</span><br><code>LegendSpec</code> |  |
| <span id="getter-shapestestid">**shapesTestId**</span><br><code>string</code> | the test id on the chord paths' group, on screen and in the export |
| <span id="getter-solidcolor">**solidColor**</span><br><code>string &#124; undefined</code> | the constant `color.value` holds as written, undefined for none or a `jexl:` one |

<details class="inherited-members" data-pagefind-ignore>
<summary>33 inherited getters from 4 models</summary>

From [ColorWritesMixin](../colorwritesmixin): <span id="getter-writtencolor">[`writtenColor`](../colorwritesmixin#getter-writtencolor)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="getter-parkedcolor">[`parkedColor`](../parkedcolormixin#getter-parkedcolor)</span>

From [BaseChordDisplay](../basechorddisplay): <span id="getter-view">[`view`](../basechorddisplay#getter-view)</span>, <span id="getter-trackassemblynames">[`trackAssemblyNames`](../basechorddisplay#getter-trackassemblynames)</span>, <span id="getter-fetchinert">[`fetchInert`](../basechorddisplay#getter-fetchinert)</span>, <span id="getter-loaded">[`loaded`](../basechorddisplay#getter-loaded)</span>, <span id="getter-ready">[`ready`](../basechorddisplay#getter-ready)</span>, <span id="getter-displayerror">[`displayError`](../basechorddisplay#getter-displayerror)</span>, <span id="getter-svgready">[`svgReady`](../basechorddisplay#getter-svgready)</span>, <span id="getter-displayphase">[`displayPhase`](../basechorddisplay#getter-displayphase)</span>, <span id="getter-radiuspx">[`radiusPx`](../basechorddisplay#getter-radiuspx)</span>, <span id="getter-curvedepth">[`curveDepth`](../basechorddisplay#getter-curvedepth)</span>, <span id="getter-bezierradius">[`bezierRadius`](../basechorddisplay#getter-bezierradius)</span>, <span id="getter-selectedfeatureid">[`selectedFeatureId`](../basechorddisplay#getter-selectedfeatureid)</span>, <span id="getter-hoveredfeatureid">[`hoveredFeatureId`](../basechorddisplay#getter-hoveredfeatureid)</span>, <span id="getter-figurestage">[`figureStage`](../basechorddisplay#getter-figurestage)</span>, <span id="getter-drawncount">[`drawnCount`](../basechorddisplay#getter-drawncount)</span>, <span id="getter-shapes">[`shapes`](../basechorddisplay#getter-shapes)</span>

From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-hoveredfeature">[`hoveredFeature`](../basedisplay#getter-hoveredfeature)</span>, <span id="getter-featurenoun">[`featureNoun`](../basedisplay#getter-featurenoun)</span>, <span id="getter-livenotices">[`liveNotices`](../basedisplay#getter-livenotices)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-confignotices">[`configNotices`](../basedisplay#getter-confignotices)</span>, <span id="getter-notices">[`notices`](../basedisplay#getter-notices)</span>, <span id="getter-cornernotices">[`cornerNotices`](../basedisplay#getter-cornernotices)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span>

</details>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-shapeat">**shapeAt**</span><br><code>(i: number) =&gt; ChordShape &#124; undefined</code> | lane `i` as the SVG side draws it, on the unrotated figure; undefined for a chord whose ends are under a pixel apart |
| <span id="method-laneat">**laneAt**</span><br><code>(x: number, y: number) =&gt; number &#124; undefined</code> | the chord passing nearest a figure point, within `CHORD_HIT_PX` |
| <span id="method-shapelabel">**shapeLabel**</span><br><code>(feature: Feature) =&gt; string</code> |  |
| <span id="method-swatchcolor">**swatchColor**</span><br><code>(color: string) =&gt; string</code> | a key swatch for `encoding.color`, faded as the chords draw it |
| <span id="method-rendersvg">**renderSvg**</span><br><code>() =&gt; Promise&lt;Element &#124; null&gt;</code> |  |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> | Color by... and Advanced → Edit plot..., which the circular view shows under its Tracks menu |

<details class="inherited-members" data-pagefind-ignore>
<summary>12 inherited methods from 3 models</summary>

From [ParkedColorMixin](../parkedcolormixin): <span id="method-parkedcolorof">[`parkedColorOf`](../parkedcolormixin#method-parkedcolorof)</span>

From [BaseChordDisplay](../basechorddisplay): <span id="method-shapefor">[`shapeFor`](../basechorddisplay#method-shapefor)</span>, <span id="method-shapepathfor">[`shapePathFor`](../basechorddisplay#method-shapepathfor)</span>, <span id="method-hitat">[`hitAt`](../basechorddisplay#method-hitat)</span>, <span id="method-assemblyof">[`assemblyOf`](../basechorddisplay#method-assemblyof)</span>, <span id="method-canonicalrefname">[`canonicalRefName`](../basechorddisplay#method-canonicalrefname)</span>, <span id="method-axisslice">[`axisSlice`](../basechorddisplay#method-axisslice)</span>

From [BaseDisplay](../basedisplay): <span id="method-renderingprops">[`renderingProps`](../basedisplay#method-renderingprops)</span>, <span id="method-configproblemsof">[`configProblemsOf`](../basedisplay#method-configproblemsof)</span>, <span id="method-liftplot">[`liftPlot`](../basedisplay#method-liftplot)</span>, <span id="method-plotproblems">[`plotProblems`](../basedisplay#method-plotproblems)</span>, <span id="method-plotwrites">[`plotWrites`](../basedisplay#method-plotwrites)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-onchordclick">**onChordClick**</span><br><code>(feature: Feature) =&gt; void</code> | the `onChordClick` callback when the config sets one, else the record's details |
| <span id="action-clickfeature">**clickFeature**</span><br><code>(feature: Feature) =&gt; void</code> | what a click on the canvas reaches |
| <span id="action-sethighlightedfeatureids">**setHighlightedFeatureIds**</span><br><code>(ids: string[] &#124; undefined) =&gt; void</code> |  |
| <span id="action-setvisiblefeatureids">**setVisibleFeatureIds**</span><br><code>(ids: string[] &#124; undefined) =&gt; void</code> |  |
| <span id="action-opensolidcolordialog">**openSolidColorDialog**</span><br><code>() =&gt; void</code> | the picker Color by's Solid color... opens |

<details class="inherited-members" data-pagefind-ignore>
<summary>13 inherited actions from 4 models</summary>

From [ColorWritesMixin](../colorwritesmixin): <span id="action-colorbyfield">[`colorByField`](../colorwritesmixin#action-colorbyfield)</span>, <span id="action-setcolorvalue">[`setColorValue`](../colorwritesmixin#action-setcolorvalue)</span>, <span id="action-pickdefaultcolor">[`pickDefaultColor`](../colorwritesmixin#action-pickdefaultcolor)</span>, <span id="action-picksolidcolor">[`pickSolidColor`](../colorwritesmixin#action-picksolidcolor)</span>

From [ParkedColorMixin](../parkedcolormixin): <span id="action-parkcolor">[`parkColor`](../parkedcolormixin#action-parkcolor)</span>

From [BaseChordDisplay](../basechorddisplay): <span id="action-openerrordialog">[`openErrorDialog`](../basechorddisplay#action-openerrordialog)</span>, <span id="action-setfeatures">[`setFeatures`](../basechorddisplay#action-setfeatures)</span>, <span id="action-reload">[`reload`](../basechorddisplay#action-reload)</span>

From [BaseDisplay](../basedisplay): <span id="action-setstatusmessage">[`setStatusMessage`](../basedisplay#action-setstatusmessage)</span>, <span id="action-seterror">[`setError`](../basedisplay#action-seterror)</span>, <span id="action-clearhoveredfeature">[`clearHoveredFeature`](../basedisplay#action-clearhoveredfeature)</span>, <span id="action-applydisplaysettings">[`applyDisplaySettings`](../basedisplay#action-applydisplaysettings)</span>, <span id="action-applyplot">[`applyPlot`](../basedisplay#action-applyplot)</span>

</details>
