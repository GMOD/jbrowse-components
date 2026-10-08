---
id: circularview
title: CircularView
description: "Properties, getters and actions of the CircularView state model."
sidebar_label: View -> CircularView
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/CircularView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`, with every setting written
directly on the view object. `assembly` picks the genome, a `tracks` entry may
carry display config inline, and `displayedRegionNames` keeps an assembly's
alt/unplaced contigs off the circle:

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
| <span id="property-type">**type**</span><br><code>type: types.literal('CircularView') as unknown as string</code> | this is a string instead of the const literal 'CircularView' to reduce some typescripting strictness, but you should pass the string 'CircularView' to the model explicitly |
| <span id="property-offsetradians">**offsetRadians**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>offsetRadians: types.stripDefault(types.number, defaultOffsetRa…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>offsetRadians: types.stripDefault(types.number, defaultOffsetRadians)</code></pre></dialog></span> | similar to offsetPx in linear genome view |
| <span id="property-bpperpx">**bpPerPx**</span><br><code>bpPerPx: types.stripDefault(types.number, defaultBpPerPx)</code> | the zoom level, base-pairs per pixel. Capped by `minimumRadiusPx`, and refit over by the first resize unless `autoFit` is false. |
| <span id="property-autofit">**autoFit**</span><br><code>autoFit: types.stripDefault(types.boolean, true)</code> | whether the view keeps re-fitting to its container on resize. Cleared once the user manually zooms/pans so their view (persisted via bpPerPx/offsetRadians) is preserved across resizes and reloads. |
| <span id="property-tracks">**tracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>tracks: types.array( pluginManager.pluggableMstType('track', 's…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>tracks: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('track', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-hideverticalresizehandle">**hideVerticalResizeHandle**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, fal…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>hideVerticalResizeHandle: types.stripDefault(types.boolean, false)</code></pre></dialog></span> | chrome switch, for an embed that drives the view itself |
| <span id="property-hidetrackselectorbutton">**hideTrackSelectorButton**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>hideTrackSelectorButton: types.stripDefault(types.boolean, fals…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>hideTrackSelectorButton: types.stripDefault(types.boolean, false)</code></pre></dialog></span> | chrome switch, for an embed that drives the view itself |
| <span id="property-disableimportform">**disableImportForm**</span><br><code>disableImportForm: types.stripDefault(types.boolean, false)</code> | suppress the import form even on an error — what the SV inspector's circle wants, since its assembly comes from the sheet beside it and a form there would offer a control that cannot work |
| <span id="property-showlegend">**showLegend**</span><br><code>showLegend: types.stripDefault(types.boolean, false)</code> | a key naming each track's ring, chords or ribbons in the corner |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, defaultHeight)</code> | the height of the view in pixels. The circle auto-fits its container, so this is what sizes the drawing. |
| <span id="property-displayedregions">**displayedRegions**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>displayedRegions: types.stripDefault(types.frozen&lt;Region[]&gt;(),…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>displayedRegions: types.stripDefault(types.frozen&lt;Region[]&gt;(), [])</code></pre></dialog></span> | the regions the circle lays out, one arc each, in this order. `displayedRegionNames` names the same thing by refName and is the shorter form. |
| <span id="property-minimumradiuspx">**minimumRadiusPx**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>minimumRadiusPx: types.stripDefault( types.number, defaultMinim…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>minimumRadiusPx: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.number,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;defaultMinimumRadiusPx,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | how far in the circle may be zoomed, as a floor on the radius; it is what caps bpPerPx |
| <span id="property-spacingpx">**spacingPx**</span><br><code>spacingPx: types.stripDefault(types.number, defaultSpacingPx)</code> | the gap drawn between adjacent chromosome arcs |
| <span id="property-paddingpx">**paddingPx**</span><br><code>paddingPx: types.stripDefault(types.number, defaultPaddingPx)</code> | blank margin between the circle and the edge of the figure |
| <span id="property-minvisiblewidth">**minVisibleWidth**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>minVisibleWidth: types.stripDefault( types.number, defaultMinVi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>minVisibleWidth: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.number,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;defaultMinVisibleWidth,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | arcs thinner than this many pixels are elided instead of drawn, so a few thousand unplaced contigs do not become a ring of hairlines |
| <span id="property-trackselectortype">**trackSelectorType**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>trackSelectorType: types.stripDefault(types.string, 'hierarchic…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>trackSelectorType: types.stripDefault(types.string, 'hierarchical')</code></pre></dialog></span> | vestigial: the hierarchical selector is the only one that exists, so this value is ignored. Retained because saved sessions and share links persist it. |
| <span id="property-launch">**launch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>launch: types.frozen&lt;LaunchInput&lt;CircularViewCommands&gt; &#124; undefi…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>launch: types.frozen&lt;LaunchInput&lt;CircularViewCommands&gt; &#124; undefined&gt;()</code></pre></dialog></span> | transient launch state: the settings written on the view object that need resolving before they can be view state — the assembly the circle is drawn from, the refNames to restrict it to, chord track recipes. `preProcessSnapshot` moves them here off the snapshot, the afterAttach autorun applies them and clears this, so a saved session never retains it. Not written by hand: author every setting directly on the view. |

<span data-pagefind-ignore>From [BaseViewModel](../baseviewmodel): <span id="property-id">[`id`](../baseviewmodel#property-id)</span>, <span id="property-displayname">[`displayName`](../baseviewmodel#property-displayname)</span>, <span id="property-minimized">[`minimized`](../baseviewmodel#property-minimized)</span></span>

<span data-pagefind-ignore>From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="property-opacity">[`opacity`](../syntenycolorsmixin#property-opacity)</span>, <span id="property-minalignmentlength">[`minAlignmentLength`](../syntenycolorsmixin#property-minalignmentlength)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="property-color">[`color`](../trackcolorsmixin#property-color)</span>, <span id="property-trackcolors">[`trackColors`](../trackcolorsmixin#property-trackcolors)</span>, <span id="property-hideunlabelled">[`hideUnlabelled`](../trackcolorsmixin#property-hideunlabelled)</span></span>

<span data-pagefind-ignore>From [SyntenyFadeMixin](../syntenyfademixin): <span id="property-fadethinalignmentsmode">[`fadeThinAlignmentsMode`](../syntenyfademixin#property-fadethinalignmentsmode)</span></span>

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-volatilewidth">**volatileWidth**</span><br><code>number &#124; undefined</code> |  |
| <span id="volatile-volatileerror">**volatileError**</span><br><code>unknown</code> |  |
| <span id="volatile-panx">**panX**</span><br><code>number</code> |  |
| <span id="volatile-pany">**panY**</span><br><code>number</code> |  |
| <span id="volatile-ringhost">**ringHost**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; { setWidth(): void; set…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; { setWidth(): void; setBodyMounted(): void; setMinimized(): void; setDisplayName(): void; scrollZoom(): void; setStripElement(displayId: string, el: HTMLElement &#124; null): void; setCoarseDynamicBlocks(blocks: BlockSet, bpPerPx: number): void; syncRings(displayIds: string[]): void; } &amp; { setView(view: RingHostView): void; beforeDestroy(): void; } &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> | the strip every linear display in this view lays out along, and the rings drawn from it — see `regionHost` |
| <span id="volatile-hover">**hover**</span><br><code>PointerTarget &#124; undefined</code> | the chord or ribbon under the pointer, which the highlight paths and the tooltip read |
| <span id="volatile-hoverclientxy">**hoverClientXY**</span><br><code>[number, number] &#124; undefined</code> | where the pointer was on the page while it was on `hover`, which only the tooltip follows |
| <span id="volatile-chordpass">**chordPass**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { attachRen…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { attachRenderingBackend&lt;B&gt;(backend: B, setup: () =&gt; RenderingBackendCallbacks&lt;…&gt;): void; } &amp; { view: ChordPassView &#124; undefined; drawnCells: ReadonlySet&lt;…&gt;; } &amp; { readonly frame: ChordLayerFrame; readonly cells: ReadonlyMap&lt;…&gt;; readonly canRender: boolean; readonly rendersCanvas: boolean; drew(cell: ChordCell): boolean; } &amp; { setView(view: ChordPassView): void; setDrawnCells(cells: ReadonlyMap&lt;…&gt;): void; } &amp; { startRenderingBackend(backend: ChordBackend): void; } &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> | the canvas the chords and ribbons of every chord display draw on |

<span data-pagefind-ignore>From [BaseViewModel](../baseviewmodel): <span id="volatile-width">[`width`](../baseviewmodel#volatile-width)</span>, <span id="volatile-bodymounted">[`bodyMounted`](../baseviewmodel#volatile-bodymounted)</span></span>

<span data-pagefind-ignore>From [DiagonalizeProgressMixin](../diagonalizeprogressmixin): <span id="volatile-awaitingautodiagonalize">[`awaitingAutoDiagonalize`](../diagonalizeprogressmixin#volatile-awaitingautodiagonalize)</span>, <span id="volatile-pendingautodiagonalize">[`pendingAutoDiagonalize`](../diagonalizeprogressmixin#volatile-pendingautodiagonalize)</span>, <span id="volatile-diagonalizestatus">[`diagonalizeStatus`](../diagonalizeprogressmixin#volatile-diagonalizestatus)</span>, <span id="volatile-diagonalizecancel">[`diagonalizeCancel`](../diagonalizeprogressmixin#volatile-diagonalizecancel)</span>, <span id="volatile-diagonalizeerror">[`diagonalizeError`](../diagonalizeprogressmixin#volatile-diagonalizeerror)</span></span>

<span data-pagefind-ignore>From [ImportFormSyntenyMixin](../importformsyntenymixin): <span id="volatile-importformsyntenytrackselections">[`importFormSyntenyTrackSelections`](../importformsyntenymixin#volatile-importformsyntenytrackselections)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="volatile-seenattributeranges">[`seenAttributeRanges`](../trackcolorsmixin#volatile-seenattributeranges)</span></span>

<span data-pagefind-ignore>From [SyntenyFadeMixin](../syntenyfademixin): <span id="volatile-fadethinlatch">[`fadeThinLatch`](../syntenyfademixin#volatile-fadethinlatch)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-owntracks">**ownTracks**</span><br><code>any[]</code> | The census entry for this view: the tracks it holds itself. Declared rather than derived — see `BaseViewModel.ownTracks`. |
| <span id="getter-width">**width**</span><br><code>number</code> |  |
| <span id="getter-fitlayout">**fitLayout**</span><br><code>FitLayout</code> | the circle that fills the box: its scale and radius, and the padding the view keeps at every zoom. A pure function of the regions and the box — see `fitLayout` |
| <span id="getter-effectivepaddingpx">**effectivePaddingPx**</span><br><code>number</code> | `paddingPx`, capped at a share of a small box and floored at what the labels drawn at the fit reach, so a label is never drawn at a negative x and clipped by the box |
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
| <span id="getter-figureoriginxy">**figureOriginXY**</span><br><code>[number, number]</code> | top-left of the figure within the view's box, then shifted by the zoom-to-cursor pan.<br><br>Centered horizontally: a view much wider than it is tall would otherwise leave the circle jammed in the corner under the controls.<br><br>Vertically it hangs from the top of a box taller than it is wide — see `figureMiddleY`, which `zoomToPoint` reads for the same reason. |
| <span id="getter-elisionmask">**elisionMask**</span><br><code>string</code> | which displayed regions are too narrow at this zoom to draw as themselves, one character each |
| <span id="getter-elidedregions">**elidedRegions**</span><br><code>SliceRegion[]</code> | this is displayedRegions, post-processed to elide regions that are too small to see reasonably. A run of them never crosses from one assembly into the next, so each genome's arcs stay its own. Read off `elisionMask`, so a zoom that elides nothing new rebuilds nothing |
| <span id="getter-pendinglaunch">**pendingLaunch**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>LaunchInput&lt;CircularViewCommands &amp; { unknown?: Record&lt;string, u…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>LaunchInput&lt;CircularViewCommands &amp; { unknown?: Record&lt;string, unknown&gt; &#124; undefined; malformed?: Record&lt;string, unknown&gt; &#124; undefined; legacyInit?: boolean &#124; undefined; } &amp; IStateTreeNode&lt;IType&lt;LaunchInput&lt;CircularViewCommands&gt; &#124; undefined, LaunchInput&lt;CircularViewCommands&gt; &#124; undefined, LaunchInput&lt;CircularViewCommands&gt; &#124; undefined&gt;&gt;&gt; &#124; undefined</code></pre></dialog></span> | the launch state that still has something to apply — the gate the loading and import-form paths below read. |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  |
| <span id="getter-chordsyntenydisplays">**chordSyntenyDisplays**</span><br><code>ChordSyntenyDisplaySelf[]</code> | the ribbon displays of `syntenyTracks()`; a chromosome reorder reads its alignments from these |
| <span id="getter-candiagonalize">**canDiagonalize**</span><br><code>boolean</code> | Whether a chromosome reorder has anything to do: a ribbon track to take alignments from, and exactly the two genomes a mirrored layout is defined for. One is a self-alignment, with no second arc to reorder; three or more have no layout in which every pair reads as a band. |
| <span id="getter-paintedassemblyname">**paintedAssemblyName**</span><br><code>string &#124; undefined</code> | the genome whose ideogram a ribbon track paints by what aligns to it from the first, rather than in its own chromosomes' colours |
| <span id="getter-ideogrampaint">**ideogramPaint**</span><br><code>ReadonlyMap&lt;string, PaintRun[]&gt;</code> | that genome's paint, by slice key |
| <span id="getter-launchassemblynames">**launchAssemblyNames**</span><br><code>string[]</code> | The assemblies a pending launch names, which the gates below wait on before `displayedRegions` exist. A blob carrying only tracks names none, and waiting on one nobody named never ends. |
| <span id="getter-initialized">**initialized**</span><br><code>boolean</code> |  |
| <span id="getter-assemblyerrors">**assemblyErrors**</span><br><code>string &#124; undefined</code> |  |
| <span id="getter-error">**error**</span><br><code>unknown</code> |  |
| <span id="getter-hassomethingtoshow">**hasSomethingToShow**</span><br><code>boolean</code> |  |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | Whether to show a loading indicator instead of the import form or view |
| <span id="getter-loadingassembly">**loadingAssembly**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…}…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; {…} &amp; { getCanonicalRefName2(refName: string): string; isValidRefName(refName: string): boolean; } &amp; { getRefNamePosition(refName: string): number &#124; undefined; getAliasesForRefName(refName: string): string[]; getRefNameMapForAdapter(adapterConf: AdapterConf, options: BaseOptions): Promise&lt;…&gt;; getRefNameMismatch(adapterCacheKey: string): RefNameMismatch &#124; undefined; } &amp; IStateTreeNode&lt;…&gt;) &#124; undefined</code></pre></dialog></span> | The assembly whose load the spinner is waiting on. A pending launch names them before displayedRegions exist, so it is the source until then — the same order `initialized` above resolves in. |
| <span id="getter-loading">**loading**</span><br><code>ViewLoading &#124; undefined</code> | What the loading screen says while `showLoading`, read off the assembly whose load is the wait; undefined otherwise. |
| <span id="getter-showview">**showView**</span><br><code>boolean</code> | Whether the view is fully initialized and ready to display |
| <span id="getter-showimportform">**showImportForm**</span><br><code>boolean</code> | `!hasSomethingToShow \|\| !!error`, the same predicate as every other view, with `disableImportForm` suppressing the whole thing rather than only its first half.<br><br>The `\|\|` used to bind the other way, so an error re-enabled a form the embedder had turned off. That is reachable, and the sv-inspector — `disableImportForm`'s only setter — is where: its circle is driven by the spreadsheet's assembly, so a circle left sitting on regions whose assembly the config no longer has reports an error (the case the region-binding autorun's comment describes). The inspector then grew a circular-view import form inside its own panel, offering an assembly dropdown whose Open the inspector's autorun overwrites on the next pass — a control that cannot work, in a view that asked not to have it.<br><br>The error still has to be reported, so the component renders a bare ErrorBanner in that case; the form is only the *usual* place a circular view puts one. |
| <span id="getter-status">**status**</span><br><code>ViewStatus</code> | The view's lifecycle as one value — ready, error, loading or noRegions — for a host that draws its own chrome and has to render all four. Same shape and same precedence as the linear view's, through `computeViewStatus`. |
| <span id="getter-regionhost">**regionHost**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; { setWidth(): void; set…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>ModelInstanceTypeProps&lt;…&gt; &amp; {…} &amp; {…} &amp; { setWidth(): void; setBodyMounted(): void; setMinimized(): void; setDisplayName(): void; scrollZoom(): void; setStripElement(displayId: string, el: HTMLElement &#124; null): void; setCoarseDynamicBlocks(blocks: BlockSet, bpPerPx: number): void; syncRings(displayIds: string[]): void; } &amp; { setView(view: RingHostView): void; beforeDestroy(): void; } &amp; IStateTreeNode&lt;…&gt;</code></pre></dialog></span> | The node a linear display's foundation reads as its view: the circumference unrolled into a strip. A display registered for the linear genome view draws on this view as a ring of that strip, so `containingHost` answers this rather than the view itself. |
| <span id="getter-chordradiuspx">**chordRadiusPx**</span><br><code>number</code> | Where the chord displays start: inside the innermost ring, or at the ruler when the view holds none. |
| <span id="getter-chorddisplays">**chordDisplays**</span><br><code>ChordLayerDisplay[]</code> | the displays drawing across the circle, in track order: every first display registered for this view rather than laid out as a ring |
| <span id="getter-hoveredchord">**hoveredChord**</span><br><code>ChordHit &#124; undefined</code> | the chord or ribbon under the pointer |
| <span id="getter-hoveredband">**hoveredBand**</span><br><code>AxisSlice</code> | the chromosome whose band is under the pointer, on the chord axis |
| <span id="getter-chordfocusgaps">**chordFocusGaps**</span><br><code>number</code> | that chromosome as the chord stage's focus: its slice's gap count, the name a foot gives it, or -1 for none |
| <span id="getter-bandcomposition">**bandComposition**</span><br><code>{ name: string; shares: PartnerShare[]; } &#124; undefined</code> | the hovered chromosome's name and the share of it each chromosome aligned to it covers, most first |
| <span id="getter-hoverschord">**hoversChord**</span><br><code>boolean</code> | whether the pointer is on a chord or ribbon, which only changes as it crosses onto one or off it |
| <span id="getter-chordaxis">**chordAxis**</span><br><code>ChordAxis</code> | the circle's slices on the unrolled genome axis, which the chord displays place their feet on; rebuilt when the regions or their elision change, never by a zoom or a rotation alone |
| <span id="getter-chordscale">**chordScale**</span><br><code>{ radiansPerBp: number; gapRadians: number; }</code> | the polar stage's scale from the unrolled axis to radians: per base, and per gap between slices |
| <span id="getter-autofadewidthpx">**autoFadeWidthPx**</span><br><code>number</code> | The width 'auto' compares against its thresholds: the narrowest capped mean span, on screen, of any ribbon display with enough alignments to judge, and nothing to judge before the circle has a size |
| <span id="getter-chordthinfadefloor">**chordThinFadeFloor**</span><br><code>1 &#124; 0.15</code> | the least alpha the thin fade leaves a ribbon, 1 while it is off |
| <span id="getter-staticslices">**staticSlices**</span><br><code>Slice[]</code> |  |
| <span id="getter-legendspec">**legendSpec**</span><br><code>LegendSpec</code> | one row per track: its name beside the color or ramp it paints with |

<span data-pagefind-ignore>From [BaseViewModel](../baseviewmodel): <span id="getter-rendersdisplays">[`rendersDisplays`](../baseviewmodel#getter-rendersdisplays)</span>, <span id="getter-effectivebodymounted">[`effectiveBodyMounted`](../baseviewmodel#getter-effectivebodymounted)</span>, <span id="getter-ownviews">[`ownViews`](../baseviewmodel#getter-ownviews)</span></span>

<span data-pagefind-ignore>From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="getter-defaultopacity">[`defaultOpacity`](../syntenycolorsmixin#getter-defaultopacity)</span>, <span id="getter-opacitysetting">[`opacitySetting`](../syntenycolorsmixin#getter-opacitysetting)</span>, <span id="getter-opacityfade">[`opacityFade`](../syntenycolorsmixin#getter-opacityfade)</span>, <span id="getter-opacitylevel">[`opacityLevel`](../syntenycolorsmixin#getter-opacitylevel)</span>, <span id="getter-opacityfield">[`opacityField`](../syntenycolorsmixin#getter-opacityfield)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="getter-colorsetting">[`colorSetting`](../trackcolorsmixin#getter-colorsetting)</span>, <span id="getter-colorramp">[`colorRamp`](../trackcolorsmixin#getter-colorramp)</span>, <span id="getter-colorvalue">[`colorValue`](../trackcolorsmixin#getter-colorvalue)</span>, <span id="getter-colordomain">[`colorDomain`](../trackcolorsmixin#getter-colordomain)</span>, <span id="getter-colorrange">[`colorRange`](../trackcolorsmixin#getter-colorrange)</span>, <span id="getter-colorableattributes">[`colorableAttributes`](../trackcolorsmixin#getter-colorableattributes)</span>, <span id="getter-attributeranges">[`attributeRanges`](../trackcolorsmixin#getter-attributeranges)</span>, <span id="getter-colorabletracks">[`colorableTracks`](../trackcolorsmixin#getter-colorabletracks)</span>, <span id="getter-trackcolorassignments">[`trackColorAssignments`](../trackcolorsmixin#getter-trackcolorassignments)</span>, <span id="getter-colorfield">[`colorField`](../trackcolorsmixin#getter-colorfield)</span>, <span id="getter-haslegendkey">[`hasLegendKey`](../trackcolorsmixin#getter-haslegendkey)</span>, <span id="getter-colorlegendchips">[`colorLegendChips`](../trackcolorsmixin#getter-colorlegendchips)</span>, <span id="getter-colorscales">[`colorScales`](../trackcolorsmixin#getter-colorscales)</span></span>

<span data-pagefind-ignore>From [SyntenyFadeMixin](../syntenyfademixin): <span id="getter-fadethinalignments">[`fadeThinAlignments`](../syntenyfademixin#getter-fadethinalignments)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-syntenytracks">**syntenyTracks**</span><br><code>() =&gt; ComparativeTrackModel[]</code> | the tracks drawing ribbons, which the view's colour settings paint |
| <span id="method-loadedattributeranges">**loadedAttributeRanges**</span><br><code>() =&gt; Record&lt;string, AttributeRange&gt;[]</code> | each ribbon display's attribute spans, over the alignments it holds |
| <span id="method-legendcigarops">**legendCigarOps**</span><br><code>() =&gt; number</code> | a ribbon draws no indel blocks, so the key lists none |
| <span id="method-shapeshowsstrand">**shapeShowsStrand**</span><br><code>() =&gt; boolean</code> | a ribbon twists against its two arcs' directions, and nothing on the circle shows which way an arc runs |
| <span id="method-chordat">**chordAt**</span><br><code>(dx: number, dy: number) =&gt; ChordHit &#124; undefined</code> | the chord or ribbon under a point `dx`,`dy` CSS px from the circle's centre in the screen frame |
| <span id="method-bandat">**bandAt**</span><br><code>(dx: number, dy: number) =&gt; string &#124; undefined</code> | the place of the chromosome whose ideogram band holds a point `dx`,`dy` CSS px from the circle's centre in the screen frame |
| <span id="method-bandcenter">**bandCenter**</span><br><code>(key: string) =&gt; [number, number] &#124; undefined</code> | the middle of the ideogram band `key` names, CSS px from the circle's centre in the screen frame: the point `bandAt` answers `key` for |
| <span id="method-lineartracksfor">**linearTracksFor**</span><br><code>(assemblyName: string) =&gt; TrackInit[]</code> | the tracks a linear view of one genome on this circle opens with: each track on that genome but the synteny tracks, a ring as its display and a chord track as the linear view's own |
| <span id="method-tracksmenuitem">**tracksMenuItem**</span><br><code>() =&gt; MenuItem</code> | each track's own menu, which on a linear view hangs off its label and on the circle has nowhere else to go |
| <span id="method-legendspecin">**legendSpecIn**</span><br><code>(palette?: JBrowsePalette &#124; undefined) =&gt; LegendSpec</code> | `legendSpec` in another theme, the SVG export's, which keys a ring whose colors follow the theme (alignments, MAF) in that theme. The ribbon key takes no colors from the theme. |
| <span id="method-menuitems">**menuItems**</span><br><code>() =&gt; MenuItem[]</code> | return the view menu items |

<span data-pagefind-ignore>From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="method-colorabletrackconfigs">[`colorableTrackConfigs`](../syntenycolorsmixin#method-colorabletrackconfigs)</span>, <span id="method-colorableattributenames">[`colorableAttributeNames`](../syntenycolorsmixin#method-colorableattributenames)</span>, <span id="method-legendalpha">[`legendAlpha`](../syntenycolorsmixin#method-legendalpha)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="method-colorsurface">[`colorSurface`](../trackcolorsmixin#method-colorsurface)</span>, <span id="method-offersreferencecolor">[`offersReferenceColor`](../trackcolorsmixin#method-offersreferencecolor)</span>, <span id="method-trackcolorfor">[`trackColorFor`](../trackcolorsmixin#method-trackcolorfor)</span></span>

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
| <span id="action-openinlinearsyntenyview">**openInLinearSyntenyView**</span><br><code>() =&gt; void</code> | a linear synteny view of this circle's genomes, a row each over the chromosomes the circle shows with the tracks it shows for that genome, its ribbon tracks between them, reordered, in this view's colour and length filter. A self-alignment opens the genome against itself |
| <span id="action-autodiagonalize">**autoDiagonalize**</span><br><code>() =&gt; Promise&lt;void&gt;</code> | The init-time reorder, behind the "Reordering chromosomes" screen `withDiagonalizeProgress` drives. |
| <span id="action-exportsvg">**exportSvg**</span><br><code>(opts?: ViewExportSvgOptions) =&gt; Promise&lt;string&gt;</code> | renders the view to SVG markup, which it returns; saves it through FileSaver unless `save: false` |
| <span id="action-launchtrack">**launchTrack**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, initialSnapshot?: any, displayInitialSnapshot…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, initialSnapshot?: any, displayInitialSnapshot?: any) =&gt; Promise&lt;any&gt;</code></pre></dialog></span> | showTrack for a track whose display state model may be lazily loaded: loads it, then shows |
| <span id="action-launchtoggletrack">**launchToggleTrack**</span><br><code>(trackId: string) =&gt; Promise&lt;boolean&gt;</code> | toggleTrack with launchTrack's loading behavior |
| <span id="action-launchtrackconf">**launchTrackConf**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any)…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(configuration: Record&lt;string, unknown&gt;, initialSnapshot?: any) =&gt; Promise&lt;any&gt;</code></pre></dialog></span> | `addTrackConf` with `launchTrack`'s loading behavior, for a track handed over inline rather than from a session list |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; number</code> |  |
| <span id="action-resizewidth">**resizeWidth**</span><br><code>(distance: number) =&gt; number</code> |  |

<span data-pagefind-ignore>From [BaseViewModel](../baseviewmodel): <span id="action-setdisplayname">[`setDisplayName`](../baseviewmodel#action-setdisplayname)</span>, <span id="action-setbodymounted">[`setBodyMounted`](../baseviewmodel#action-setbodymounted)</span>, <span id="action-setminimized">[`setMinimized`](../baseviewmodel#action-setminimized)</span></span>

<span data-pagefind-ignore>From [DiagonalizeProgressMixin](../diagonalizeprogressmixin): <span id="action-setawaitingautodiagonalize">[`setAwaitingAutoDiagonalize`](../diagonalizeprogressmixin#action-setawaitingautodiagonalize)</span>, <span id="action-beginautodiagonalize">[`beginAutoDiagonalize`](../diagonalizeprogressmixin#action-beginautodiagonalize)</span>, <span id="action-finishautodiagonalize">[`finishAutoDiagonalize`](../diagonalizeprogressmixin#action-finishautodiagonalize)</span>, <span id="action-setdiagonalizeerror">[`setDiagonalizeError`](../diagonalizeprogressmixin#action-setdiagonalizeerror)</span>, <span id="action-setdiagonalizecancel">[`setDiagonalizeCancel`](../diagonalizeprogressmixin#action-setdiagonalizecancel)</span>, <span id="action-cancelautodiagonalize">[`cancelAutoDiagonalize`](../diagonalizeprogressmixin#action-cancelautodiagonalize)</span></span>

<span data-pagefind-ignore>From [ImportFormSyntenyMixin](../importformsyntenymixin): <span id="action-setimportformsyntenytrack">[`setImportFormSyntenyTrack`](../importformsyntenymixin#action-setimportformsyntenytrack)</span>, <span id="action-clearimportformsyntenytracks">[`clearImportFormSyntenyTracks`](../importformsyntenymixin#action-clearimportformsyntenytracks)</span></span>

<span data-pagefind-ignore>From [SyntenyColorsMixin](../syntenycolorsmixin): <span id="action-setopacity">[`setOpacity`](../syntenycolorsmixin#action-setopacity)</span>, <span id="action-setopacityfield">[`setOpacityField`](../syntenycolorsmixin#action-setopacityfield)</span>, <span id="action-setminalignmentlength">[`setMinAlignmentLength`](../syntenycolorsmixin#action-setminalignmentlength)</span></span>

<span data-pagefind-ignore>From [TrackColorsMixin](../trackcolorsmixin): <span id="action-observeattributeranges">[`observeAttributeRanges`](../trackcolorsmixin#action-observeattributeranges)</span>, <span id="action-resetattributeranges">[`resetAttributeRanges`](../trackcolorsmixin#action-resetattributeranges)</span>, <span id="action-sethideunlabelled">[`setHideUnlabelled`](../trackcolorsmixin#action-sethideunlabelled)</span>, <span id="action-setcolorfield">[`setColorField`](../trackcolorsmixin#action-setcolorfield)</span>, <span id="action-setcolordomain">[`setColorDomain`](../trackcolorsmixin#action-setcolordomain)</span>, <span id="action-settrackcolor">[`setTrackColor`](../trackcolorsmixin#action-settrackcolor)</span>, <span id="action-cleartrackcolors">[`clearTrackColors`](../trackcolorsmixin#action-cleartrackcolors)</span></span>

<span data-pagefind-ignore>From [SyntenyFadeMixin](../syntenyfademixin): <span id="action-setfadethinalignmentsmode">[`setFadeThinAlignmentsMode`](../syntenyfademixin#action-setfadethinalignmentsmode)</span>, <span id="action-setfadethinlatch">[`setFadeThinLatch`](../syntenyfademixin#action-setfadethinlatch)</span></span>
