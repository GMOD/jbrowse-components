---
id: circularview
title: CircularView
description: "Lays one or more assemblies' chromosomes around a circle, and draws structural variants as chords and synteny alignments as ribbons across it."
sidebar_label: View -> CircularView
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/CircularView/model.ts).

Lays one or more assemblies' chromosomes around a circle, and draws
structural variants as chords and synteny alignments as ribbons across it.

## Example usage

Hand-authored under `defaultSession.views`, with every setting written
directly on the view object. `assembly` names the genome, a `tracks` entry may
include display config inline, and `displayedRegionNames` lists the regions
to draw, which keeps an assembly's alt/unplaced contigs off the circle:

```js
{
  type: 'CircularView',
  assembly: 'hg38',
  displayedRegionNames: ['chr1', 'chr2', 'chr3'],
  tracks: [{ trackId: 'my-sv-vcf', color: 'red' }],
}
```

`assembly` also takes a list, for a synteny ribbon plot: each
assembly lays its contigs out in turn, so the first genome takes one arc of
the circle and the second the next, and a `SyntenyTrack` covering both draws
a ribbon per alignment between them. `displayedRegionNames` keyed by assembly
restricts each genome separately, and `autoDiagonalize` reorders the second
to follow the first:

```js
{
  type: 'CircularView',
  assembly: ['hg38', 'mm39'],
  displayedRegionNames: { hg38: ['chr1', 'chr2'] },
  tracks: ['hg38_vs_mm39'],
  autoDiagonalize: true,
}
```

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-type">**type**</span><br><code>type: types.literal('CircularView') as unknown as string</code> |  |
| <span id="property-offsetradians">**offsetRadians**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>offsetRadians: types.stripDefault(types.number, defaultOffsetRa…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>offsetRadians: types.stripDefault(types.number, defaultOffsetRadians)</code></pre></dialog></span> | the figure's rotation in radians, the linear view's offsetPx |
| <span id="property-bpperpx">**bpPerPx**</span><br><code>bpPerPx: types.stripDefault(types.number, defaultBpPerPx)</code> | the zoom level, base-pairs per pixel. Capped by `minimumRadiusPx`, and refit over by the first resize unless `autoFit` is false. |
| <span id="property-autofit">**autoFit**</span><br><code>autoFit: types.stripDefault(types.boolean, true)</code> | whether the view refits to its box on resize; a manual zoom or pan clears it |
| <span id="property-tracks">**tracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>tracks: types.array( pluginManager.pluggableMstType('track', 's…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>tracks: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('track', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-hideverticalresizehandle">**hideVerticalResizeHandle**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, fal…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, false)</code></pre></dialog></span> | chrome switch, for an embed that drives the view itself |
| <span id="property-hidetrackselectorbutton">**hideTrackSelectorButton**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>hideTrackSelectorButton: types.stripDefault(types.boolean, fals…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>hideTrackSelectorButton: types.stripDefault(types.boolean, false)</code></pre></dialog></span> | chrome switch, for an embed that drives the view itself |
| <span id="property-disableimportform">**disableImportForm**</span><br><code>disableImportForm: types.stripDefault(types.boolean, false)</code> | never show the import form, even on an error, for an embed that picks the assembly itself (the SV inspector) |
| <span id="property-showlegend">**showLegend**</span><br><code>showLegend: types.stripDefault(types.boolean, false)</code> | a key naming each track's ring, chords or ribbons in the corner |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, defaultHeight)</code> | the view's height in px, which sizes the fitted circle. Left at its default in a multi-view session, the view opens square to its width |
| <span id="property-displayedregions">**displayedRegions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>displayedRegions: types.stripDefault(types.frozen&lt;Region[]&gt;(),…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>displayedRegions: types.stripDefault(types.frozen&lt;Region[]&gt;(), [])</code></pre></dialog></span> | the regions the circle lays out, one arc each, in this order. `displayedRegionNames` names the same thing by refName and is the shorter form. |
| <span id="property-minimumradiuspx">**minimumRadiusPx**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>minimumRadiusPx: types.stripDefault( types.number, defaultMinim…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>minimumRadiusPx: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.number,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;defaultMinimumRadiusPx,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | how far out the circle may zoom, as the smallest radius it shrinks to; it is what caps bpPerPx |
| <span id="property-spacingpx">**spacingPx**</span><br><code>spacingPx: types.stripDefault(types.number, defaultSpacingPx)</code> | the gap drawn between adjacent chromosome arcs |
| <span id="property-paddingpx">**paddingPx**</span><br><code>paddingPx: types.stripDefault(types.number, defaultPaddingPx)</code> | blank margin between the circle and the edge of the figure |
| <span id="property-minvisiblewidth">**minVisibleWidth**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>minVisibleWidth: types.stripDefault( types.number, defaultMinVi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>minVisibleWidth: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.number,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;defaultMinVisibleWidth,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | arcs thinner than this many pixels are elided instead of drawn, so a few thousand unplaced contigs do not become a ring of hairlines |
| <span id="property-trackselectortype">**trackSelectorType**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>trackSelectorType: types.stripDefault(types.string, 'hierarchic…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>trackSelectorType: types.stripDefault(types.string, 'hierarchical')</code></pre></dialog></span> | ignored, kept because saved sessions carry it |
| <span id="property-launch">**launch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>launch: types.frozen&lt;LaunchInput&lt;CircularViewCommands&gt; &#124; undefi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>launch: types.frozen&lt;LaunchInput&lt;CircularViewCommands&gt; &#124; undefined&gt;()</code></pre></dialog></span> | the launch keys still to apply, moved here by `preProcessSnapshot` and cleared once applied; not written by hand |

<details class="inherited-members" data-pagefind-ignore>
<summary>8 inherited properties from 5 models</summary>

From [SyntenyFadeMixin](../syntenyfademixin): <span id="property-render">[`render`](../syntenyfademixin#property-render)</span>

From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="property-opacity">[`opacity`](../syntenycolorsmixin#property-opacity)</span>

From [TrackColorsMixin](../trackcolorsmixin): <span id="property-color">[`color`](../trackcolorsmixin#property-color)</span>, <span id="property-trackcolors">[`trackColors`](../trackcolorsmixin#property-trackcolors)</span>

From [SyntenyFilterMixin](../syntenyfiltermixin): <span id="property-filter">[`filter`](../syntenyfiltermixin#property-filter)</span>

From [BaseViewModel](../baseviewmodel): <span id="property-id">[`id`](../baseviewmodel#property-id)</span>, <span id="property-displayname">[`displayName`](../baseviewmodel#property-displayname)</span>, <span id="property-minimized">[`minimized`](../baseviewmodel#property-minimized)</span>

</details>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-volatilewidth">**volatileWidth**</span><br><code>number &#124; undefined</code> |  |
| <span id="volatile-heightfollowswidth">**heightFollowsWidth**</span><br><code>boolean</code> |  |
| <span id="volatile-volatileerror">**volatileError**</span><br><code>unknown</code> |  |
| <span id="volatile-panx">**panX**</span><br><code>number</code> |  |
| <span id="volatile-pany">**panY**</span><br><code>number</code> |  |
| <span id="volatile-ringhost">**ringHost**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; { setWidth(): void; set…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; { setWidth(): void; setBodyMounted(): void; setMinimized(): void; setDisplayName(): void; scrollZoom(): void; setStripElement(displayId: string, el: HTMLElement &#124; null): void; setCoarseDynamicBlocks(blocks: BlockSet, bpPerPx: number): void; syncRings(displayIds: string[]): void; } &amp; { setView(view: RingHostView): void; beforeDestroy(): void; } &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> | the strip every linear display in this view lays out along, and the rings drawn from it — see `regionHost` |
| <span id="volatile-hover">**hover**</span><br><code>PointerTarget &#124; undefined</code> | the chord or ribbon under the pointer, which the highlight paths and the tooltip read |
| <span id="volatile-hoverclientxy">**hoverClientXY**</span><br><code>[number, number] &#124; undefined</code> | where the pointer was on the page while it was on `hover`, which only the tooltip follows |
| <span id="volatile-chordpass">**chordPass**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { attachRen…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { attachRenderingBackend&lt;B&gt;(backend: B, setup: () =&gt; RenderingBackendCallbacks&lt;…&gt;): void; } &amp; { view: ChordPassView &#124; undefined; drawnCells: ReadonlySet&lt;…&gt;; } &amp; { readonly frame: ChordLayerFrame; readonly cells: ReadonlyMap&lt;…&gt;; readonly canRender: boolean; readonly rendersCanvas: boolean; drew(cell: ChordCell): boolean; } &amp; { setView(view: ChordPassView): void; setDrawnCells(cells: ReadonlyMap&lt;…&gt;): void; } &amp; { startRenderingBackend(backend: ChordBackend): void; } &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> | the canvas the chords and ribbons of every chord display draw on |

<details class="inherited-members" data-pagefind-ignore>
<summary>10 inherited volatiles from 5 models</summary>

From [SyntenyFadeMixin](../syntenyfademixin): <span id="volatile-fadethinlatch">[`fadeThinLatch`](../syntenyfademixin#volatile-fadethinlatch)</span>

From [TrackColorsMixin](../trackcolorsmixin): <span id="volatile-seenattributeranges">[`seenAttributeRanges`](../trackcolorsmixin#volatile-seenattributeranges)</span>

From [ImportFormSyntenyMixin](../importformsyntenymixin): <span id="volatile-importformsyntenytrackselections">[`importFormSyntenyTrackSelections`](../importformsyntenymixin#volatile-importformsyntenytrackselections)</span>

From [DiagonalizeProgressMixin](../diagonalizeprogressmixin): <span id="volatile-awaitingautodiagonalize">[`awaitingAutoDiagonalize`](../diagonalizeprogressmixin#volatile-awaitingautodiagonalize)</span>, <span id="volatile-pendingautodiagonalize">[`pendingAutoDiagonalize`](../diagonalizeprogressmixin#volatile-pendingautodiagonalize)</span>, <span id="volatile-diagonalizestatus">[`diagonalizeStatus`](../diagonalizeprogressmixin#volatile-diagonalizestatus)</span>, <span id="volatile-diagonalizecancel">[`diagonalizeCancel`](../diagonalizeprogressmixin#volatile-diagonalizecancel)</span>, <span id="volatile-diagonalizeerror">[`diagonalizeError`](../diagonalizeprogressmixin#volatile-diagonalizeerror)</span>

From [BaseViewModel](../baseviewmodel): <span id="volatile-width">[`width`](../baseviewmodel#volatile-width)</span>, <span id="volatile-bodymounted">[`bodyMounted`](../baseviewmodel#volatile-bodymounted)</span>

</details>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-owntracks">**ownTracks**</span><br><code>any[]</code> | the tracks this view holds itself, for the census |
| <span id="getter-width">**width**</span><br><code>number</code> |  |
| <span id="getter-circleregions">**circleRegions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(Region &#124; { circular: boolean; assemblyName: string; refName: s…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(Region &#124; { circular: boolean; assemblyName: string; refName: string; start: number; end: number; reversed?: boolean &#124; undefined; })[]</code></pre></dialog></span> | `displayedRegions`, each marked `circular` where it is a whole sequence its assembly lists in `circularRefNames` |
| <span id="getter-fitlayout">**fitLayout**</span><br><code>FitLayout</code> | the circle that fills the box: its scale, radius and padding |
| <span id="getter-fitinput">**fitInput**</span><br><code>FitInput</code> | what `fitLayout` measures the circle from |
| <span id="getter-namesfeaturesoutside">**namesFeaturesOutside**</span><br><code>boolean</code> | a circle of one contig is a map: its ring displays' features are named outside the circle with leaders, not along their rows |
| <span id="getter-effectivepaddingpx">**effectivePaddingPx**</span><br><code>number</code> | `paddingPx`, capped in a small box and floored at what the labels drawn at the fit or at this zoom reach |
| <span id="getter-ring">**ring**</span><br><code>{ spacingPx: number; radiusPx: number; }</code> | the ring at this zoom: its gaps' spacing and the radius that closes it — see `ringAt` |
| <span id="getter-effectivespacingpx">**effectiveSpacingPx**</span><br><code>number</code> | `spacingPx`, capped so the gaps take at most a quarter of the ring |
| <span id="getter-totalgapunits">**totalGapUnits**</span><br><code>number</code> | how many inter-slice gaps go round the circle, a genome boundary counting as several |
| <span id="getter-radiuspx">**radiusPx**</span><br><code>number</code> |  |
| <span id="getter-circumferencepx">**circumferencePx**</span><br><code>number</code> |  |
| <span id="getter-bpperradian">**bpPerRadian**</span><br><code>number</code> |  |
| <span id="getter-centerxy">**centerXY**</span><br><code>[number, number]</code> |  |
| <span id="getter-totalbp">**totalBp**</span><br><code>number</code> |  |
| <span id="getter-maxbpperpx">**maxBpPerPx**</span><br><code>number</code> |  |
| <span id="getter-minbpperpx">**minBpPerPx**</span><br><code>number</code> |  |
| <span id="getter-atmaxbpperpx">**atMaxBpPerPx**</span><br><code>boolean</code> |  |
| <span id="getter-atminbpperpx">**atMinBpPerPx**</span><br><code>boolean</code> |  |
| <span id="getter-figuresize">**figureSize**</span><br><code>number</code> | figure is always square, so width === height |
| <span id="getter-figureoriginxy">**figureOriginXY**</span><br><code>[number, number]</code> | the figure's top-left in the view's box, centered horizontally and placed by `figureMiddleY` vertically, plus the pan |
| <span id="getter-circlecenterxy">**circleCenterXY**</span><br><code>[number, number]</code> | the circle's centre in the view's box |
| <span id="getter-polarframe">**polarFrame**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ canvasWidth: number; canvasHeight: number; centerX: number; c…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ canvasWidth: number; canvasHeight: number; centerX: number; centerY: number; offsetRadians: number; }</code></pre></dialog></span> | what the ring and chord canvases both draw against: the view's box, the circle's centre in it and the figure's rotation |
| <span id="getter-elisionmask">**elisionMask**</span><br><code>string</code> | which displayed regions are too narrow at this zoom to draw as themselves, one character each |
| <span id="getter-elidedregions">**elidedRegions**</span><br><code>SliceRegion[]</code> | `displayedRegions` with each run of too-narrow regions in one assembly folded into one elided slice |
| <span id="getter-pendinglaunch">**pendingLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>LaunchInput&lt;CircularViewCommands &amp; { unknown?: Record&lt;string, u…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>LaunchInput&lt;CircularViewCommands &amp; { unknown?: Record&lt;string, unknown&gt; &#124; undefined; malformed?: Record&lt;string, unknown&gt; &#124; undefined; legacyInit?: boolean &#124; undefined; } &amp; IStateTreeNode&lt;IType&lt;LaunchInput&lt;CircularViewCommands&gt; &#124; undefined, LaunchInput&lt;CircularViewCommands&gt; &#124; undefined, LaunchInput&lt;CircularViewCommands&gt; &#124; undefined&gt;&gt;&gt; &#124; undefined</code></pre></dialog></span> | the launch state still to apply |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  |
| <span id="getter-chordsyntenydisplays">**chordSyntenyDisplays**</span><br><code>ChordSyntenyDisplaySelf[]</code> | the ribbon displays of `syntenyTracks()`; a chromosome reorder reads its alignments from these |
| <span id="getter-candiagonalize">**canDiagonalize**</span><br><code>boolean</code> | whether a reorder applies: a ribbon track, and exactly two genomes (ADR-121) |
| <span id="getter-paintedassemblyname">**paintedAssemblyName**</span><br><code>string &#124; undefined</code> | the genome whose ideogram a ribbon track paints by what aligns to it from the first, rather than in the colors of its chromosomes |
| <span id="getter-ideogrampaint">**ideogramPaint**</span><br><code>ReadonlyMap&lt;string, PaintRun[]&gt;</code> | that genome's paint, by slice key |
| <span id="getter-launchassemblynames">**launchAssemblyNames**</span><br><code>string[]</code> | the assemblies a pending launch names, which the gates wait on before `displayedRegions` exist |
| <span id="getter-initialized">**initialized**</span><br><code>boolean</code> |  |
| <span id="getter-assemblyerrors">**assemblyErrors**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-error">**error**</span><br><code>unknown</code> |  |
| <span id="getter-hassomethingtoshow">**hasSomethingToShow**</span><br><code>boolean</code> |  |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | whether the loading screen stands in for the form or the figure |
| <span id="getter-loadingassembly">**loadingAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…}…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { getCanonicalRefName2(refName: string): string; isValidRefName(refName: string): boolean; } &amp; { isCircularRefName(refName: string): boolean; getRefNamePosition(refName: string): number &#124; undefined; getAliasesForRefName(refName: string): string[]; getRefNameMapForAdapter(adapterConf: AdapterConf, options: BaseOptions): Promise&lt;…&gt;; getRefNameMismatch(adapterCacheKey: string): RefNameMismatch &#124; undefined; } &amp; IStateTreeNode&lt;…&gt;) &#124; undefined</code></pre></dialog></span> | the assembly whose load the spinner waits on |
| <span id="getter-loading">**loading**</span><br><code>ViewLoading &#124; undefined</code> | the loading screen's text while `showLoading` |
| <span id="getter-showview">**showView**</span><br><code>boolean</code> | whether the figure draws: regions, and every assembly loaded |
| <span id="getter-showimportform">**showImportForm**</span><br><code>boolean</code> | nothing to show or an error, unless `disableImportForm`, which an error does not override |
| <span id="getter-status">**status**</span><br><code>ViewStatus</code> | the lifecycle as one value, as the linear view answers it |
| <span id="getter-regionhost">**regionHost**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; { setWidth(): void; set…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; { setWidth(): void; setBodyMounted(): void; setMinimized(): void; setDisplayName(): void; scrollZoom(): void; setStripElement(displayId: string, el: HTMLElement &#124; null): void; setCoarseDynamicBlocks(blocks: BlockSet, bpPerPx: number): void; syncRings(displayIds: string[]): void; } &amp; { setView(view: RingHostView): void; beforeDestroy(): void; } &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> | the strip a linear display lays out along and draws its ring from (ADR-119) |
| <span id="getter-chordradiuspx">**chordRadiusPx**</span><br><code>number</code> | Where the chord displays start: inside the innermost ring, or at the ruler when the view holds none. |
| <span id="getter-chorddisplays">**chordDisplays**</span><br><code>ChordLayerDisplay[]</code> | the displays drawing across the circle, in track order: every first display registered for this view rather than laid out as a ring |
| <span id="getter-hoveredchord">**hoveredChord**</span><br><code>ChordHit &#124; undefined</code> | the chord or ribbon under the pointer |
| <span id="getter-hoveredband">**hoveredBand**</span><br><code>AxisSlice</code> | the chromosome whose band is under the pointer, on the chord axis |
| <span id="getter-chordfocusgaps">**chordFocusGaps**</span><br><code>number</code> | that chromosome as the chord stage's focus: its slice's gap count, the name a foot gives it, or -1 for none |
| <span id="getter-bandcomposition">**bandComposition**</span><br><code>{ name: string; shares: PartnerShare[]; } &#124; undefined</code> | the hovered chromosome's name and the share of it each chromosome aligned to it covers, most first |
| <span id="getter-hoverschord">**hoversChord**</span><br><code>boolean</code> | whether the pointer is on a chord or ribbon, which only changes as it crosses onto one or off it |
| <span id="getter-chordaxis">**chordAxis**</span><br><code>ChordAxis</code> | the circle's slices on the unrolled genome axis, unchanged by a zoom or rotation |
| <span id="getter-chordscale">**chordScale**</span><br><code>PolarScale</code> | the scale from the unrolled axis to radians |
| <span id="getter-autofadewidthpx">**autoFadeWidthPx**</span><br><code>number</code> | the narrowest capped mean ribbon span on screen, which the auto fade judges |
| <span id="getter-chordthinfadefloor">**chordThinFadeFloor**</span><br><code>1 &#124; 0.15</code> | the least alpha the thin fade leaves a ribbon, 1 while it is off |
| <span id="getter-staticslices">**staticSlices**</span><br><code>Slice[]</code> | the slices at this zoom, in radians |
| <span id="getter-legendspec">**legendSpec**</span><br><code>LegendSpec</code> | one row per track: its name beside the color or ramp it paints with |

<details class="inherited-members" data-pagefind-ignore>
<summary>26 inherited getters from 5 models</summary>

From [SyntenyFadeMixin](../syntenyfademixin): <span id="getter-antialias">[`antialias`](../syntenyfademixin#getter-antialias)</span>, <span id="getter-fadethinalignments">[`fadeThinAlignments`](../syntenyfademixin#getter-fadethinalignments)</span>

From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="getter-defaultopacity">[`defaultOpacity`](../syntenycolorsmixin#getter-defaultopacity)</span>, <span id="getter-opacitysetting">[`opacitySetting`](../syntenycolorsmixin#getter-opacitysetting)</span>, <span id="getter-opacityfade">[`opacityFade`](../syntenycolorsmixin#getter-opacityfade)</span>, <span id="getter-opacitylevel">[`opacityLevel`](../syntenycolorsmixin#getter-opacitylevel)</span>, <span id="getter-opacityfield">[`opacityField`](../syntenycolorsmixin#getter-opacityfield)</span>

From [TrackColorsMixin](../trackcolorsmixin): <span id="getter-colorsetting">[`colorSetting`](../trackcolorsmixin#getter-colorsetting)</span>, <span id="getter-colorpaint">[`colorPaint`](../trackcolorsmixin#getter-colorpaint)</span>, <span id="getter-colorvalue">[`colorValue`](../trackcolorsmixin#getter-colorvalue)</span>, <span id="getter-colordomain">[`colorDomain`](../trackcolorsmixin#getter-colordomain)</span>, <span id="getter-colorrange">[`colorRange`](../trackcolorsmixin#getter-colorrange)</span>, <span id="getter-colorableattributes">[`colorableAttributes`](../trackcolorsmixin#getter-colorableattributes)</span>, <span id="getter-attributeranges">[`attributeRanges`](../trackcolorsmixin#getter-attributeranges)</span>, <span id="getter-colorabletracks">[`colorableTracks`](../trackcolorsmixin#getter-colorabletracks)</span>, <span id="getter-trackcolorassignments">[`trackColorAssignments`](../trackcolorsmixin#getter-trackcolorassignments)</span>, <span id="getter-colorfield">[`colorField`](../trackcolorsmixin#getter-colorfield)</span>, <span id="getter-hideunlabelled">[`hideUnlabelled`](../trackcolorsmixin#getter-hideunlabelled)</span>, <span id="getter-haslegendkey">[`hasLegendKey`](../trackcolorsmixin#getter-haslegendkey)</span>, <span id="getter-colorlegendchips">[`colorLegendChips`](../trackcolorsmixin#getter-colorlegendchips)</span>, <span id="getter-colorscales">[`colorScales`](../trackcolorsmixin#getter-colorscales)</span>

From [SyntenyFilterMixin](../syntenyfiltermixin): <span id="getter-predicates">[`predicates`](../syntenyfiltermixin#getter-predicates)</span>, <span id="getter-minlength">[`minLength`](../syntenyfiltermixin#getter-minlength)</span>

From [BaseViewModel](../baseviewmodel): <span id="getter-rendersdisplays">[`rendersDisplays`](../baseviewmodel#getter-rendersdisplays)</span>, <span id="getter-effectivebodymounted">[`effectiveBodyMounted`](../baseviewmodel#getter-effectivebodymounted)</span>, <span id="getter-ownviews">[`ownViews`](../baseviewmodel#getter-ownviews)</span>

</details>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-syntenytracks">**syntenyTracks**</span><br><code>() =&gt; ComparativeTrackModel[]</code> | the tracks drawing ribbons, which the view's color settings paint |
| <span id="method-loadedattributeranges">**loadedAttributeRanges**</span><br><code>() =&gt; Record&lt;string, AttributeRange&gt;[]</code> | each ribbon display's attribute spans, over the alignments it holds |
| <span id="method-legendcigarops">**legendCigarOps**</span><br><code>() =&gt; number</code> | a ribbon draws no indel blocks, so the key lists none |
| <span id="method-shapeshowsstrand">**shapeShowsStrand**</span><br><code>() =&gt; boolean</code> | a ribbon twists against its two arcs' directions, and nothing on the circle shows which way an arc runs |
| <span id="method-chordat">**chordAt**</span><br><code>(dx: number, dy: number) =&gt; ChordHit &#124; undefined</code> | the chord or ribbon under a point `dx`,`dy` CSS px from the circle's centre in the screen frame |
| <span id="method-bandat">**bandAt**</span><br><code>(dx: number, dy: number) =&gt; string &#124; undefined</code> | the place of the chromosome whose ideogram band holds a point `dx`,`dy` CSS px from the circle's centre in the screen frame |
| <span id="method-bandcenter">**bandCenter**</span><br><code>(key: string) =&gt; [number, number] &#124; undefined</code> | the middle of the ideogram band `key` names, CSS px from the circle's centre in the screen frame: the point `bandAt` answers `key` for |
| <span id="method-lineartracksfor">**linearTracksFor**</span><br><code>(assemblyName: string) =&gt; TrackInit[]</code> | the tracks a linear view of one genome on this circle opens with: each track on that genome but the synteny tracks, a ring as its display and a chord track as the linear view's own |
| <span id="method-tracksmenuitem">**tracksMenuItem**</span><br><code>() =&gt; MenuItem</code> | each track's own menu, which on a linear view hangs off its label and on the circle has nowhere else to go |
| <span id="method-legendspecin">**legendSpecIn**</span><br><code>(palette?: JBrowsePalette &#124; undefined) =&gt; LegendSpec</code> | `legendSpec` in another theme, the SVG export's |
| <span id="method-menuitems">**menuItems**</span><br><code>() =&gt; MenuItem[]</code> | return the view menu items |

<details class="inherited-members" data-pagefind-ignore>
<summary>7 inherited methods from 3 models</summary>

From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="method-colorabletrackconfigs">[`colorableTrackConfigs`](../syntenycolorsmixin#method-colorabletrackconfigs)</span>, <span id="method-colorableattributenames">[`colorableAttributeNames`](../syntenycolorsmixin#method-colorableattributenames)</span>, <span id="method-legendalpha">[`legendAlpha`](../syntenycolorsmixin#method-legendalpha)</span>

From [TrackColorsMixin](../trackcolorsmixin): <span id="method-colorsurface">[`colorSurface`](../trackcolorsmixin#method-colorsurface)</span>, <span id="method-offersreferencecolor">[`offersReferenceColor`](../trackcolorsmixin#method-offersreferencecolor)</span>, <span id="method-trackcolorfor">[`trackColorFor`](../trackcolorsmixin#method-trackcolorfor)</span>

From [SyntenyFilterMixin](../syntenyfiltermixin): <span id="method-lowerbound">[`lowerBound`](../syntenyfiltermixin#method-lowerbound)</span>

</details>

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-fittowindow">**fitToWindow**</span><br><code>() =&gt; void</code> | size the figure so it exactly fills the smaller of the view's two dimensions |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; number</code> |  |
| <span id="action-setheight">**setHeight**</span><br><code>(newHeight: number) =&gt; number</code> |  |
| <span id="action-setshowlegend">**setShowLegend**</span><br><code>(flag: boolean) =&gt; void</code> |  |
| <span id="action-rotateclockwisebutton">**rotateClockwiseButton**</span><br><code>() =&gt; void</code> |  |
| <span id="action-rotatecounterclockwisebutton">**rotateCounterClockwiseButton**</span><br><code>() =&gt; void</code> |  |
| <span id="action-rotate">**rotate**</span><br><code>(delta: number) =&gt; void</code> |  |
| <span id="action-resetview">**resetView**</span><br><code>() =&gt; void</code> | reset rotation, pan, and zoom back to the default fit-to-window view |
| <span id="action-zoominbutton">**zoomInButton**</span><br><code>() =&gt; void</code> |  |
| <span id="action-zoomoutbutton">**zoomOutButton**</span><br><code>() =&gt; void</code> |  |
| <span id="action-zoomaboutviewmiddle">**zoomAboutViewMiddle**</span><br><code>(newBpPerPx: number) =&gt; void</code> | zoom about the circle's middle while the figure sits where the fit put it, and about the view's middle once a zoom to the cursor has panned it, so what the user zoomed toward stays in view |
| <span id="action-setbpperpx">**setBpPerPx**</span><br><code>(newVal: number) =&gt; void</code> |  |
| <span id="action-zoomtopoint">**zoomToPoint**</span><br><code>(newBpPerPx: number, cursorX: number, cursorY: number) =&gt; void</code> | zoom toward/away from a point on the figure, keeping whatever is under it visually fixed. The point is its offset in screen px from the middle of the circle — what `offsetFromCenter` in the component hands back |
| <span id="action-setdisplayedregions">**setDisplayedRegions**</span><br><code>(regions: Region[]) =&gt; void</code> |  |
| <span id="action-activatetrackselector">**activateTrackSelector**</span><br><code>() =&gt; Widget &#124; undefined</code> |  |
| <span id="action-toggletrack">**toggleTrack**</span><br><code>(trackId: string) =&gt; boolean</code> |  |
| <span id="action-seterror">**setError**</span><br><code>(error: unknown) =&gt; void</code> |  |
| <span id="action-sethover">**setHover**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(target: PointerTarget &#124; undefined, clientX?: any, clientY?: an…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(target: PointerTarget &#124; undefined, clientX?: any, clientY?: any) =&gt; void</code></pre></dialog></span> | the pointer is on `target`, or on nothing, at client `x`,`y`. A move that stays on one target keeps it, so only the tooltip follows it |
| <span id="action-setlaunch">**setLaunch**</span><br><code>(launch?: LaunchInput&lt;CircularViewCommands&gt; &#124; undefined) =&gt; void</code> |  |
| <span id="action-clearview">**clearView**</span><br><code>() =&gt; void</code> | back to the import form: no regions, no tracks, no pending launch and no error from the one before |
| <span id="action-showtrack">**showTrack**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, initialSnapshot?: any, displayInitialSnapshot…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, initialSnapshot?: any, displayInitialSnapshot?: any, inlineConf?: Record&lt;string, unknown&gt; &#124; undefined) =&gt; any</code></pre></dialog></span> |  |
| <span id="action-addtrackconf">**addTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any)…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any) =&gt; any</code></pre></dialog></span> |  |
| <span id="action-hidetrack">**hideTrack**</span><br><code>(trackId: string) =&gt; boolean</code> |  |
| <span id="action-openexportdialog">**openExportDialog**</span><br><code>() =&gt; void</code> |  |
| <span id="action-openreorderchromosomesdialog">**openReorderChromosomesDialog**</span><br><code>() =&gt; void</code> |  |
| <span id="action-openinlinearsyntenyview">**openInLinearSyntenyView**</span><br><code>() =&gt; void</code> | a linear synteny view of this circle's genomes, a row each over the chromosomes the circle shows with the tracks it shows for that genome, its ribbon tracks between them, reordered, in this view's color and length filter. A self-alignment opens the genome against itself |
| <span id="action-autodiagonalize">**autoDiagonalize**</span><br><code>() =&gt; Promise&lt;void&gt;</code> | The init-time reorder, behind the "Reordering chromosomes" screen `withDiagonalizeProgress` drives. |
| <span id="action-exportsvg">**exportSvg**</span><br><code>(opts?: ViewExportSvgOptions) =&gt; Promise&lt;string&gt;</code> | renders the view to SVG markup, which it returns; saves it through FileSaver unless `save: false` |
| <span id="action-launchtrack">**launchTrack**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, initialSnapshot?: any, displayInitialSnapshot…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, initialSnapshot?: any, displayInitialSnapshot?: any) =&gt; Promise&lt;any&gt;</code></pre></dialog></span> | showTrack for a track whose display state model may be lazily loaded: loads it, then shows |
| <span id="action-launchtoggletrack">**launchToggleTrack**</span><br><code>(trackId: string) =&gt; Promise&lt;boolean&gt;</code> | toggleTrack with launchTrack's loading behavior |
| <span id="action-launchtrackconf">**launchTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any)…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any) =&gt; Promise&lt;any&gt;</code></pre></dialog></span> | `addTrackConf` with `launchTrack`'s loading behavior, for a track handed over inline rather than from a session list |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> |  |
| <span id="action-resizewidth">**resizeWidth**</span><br><code>(distance: number) =&gt; number</code> |  |

<details class="inherited-members" data-pagefind-ignore>
<summary>24 inherited actions from 7 models</summary>

From [SyntenyFadeMixin](../syntenyfademixin): <span id="action-setantialias">[`setAntialias`](../syntenyfademixin#action-setantialias)</span>, <span id="action-setfadethinlatch">[`setFadeThinLatch`](../syntenyfademixin#action-setfadethinlatch)</span>

From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="action-setopacity">[`setOpacity`](../syntenycolorsmixin#action-setopacity)</span>, <span id="action-setopacityfield">[`setOpacityField`](../syntenycolorsmixin#action-setopacityfield)</span>

From [TrackColorsMixin](../trackcolorsmixin): <span id="action-observeattributeranges">[`observeAttributeRanges`](../trackcolorsmixin#action-observeattributeranges)</span>, <span id="action-resetattributeranges">[`resetAttributeRanges`](../trackcolorsmixin#action-resetattributeranges)</span>, <span id="action-sethideunlabelled">[`setHideUnlabelled`](../trackcolorsmixin#action-sethideunlabelled)</span>, <span id="action-setcolorfield">[`setColorField`](../trackcolorsmixin#action-setcolorfield)</span>, <span id="action-setcolordomain">[`setColorDomain`](../trackcolorsmixin#action-setcolordomain)</span>, <span id="action-settrackcolor">[`setTrackColor`](../trackcolorsmixin#action-settrackcolor)</span>, <span id="action-cleartrackcolors">[`clearTrackColors`](../trackcolorsmixin#action-cleartrackcolors)</span>

From [SyntenyFilterMixin](../syntenyfiltermixin): <span id="action-setfilter">[`setFilter`](../syntenyfiltermixin#action-setfilter)</span>, <span id="action-setlowerbound">[`setLowerBound`](../syntenyfiltermixin#action-setlowerbound)</span>

From [ImportFormSyntenyMixin](../importformsyntenymixin): <span id="action-setimportformsyntenytrack">[`setImportFormSyntenyTrack`](../importformsyntenymixin#action-setimportformsyntenytrack)</span>, <span id="action-clearimportformsyntenytracks">[`clearImportFormSyntenyTracks`](../importformsyntenymixin#action-clearimportformsyntenytracks)</span>

From [DiagonalizeProgressMixin](../diagonalizeprogressmixin): <span id="action-setawaitingautodiagonalize">[`setAwaitingAutoDiagonalize`](../diagonalizeprogressmixin#action-setawaitingautodiagonalize)</span>, <span id="action-beginautodiagonalize">[`beginAutoDiagonalize`](../diagonalizeprogressmixin#action-beginautodiagonalize)</span>, <span id="action-finishautodiagonalize">[`finishAutoDiagonalize`](../diagonalizeprogressmixin#action-finishautodiagonalize)</span>, <span id="action-setdiagonalizeerror">[`setDiagonalizeError`](../diagonalizeprogressmixin#action-setdiagonalizeerror)</span>, <span id="action-setdiagonalizecancel">[`setDiagonalizeCancel`](../diagonalizeprogressmixin#action-setdiagonalizecancel)</span>, <span id="action-cancelautodiagonalize">[`cancelAutoDiagonalize`](../diagonalizeprogressmixin#action-cancelautodiagonalize)</span>

From [BaseViewModel](../baseviewmodel): <span id="action-setdisplayname">[`setDisplayName`](../baseviewmodel#action-setdisplayname)</span>, <span id="action-setbodymounted">[`setBodyMounted`](../baseviewmodel#action-setbodymounted)</span>, <span id="action-setminimized">[`setMinimized`](../baseviewmodel#action-setminimized)</span>

</details>
