---
id: multiwaysyntenydisplay
title: MultiWaySyntenyDisplay
description: "draws a multi-genome ortholog track as one lane per assembly inside a linear genome view, with ribbons joining each gene's placements between adjacent lanes"
sidebar_label: Display -> MultiWaySyntenyDisplay
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/model.ts).

draws a multi-genome ortholog track as one lane per assembly inside a linear
genome view, with ribbons joining each gene's placements between adjacent
lanes

The configuration slots for this model are documented on its [config schema page](../../config/multiwaysyntenydisplay).

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('MultiWaySyntenyDisplay')</code> |  |
| <span id="property-configuration">**configuration**</span><br><code>configuration: ConfigurationReference(configSchema)</code> |  |
| <span id="property-hiddenlanenames">**hiddenLaneNames**</span><br><code>hiddenLaneNames: types.frozen&lt;readonly string[] &#124; undefined&gt;()</code> | the lanes a reader hid from the lane menu, by assembly name; the lanes chosen are `rows.kept` |
| <span id="property-frozenlanes">**frozenLanes**</span><br><code>frozenLanes: types.frozen&lt;FrozenLanes &#124; undefined&gt;()</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="property-id">[`id`](../basedisplay#property-id)</span></span>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-fetchedfeatures">**fetchedFeatures**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ anchor: string; features: Feature[]; ops: AlignmentOpsById; l…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ anchor: string; features: Feature[]; ops: AlignmentOpsById; lanes?: string[] &#124; undefined; } &#124; undefined</code></pre></dialog></span> |  |
| <span id="volatile-seenattributeranges">**seenAttributeRanges**</span><br><code>Record&lt;string, AttributeRange&gt;</code> |  |
| <span id="volatile-lanegenes">**laneGenes**</span><br><code>LaneFetchState&lt;HeldLaneGenes&gt;</code> |  |
| <span id="volatile-lanedescriptions">**laneDescriptions**</span><br><code>Map&lt;string, AssemblyDescription&gt;</code> |  |
| <span id="volatile-describedlanes">**describedLanes**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="volatile-lanesbeingdescribed">**lanesBeingDescribed**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="volatile-releasedlanes">**releasedLanes**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="volatile-lanelinks">**laneLinks**</span><br><code>LaneFetchState&lt;HeldLaneLinks&gt;</code> | per adjacent mate-lane pair, at the lanes' own coordinates |
| <span id="volatile-lanegroups">**laneGroups**</span><br><code>LaneFetchState&lt;HeldLaneGroups&gt;</code> | per mate lane, a gene table's rows on the lane's own window |
| <span id="volatile-lanelayerdata">**laneLayerData**</span><br><code>LaneFetchState&lt;HeldLaneLayer&gt;</code> |  |
| <span id="volatile-hovertarget">**hoverTarget**</span><br><code>HoverTarget &#124; undefined</code> |  |
| <span id="volatile-clickedtarget">**clickedTarget**</span><br><code>RibbonRef &#124; undefined</code> |  |
| <span id="volatile-lanedecisions">**laneDecisions**</span><br><code>Map&lt;string, LaneDecision &#124; undefined&gt;</code> |  |
| <span id="volatile-pinnedlanecontigs">**pinnedLaneContigs**</span><br><code>Map&lt;string, string&gt;</code> |  |
| <span id="volatile-laneflippinsbyanchor">**laneFlipPinsByAnchor**</span><br><code>Map&lt;string, ReadonlyMap&lt;string, LaneFlipPin&gt;&gt;</code> |  |
| <span id="volatile-renderoriginpx">**renderOriginPx**</span><br><code>number</code> | the view's `offsetPx` the stack was last laid out against |
| <span id="volatile-lanetransitions">**laneTransitions**</span><br><code>Map&lt;string, LaneTransition&gt;</code> |  |
| <span id="volatile-lanemotionclockms">**laneMotionClockMs**</span><br><code>number</code> |  |
| <span id="volatile-lanemotionhalfway">**laneMotionHalfway**</span><br><code>ReadonlySet&lt;string&gt;</code> |  |
| <span id="volatile-lanedragpx">**laneDragPx**</span><br><code>ReadonlyMap&lt;string, number&gt;</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="volatile-error">[`error`](../basedisplay#volatile-error)</span>, <span id="volatile-statusmessage">[`statusMessage`](../basedisplay#volatile-statusmessage)</span>, <span id="volatile-statusprogress">[`statusProgress`](../basedisplay#volatile-statusprogress)</span></span>

<span data-pagefind-ignore>From [TrackHeightMixin](../trackheightmixin): <span id="volatile-scrolltop">[`scrollTop`](../trackheightmixin#volatile-scrolltop)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="volatile-forceloadtrack">[`forceLoadTrack`](../regiontoolargemixin#volatile-forceloadtrack)</span>, <span id="volatile-byteestimate">[`byteEstimate`](../regiontoolargemixin#volatile-byteestimate)</span>, <span id="volatile-gatemeasuredviewportkey">[`gateMeasuredViewportKey`](../regiontoolargemixin#volatile-gatemeasuredviewportkey)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="volatile-canvasdrawn">[`canvasDrawn`](../renderlifecyclemixin#volatile-canvasdrawn)</span>, <span id="volatile-paintcount">[`paintCount`](../renderlifecyclemixin#volatile-paintcount)</span>, <span id="volatile-currentrenderingbackend">[`currentRenderingBackend`](../renderlifecyclemixin#volatile-currentrenderingbackend)</span>, <span id="volatile-rendertick">[`renderTick`](../renderlifecyclemixin#volatile-rendertick)</span>, <span id="volatile-autorunsinstalled">[`autorunsInstalled`](../renderlifecyclemixin#volatile-autorunsinstalled)</span>, <span id="volatile-rendererror">[`renderError`](../renderlifecyclemixin#volatile-rendererror)</span>, <span id="volatile-offscreen">[`offScreen`](../renderlifecyclemixin#volatile-offscreen)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="volatile-loadedfetchkey">[`loadedFetchKey`](../keyedfetchmixin#volatile-loadedfetchkey)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="volatile-activesignal">[`activeSignal`](../fetchmixin#volatile-activesignal)</span>, <span id="volatile-fetchgeneration">[`fetchGeneration`](../fetchmixin#volatile-fetchgeneration)</span>, <span id="volatile-reloadcounter">[`reloadCounter`](../fetchmixin#volatile-reloadcounter)</span>, <span id="volatile-statuswindow">[`statusWindow`](../fetchmixin#volatile-statuswindow)</span>, <span id="volatile-fetchcanceled">[`fetchCanceled`](../fetchmixin#volatile-fetchcanceled)</span>, <span id="volatile-fetchrotation">[`fetchRotation`](../fetchmixin#volatile-fetchrotation)</span></span>

<span data-pagefind-ignore>From [LegendMixin](../legendmixin): <span id="volatile-dismissedlegendsections">[`dismissedLegendSections`](../legendmixin#volatile-dismissedlegendsections)</span></span>

<span data-pagefind-ignore>From [LodTierInfoMixin](../lodtierinfomixin): <span id="volatile-adapterheaderread">[`adapterHeaderRead`](../lodtierinfomixin#volatile-adapterheaderread)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-declaredlanes">**declaredLanes**</span><br><code>DeclaredLane[] &#124; undefined</code> |  |
| <span id="getter-staranchor">**starAnchor**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-lgv">**lgv**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { rubberbandClickMenuItems(clickOffset: BpOffset): MenuItem[]; highlightMenuItems(_highlight: HighlightType): MenuItem[]; } &amp; { flyTo: (centerBp: number, windowWidthBp: number) =&gt; void; flyToCenter(coord: number, refName: string, displayedRegionIndex?: number &#124; undefined): void; flyToFit(centerBp: number, fitWidthBp: number): void; } &amp; { afterCreate(): void; afterAttach(): void; } &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> |  |
| <span id="getter-features">**features**</span><br><code>Feature[] &#124; undefined</code> | undefined while the view's anchor differs from the fetch's |
| <span id="getter-featureops">**featureOps**</span><br><code>AlignmentOpsById</code> |  |
| <span id="getter-hoveredgroupkey">**hoveredGroupKey**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-lodmode">**lodMode**</span><br><code>LodMode</code> |  |
| <span id="getter-haslodcapableadapter">**hasLodCapableAdapter**</span><br><code>boolean</code> |  |
| <span id="getter-lodtier">**lodTier**</span><br><code>LodTier</code> | read off the settled zoom, so a passing gesture refetches nothing |
| <span id="getter-livelodtier">**liveLodTier**</span><br><code>LodTier</code> |  |
| <span id="getter-canvaswidth">**canvasWidth**</span><br><code>number</code> |  |
| <span id="getter-viewsignature">**viewSignature**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-groups">**groups**</span><br><code>MultiWayGroup[]</code> |  |
| <span id="getter-laneopenings">**laneOpenings**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(assemblyName: string, refName: string) =&gt; readonly LaneOpening…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(assemblyName: string, refName: string) =&gt; readonly LaneOpening[]</code></pre></dialog></span> | each lane's holes, read off every fetched group rather than the viewport's, so one appears once both its pieces arrive and not as the second scrolls in |
| <span id="getter-featuresarenameless">**featuresAreNameless**</span><br><code>boolean</code> |  |
| <span id="getter-ribboncolor">**ribbonColor**</span><br><code>string</code> |  |
| <span id="getter-domain">**domain**</span><br><code>string[]</code> |  |
| <span id="getter-lanechoice">**laneChoice**</span><br><code>readonly string[] &#124; undefined</code> | `rows.kept` as a choice: undefined while it names no lane |
| <span id="getter-ribboncolorfield">**ribbonColorField**</span><br><code>string</code> |  |
| <span id="getter-ribboncolorattributes">**ribbonColorAttributes**</span><br><code>string[]</code> |  |
| <span id="getter-ribboncolordomain">**ribbonColorDomain**</span><br><code>string[]</code> |  |
| <span id="getter-ribbonpaint">**ribbonPaint**</span><br><code>SyntenyColorPaint</code> |  |
| <span id="getter-ribbonattributeranges">**ribbonAttributeRanges**</span><br><code>Record&lt;string, AttributeRange&gt;</code> |  |
| <span id="getter-hideunlabelled">**hideUnlabelled**</span><br><code>boolean</code> |  |
| <span id="getter-drawcurves">**drawCurves**</span><br><code>boolean</code> |  |
| <span id="getter-bridgeskippedlanes">**bridgeSkippedLanes**</span><br><code>boolean</code> |  |
| <span id="getter-showlaneticks">**showLaneTicks**</span><br><code>boolean</code> |  |
| <span id="getter-splitstrands">**splitStrands**</span><br><code>boolean</code> |  |
| <span id="getter-showgenelabels">**showGeneLabels**</span><br><code>boolean</code> |  |
| <span id="getter-genetextfield">**geneTextField**</span><br><code>string</code> | a field, a jexl expression, or empty for the name-else-ID default |
| <span id="getter-inlinelanenames">**inlineLaneNames**</span><br><code>boolean</code> |  |
| <span id="getter-genelabelpx">**geneLabelPx**</span><br><code>number</code> |  |
| <span id="getter-lanelayerheights">**laneLayerHeights**</span><br><code>number[]</code> |  |
| <span id="getter-layerpx">**layerPx**</span><br><code>number</code> |  |
| <span id="getter-genecolorsettings">**geneColorSettings**</span><br><code>GeneColorSettings</code> |  |
| <span id="getter-genecolorencoding">**geneColorEncoding**</span><br><code>string &#124; FieldColorEncoding &#124; undefined</code> |  |
| <span id="getter-genecolorslots">**geneColorSlots**</span><br><code>HeldSlots &#124; undefined</code> | The slots a categorical gene color deals its values into. |
| <span id="getter-genecolorfield">**geneColorField**</span><br><code>string</code> | `''` while `color.value` paints |
| <span id="getter-genesolidcolor">**geneSolidColor**</span><br><code>string &#124; undefined</code> | the constant `color.value` holds, undefined for none or a `jexl:` one |
| <span id="getter-boxcolors">**boxColors**</span><br><code>GeneColors</code> |  |
| <span id="getter-lanegenecolors">**laneGeneColors**</span><br><code>ReadonlyMap&lt;string, GeneColors&gt;</code> |  |
| <span id="getter-selectedfeatureid">**selectedFeatureId**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-anchorassemblyname">**anchorAssemblyName**</span><br><code>string</code> |  |
| <span id="getter-adaptercapabilities">**adapterCapabilities**</span><br><code>readonly string[]</code> |  |
| <span id="getter-adapterdeclareslanes">**adapterDeclaresLanes**</span><br><code>boolean</code> |  |
| <span id="getter-adapterpairsonanchor">**adapterPairsOnAnchor**</span><br><code>boolean</code> |  |
| <span id="getter-adapterbatcheslanepairs">**adapterBatchesLanePairs**</span><br><code>boolean</code> | the adapter answers a window's `lanePairs` in one call |
| <span id="getter-adjacentlanesaligndirectly">**adjacentLanesAlignDirectly**</span><br><code>boolean</code> |  |
| <span id="getter-rowsvsanchor">**rowsVsAnchor**</span><br><code>boolean</code> | a source that names an anchor and answers no lane pairs states each lane against the anchor alone, so each gutter draws its lower lane against the anchor |
| <span id="getter-pinnedlaneflips">**pinnedLaneFlips**</span><br><code>ReadonlyMap&lt;string, LaneFlipPin&gt;</code> |  |
| <span id="getter-configuredlanes">**configuredLanes**</span><br><code>string[]</code> | the track's assemblies beside the anchor for a source that declares its own lanes, empty for every other source |
| <span id="getter-laneselection">**laneSelection**</span><br><code>readonly string[] &#124; undefined</code> | undefined means every lane, and a hidden lane stays in force |
| <span id="getter-hiddenlanes">**hiddenLanes**</span><br><code>readonly string[]</code> |  |
| <span id="getter-fetchlaneselection">**fetchLaneSelection**</span><br><code>string[] &#124; undefined</code> | undefined unless the adapter declares its lanes, and lists each held genome under every name the session knows it by |
| <span id="getter-anchorassembly">**anchorAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…}…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { getCanonicalRefName2(refName: string): string; isValidRefName(refName: string): boolean; } &amp; { getRefNamePosition(refName: string): number &#124; undefined; getAliasesForRefName(refName: string): string[]; getRefNameMapForAdapter(adapterConf: AdapterConf, options: BaseOptions): Promise&lt;…&gt;; getRefNameMismatch(adapterCacheKey: string): RefNameMismatch &#124; undefined; } &amp; IStateTreeNode&lt;…&gt;) &#124; undefined</code></pre></dialog></span> |  |
| <span id="getter-anchorlocstring">**anchorLocString**</span><br><code>string</code> |  |
| <span id="getter-declaredlanelabels">**declaredLaneLabels**</span><br><code>Map&lt;string, string&gt;</code> | keyed by `laneKey` |
| <span id="getter-laneuniverse">**laneUniverse**</span><br><code>LaneChoice[]</code> | the anchor is never a lane |
| <span id="getter-rowassemblies">**rowAssemblies**</span><br><code>string[]</code> | a paralogy mate on the anchor assembly draws on its axis, not as a row |
| <span id="getter-lanestructureorder">**laneStructureOrder**</span><br><code>string[]</code> | the drawn lanes chained by their deletions and insertions against the anchor, for "Order lanes by structure"; empty for a gene table |
| <span id="getter-rowoflane">**rowOfLane**</span><br><code>ReadonlyMap&lt;string, string&gt;</code> | each drawn lane's row name by its canonical name, for data keyed by the records' spelling of a lane |
| <span id="getter-lanestodescribe">**lanesToDescribe**</span><br><code>string[]</code> |  |
| <span id="getter-laneassemblyconfs">**laneAssemblyConfs**</span><br><code>Map&lt;string, Record&lt;string, unknown&gt;&gt;</code> |  |
| <span id="getter-canreanchor">**canReanchor**</span><br><code>boolean</code> |  |
| <span id="getter-visiblebpspan">**visibleBpSpan**</span><br><code>number</code> |  |
| <span id="getter-visiblegroupwindows">**visibleGroupWindows**</span><br><code>{ group: MultiWayGroup; start: number; end: number; }[]</code> | each with the hull, in anchor bp, of the settled blocks it meets |
| <span id="getter-visiblegroups">**visibleGroups**</span><br><code>MultiWayGroup[]</code> | uncut at the viewport edge, cut only at a displayed region's end |
| <span id="getter-fitgroups">**fitGroups**</span><br><code>MultiWayGroup[]</code> | the visible groups cut to the viewport, which each lane's frame fits |
| <span id="getter-tickintervalbp">**tickIntervalBp**</span><br><code>number</code> |  |
| <span id="getter-scrollcontentheight">**scrollContentHeight**</span><br><code>number</code> |  |
| <span id="getter-lanegenetracks">**laneGeneTracks**</span><br><code>Map&lt;string, AnyTrackConfig&gt;</code> | keyed by each lane's own spelling, not by `laneKey` |
| <span id="getter-lanegeneadapters">**laneGeneAdapters**</span><br><code>Map&lt;string, Record&lt;string, unknown&gt;&gt;</code> |  |
| <span id="getter-scrollviewportheight">**scrollViewportHeight**</span><br><code>number</code> |  |
| <span id="getter-anchorplacements">**anchorPlacements**</span><br><code>Map&lt;string, AxisPlacement&gt;</code> | in view px before the scroll offset; a flipped view gives x1 > x2 |
| <span id="getter-dragoffsetpx">**dragOffsetPx**</span><br><code>number</code> | the px the view has scrolled since the stack was laid out |
| <span id="getter-anchorreversed">**anchorReversed**</span><br><code>boolean</code> |  |
| <span id="getter-anchorspans">**anchorSpans**</span><br><code>Map&lt;string, Span&gt;</code> | the anchor placements in stack px, relative to `renderOriginPx` |
| <span id="getter-anchorabsx">**anchorAbsX**</span><br><code>Map&lt;string, { coord: AnchorCoord; x: number; }&gt;</code> | each group's viewport-cut centre, in view px before the scroll offset |
| <span id="getter-rowframes">**rowFrames**</span><br><code>Map&lt;string, RowFrame &#124; undefined&gt;</code> |  |
| <span id="getter-lanesfrozen">**lanesFrozen**</span><br><code>boolean</code> | true only while the view, on the anchor the lanes froze on, still shows part of the window they froze on |
| <span id="getter-frozendecisions">**frozenDecisions**</span><br><code>ReadonlyMap&lt;string, LaneDecision&gt;</code> | empty unless `lanesFrozen` |
| <span id="getter-anchorfetchregions">**anchorFetchRegions**</span><br><code>FetchRegion[]</code> |  |
| <span id="getter-lanewindows">**laneWindows**</span><br><code>ReadonlyMap&lt;string, LaneWindow&gt;</code> | what each lane's dependent fetches ask for: the anchor's merged blocks, and each held, framed lane's window |
| <span id="getter-lanepairs">**lanePairs**</span><br><code>LanePair[]</code> |  |
| <span id="getter-anchorlessgroups">**anchorlessGroups**</span><br><code>PlacedGroup[]</code> |  |
| <span id="getter-lanegenesfetchspecs">**laneGenesFetchSpecs**</span><br><code>LaneGenesFetchSpec[]</code> |  |
| <span id="getter-lanegroupsfetchspecs">**laneGroupsFetchSpecs**</span><br><code>LaneGroupsFetchSpec[]</code> | a gene table read on each mate lane's window, for the rows the anchor lacks; a star source indexes its anchor alone, so it has none to give |
| <span id="getter-lanelinksfetchspecs">**laneLinksFetchSpecs**</span><br><code>LaneLinksFetchSpec[]</code> | one spec per adjacent mate-lane pair whose gutter is on screen or within a screen of it |
| <span id="getter-lanelayertemplates">**laneLayerTemplates**</span><br><code>(Record&lt;string, unknown&gt; &#124; undefined)[]</code> |  |
| <span id="getter-lanelayersources">**laneLayerSources**</span><br><code>Map&lt;string, LaneLayerSource&gt;[]</code> |  |
| <span id="getter-lanelayerreads">**laneLayerReads**</span><br><code>{ specs: LaneLayerFetchSpec[]; pastCap: boolean[]; }</code> | `pastCap` flags a layer that skipped a lane past `LANE_TEMPLATE_MAX_BP` |
| <span id="getter-lanelayersfetchspecs">**laneLayersFetchSpecs**</span><br><code>LaneLayerFetchSpec[]</code> |  |
| <span id="getter-lanestack">**laneStack**</span><br><code>LaneStack</code> | carries no lane genes, so a gene commit re-uploads no ribbon or tick |
| <span id="getter-lanemaps">**laneMaps**</span><br><code>ReadonlyMap&lt;number, LaneMap&gt;</code> |  |
| <span id="getter-laneheaderrows">**laneHeaderRows**</span><br><code>LaneHeaderRow[]</code> |  |
| <span id="getter-pairlinks">**pairLinks**</span><br><code>ReadonlyMap&lt;string, LaneLinks&gt;</code> | the alignments the source answered for each adjacent mate-lane pair, keyed `upper\|lower`; a pair it has not answered draws nothing |
| <span id="getter-loadinggutterys">**loadingGutterYs**</span><br><code>number[]</code> | the centre, in stack px, of each gutter whose lane pair was asked for and has not landed |
| <span id="getter-ribbongeometry">**ribbonGeometry**</span><br><code>RibbonGeometry</code> | in the stack's own px |
| <span id="getter-tickgeometry">**tickGeometry**</span><br><code>TickGeometry</code> |  |
| <span id="getter-bandcell">**bandCell**</span><br><code>MultiWayCell</code> |  |
| <span id="getter-anchortickxs">**anchorTickXs**</span><br><code>number[]</code> | px of the anchor's ticks across the displayed regions |
| <span id="getter-lanecells">**laneCells**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ cells: Map&lt;string, MultiWayCell&gt;; boxNames: Map&lt;string, Named…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ cells: Map&lt;string, MultiWayCell&gt;; boxNames: Map&lt;string, NamedSpan[]&gt;; geneGroups: Map&lt;string, Map&lt;string, string&gt;&gt;; }</code></pre></dialog></span> | boxes before glyphs, so an in-order hit test finds a box over a gene |
| <span id="getter-laneglyphcells">**laneGlyphCells**</span><br><code>Map&lt;string, MultiWayCell&gt;</code> |  |
| <span id="getter-laneboxnames">**laneBoxNames**</span><br><code>Map&lt;string, NamedSpan[]&gt;</code> |  |
| <span id="getter-lanegenegroups">**laneGeneGroups**</span><br><code>Map&lt;string, Map&lt;string, string&gt;&gt;</code> | per lane, each drawn gene's group, keyed by feature id |
| <span id="getter-pinnedlabelgroups">**pinnedLabelGroups**</span><br><code>ReadonlySet&lt;string&gt;</code> |  |
| <span id="getter-genetextof">**geneTextOf**</span><br><code>(feature: Feature) =&gt; string &#124; undefined</code> |  |
| <span id="getter-genecolorscales">**geneColorScales**</span><br><code>ColorScale[]</code> | keys the anchor lane alone, over the settled window |
| <span id="getter-colorscales">**colorScales**</span><br><code>ColorScale[]</code> |  |
| <span id="getter-legendright">**legendRight**</span><br><code>number</code> |  |
| <span id="getter-lanelayerplacements">**laneLayerPlacements**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ specLane: string; held: HeldLaneLayer; row: number; top: numb…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ specLane: string; held: HeldLaneLayer; row: number; top: number; height: number; segments: { start: number; end: number; px: Span; }[]; }[]</code></pre></dialog></span> | each payload's region placed in its lane's own frame; a payload whose lane or contig no longer draws is left out |
| <span id="getter-lanelayerdomains">**laneLayerDomains**</span><br><code>([number, number] &#124; undefined)[]</code> | undefined for a layer no drawn lane holds values for yet |
| <span id="getter-lanelayercolors">**laneLayerColors**</span><br><code>ColorSource[][]</code> | where each lane layer's marks take their color from, one per mark, read as the mark display reads its own |
| <span id="getter-selectedglyphhits">**selectedGlyphHits**</span><br><code>GlyphHit[][]</code> | the selected feature's glyph hits per row, which a pan leaves alone |
| <span id="getter-lanelayercolorscales">**laneLayerColorScales**</span><br><code>(MarkColorScale &#124; undefined)[][]</code> | the ramp or threshold each lane layer's bars paint numbers through, one per mark and undefined for a mark colored another way; a ramp's domain covers the values of every drawn lane, as `laneLayerDomains` does for y, so one value takes one color in all of them |
| <span id="getter-lanelayertitles">**laneLayerTitles**</span><br><code>{ key: string; text: string; top: number; }[]</code> |  |
| <span id="getter-lanelayercells">**laneLayerCells**</span><br><code>{ cells: Map&lt;string, MultiWayCell&gt;; layers: BarLayer[]; }</code> |  |
| <span id="getter-namedcells">**namedCells**</span><br><code>ReadonlyMap&lt;string, MultiWayCell&gt;</code> |  |
| <span id="getter-namedlayers">**namedLayers**</span><br><code>MultiWayLayer[]</code> | back to front, bands first to cover the view's gridlines |
| <span id="getter-hoveredfeatureid">**hoveredFeatureId**</span><br><code>number</code> |  |
| <span id="getter-clickedfeatureid">**clickedFeatureId**</span><br><code>number</code> |  |
| <span id="getter-hoverink">**hoverInk**</span><br><code>HighlightRect[]</code> |  |
| <span id="getter-selectionink">**selectionInk**</span><br><code>HighlightRect[]</code> |  |
| <span id="getter-highlightstyle">**highlightStyle**</span><br><code>HighlightStyle</code> |  |
| <span id="getter-groundpalette">**groundPalette**</span><br><code>JBrowsePalette</code> |  |
| <span id="getter-outlinecells">**outlineCells**</span><br><code>ReadonlyMap&lt;string, MultiWayCell&gt;</code> |  |
| <span id="getter-rendercells">**renderCells**</span><br><code>ReadonlyMap&lt;number, MultiWayCell&gt;</code> | keyed by `sharedBackendKey` |
| <span id="getter-renderlayers">**renderLayers**</span><br><code>ReadonlyMap&lt;number, MultiWayLayer&gt;</code> | back to front, each outline immediately over the gutter it traces |
| <span id="getter-ribbonregions">**ribbonRegions**</span><br><code>ReadonlyMap&lt;number, SyntenyInstanceData&gt;</code> | in draw order |
| <span id="getter-ribbonrecords">**ribbonRecords**</span><br><code>ReadonlyMap&lt;number, ReadonlyMap&lt;number, Feature&gt;&gt;</code> | `ribbonGeometry.records` keyed by `sharedBackendKey` |
| <span id="getter-renderstate">**renderState**</span><br><code>MultiWayRenderState</code> |  |
| <span id="getter-renderblocks">**renderBlocks**</span><br><code>RenderBlock[]</code> |  |
| <span id="getter-ribbonpickstate">**ribbonPickState**</span><br><code>SyntenyRenderState</code> |  |
| <span id="getter-animating">**animating**</span><br><code>boolean</code> |  |
| <span id="getter-lanefetches">**laneFetches**</span><br><code>{ state: LaneFetchState&lt;HeldLane&gt;; specs: LaneFetchSpec[]; }[]</code> |  |
| <span id="getter-awaitingdependentdata">**awaitingDependentData**</span><br><code>boolean</code> |  |
| <span id="getter-datasuperseded">**dataSuperseded**</span><br><code>boolean</code> |  |
| <span id="getter-hoveredfeature">**hoveredFeature**</span><br><code>Feature &#124; undefined</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="getter-parenttrack">[`parentTrack`](../basedisplay#getter-parenttrack)</span>, <span id="getter-renderingcomponent">[`RenderingComponent`](../basedisplay#getter-renderingcomponent)</span>, <span id="getter-displayblurb">[`DisplayBlurb`](../basedisplay#getter-displayblurb)</span>, <span id="getter-adapterconfig">[`adapterConfig`](../basedisplay#getter-adapterconfig)</span>, <span id="getter-isminimized">[`isMinimized`](../basedisplay#getter-isminimized)</span>, <span id="getter-featurenoun">[`featureNoun`](../basedisplay#getter-featurenoun)</span>, <span id="getter-featurewidgettype">[`featureWidgetType`](../basedisplay#getter-featurewidgettype)</span>, <span id="getter-plotkeys">[`plotKeys`](../basedisplay#getter-plotkeys)</span>, <span id="getter-plot">[`plot`](../basedisplay#getter-plot)</span>, <span id="getter-plotexamples">[`plotExamples`](../basedisplay#getter-plotexamples)</span>, <span id="getter-configdocsurl">[`configDocsUrl`](../basedisplay#getter-configdocsurl)</span></span>

<span data-pagefind-ignore>From [TrackHeightMixin](../trackheightmixin): <span id="getter-height">[`height`](../trackheightmixin#getter-height)</span>, <span id="getter-resizing">[`resizing`](../trackheightmixin#getter-resizing)</span>, <span id="getter-scrollableheight">[`scrollableHeight`](../trackheightmixin#getter-scrollableheight)</span></span>

<span data-pagefind-ignore>From [GlobalFetchMixin](../globalfetchmixin): <span id="getter-host">[`host`](../globalfetchmixin#getter-host)</span>, <span id="getter-staticblocksignature">[`staticBlockSignature`](../globalfetchmixin#getter-staticblocksignature)</span>, <span id="getter-dynamicblocksignature">[`dynamicBlockSignature`](../globalfetchmixin#getter-dynamicblocksignature)</span>, <span id="getter-viewportempty">[`viewportEmpty`](../globalfetchmixin#getter-viewportempty)</span>, <span id="getter-canrender">[`canRender`](../globalfetchmixin#getter-canrender)</span>, <span id="getter-renderscanvas">[`rendersCanvas`](../globalfetchmixin#getter-renderscanvas)</span>, <span id="getter-paintinert">[`paintInert`](../globalfetchmixin#getter-paintinert)</span>, <span id="getter-svgready">[`svgReady`](../globalfetchmixin#getter-svgready)</span>, <span id="getter-displayphase">[`displayPhase`](../globalfetchmixin#getter-displayphase)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="getter-gateenabled">[`gateEnabled`](../regiontoolargemixin#getter-gateenabled)</span>, <span id="getter-bytegateadapterconfig">[`byteGateAdapterConfig`](../regiontoolargemixin#getter-bytegateadapterconfig)</span>, <span id="getter-configuredfetchsizelimit">[`configuredFetchSizeLimit`](../regiontoolargemixin#getter-configuredfetchsizelimit)</span>, <span id="getter-densitytoolarge">[`densityTooLarge`](../regiontoolargemixin#getter-densitytoolarge)</span>, <span id="getter-bytegateadapterpath">[`byteGateAdapterPath`](../regiontoolargemixin#getter-bytegateadapterpath)</span>, <span id="getter-adapterfetchsizelimit">[`adapterFetchSizeLimit`](../regiontoolargemixin#getter-adapterfetchsizelimit)</span>, <span id="getter-configforceload">[`configForceLoad`](../regiontoolargemixin#getter-configforceload)</span>, <span id="getter-gateviewportspanbp">[`gateViewportSpanBp`](../regiontoolargemixin#getter-gateviewportspanbp)</span>, <span id="getter-gateviewport">[`gateViewport`](../regiontoolargemixin#getter-gateviewport)</span>, <span id="getter-aboveforceloadfloor">[`aboveForceLoadFloor`](../regiontoolargemixin#getter-aboveforceloadfloor)</span>, <span id="getter-gateexempt">[`gateExempt`](../regiontoolargemixin#getter-gateexempt)</span>, <span id="getter-estimatedfetchbytes">[`estimatedFetchBytes`](../regiontoolargemixin#getter-estimatedfetchbytes)</span>, <span id="getter-gatemeasurementstale">[`gateMeasurementStale`](../regiontoolargemixin#getter-gatemeasurementstale)</span>, <span id="getter-gatebytelimit">[`gateByteLimit`](../regiontoolargemixin#getter-gatebytelimit)</span>, <span id="getter-gateactive">[`gateActive`](../regiontoolargemixin#getter-gateactive)</span>, <span id="getter-densitygateactive">[`densityGateActive`](../regiontoolargemixin#getter-densitygateactive)</span>, <span id="getter-toolargestatus">[`tooLargeStatus`](../regiontoolargemixin#getter-toolargestatus)</span>, <span id="getter-regiontoolarge">[`regionTooLarge`](../regiontoolargemixin#getter-regiontoolarge)</span>, <span id="getter-regiontoolargereason">[`regionTooLargeReason`](../regiontoolargemixin#getter-regiontoolargereason)</span>, <span id="getter-zoomcanreleasegate">[`zoomCanReleaseGate`](../regiontoolargemixin#getter-zoomcanreleasegate)</span>, <span id="getter-gateskipsmeasuredviewport">[`gateSkipsMeasuredViewport`](../regiontoolargemixin#getter-gateskipsmeasuredviewport)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="getter-paintsuperseded">[`paintSuperseded`](../renderlifecyclemixin#getter-paintsuperseded)</span>, <span id="getter-painted">[`painted`](../renderlifecyclemixin#getter-painted)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="getter-currentfetchkey">[`currentFetchKey`](../keyedfetchmixin#getter-currentfetchkey)</span>, <span id="getter-datacurrent">[`dataCurrent`](../keyedfetchmixin#getter-datacurrent)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="getter-isloading">[`isLoading`](../fetchmixin#getter-isloading)</span>, <span id="getter-isloadingorcanceled">[`isLoadingOrCanceled`](../fetchmixin#getter-isloadingorcanceled)</span>, <span id="getter-fetchinert">[`fetchInert`](../fetchmixin#getter-fetchinert)</span>, <span id="getter-awaitingprerequisite">[`awaitingPrerequisite`](../fetchmixin#getter-awaitingprerequisite)</span>, <span id="getter-settingsfetchinputs">[`settingsFetchInputs`](../fetchmixin#getter-settingsfetchinputs)</span></span>

<span data-pagefind-ignore>From [LegendMixin](../legendmixin): <span id="getter-showlegend">[`showLegend`](../legendmixin#getter-showlegend)</span>, <span id="getter-legendtop">[`legendTop`](../legendmixin#getter-legendtop)</span>, <span id="getter-legendspec">[`legendSpec`](../legendmixin#getter-legendspec)</span>, <span id="getter-haslegendkey">[`hasLegendKey`](../legendmixin#getter-haslegendkey)</span></span>

<span data-pagefind-ignore>From [LodTierInfoMixin](../lodtierinfomixin): <span id="getter-adapterheader">[`adapterHeader`](../lodtierinfomixin#getter-adapterheader)</span>, <span id="getter-lodtierinfo">[`lodTierInfo`](../lodtierinfomixin#getter-lodtierinfo)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-lanekey">**laneKey**</span><br><code>(assemblyName: string) =&gt; string</code> | the canonical name, so two spellings of one assembly share a key |
| <span id="method-rpcprops">**rpcProps**</span><br><code>() =&gt; { haplotypes: string[] &#124; undefined; }</code> | reads only user-controlled state, never a fetch's output, or it loops |
| <span id="method-holdsassembly">**holdsAssembly**</span><br><code>(assemblyName: string) =&gt; boolean</code> |  |
| <span id="method-holdstemporarily">**holdsTemporarily**</span><br><code>(assemblyName: string) =&gt; boolean</code> |  |
| <span id="method-lanelabel">**laneLabel**</span><br><code>(assemblyName: string) =&gt; string</code> |  |
| <span id="method-laneframeof">**laneFrameOf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(decision: LaneDecision, assemblyName: string) =&gt; RowFrame &#124; un…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(decision: LaneDecision, assemblyName: string) =&gt; RowFrame &#124; undefined</code></pre></dialog></span> | undefined once the pivot is off the displayed regions |
| <span id="method-lanedecisionsat">**laneDecisionsAt**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(origin: number, previous: ReadonlyMap&lt;string, LaneDecision &#124; u…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(origin: number, previous: ReadonlyMap&lt;string, LaneDecision &#124; undefined&gt;, frozen: ReadonlyMap&lt;string, LaneDecision&gt;) =&gt; Map&lt;string, LaneDecision &#124; undefined&gt;</code></pre></dialog></span> | in the px space anchored at `origin`; a lane in `frozen` keeps its own |
| <span id="method-bandcellon">**bandCellOn**</span><br><code>(page: string) =&gt; MultiWayCell</code> |  |
| <span id="method-lanegenelabels">**laneGeneLabels**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(fontFamily: string &#124; undefined, pinnedGroups?: ReadonlySet&lt;str…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(fontFamily: string &#124; undefined, pinnedGroups?: ReadonlySet&lt;string&gt;, width?: number) =&gt; PlacedLaneLabel[]</code></pre></dialog></span> | placed in the stack's px |
| <span id="method-coloredlayersof">**coloredLayersOf**</span><br><code>(held: HeldLaneLayer) =&gt; EncodedChannels[]</code> | a held payload's layers, each colored as its mark declares |
| <span id="method-pickribbonat">**pickRibbonAt**</span><br><code>(x: number, y: number) =&gt; SyntenyPickResult &#124; undefined</code> | `x` and `y` are container-relative; the topmost ribbon wins |
| <span id="method-slidablelaneat">**slidableLaneAt**</span><br><code>(y: number) =&gt; string &#124; undefined</code> | `y` is container-relative; undefined unless the lanes are frozen |
| <span id="method-hittest">**hitTest**</span><br><code>(x: number, y: number) =&gt; HoverTarget &#124; undefined</code> | `x` and `y` are container-relative |
| <span id="method-trackmenuitems">**trackMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="method-renderingprops">[`renderingProps`](../basedisplay#method-renderingprops)</span>, <span id="method-liftplot">[`liftPlot`](../basedisplay#method-liftplot)</span>, <span id="method-plotproblems">[`plotProblems`](../basedisplay#method-plotproblems)</span>, <span id="method-plotwrites">[`plotWrites`](../basedisplay#method-plotwrites)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="method-resolvedbytelimit">[`resolvedByteLimit`](../regiontoolargemixin#method-resolvedbytelimit)</span>, <span id="method-gatefetchstate">[`gateFetchState`](../regiontoolargemixin#method-gatefetchstate)</span></span>

<span data-pagefind-ignore>From [LegendMixin](../legendmixin): <span id="method-svglegendwidth">[`svgLegendWidth`](../legendmixin#method-svglegendwidth)</span>, <span id="method-colorscalesin">[`colorScalesIn`](../legendmixin#method-colorscalesin)</span>, <span id="method-legendspecin">[`legendSpecIn`](../legendmixin#method-legendspecin)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setfeatures">**setFeatures**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(features: Feature[], anchor?: string, lanes?: string[] &#124; undef…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(features: Feature[], anchor?: string, lanes?: string[] &#124; undefined, ops?: AlignmentOpsById) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-begindescribinglanes">**beginDescribingLanes**</span><br><code>(names: string[]) =&gt; void</code> |  |
| <span id="action-enddescribinglanes">**endDescribingLanes**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(names: string[], descriptions: Record&lt;string, AssemblyDescript…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(names: string[], descriptions: Record&lt;string, AssemblyDescription&gt;) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-forgetundescribedlanes">**forgetUndescribedLanes**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setlanegenes">**setLaneGenes**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(fetched: ReadonlyMap&lt;string, HeldLaneGenes&gt;, specs: LaneFetchS…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(fetched: ReadonlyMap&lt;string, HeldLaneGenes&gt;, specs: LaneFetchSpec[], anchor: string) =&gt; void</code></pre></dialog></span> | `specs` holds every lane the run was asked for, and `anchor` the anchor the specs were built under |
| <span id="action-setlanelayerdata">**setLaneLayerData**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(fetched: ReadonlyMap&lt;string, HeldLaneLayer&gt;, specs: LaneFetchS…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(fetched: ReadonlyMap&lt;string, HeldLaneLayer&gt;, specs: LaneFetchSpec[], anchor: string) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-setlanelinks">**setLaneLinks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(fetched: ReadonlyMap&lt;string, HeldLaneLinks&gt;, specs: LaneFetchS…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(fetched: ReadonlyMap&lt;string, HeldLaneLinks&gt;, specs: LaneFetchSpec[], anchor: string) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-setlanegroups">**setLaneGroups**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(fetched: ReadonlyMap&lt;string, HeldLaneGroups&gt;, specs: LaneFetch…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(fetched: ReadonlyMap&lt;string, HeldLaneGroups&gt;, specs: LaneFetchSpec[], anchor: string) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-setdomain">**setDomain**</span><br><code>(domain: string[]) =&gt; void</code> | takes the whole pinned order, empty meaning densest-first; merge a partial one with `mergeDomain` first |
| <span id="action-setselectedlanes">**setSelectedLanes**</span><br><code>(names: readonly string[] &#124; undefined) =&gt; void</code> | writes `rows.kept`; undefined restores `configuredLanes`, or every lane |
| <span id="action-setbridgeskippedlanes">**setBridgeSkippedLanes**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-setribboncolorfield">**setRibbonColorField**</span><br><code>(field: string) =&gt; void</code> |  |
| <span id="action-setribboncolordomain">**setRibbonColorDomain**</span><br><code>(domain: string[]) =&gt; void</code> |  |
| <span id="action-sethideunlabelled">**setHideUnlabelled**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-setdrawcurves">**setDrawCurves**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-setshowlaneticks">**setShowLaneTicks**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-setsplitstrands">**setSplitStrands**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-setinlinelanenames">**setInlineLaneNames**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-setshowgenelabels">**setShowGeneLabels**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-setgenetextfield">**setGeneTextField**</span><br><code>(field: string) =&gt; void</code> |  |
| <span id="action-setlodmode">**setLodMode**</span><br><code>(mode: LodMode) =&gt; void</code> |  |
| <span id="action-chooselanes">**chooseLanes**</span><br><code>(names: string[]) =&gt; void</code> |  |
| <span id="action-hidelane">**hideLane**</span><br><code>(assemblyName: string) =&gt; void</code> |  |
| <span id="action-showlane">**showLane**</span><br><code>(assemblyName: string) =&gt; void</code> |  |
| <span id="action-showhiddenlanes">**showHiddenLanes**</span><br><code>() =&gt; void</code> |  |
| <span id="action-openlaneselection">**openLaneSelection**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setlanesfrozen">**setLanesFrozen**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-realignlane">**realignLane**</span><br><code>(assemblyName: string) =&gt; void</code> |  |
| <span id="action-nudgelane">**nudgeLane**</span><br><code>(assemblyName: string, dxPx: number) =&gt; void</code> | slides a mate lane `dxPx` screen px, only while the lanes are frozen |
| <span id="action-setlanedragpx">**setLaneDragPx**</span><br><code>(assemblyName: string, dxPx: number) =&gt; void</code> |  |
| <span id="action-endlanedrag">**endLaneDrag**</span><br><code>(assemblyName: string) =&gt; void</code> |  |
| <span id="action-pinlanecontig">**pinLaneContig**</span><br><code>(assemblyName: string, refName: string &#124; undefined) =&gt; void</code> | `undefined` lets the lane choose again |
| <span id="action-fliplane">**flipLane**</span><br><code>(assemblyName: string) =&gt; void</code> |  |
| <span id="action-unpinlaneflip">**unpinLaneFlip**</span><br><code>(assemblyName: string) =&gt; void</code> |  |
| <span id="action-setlaneframes">**setLaneFrames**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(originPx: number, decisions: Map&lt;string, LaneDecision &#124; undefi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(originPx: number, decisions: Map&lt;string, LaneDecision &#124; undefined&gt;) =&gt; void</code></pre></dialog></span> | `originPx` is the view offset the decisions' px space is anchored at |
| <span id="action-advanceanimation">**advanceAnimation**</span><br><code>(nowMs: number) =&gt; void</code> |  |
| <span id="action-endanimation">**endAnimation**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setgenecolorby">**setGeneColorBy**</span><br><code>(field: string) =&gt; void</code> | `''` paints by `color.value` |
| <span id="action-setgenesolidcolor">**setGeneSolidColor**</span><br><code>(color: string &#124; undefined) =&gt; void</code> | Paints the constant, a field staying under `scale: 'none'` for the way back; undefined returns to the config's own color. |
| <span id="action-pickdefaultgenecolor">**pickDefaultGeneColor**</span><br><code>() =&gt; void</code> | Color by's Default: no field and no constant, so the config's own color paints, a `jexl:` expression included |
| <span id="action-pickgenesolidcolor">**pickGeneSolidColor**</span><br><code>() =&gt; void</code> | Color by's Solid color...: paints the constant kept beside a field, where there is one, and opens the picker |
| <span id="action-selectfeature">**selectFeature**</span><br><code>(feature: Feature) =&gt; void</code> |  |
| <span id="action-openinnewview">**openInNewView**</span><br><code>(assemblyName: string, loc: string) =&gt; void</code> |  |
| <span id="action-reanchor">**reanchor**</span><br><code>(assemblyName: string, loc: string) =&gt; void</code> |  |
| <span id="action-sethovertarget">**setHoverTarget**</span><br><code>(target: HoverTarget &#124; undefined) =&gt; void</code> |  |
| <span id="action-startrenderingbackend">**startRenderingBackend**</span><br><code>(backend: MultiWayRenderingBackend) =&gt; void</code> |  |
| <span id="action-setpointer">**setPointer**</span><br><code>(state?: MouseState &#124; undefined) =&gt; void</code> |  |
| <span id="action-clearhoveredfeature">**clearHoveredFeature**</span><br><code>() =&gt; void</code> |  |
| <span id="action-selecthovered">**selectHovered**</span><br><code>() =&gt; void</code> |  |
| <span id="action-rendersvg">**renderSvg**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(opts?: ExportSvgDisplayOptions &#124; undefined) =&gt; Promise&lt;ReactNo…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(opts?: ExportSvgDisplayOptions &#124; undefined) =&gt; Promise&lt;ReactNode&gt;</code></pre></dialog></span> |  |

<span data-pagefind-ignore>From [BaseDisplay](../basedisplay): <span id="action-setstatusmessage">[`setStatusMessage`](../basedisplay#action-setstatusmessage)</span>, <span id="action-seterror">[`setError`](../basedisplay#action-seterror)</span>, <span id="action-reload">[`reload`](../basedisplay#action-reload)</span>, <span id="action-applydisplaysettings">[`applyDisplaySettings`](../basedisplay#action-applydisplaysettings)</span>, <span id="action-applyplot">[`applyPlot`](../basedisplay#action-applyplot)</span></span>

<span data-pagefind-ignore>From [TrackHeightMixin](../trackheightmixin): <span id="action-setscrolltop">[`setScrollTop`](../trackheightmixin#action-setscrolltop)</span>, <span id="action-setheight">[`setHeight`](../trackheightmixin#action-setheight)</span>, <span id="action-resizeheight">[`resizeHeight`](../trackheightmixin#action-resizeheight)</span>, <span id="action-expandtocontentheight">[`expandToContentHeight`](../trackheightmixin#action-expandtocontentheight)</span></span>

<span data-pagefind-ignore>From [RegionTooLargeMixin](../regiontoolargemixin): <span id="action-clearbyteestimate">[`clearByteEstimate`](../regiontoolargemixin#action-clearbyteestimate)</span>, <span id="action-cleargatemeasurements">[`clearGateMeasurements`](../regiontoolargemixin#action-cleargatemeasurements)</span>, <span id="action-setforceloadtrack">[`setForceLoadTrack`](../regiontoolargemixin#action-setforceloadtrack)</span>, <span id="action-commitfetchbytes">[`commitFetchBytes`](../regiontoolargemixin#action-commitfetchbytes)</span>, <span id="action-forceload">[`forceLoad`](../regiontoolargemixin#action-forceload)</span></span>

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="action-markcanvasdrawn">[`markCanvasDrawn`](../renderlifecyclemixin#action-markcanvasdrawn)</span>, <span id="action-resetcanvasdrawn">[`resetCanvasDrawn`](../renderlifecyclemixin#action-resetcanvasdrawn)</span>, <span id="action-stoprenderingbackend">[`stopRenderingBackend`](../renderlifecyclemixin#action-stoprenderingbackend)</span>, <span id="action-rendernow">[`renderNow`](../renderlifecyclemixin#action-rendernow)</span>, <span id="action-setoffscreen">[`setOffScreen`](../renderlifecyclemixin#action-setoffscreen)</span>, <span id="action-setrendererror">[`setRenderError`](../renderlifecyclemixin#action-setrendererror)</span>, <span id="action-attachrenderingbackend">[`attachRenderingBackend`](../renderlifecyclemixin#action-attachrenderingbackend)</span></span>

<span data-pagefind-ignore>From [KeyedFetchMixin](../keyedfetchmixin): <span id="action-commitfetchresult">[`commitFetchResult`](../keyedfetchmixin#action-commitfetchresult)</span></span>

<span data-pagefind-ignore>From [FetchMixin](../fetchmixin): <span id="action-stopactivefetch">[`stopActiveFetch`](../fetchmixin#action-stopactivefetch)</span>, <span id="action-openstatusstream">[`openStatusStream`](../fetchmixin#action-openstatusstream)</span>, <span id="action-cancelfetch">[`cancelFetch`](../fetchmixin#action-cancelfetch)</span>, <span id="action-cancelfetchbyuser">[`cancelFetchByUser`](../fetchmixin#action-cancelfetchbyuser)</span>, <span id="action-beforedestroy">[`beforeDestroy`](../fetchmixin#action-beforedestroy)</span>, <span id="action-beginfetch">[`beginFetch`](../fetchmixin#action-beginfetch)</span>, <span id="action-endfetch">[`endFetch`](../fetchmixin#action-endfetch)</span>, <span id="action-runfetch">[`runFetch`](../fetchmixin#action-runfetch)</span></span>

<span data-pagefind-ignore>From [LegendMixin](../legendmixin): <span id="action-setshowlegend">[`setShowLegend`](../legendmixin#action-setshowlegend)</span>, <span id="action-dismisslegendsection">[`dismissLegendSection`](../legendmixin#action-dismisslegendsection)</span></span>

<span data-pagefind-ignore>From [LodTierInfoMixin](../lodtierinfomixin): <span id="action-setadapterheader">[`setAdapterHeader`](../lodtierinfomixin#action-setadapterheader)</span></span>
