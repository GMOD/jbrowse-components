---
id: basechorddisplay
title: BaseChordDisplay
description: "What the circular view's chord and ribbon displays share: the features, the slice index a feature end is looked up in, and the lifecycle getters ChordDisplayFrame publishes."
sidebar_label: Display -> BaseChordDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/chords/BaseChordDisplay.ts).

What the circular view's chord and ribbon displays share: the features, the
slice index a feature end is looked up in, and the lifecycle getters
`ChordDisplayFrame` publishes. A track
draws on the arcs of the assemblies it names, so a one-genome variant track
on a two-genome circle fetches and places only that genome's chords.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<details class="inherited-members" data-pagefind-ignore>
<summary>2 inherited properties from one model</summary>

From [BaseDisplay](../basedisplay): <span id="property-id">[`id`](../basedisplay#property-id)</span>, <span id="property-type">[`type`](../basedisplay#property-type)</span>

</details>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-features">**features**</span><br><code>Feature[] &#124; undefined</code> |  |
| <span id="volatile-reloadcounter">**reloadCounter**</span><br><code>number</code> | the fetch's pure "go again" signal |

<details class="inherited-members" data-pagefind-ignore>
<summary>3 inherited volatiles from one model</summary>

From [BaseDisplay](../basedisplay): <span id="volatile-error">[`error`](../basedisplay#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../basedisplay#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../basedisplay#volatile-statusprogress)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { resizeHeight(distance: number): number; resizeWidth(distance: number): number; } &amp; { afterCreate(): void; beforeDestroy(): void; afterAttach(): void; } &amp; { tracksMenuItem(): MenuItem; } &amp; { readonly legendSpec: LegendSpec; legendSpecIn(palette?: JBrowsePalette &#124; undefined): LegendSpec; menuItems(): MenuItem[]; } &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> |  |
| <span id="getter-trackassemblynames">**trackAssemblyNames**</span><br><code>string[]</code> | the track's assemblies that are on the circle, canonical and in the order the circle lays them out |
| <span id="getter-fetchinert">**fetchInert**</span><br><code>boolean</code> | nothing of this track's is on the circle, so the fetch never runs; the SVG export's wait and the retry contract check both read it |
| <span id="getter-loaded">**loaded**</span><br><code>boolean</code> |  |
| <span id="getter-ready">**ready**</span><br><code>boolean</code> |  |
| <span id="getter-displayerror">**displayError**</span><br><code>unknown</code> | what the error ring shows |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | the off-screen export gate, on the shared `computeSvgReady` policy. A radial display has no box to draw an error in, so the export fails rather than exporting a message |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayStatusPhase</code> |  |
| <span id="getter-radiuspx">**radiusPx**</span><br><code>number</code> |  |
| <span id="getter-curvedepth">**curveDepth**</span><br><code>number</code> | `mark.depth`, how deeply a chord curves toward the center, 0 to 1 |
| <span id="getter-bezierradius">**bezierRadius**</span><br><code>number</code> | the radius of a chord's Bezier control point when its ends are opposite each other |
| <span id="getter-selectedfeatureid">**selectedFeatureId**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-hoveredfeatureid">**hoveredFeatureId**</span><br><code>string &#124; undefined</code> | the feature under the pointer, which the view hit-tests for every chord display at once |
| <span id="getter-figurestage">**figureStage**</span><br><code>ChordStage</code> | the polar stage on the unrotated figure, which the view's SVG turns: what the export, the highlight paths and the hit tests are placed on |
| <span id="getter-drawnlanes">**drawnLanes**</span><br><code>{ count: number; features: readonly Feature[]; }</code> | Overridable hook: the drawn records, one per lane, in paint order |
| <span id="getter-laneindexbyid">**laneIndexById**</span><br><code>ReadonlyMap&lt;string, number&gt;</code> | each drawn record's lane, by id |
| <span id="getter-drawncount">**drawnCount**</span><br><code>number</code> | how many lanes the canvas draws, a chord under a pixel included |
| <span id="getter-shapes">**shapes**</span><br><code>Shape[]</code> | every drawn shape, as the export draws it |

<details class="inherited-members" data-pagefind-ignore>
<summary>16 inherited getters from one model</summary>

From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-hoveredfeature">[`hoveredFeature`](../basedisplay#getter-hoveredfeature)</span>, <span id="getter-featurenoun">[`featureNoun`](../basedisplay#getter-featurenoun)</span>, <span id="getter-featurewidgettype">[`featureWidgetType`](../basedisplay#getter-featurewidgettype)</span>, <span id="getter-livenotices">[`liveNotices`](../basedisplay#getter-livenotices)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-confignotices">[`configNotices`](../basedisplay#getter-confignotices)</span>, <span id="getter-notices">[`notices`](../basedisplay#getter-notices)</span>, <span id="getter-cornernotices">[`cornerNotices`](../basedisplay#getter-cornernotices)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span>

</details>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-shapeat">**shapeAt**</span><br><code>(_i: number) =&gt; Shape &#124; undefined</code> | Overridable hook: lane `i` as the SVG side draws it, on the unrotated figure; undefined where it draws nothing |
| <span id="method-laneat">**laneAt**</span><br><code>(_x: number, _y: number) =&gt; number &#124; undefined</code> | Overridable hook: the topmost lane under a point on the unrotated figure |
| <span id="method-shapefor">**shapeFor**</span><br><code>(featureId: string) =&gt; Shape &#124; undefined</code> | the shape a drawn record's id names, undefined where none draws |
| <span id="method-shapepathfor">**shapePathFor**</span><br><code>(feature: Feature) =&gt; string &#124; undefined</code> | a drawn feature's outline as an SVG path on the unrotated figure, for anything that has to find a shape on screen without a DOM node |
| <span id="method-hitat">**hitAt**</span><br><code>(dx: number, dy: number) =&gt; Feature &#124; undefined</code> | the record drawn under a point CSS px from the circle's centre in the screen frame |
| <span id="method-assemblyof">**assemblyOf**</span><br><code>(assemblyName: string &#124; undefined) =&gt; string &#124; undefined</code> | the assembly on the circle a feature names, in whatever spelling the adapter wrote. A feature that names none, as a VCF record does not, is on the track's first assembly. |
| <span id="method-canonicalrefname">**canonicalRefName**</span><br><code>(assemblyName: string, refName: string) =&gt; string</code> | a refName as the adapter wrote it, in the assembly's canonical spelling |
| <span id="method-axisslice">**axisSlice**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(assemblyName: string &#124; undefined, refName: string) =&gt; AxisSlic…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(assemblyName: string &#124; undefined, refName: string) =&gt; AxisSlice &#124; undefined</code></pre></dialog></span> | the slice of the unrolled axis that one end of a feature falls in |

<details class="inherited-members" data-pagefind-ignore>
<summary>6 inherited methods from one model</summary>

From [BaseDisplay](../basedisplay): <span id="method-renderingprops">[`renderingProps`](../basedisplay#method-renderingprops)</span>, <span id="method-trackmenuitems">[`trackMenuItems`](../basedisplay#method-trackmenuitems)</span>, <span id="method-configproblemsof">[`configProblemsOf`](../basedisplay#method-configproblemsof)</span>, <span id="method-liftplot">[`liftPlot`](../basedisplay#method-liftplot)</span>, <span id="method-plotproblems">[`plotProblems`](../basedisplay#method-plotproblems)</span>, <span id="method-plotwrites">[`plotWrites`](../basedisplay#method-plotwrites)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-openerrordialog">**openErrorDialog**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setfeatures">**setFeatures**</span><br><code>(features: Feature[] &#124; undefined) =&gt; void</code> |  |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>5 inherited actions from one model</summary>

From [BaseDisplay](../basedisplay): <span id="action-setstatusmessage">[`setStatusMessage`](../basedisplay#action-setstatusmessage)</span>, <span id="action-seterror">[`setError`](../basedisplay#action-seterror)</span>, <span id="action-clearhoveredfeature">[`clearHoveredFeature`](../basedisplay#action-clearhoveredfeature)</span>, <span id="action-applydisplaysettings">[`applyDisplaySettings`](../basedisplay#action-applydisplaysettings)</span>, <span id="action-applyplot">[`applyPlot`](../basedisplay#action-applyplot)</span>

</details>
