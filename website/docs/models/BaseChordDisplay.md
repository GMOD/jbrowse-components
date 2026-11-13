---
id: basechorddisplay
title: BaseChordDisplay
description: "What the circular view's chord and ribbon displays share: the features, the slice index a feature end is looked up in, the lifecycle getters ChordDisplayFrame publishes, and the linear displays'…"
sidebar_label: Display -> BaseChordDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source. See the [developer guide](/docs/developer_guide/) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/chords/BaseChordDisplay.ts).

What the circular view's chord and ribbon displays share: the features, the
slice index a feature end is looked up in, the lifecycle getters
`ChordDisplayFrame` publishes, and the linear displays' region-too-large
gate, which a display opts into with `gateEnabled`. A track
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
<summary>6 inherited volatiles from 2 models</summary>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="volatile-forceloadtrack">[`forceLoadTrack`](../regiontoolargemixin#volatile-forceloadtrack)</span>, <span id="volatile-byteestimate">[`byteEstimate`](../regiontoolargemixin#volatile-byteestimate)</span>, <span id="volatile-gatemeasuredviewportkey">[`gateMeasuredViewportKey`](../regiontoolargemixin#volatile-gatemeasuredviewportkey)</span>

From [BaseDisplay](../basedisplay): <span id="volatile-error">[`error`](../basedisplay#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../basedisplay#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../basedisplay#volatile-statusprogress)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-view">**view**</span><br><code><a href="../circularview">CircularView</a></code> |  |
| <span id="getter-trackassemblynames">**trackAssemblyNames**</span><br><code>string[]</code> | the track's assemblies that are on the circle, canonical and in the order the circle lays them out |
| <span id="getter-trackregions">**trackRegions**</span><br><code>Region[]</code> | the displayed regions on the track's assemblies |
| <span id="getter-fetchinert">**fetchInert**</span><br><code>boolean</code> | nothing of this track's is on the circle, so the fetch never runs; the SVG export's wait and the retry contract check both read it |
| <span id="getter-loaded">**loaded**</span><br><code>boolean</code> |  |
| <span id="getter-ready">**ready**</span><br><code>boolean</code> |  |
| <span id="getter-displayerror">**displayError**</span><br><code>unknown</code> | what the error ring shows |
| <span id="getter-settingsfetchinputs">**settingsFetchInputs**</span><br><code>{}</code> | a chord fetch takes no settings, so the gate's measurement is about the regions alone |
| <span id="getter-svgready">**svgReady**</span><br><code>boolean</code> | the off-screen export gate, on the shared `computeSvgReady` policy. A radial display has no box to draw an error in, so the export fails rather than exporting a message |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayStatusPhase</code> |  |
| <span id="getter-radiuspx">**radiusPx**</span><br><code>number</code> |  |
| <span id="getter-curvedepth">**curveDepth**</span><br><code>number</code> | `mark.depth`, how deeply a chord curves toward the center, 0 to 1 |
| <span id="getter-bezierradius">**bezierRadius**</span><br><code>number</code> | the radius of a chord's Bezier control point when its ends are opposite each other |
| <span id="getter-hoveredfeatureid">**hoveredFeatureId**</span><br><code>string &#124; undefined</code> | the feature under the pointer, which the view hit-tests for every chord display at once |
| <span id="getter-figurestage">**figureStage**</span><br><code>ChordStage</code> | the polar stage on the unrotated figure, which the view's SVG turns: what the export, the highlight paths and the hit tests are placed on |
| <span id="getter-drawnlanes">**drawnLanes**</span><br><code>{ count: number; features: readonly Feature[]; }</code> | Overridable hook: the drawn records, one per lane, in paint order |
| <span id="getter-laneindexbyid">**laneIndexById**</span><br><code>ReadonlyMap&lt;string, number&gt;</code> | each drawn record's lane, by id |
| <span id="getter-drawncount">**drawnCount**</span><br><code>number</code> | how many lanes the canvas draws, a chord under a pixel included |
| <span id="getter-shapes">**shapes**</span><br><code>Shape[]</code> | every drawn shape, as the export draws it |

<details class="inherited-members" data-pagefind-ignore>
<summary>38 inherited getters from 2 models</summary>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="getter-gateenabled">[`gateEnabled`](../regiontoolargemixin#getter-gateenabled)</span>, <span id="getter-bytegateadapterconfig">[`byteGateAdapterConfig`](../regiontoolargemixin#getter-bytegateadapterconfig)</span>, <span id="getter-densitytoolarge">[`densityTooLarge`](../regiontoolargemixin#getter-densitytoolarge)</span>, <span id="getter-bytegateadapterpath">[`byteGateAdapterPath`](../regiontoolargemixin#getter-bytegateadapterpath)</span>, <span id="getter-adapterfetchsizelimit">[`adapterFetchSizeLimit`](../regiontoolargemixin#getter-adapterfetchsizelimit)</span>, <span id="getter-gateviewportspanbp">[`gateViewportSpanBp`](../regiontoolargemixin#getter-gateviewportspanbp)</span>, <span id="getter-gateviewport">[`gateViewport`](../regiontoolargemixin#getter-gateviewport)</span>, <span id="getter-configuredfetchsizelimit">[`configuredFetchSizeLimit`](../regiontoolargemixin#getter-configuredfetchsizelimit)</span>, <span id="getter-configforceload">[`configForceLoad`](../regiontoolargemixin#getter-configforceload)</span>, <span id="getter-aboveforceloadfloor">[`aboveForceLoadFloor`](../regiontoolargemixin#getter-aboveforceloadfloor)</span>, <span id="getter-gateexempt">[`gateExempt`](../regiontoolargemixin#getter-gateexempt)</span>, <span id="getter-estimatedfetchbytes">[`estimatedFetchBytes`](../regiontoolargemixin#getter-estimatedfetchbytes)</span>, <span id="getter-gatebytelimit">[`gateByteLimit`](../regiontoolargemixin#getter-gatebytelimit)</span>, <span id="getter-gateactive">[`gateActive`](../regiontoolargemixin#getter-gateactive)</span>, <span id="getter-gatemeasurementstale">[`gateMeasurementStale`](../regiontoolargemixin#getter-gatemeasurementstale)</span>, <span id="getter-densitygateactive">[`densityGateActive`](../regiontoolargemixin#getter-densitygateactive)</span>, <span id="getter-toolargestatus">[`tooLargeStatus`](../regiontoolargemixin#getter-toolargestatus)</span>, <span id="getter-regiontoolarge">[`regionTooLarge`](../regiontoolargemixin#getter-regiontoolarge)</span>, <span id="getter-regiontoolargereason">[`regionTooLargeReason`](../regiontoolargemixin#getter-regiontoolargereason)</span>, <span id="getter-zoomcanreleasegate">[`zoomCanReleaseGate`](../regiontoolargemixin#getter-zoomcanreleasegate)</span>, <span id="getter-gateskipsmeasuredviewport">[`gateSkipsMeasuredViewport`](../regiontoolargemixin#getter-gateskipsmeasuredviewport)</span>

From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-selectedfeatureid">[`selectedFeatureId`](../basedisplay#getter-selectedfeatureid)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-hoveredfeature">[`hoveredFeature`](../basedisplay#getter-hoveredfeature)</span>, <span id="getter-featurenoun">[`featureNoun`](../basedisplay#getter-featurenoun)</span>, <span id="getter-featurewidgettype">[`featureWidgetType`](../basedisplay#getter-featurewidgettype)</span>, <span id="getter-livenotices">[`liveNotices`](../basedisplay#getter-livenotices)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-confignotices">[`configNotices`](../basedisplay#getter-confignotices)</span>, <span id="getter-notices">[`notices`](../basedisplay#getter-notices)</span>, <span id="getter-cornernotices">[`cornerNotices`](../basedisplay#getter-cornernotices)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span>

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
| <span id="method-placeend">**placeEnd**</span><br><code>(assemblyName: string &#124; undefined, refName: string) =&gt; PlacedEnd</code> | one end of a feature, as the adapter wrote it, on the circle: the assembly it names (`assemblyOf`) and its refName in that assembly's spelling, the assembly undefined where it names none on the circle |
| <span id="method-axisslice">**axisSlice**</span><br><code>({ assemblyName, refName }: PlacedEnd) =&gt; AxisSlice &#124; undefined</code> | the slice of the unrolled axis a placed end falls in |

<details class="inherited-members" data-pagefind-ignore>
<summary>9 inherited methods from 2 models</summary>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="method-gatefetchstate">[`gateFetchState`](../regiontoolargemixin#method-gatefetchstate)</span>, <span id="method-resolvedbytelimit">[`resolvedByteLimit`](../regiontoolargemixin#method-resolvedbytelimit)</span>

From [BaseDisplay](../basedisplay): <span id="method-renderingprops">[`renderingProps`](../basedisplay#method-renderingprops)</span>, <span id="method-trackmenuitems">[`trackMenuItems`](../basedisplay#method-trackmenuitems)</span>, <span id="method-exportedfeatures">[`exportedFeatures`](../basedisplay#method-exportedfeatures)</span>, <span id="method-configproblemsof">[`configProblemsOf`](../basedisplay#method-configproblemsof)</span>, <span id="method-liftplot">[`liftPlot`](../basedisplay#method-liftplot)</span>, <span id="method-plotproblems">[`plotProblems`](../basedisplay#method-plotproblems)</span>, <span id="method-plotwrites">[`plotWrites`](../basedisplay#method-plotwrites)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-openerrordialog">**openErrorDialog**</span><br><code>() =&gt; void</code> |  |
| <span id="action-clickfeature">**clickFeature**</span><br><code>(feature: Feature) =&gt; void</code> | what a click on the canvas reaches: the record's details |
| <span id="action-setfeatures">**setFeatures**</span><br><code>(features: Feature[] &#124; undefined) =&gt; void</code> |  |
| <span id="action-reload">**reload**</span><br><code>() =&gt; void</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>10 inherited actions from 2 models</summary>

From [RegionTooLargeMixin](../regiontoolargemixin): <span id="action-clearbyteestimate">[`clearByteEstimate`](../regiontoolargemixin#action-clearbyteestimate)</span>, <span id="action-cleargatemeasurements">[`clearGateMeasurements`](../regiontoolargemixin#action-cleargatemeasurements)</span>, <span id="action-setforceloadtrack">[`setForceLoadTrack`](../regiontoolargemixin#action-setforceloadtrack)</span>, <span id="action-commitfetchbytes">[`commitFetchBytes`](../regiontoolargemixin#action-commitfetchbytes)</span>, <span id="action-forceload">[`forceLoad`](../regiontoolargemixin#action-forceload)</span>

From [BaseDisplay](../basedisplay): <span id="action-setstatusmessage">[`setStatusMessage`](../basedisplay#action-setstatusmessage)</span>, <span id="action-seterror">[`setError`](../basedisplay#action-seterror)</span>, <span id="action-clearhoveredfeature">[`clearHoveredFeature`](../basedisplay#action-clearhoveredfeature)</span>, <span id="action-applydisplaysettings">[`applyDisplaySettings`](../basedisplay#action-applydisplaysettings)</span>, <span id="action-applyplot">[`applyPlot`](../basedisplay#action-applyplot)</span>

</details>
