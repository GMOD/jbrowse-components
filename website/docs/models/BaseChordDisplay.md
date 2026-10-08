---
id: basechorddisplay
title: BaseChordDisplay
description: "What the circular view's chord and ribbon displays share: the features, the slice index a feature end is looked up in, and the lifecycle getters ChordDisplayFrame publishes. A track draws on the…"
sidebar_label: Display -> BaseChordDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/chords/BaseChordDisplay.ts).

What the circular view's chord and ribbon displays share: the features, the
slice index a feature end is looked up in, and the lifecycle getters
`ChordDisplayFrame` publishes. A track
draws on the arcs of its own assemblies, so a one-genome variant track on a
two-genome circle fetches and places only that genome's chords.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="property-id">[`id`](../basedisplay#property-id)</span>, <span id="property-type">[`type`](../basedisplay#property-type)</span></span>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-features">**features**</span><br><code>Feature[] &#124; undefined</code> |  |
| <span id="volatile-reloadcounter">**reloadCounter**</span><br><code>number</code> | the fetch's pure "go again" signal |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="volatile-error">[`error`](../basedisplay#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../basedisplay#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../basedisplay#volatile-statusprogress)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-view">**view**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { resizeHeight(distance: number): number; resizeWidth(distance: number): number; } &amp; { afterCreate(): void; beforeDestroy(): void; afterAttach(): void; } &amp; { tracksMenuItem(): MenuItem; } &amp; { readonly legendSpec: LegendSpec; legendSpecIn(palette?: JBrowsePalette &#124; undefined): LegendSpec; menuItems(): MenuItem[]; } &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> |  |
| <span id="getter-trackassemblynames">**trackAssemblyNames**</span><br><code>string[]</code> | the track's assemblies that are on the circle, canonical and in the order the circle lays them out |
| <span id="getter-fetchinert">**fetchInert**</span><br><code>boolean</code> | nothing of this track's is on the circle, so the fetch never runs; the SVG export's wait and the retry contract check both read it |
| <span id="getter-loaded">**loaded**</span><br><code>boolean</code> |  |
| <span id="getter-ready">**ready**</span><br><code>boolean</code> |  |
| <span id="getter-displayerror">**displayError**</span><br><code>unknown</code> | what the error ring shows |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | the off-screen export gate, on the shared `computeSvgReady` policy. A radial display has no box to draw an error in, so the export fails rather than exporting a message |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayStatusPhase</code> |  |
| <span id="getter-radiuspx">**radiusPx**</span><br><code>number</code> |  |
| <span id="getter-bezierradiusratio">**bezierRadiusRatio**</span><br><code>number</code> | how far from the center a chord across the circle passes, as a fraction of the radius; a shorter chord bows less, in proportion to its span |
| <span id="getter-bezierradius">**bezierRadius**</span><br><code>number</code> |  |
| <span id="getter-sliceindex">**sliceIndex**</span><br><code>Record&lt;string, Slice&gt;</code> | every slice of the circle, keyed by canonical assembly AND refName: two genomes on one circle can each carry a `chr1`. An elided slice answers to each refName it swallowed. |
| <span id="getter-drawnfeatures">**drawnFeatures**</span><br><code>Feature[] &#124; undefined</code> | what the chord components draw |
| <span id="getter-selectedfeatureid">**selectedFeatureId**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-hoveredfeatureid">**hoveredFeatureId**</span><br><code>string &#124; undefined</code> | the feature under the pointer, which the view hit-tests for every chord display at once |
| <span id="getter-chordstage">**chordStage**</span><br><code>ChordStage</code> | the polar stage as the canvas and the pointer see it, rotation in |
| <span id="getter-figurestage">**figureStage**</span><br><code>ChordStage</code> | the polar stage on the unrotated figure, which the view's SVG turns: what the export and the highlight paths are placed on |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-hoveredfeature">[`hoveredFeature`](../basedisplay#getter-hoveredfeature)</span>, <span id="getter-featurenoun">[`featureNoun`](../basedisplay#getter-featurenoun)</span>, <span id="getter-featurewidgettype">[`featureWidgetType`](../basedisplay#getter-featurewidgettype)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-assemblyof">**assemblyOf**</span><br><code>(assemblyName: string &#124; undefined) =&gt; string &#124; undefined</code> | the assembly on the circle a feature names, in whatever spelling the adapter wrote. A feature that names none, as a VCF record does not, is on the track's first assembly. |
| <span id="method-canonicalrefname">**canonicalRefName**</span><br><code>(assemblyName: string, refName: string) =&gt; string</code> | a refName as the adapter wrote it, in the assembly's canonical spelling |
| <span id="method-slicefor">**sliceFor**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(assemblyName: string &#124; undefined, refName: string) =&gt; Slice &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(assemblyName: string &#124; undefined, refName: string) =&gt; Slice &#124; undefined</code></pre></dialog></span> | the slice one end of a feature lands on |
| <span id="method-axisslice">**axisSlice**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(assemblyName: string &#124; undefined, refName: string) =&gt; AxisSlic…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(assemblyName: string &#124; undefined, refName: string) =&gt; AxisSlice &#124; undefined</code></pre></dialog></span> | the slice of the unrolled axis one end of a feature lands on |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="method-renderingprops">[`renderingProps`](../basedisplay#method-renderingprops)</span>, <span id="method-trackmenuitems">[`trackMenuItems`](../basedisplay#method-trackmenuitems)</span>, <span id="method-liftplot">[`liftPlot`](../basedisplay#method-liftplot)</span>, <span id="method-plotproblems">[`plotProblems`](../basedisplay#method-plotproblems)</span>, <span id="method-plotwrites">[`plotWrites`](../basedisplay#method-plotwrites)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-openerrordialog">**openErrorDialog**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setfeatures">**setFeatures**</span><br><code>(features: Feature[] &#124; undefined) =&gt; void</code> |  |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="action-setstatusmessage">[`setStatusMessage`](../basedisplay#action-setstatusmessage)</span>, <span id="action-seterror">[`setError`](../basedisplay#action-seterror)</span>, <span id="action-clearhoveredfeature">[`clearHoveredFeature`](../basedisplay#action-clearhoveredfeature)</span>, <span id="action-applydisplaysettings">[`applyDisplaySettings`](../basedisplay#action-applydisplaysettings)</span>, <span id="action-applyplot">[`applyPlot`](../basedisplay#action-applyplot)</span></span>
