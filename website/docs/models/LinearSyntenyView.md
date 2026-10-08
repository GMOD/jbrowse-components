---
id: linearsyntenyview
title: LinearSyntenyView
description: "Properties, getters and actions of the LinearSyntenyView state model."
sidebar_label: View -> LinearSyntenyView
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`, with every setting written
directly on the view object. `views` declares the member assemblies (stacked
as linear views) and `tracks` the synteny feature track connecting them with
a ribbon:

```js
{
  type: 'LinearSyntenyView',
  views: [{ assembly: 'hg38' }, { assembly: 'mm10' }],
  tracks: ['hg38_vs_mm10.paf'],
  drawCurves: true,
  color: { field: 'query' },
}
```

The launch keys are `views`, `tracks`, `levelHeights`, `autoDiagonalize`,
`sameScale` and `collapseEmptyRows`; everything else is a property below and
needs no list to join.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: types.literal('LinearSyntenyView')</code> |  |
| <span id="property-cigarmode">**cigarMode**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>cigarMode: types.stripDefault( types.enumeration(['off', 'match…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>cigarMode: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.enumeration(['off', 'matches', 'full'] as const),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;'full',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | How per-base insertions and deletions inside each alignment are shown: 'full' paints indel wedges, 'matches' leaves them see-through, 'off' draws blocks only. |
| <span id="property-drawcurves">**drawCurves**</span><br><code>drawCurves: types.stripDefault(types.boolean, false)</code> | Draw every band's ribbons as bezier curves rather than straight chords. |
| <span id="property-drawlocationmarkers">**drawLocationMarkers**</span><br><code>drawLocationMarkers: types.stripDefault(types.boolean, false)</code> | Continue the query row's scalebar grid down through every band: a tick at each round query coordinate, joined to the coordinate the alignment pairs it with. |
| <span id="property-showoffscreenmates">**showOffscreenMates**</span><br><code>showOffscreenMates: types.stripDefault(types.boolean, true)</code> | Mark the alignments the view cannot draw a ribbon for, along both edges of each band. Costs a second query per pair of rows. |
| <span id="property-overdrawpx">**overdrawPx**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>overdrawPx: types.stripDefault(types.number, DEFAULT_OVERDRAW_P…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>overdrawPx: types.stripDefault(types.number, DEFAULT_OVERDRAW_PX)</code></pre></dialog></span> | pixels beyond the visible viewport edge that synteny lines are still drawn. Effective up to the pan buffer (`syntenyPanBufferPx`: 2000px, or half the viewport when that is wider) — the worker emits CIGAR detail and location markers only that far, so a larger value draws ribbons whose detail stops partway along them. |
| <span id="property-launch">**launch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>launch: types.frozen&lt; LaunchInput&lt;LinearSyntenyViewCommands&gt; &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>launch: types.frozen&lt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;LaunchInput&lt;LinearSyntenyViewCommands&gt; &#124; undefined&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&gt;()</code></pre></dialog></span> | Transient launch state: the settings written on the view object that need resolving before they can be view state — the genome rows to open, the synteny tracks per level, the shared scale. The afterAttach autorun applies and clears it. Not written by hand: author every setting directly on the view. |
| <span id="property-trackselectortype">**trackSelectorType**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>trackSelectorType: types.stripDefault(types.string, 'hierarchic…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>trackSelectorType: types.stripDefault(types.string, 'hierarchical')</code></pre></dialog></span> | Ignored: the hierarchical selector is the only one. Declared because sessions and share links still carry it. |
| <span id="property-followsynteny">**followSynteny**</span><br><code>followSynteny: types.stripDefault(types.boolean, false)</code> | The non-anchor rows follow the anchor row through the alignment, moving to whatever region aligns to its window. |
| <span id="property-samescale">**sameScale**</span><br><code>sameScale: types.stripDefault(types.boolean, false)</code> | Hold every genome row on one bp/px — the coarsest row's fit — so the rows compare by drawn length instead of each filling its pane. Moves the rows' zoom-out limit (`sharedFit`), so it holds across later zooms. |
| <span id="property-followanchorindex">**followAnchorIndex**</span><br><code>followAnchorIndex: types.stripDefault(types.number, 0)</code> | Which genome row drives the others while following. |
| <span id="property-diagonalizeanchorrow">**diagonalizeAnchorRow**</span><br><code>diagonalizeAnchorRow: types.stripDefault(types.number, 0)</code> | Which genome row "Re-order chromosomes" keeps as it is: the rows below it are ordered against the row above them, and the rows above it against the row below. |
| <span id="property-followmatchorientation">**followMatchOrientation**</span><br><code>followMatchOrientation: types.stripDefault(types.boolean, false)</code> | While following, flip a row whose placing alignment runs the other way from the anchor's, so the two pan in the same direction. |
| <span id="property-levels">**levels**</span><br><code>levels: types.array(LinearSyntenyLevel)</code> | One synteny band per adjacent pair of `views`, each holding its own track list. The track-selector and add-track widgets address a band through `trackContainerFor`. |
| <span id="property-views">**views**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>views: types.array( pluginManager.getViewType('LinearGenomeView…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>views: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.getViewType('LinearGenomeView').stateModel,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | N genome rows, with N-1 synteny `levels` between adjacent pairs (see reconcileLevels). |

<span data-pagefind-ignore>From [BaseViewModel](../baseviewmodel): <span id="property-displayname">[`displayName`](../baseviewmodel#property-displayname)</span>, <span id="property-minimized">[`minimized`](../baseviewmodel#property-minimized)</span></span>

<span data-pagefind-ignore>From [SyntenyViewMixin](../syntenyviewmixin): <span id="property-lodmode">[`lodMode`](../syntenyviewmixin#property-lodmode)</span></span>

<span data-pagefind-ignore>From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="property-opacity">[`opacity`](../syntenycolorsmixin#property-opacity)</span>, <span id="property-minalignmentlength">[`minAlignmentLength`](../syntenycolorsmixin#property-minalignmentlength)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="property-color">[`color`](../trackcolorsmixin#property-color)</span>, <span id="property-trackcolors">[`trackColors`](../trackcolorsmixin#property-trackcolors)</span>, <span id="property-hideunlabelled">[`hideUnlabelled`](../trackcolorsmixin#property-hideunlabelled)</span></span>

<span data-pagefind-ignore>From [SyntenyFadeMixin](../syntenyfademixin): <span id="property-fadethinalignmentsmode">[`fadeThinAlignmentsMode`](../syntenyfademixin#property-fadethinalignmentsmode)</span></span>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-width">**width**</span><br><code>number &#124; undefined</code> |  |
| <span id="volatile-volatileerror">**volatileError**</span><br><code>unknown</code> | View-level failure, e.g. a launch that couldn't be applied. Volatile so a reload retries from a clean slate. |
| <span id="volatile-followreport">**followReport**</span><br><code>FollowReport</code> | What the follow's last settled pass reports, for the header's follow button: rows holding because nothing aligns under the anchor, a row placed proportionally rather than by a CIGAR walk, a level with no synteny track, a multi-contig answer refused as mostly filler. |

<span data-pagefind-ignore>From [BaseViewModel](../baseviewmodel): <span id="volatile-bodymounted">[`bodyMounted`](../baseviewmodel#volatile-bodymounted)</span></span>

<span data-pagefind-ignore>From [DiagonalizeProgressMixin](../diagonalizeprogressmixin): <span id="volatile-awaitingautodiagonalize">[`awaitingAutoDiagonalize`](../diagonalizeprogressmixin#volatile-awaitingautodiagonalize)</span>, <span id="volatile-pendingautodiagonalize">[`pendingAutoDiagonalize`](../diagonalizeprogressmixin#volatile-pendingautodiagonalize)</span>, <span id="volatile-diagonalizestatus">[`diagonalizeStatus`](../diagonalizeprogressmixin#volatile-diagonalizestatus)</span>, <span id="volatile-diagonalizecancel">[`diagonalizeCancel`](../diagonalizeprogressmixin#volatile-diagonalizecancel)</span>, <span id="volatile-diagonalizeerror">[`diagonalizeError`](../diagonalizeprogressmixin#volatile-diagonalizeerror)</span></span>

<span data-pagefind-ignore>From [ImportFormSyntenyMixin](../importformsyntenymixin): <span id="volatile-importformsyntenytrackselections">[`importFormSyntenyTrackSelections`](../importformsyntenymixin#volatile-importformsyntenytrackselections)</span></span>

<span data-pagefind-ignore>From [SyntenyViewMixin](../syntenyviewmixin): <span id="volatile-colorlegenddismissedfor">[`colorLegendDismissedFor`](../syntenyviewmixin#volatile-colorlegenddismissedfor)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="volatile-seenattributeranges">[`seenAttributeRanges`](../trackcolorsmixin#volatile-seenattributeranges)</span></span>

<span data-pagefind-ignore>From [SyntenyFadeMixin](../syntenyfademixin): <span id="volatile-fadethinlatch">[`fadeThinLatch`](../syntenyfademixin#volatile-fadethinlatch)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-bandgesturerows">**bandGestureRows**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…}…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { rubberbandClickMenuItems(clickOffset: BpOffset): MenuItem[]; highlightMenuItems(_highlight: HighlightType): MenuItem[]; } &amp; { flyTo: (centerBp: number, windowWidthBp: number) =&gt; void; flyToCenter(coord: number, refName: string, displayedRegionIndex?: number &#124; undefined): void; flyToFit(centerBp: number, fitWidthBp: number): void; } &amp; { afterCreate(): void; afterAttach(): void; } &amp; IStateTreeNode&lt;…&gt;)[]</code></pre></dialog></span> | The rows a drag or a wheel on a band moves: every row the follow cannot place. Off, that is every row; on, it is the anchor and any row whose level toward the anchor has no synteny track. |
| <span id="getter-scrollzoom">**scrollZoom**</span><br><code>boolean</code> | scroll-to-zoom is a global, personal preference resolved from the session; toggling it in any view applies everywhere |
| <span id="getter-initialized">**initialized**</span><br><code>boolean</code> |  |
| <span id="getter-error">**error**</span><br><code>unknown</code> | The view's own failure or the first failed row's, so an export or launcher waiting on a stack with a failed row is told why. |
| <span id="getter-stackerror">**stackError**</span><br><code>unknown</code> | The failure that leaves the stack nothing to show: the view's own, or every row's. One failed row reports itself in its place in the stack. |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  |
| <span id="getter-sharedfit">**sharedFit**</span><br><code>SharedFit</code> | The zoom-out limit every row shares while `sameScale` is on (`sharedFit.ts`). Each row pulls it through its own `maxBpPerPx`, finding this view by the presence of this getter. |
| <span id="getter-allsyntenydisplays">**allSyntenyDisplays**</span><br><code>LinearSyntenyDisplayModel[]</code> | Every synteny display across every level. |
| <span id="getter-hiddenfeaturecount">**hiddenFeatureCount**</span><br><code>number</code> |  |
| <span id="getter-followpairs">**followPairs**</span><br><code>{…}[]</code> | Each connected synteny level resolved into the pair of rows a follow moves it between: which row stays, which moves, which axis the anchor window is read off, and the assembly naming the level's lane of an all-vs-all track.<br><br>Ordered outward from the anchor, so each level's staying row is the anchor or a row a nearer level has already placed, and a stack of three or more settles in one pass. |
| <span id="getter-trackwarnings">**trackWarnings**</span><br><code>TrackWarning[]</code> | Every synteny display's data-quality warnings (e.g. a reversed assembly row order), grouped under the track that raised each: what the header's warning button counts and its dialog reports. |
| <span id="getter-trackcontainers">**trackContainers**</span><br><code>TrackContainer[]</code> | Every band's track list, for a reader walking the session for displays. |
| <span id="getter-owntracks">**ownTracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ configuration: { trackId: string; }; displays: { type: string…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ configuration: { trackId: string; }; displays: { type: string; configuration: AnyConfigurationModel; }[]; }[]</code></pre></dialog></span> | Every track in the view, across its bands. |
| <span id="getter-ownviews">**ownViews**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…}…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { rubberbandClickMenuItems(clickOffset: BpOffset): MenuItem[]; highlightMenuItems(_highlight: HighlightType): MenuItem[]; } &amp; { flyTo: (centerBp: number, windowWidthBp: number) =&gt; void; flyToCenter(coord: number, refName: string, displayedRegionIndex?: number &#124; undefined): void; flyToFit(centerBp: number, fitWidthBp: number): void; } &amp; { afterCreate(): void; afterAttach(): void; } &amp; IStateTreeNode&lt;…&gt;)[]</code></pre></dialog></span> |  |
| <span id="getter-pendinglaunch">**pendingLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>LaunchInput&lt;LinearSyntenyViewCommands &amp; { unknown?: Record&lt;stri…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>LaunchInput&lt;LinearSyntenyViewCommands &amp; { unknown?: Record&lt;string, unknown&gt; &#124; undefined; malformed?: Record&lt;string, unknown&gt; &#124; undefined; legacyInit?: boolean &#124; undefined; } &amp; IStateTreeNode&lt;IType&lt;LaunchInput&lt;LinearSyntenyViewCommands&gt; &#124; undefined, LaunchInput&lt;LinearSyntenyViewCommands&gt; &#124; undefined, LaunchInput&lt;LinearSyntenyViewCommands&gt; &#124; undefined&gt;&gt;&gt; &#124; undefined</code></pre></dialog></span> | the launch state that still has something to apply — the gate the loading and import-form paths below read. |
| <span id="getter-hassomethingtoshow">**hasSomethingToShow**</span><br><code>boolean</code> |  |
| <span id="getter-initpending">**initPending**</span><br><code>boolean</code> | A launch that has not finished applying: the rows can exist, and be initialized, while the synteny tracks are still several awaits away. The levels' `settled` gate reads it. |
| <span id="getter-showassemblynameinsubviewscalebar">**showAssemblyNameInSubviewScalebar**</span><br><code>boolean</code> | Opts each row's scalebar into captioning its refName labels with the assembly name ("hg38" ahead of "chr1"). Read duck-typed by the child LinearGenomeView. |
| <span id="getter-drawcigar">**drawCIGAR**</span><br><code>boolean</code> |  |
| <span id="getter-drawcigarmatchesonly">**drawCIGARMatchesOnly**</span><br><code>boolean</code> |  |
| <span id="getter-hascigardata">**hasCigarData**</span><br><code>boolean</code> | Whether any synteny display could show CIGAR detail, which gates the CIGAR setting. True while no display has fetched yet, and false with no synteny tracks. |
| <span id="getter-presentcigarkinds">**presentCigarKinds**</span><br><code>number</code> | Union across loaded displays of the CIGAR indel ops drawn on screen, which the legend lists chips for. |
| <span id="getter-autofadewidthpx">**autoFadeWidthPx**</span><br><code>number</code> | The width 'auto' compares against its thresholds: the narrowest capped mean block width of any loaded display with at least `FADE_AUTO_MIN_FEATURES` blocks, or `Infinity` with none. |
| <span id="getter-anchorassemblyname">**anchorAssemblyName**</span><br><code>string &#124; undefined</code> | The assembly the 'reference' color field keys on: the one bordering the most synteny levels, ties to the topmost. In a stacked ref-vs-A / ref-vs-B layout that is the shared reference, so a region keeps its color across levels. |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | Whether to show a loading indicator instead of the import form or view |
| <span id="getter-loadingassembly">**loadingAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…}…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { getCanonicalRefName2(refName: string): string; isValidRefName(refName: string): boolean; } &amp; { getRefNamePosition(refName: string): number &#124; undefined; getAliasesForRefName(refName: string): string[]; getRefNameMapForAdapter(adapterConf: AdapterConf, options: BaseOptions): Promise&lt;…&gt;; getRefNameMismatch(adapterCacheKey: string): RefNameMismatch &#124; undefined; } &amp; IStateTreeNode&lt;…&gt;) &#124; undefined</code></pre></dialog></span> | The assembly whose load the spinner is waiting on. `init` names them before the rows are built, so it is the source until then. |
| <span id="getter-loading">**loading**</span><br><code>ViewLoading &#124; undefined</code> | What the loading screen says while `showLoading`, read off the assembly whose load is the wait; undefined otherwise. |
| <span id="getter-showimportform">**showImportForm**</span><br><code>boolean</code> | Whether to show the import form: nothing to show, or a failure that leaves the stack nothing to show (`stackError`), which the form reports in a banner. |
| <span id="getter-status">**status**</span><br><code>ViewStatus</code> | The view's lifecycle as one value — ready, error, loading or noRegions — for a host that draws its own chrome. Same shape and precedence as the linear view's. |

<span data-pagefind-ignore>From [BaseViewModel](../baseviewmodel): <span id="getter-rendersdisplays">[`rendersDisplays`](../baseviewmodel#getter-rendersdisplays)</span>, <span id="getter-effectivebodymounted">[`effectiveBodyMounted`](../baseviewmodel#getter-effectivebodymounted)</span></span>

<span data-pagefind-ignore>From [SyntenyViewMixin](../syntenyviewmixin): <span id="getter-haslodcapableadapter">[`hasLodCapableAdapter`](../syntenyviewmixin#getter-haslodcapableadapter)</span>, <span id="getter-showlegend">[`showLegend`](../syntenyviewmixin#getter-showlegend)</span>, <span id="getter-legendspec">[`legendSpec`](../syntenyviewmixin#getter-legendspec)</span></span>

<span data-pagefind-ignore>From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="getter-defaultopacity">[`defaultOpacity`](../syntenycolorsmixin#getter-defaultopacity)</span>, <span id="getter-opacitysetting">[`opacitySetting`](../syntenycolorsmixin#getter-opacitysetting)</span>, <span id="getter-opacityfade">[`opacityFade`](../syntenycolorsmixin#getter-opacityfade)</span>, <span id="getter-opacitylevel">[`opacityLevel`](../syntenycolorsmixin#getter-opacitylevel)</span>, <span id="getter-opacityfield">[`opacityField`](../syntenycolorsmixin#getter-opacityfield)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="getter-colorsetting">[`colorSetting`](../trackcolorsmixin#getter-colorsetting)</span>, <span id="getter-colorramp">[`colorRamp`](../trackcolorsmixin#getter-colorramp)</span>, <span id="getter-colorvalue">[`colorValue`](../trackcolorsmixin#getter-colorvalue)</span>, <span id="getter-colordomain">[`colorDomain`](../trackcolorsmixin#getter-colordomain)</span>, <span id="getter-colorrange">[`colorRange`](../trackcolorsmixin#getter-colorrange)</span>, <span id="getter-colorableattributes">[`colorableAttributes`](../trackcolorsmixin#getter-colorableattributes)</span>, <span id="getter-attributeranges">[`attributeRanges`](../trackcolorsmixin#getter-attributeranges)</span>, <span id="getter-colorabletracks">[`colorableTracks`](../trackcolorsmixin#getter-colorabletracks)</span>, <span id="getter-trackcolorassignments">[`trackColorAssignments`](../trackcolorsmixin#getter-trackcolorassignments)</span>, <span id="getter-colorfield">[`colorField`](../trackcolorsmixin#getter-colorfield)</span>, <span id="getter-haslegendkey">[`hasLegendKey`](../trackcolorsmixin#getter-haslegendkey)</span>, <span id="getter-colorlegendchips">[`colorLegendChips`](../trackcolorsmixin#getter-colorlegendchips)</span>, <span id="getter-colorscales">[`colorScales`](../trackcolorsmixin#getter-colorscales)</span></span>

<span data-pagefind-ignore>From [SyntenyFadeMixin](../syntenyfademixin): <span id="getter-fadethinalignments">[`fadeThinAlignments`](../syntenyfademixin#getter-fadethinalignments)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-trackcontainerfor">**trackContainerFor**</span><br><code>(id: string) =&gt; TrackContainer &#124; undefined</code> | The level that owns a given track list, by id. The track-selector and add-track widgets target a level through here, since this view holds one track list per band rather than one of its own. |
| <span id="method-syntenytracks">**syntenyTracks**</span><br><code>() =&gt; ComparativeTrackModel[]</code> | Every synteny track across every level, in order. |
| <span id="method-loadedattributeranges">**loadedAttributeRanges**</span><br><code>() =&gt; Record&lt;string, AttributeRange&gt;[]</code> | Each loaded display's observed attribute spans, which the mixin unions into the domain the legend labels its ramp with. |
| <span id="method-legendcigarops">**legendCigarOps**</span><br><code>() =&gt; number</code> | Only the indel ops drawn on screen get a chip. |
| <span id="method-offersreferencecolor">**offersReferenceColor**</span><br><code>() =&gt; boolean</code> | A stack of two or more levels shares an anchor assembly. |
| <span id="method-headermenuitems">**headerMenuItems**</span><br><code>(extraSubMenus?: MenuItem[]) =&gt; MenuItem[]</code> | The header's view-options menu: the zoom actions, the row coupling, what varies with the stack under "Rows", then Export SVG. Every render setting is in `SyntenySettingsMenu` instead. `ViewOptionsMenuButton` passes the "Show..." submenu as `extraSubMenus`, since the search box prefs are React state. |
| <span id="method-menuitems">**menuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |
| <span id="method-rubberbandmenuitems">**rubberBandMenuItems**</span><br><code>() =&gt; MenuItem[]</code> |  |
| <span id="method-rubberbandclickmenuitemsatpx">**rubberbandClickMenuItemsAtPx**</span><br><code>(px: number) =&gt; MenuItem[]</code> | What a bare click on the shared rubberband strip offers: one row per genome row, each holding that row's own click menu at the base it paints under `px`. A pixel rather than an offset, since each row maps it through its own `pxToBp`. |

<span data-pagefind-ignore>From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="method-colorabletrackconfigs">[`colorableTrackConfigs`](../syntenycolorsmixin#method-colorabletrackconfigs)</span>, <span id="method-colorableattributenames">[`colorableAttributeNames`](../syntenycolorsmixin#method-colorableattributenames)</span>, <span id="method-legendalpha">[`legendAlpha`](../syntenycolorsmixin#method-legendalpha)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="method-colorsurface">[`colorSurface`](../trackcolorsmixin#method-colorsurface)</span>, <span id="method-shapeshowsstrand">[`shapeShowsStrand`](../trackcolorsmixin#method-shapeshowsstrand)</span>, <span id="method-trackcolorfor">[`trackColorFor`](../trackcolorsmixin#method-trackcolorfor)</span></span>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setfollowreport">**setFollowReport**</span><br><code>(report: Partial&lt;FollowReport&gt;) =&gt; void</code> | Merge into `followReport`. Declared ahead of afterAttach, which installs the follow that calls it. |
| <span id="action-setfollowsynteny">**setFollowSynteny**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-setfollowanchorindex">**setFollowAnchorIndex**</span><br><code>(idx: number) =&gt; void</code> |  |
| <span id="action-clearclickedfeatures">**clearClickedFeatures**</span><br><code>() =&gt; void</code> | Release the clicked ribbon in every band, ahead of a band pointing its own: the drawer shows one feature, so one ribbon is outlined |
| <span id="action-holdfollowanchor">**holdFollowAnchor**</span><br><code>&lt;T&gt;(fn: () =&gt; T) =&gt; T</code> | Run a navigation of a row as the follow's own placement rather than as a gesture. While following, a gesture on any row makes that row the anchor, and the follow tells a gesture from its own work by root action: whatever `fn` navigates is a nested action of this one. |
| <span id="action-takeoutrows">**takeOutRows**</span><br><code>() =&gt; void</code> |  |
| <span id="action-reconcilelevels">**reconcileLevels**</span><br><code>() =&gt; void</code> | Keep exactly one synteny level per gap between adjacent views, growing or shrinking from the end, and both anchors inside the stack. |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; void</code> |  |
| <span id="action-seterror">**setError**</span><br><code>(e: unknown) =&gt; void</code> |  |
| <span id="action-setviews">**setViews**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(views: LaunchSnapshotIn&lt;IModelType&lt;…&gt;, InitState, "bpPerPx" &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(views: LaunchSnapshotIn&lt;IModelType&lt;…&gt;, InitState, "bpPerPx" &#124; "offsetPx" &#124; "showCytobandsSetting"&gt;[]) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-addview">**addView**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(view: LaunchSnapshotIn&lt;IModelType&lt;…&gt;, InitState, "bpPerPx" &#124; "…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(view: LaunchSnapshotIn&lt;IModelType&lt;…&gt;, InitState, "bpPerPx" &#124; "offsetPx" &#124; "showCytobandsSetting"&gt;) =&gt; void</code></pre></dialog></span> | Push a new genome row. The new trailing level starts with no synteny tracks. |
| <span id="action-removerow">**removeRow**</span><br><code>(idx: number) =&gt; void</code> | Drop one genome row and the bands beside it. An interior row leaves one new band between the rows it separated, drawn by a track that connects them where the session has one — a track the removed bands were already showing first, which is what an all-vs-all file gives. |
| <span id="action-reverserows">**reverseRows**</span><br><code>() =&gt; void</code> | Flip the stack top to bottom. Every band keeps the pair of rows it draws between, so its tracks stay with it. |
| <span id="action-setfollowmatchorientation">**setFollowMatchOrientation**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setscrollzoom">**setScrollZoom**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-activatetrackselector">**activateTrackSelector**</span><br><code>(level: number) =&gt; Widget</code> |  |
| <span id="action-toggletrack">**toggleTrack**</span><br><code>(trackId: string, level?: any) =&gt; boolean</code> |  |
| <span id="action-showtrack">**showTrack**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, level?: any, initialSnapshot?: object, displa…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, level?: any, initialSnapshot?: object, displayInitialSnapshot?: DisplayInitialSnapshot, inlineConf?: Record&lt;string, unknown&gt; &#124; undefined) =&gt; any</code></pre></dialog></span> | No-op for a level that doesn't exist, matching hideTrack/toggleTrack. |
| <span id="action-launchtrack">**launchTrack**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, level?: any, initialSnapshot?: object, displa…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, level?: any, initialSnapshot?: object, displayInitialSnapshot?: DisplayInitialSnapshot, inlineConf?: Record&lt;string, unknown&gt; &#124; undefined) =&gt; Promise&lt;any&gt;</code></pre></dialog></span> | showTrack for a track whose display state model may be lazily loaded: loads it, then shows |
| <span id="action-hidetrack">**hideTrack**</span><br><code>(trackId: string, level?: any) =&gt; void</code> |  |
| <span id="action-panstack">**panStack**</span><br><code>(dx: number) =&gt; void</code> | A band's drag, over `bandGestureRows`. The rows' scrolls nest under this action, so none of them reads as a gesture that would take the anchor. |
| <span id="action-squareview">**squareView**</span><br><code>() =&gt; void</code> | Every row onto the rows' average bp/px, each keeping its centre. |
| <span id="action-showallregionsacrossrows">**showAllRegionsAcrossRows**</span><br><code>(sameScale: boolean) =&gt; void</code> | Every row onto its whole assembly, either all on one bp/px — the coarsest row's fit, so the largest genome fills its pane and the others draw shorter in proportion — or each fit to its own pane. `sameScale` latches, so the shared scale holds across later zooms. |
| <span id="action-setsamescale">**setSameScale**</span><br><code>(sameScale: boolean) =&gt; void</code> |  |
| <span id="action-setdiagonalizeanchorrow">**setDiagonalizeAnchorRow**</span><br><code>(row: number) =&gt; void</code> |  |
| <span id="action-applysharedscale">**applySharedScale**</span><br><code>() =&gt; void</code> | Latch `sameScale` and zoom every row onto the shared scale, keeping each row's regions and centre. |
| <span id="action-clearview">**clearView**</span><br><code>() =&gt; void</code> | Back to the import form. Drops `launch` too, which `hasSomethingToShow` keys off while there are no rows. |
| <span id="action-compactallviews">**compactAllViews**</span><br><code>() =&gt; void</code> |  |
| <span id="action-expandallviews">**expandAllViews**</span><br><code>() =&gt; void</code> |  |
| <span id="action-resizealllevelheights">**resizeAllLevelHeights**</span><br><code>(distance: number, levelIdx?: any, from?: number[]) =&gt; number</code> | Resize every synteny band at once by `scaleBandHeights`, choosing the total so the bar under band `levelIdx` moves by `distance`: the bands down to it take exactly that, and the rest keep their proportion to them. `from` is the heights to scale; a drag passes the ones it started with, so whole-pixel rounding does not compound frame by frame. Returns how far that bar can go, which is `distance` unless the floor stopped it. |
| <span id="action-autoscalelevelheights">**autoScaleLevelHeights**</span><br><code>() =&gt; void</code> |  |
| <span id="action-appendrow">**appendRow**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>({ assembly, loc, syntenyTrackId, }: { assembly: string; loc?:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>({ assembly, loc, syntenyTrackId, }: { assembly: string; loc?: string &#124; undefined; syntenyTrackId?: string &#124; undefined; }) =&gt; Promise&lt;any&gt; &#124; undefined</code></pre></dialog></span> | Append an assembly to the bottom of the stack, optionally showing a synteny track on the new level. Returns `launchTrack`'s promise rather than awaiting it, so the action stays synchronous. |
| <span id="action-setdrawcurves">**setDrawCurves**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setcigarmode">**setCigarMode**</span><br><code>(arg: "full" &#124; "matches" &#124; "off") =&gt; void</code> |  |
| <span id="action-setdrawlocationmarkers">**setDrawLocationMarkers**</span><br><code>(arg: boolean) =&gt; void</code> |  |
| <span id="action-setshowoffscreenmates">**setShowOffscreenMates**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-setoverdrawpx">**setOverdrawPx**</span><br><code>(arg: number) =&gt; void</code> |  |
| <span id="action-showallregions">**showAllRegions**</span><br><code>() =&gt; void</code> | Every row back to its own whole assembly, fit to its own width, which also turns `sameScale` off. |
| <span id="action-setlaunch">**setLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(launch?: LaunchInput&lt;LinearSyntenyViewCommands&gt; &#124; undefined) =…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(launch?: LaunchInput&lt;LinearSyntenyViewCommands&gt; &#124; undefined) =&gt; void</code></pre></dialog></span> |  |
| <span id="action-exportsvg">**exportSvg**</span><br><code>(opts?: ExportSvgOptions) =&gt; Promise&lt;string&gt;</code> |  |
| <span id="action-openincircularsyntenyview">**openInCircularSyntenyView**</span><br><code>() =&gt; void</code> | a circular view of this view's two genomes with its synteny tracks as ribbons, the second genome reordered to follow the first, and this view's colour and length filter |

<span data-pagefind-ignore>From [BaseViewModel](../baseviewmodel): <span id="action-setdisplayname">[`setDisplayName`](../baseviewmodel#action-setdisplayname)</span>, <span id="action-setbodymounted">[`setBodyMounted`](../baseviewmodel#action-setbodymounted)</span>, <span id="action-setminimized">[`setMinimized`](../baseviewmodel#action-setminimized)</span></span>

<span data-pagefind-ignore>From [DiagonalizeProgressMixin](../diagonalizeprogressmixin): <span id="action-setawaitingautodiagonalize">[`setAwaitingAutoDiagonalize`](../diagonalizeprogressmixin#action-setawaitingautodiagonalize)</span>, <span id="action-beginautodiagonalize">[`beginAutoDiagonalize`](../diagonalizeprogressmixin#action-beginautodiagonalize)</span>, <span id="action-finishautodiagonalize">[`finishAutoDiagonalize`](../diagonalizeprogressmixin#action-finishautodiagonalize)</span>, <span id="action-setdiagonalizeerror">[`setDiagonalizeError`](../diagonalizeprogressmixin#action-setdiagonalizeerror)</span>, <span id="action-setdiagonalizecancel">[`setDiagonalizeCancel`](../diagonalizeprogressmixin#action-setdiagonalizecancel)</span>, <span id="action-cancelautodiagonalize">[`cancelAutoDiagonalize`](../diagonalizeprogressmixin#action-cancelautodiagonalize)</span></span>

<span data-pagefind-ignore>From [ImportFormSyntenyMixin](../importformsyntenymixin): <span id="action-setimportformsyntenytrack">[`setImportFormSyntenyTrack`](../importformsyntenymixin#action-setimportformsyntenytrack)</span>, <span id="action-clearimportformsyntenytracks">[`clearImportFormSyntenyTracks`](../importformsyntenymixin#action-clearimportformsyntenytracks)</span></span>

<span data-pagefind-ignore>From [SyntenyViewMixin](../syntenyviewmixin): <span id="action-setlodmode">[`setLodMode`](../syntenyviewmixin#action-setlodmode)</span>, <span id="action-setshowlegend">[`setShowLegend`](../syntenyviewmixin#action-setshowlegend)</span>, <span id="action-dismisslegendsection">[`dismissLegendSection`](../syntenyviewmixin#action-dismisslegendsection)</span></span>

<span data-pagefind-ignore>From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="action-setopacity">[`setOpacity`](../syntenycolorsmixin#action-setopacity)</span>, <span id="action-setopacityfield">[`setOpacityField`](../syntenycolorsmixin#action-setopacityfield)</span>, <span id="action-setminalignmentlength">[`setMinAlignmentLength`](../syntenycolorsmixin#action-setminalignmentlength)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="action-observeattributeranges">[`observeAttributeRanges`](../trackcolorsmixin#action-observeattributeranges)</span>, <span id="action-resetattributeranges">[`resetAttributeRanges`](../trackcolorsmixin#action-resetattributeranges)</span>, <span id="action-sethideunlabelled">[`setHideUnlabelled`](../trackcolorsmixin#action-sethideunlabelled)</span>, <span id="action-setcolorfield">[`setColorField`](../trackcolorsmixin#action-setcolorfield)</span>, <span id="action-setcolordomain">[`setColorDomain`](../trackcolorsmixin#action-setcolordomain)</span>, <span id="action-settrackcolor">[`setTrackColor`](../trackcolorsmixin#action-settrackcolor)</span>, <span id="action-cleartrackcolors">[`clearTrackColors`](../trackcolorsmixin#action-cleartrackcolors)</span></span>

<span data-pagefind-ignore>From [SyntenyFadeMixin](../syntenyfademixin): <span id="action-setfadethinalignmentsmode">[`setFadeThinAlignmentsMode`](../syntenyfademixin#action-setfadethinalignmentsmode)</span>, <span id="action-setfadethinlatch">[`setFadeThinLatch`](../syntenyfademixin#action-setfadethinlatch)</span></span>
