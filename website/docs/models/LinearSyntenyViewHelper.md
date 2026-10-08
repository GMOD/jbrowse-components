---
id: linearsyntenyviewhelper
title: LinearSyntenyViewHelper
description: "Holds one level of a linear synteny comparison: its track list and height, composed with the shared rendering-lifecycle state."
sidebar_label: General -> LinearSyntenyViewHelper
---

Auto-generated from the @jbrowse/mobx-state-tree model in the source — see the [developer guide](/docs/developer_guide/) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyViewHelper/stateModelFactory.ts).

Holds one level of a linear synteny comparison: its track list and height,
composed with the shared rendering-lifecycle state.

Nested in LinearSyntenyView.levels, never in session.views: it is a track
container, not a view, and satisfies core's `TrackContainer` so the
track-selector and add-track widgets can write into it via the parent view's
`trackContainerFor`. The `LinearSyntenyViewHelper` name and `type` literal are
kept only because saved sessions persist them.

Each section ends with the members a composed model contributes, linked to the page that documents them.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: 'LinearSyntenyViewHelper'</code> |  |
| <span id="property-tracks">**tracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>tracks: types.array( pluginManager.pluggableMstType('track', 's…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>tracks: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('track', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, 100)</code> |  |

## Volatiles

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="volatile-canvasdrawn">[`canvasDrawn`](../renderlifecyclemixin#volatile-canvasdrawn)</span>, <span id="volatile-paintcount">[`paintCount`](../renderlifecyclemixin#volatile-paintcount)</span>, <span id="volatile-currentrenderingbackend">[`currentRenderingBackend`](../renderlifecyclemixin#volatile-currentrenderingbackend)</span>, <span id="volatile-rendertick">[`renderTick`](../renderlifecyclemixin#volatile-rendertick)</span>, <span id="volatile-autorunsinstalled">[`autorunsInstalled`](../renderlifecyclemixin#volatile-autorunsinstalled)</span>, <span id="volatile-rendererror">[`renderError`](../renderlifecyclemixin#volatile-rendererror)</span>, <span id="volatile-offscreen">[`offScreen`](../renderlifecyclemixin#volatile-offscreen)</span></span>

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-parentview">**parentView**</span><br><code>ParentViewDuck</code> |  |
| <span id="getter-level">**level**</span><br><code>number</code> | this level's place in the stack, and so which rows it draws between |
| <span id="getter-rowpair">**rowPair**</span><br><code>RowPair &#124; undefined</code> | The two rows this level draws between — the upper one is the query axis — or undefined for a level with no row below it. Ungated: whether those rows are ready to draw is `connectedRows`' question. |
| <span id="getter-connectedrows">**connectedRows**</span><br><code>RowPair &#124; undefined</code> | `rowPair` once both rows are initialized with regions, which is also when the view has a width to draw at. Gated on those two rows alone, so a row loading or failed elsewhere in the stack holds back only the bands beside it. The one gate the band's canvas and its displays' fetch share. |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> | the assemblies of `rowPair`, or [] without one |
| <span id="getter-linearsyntenydisplays">**linearSyntenyDisplays**</span><br><code>LinearSyntenyDisplayModel[]</code> | All synteny displays under this level's tracks. |
| <span id="getter-bandtransformkey">**bandTransformKey**</span><br><code>string</code> | Every number that moves a ribbon under a stationary cursor — each connected row's `offsetPx` and `bpPerPx`, plus the band height — as one key, which `installClearHoverOnSurfaceMove` watches. Empty until both rows are there, which no viewport can produce. |
| <span id="getter-displayerror">**displayError**</span><br><code>string &#124; undefined</code> | Every failed track's error in this level, joined into the one value the band has room to report. On-screen only — an SVG export has nowhere to float a banner, so it fails outright from `awaitSvgReady`. |
| <span id="getter-surfacereadiness">**surfaceReadiness**</span><br><code>ComparativeSurface</code> | This level's band as the displays drawing onto it see it: first paint, plus the parent-view flags that mean what is on screen is not the answer yet. `displayPhase` and `settled` are both computed from it. |
| <span id="getter-displayphase">**displayPhase**</span><br><code>DisplayStatusPhase</code> | What the shared canvas publishes as `data-display-phase`: the ranking over the ribbons drawing onto it. `settled` below is the stricter question — see `comparativeReadiness`. |
| <span id="getter-settled">**settled**</span><br><code>boolean</code> | The canvas has painted and no display is still fetching, so what is on screen is final. Drives `synteny_canvas`'s `data-display-drawn`, which screenshot capture and the browser suites wait on — so it means "done", not "first paint". `comparativeReadiness` says why an error answers this and "is every display finished" differently. |
| <span id="getter-syntenycells">**syntenyCells**</span><br><code>Map&lt;number, SyntenyCell&gt;</code> | Every cell the band's backend holds bytes for, in draw order: each display's ribbons, then its outline while a ribbon of it is selected. The upload autorun diffs this map — new entries upload, vanished entries evict — and the wrappers are the displays' own, so a refetch on one track re-uploads only that track. |
| <span id="getter-ribbongeometrybydisplaykey">**ribbonGeometryByDisplayKey**</span><br><code>Map&lt;number, SyntenyInstanceData&gt;</code> | Each track's ribbon geometry, in draw order — what the pick walks. The outline cells are left out: an outline is the selection's own silhouette, drawn over the ribbon it traces. |
| <span id="getter-syntenyblocks">**syntenyBlocks**</span><br><code>RenderBlock[]</code> | One canvas-wide block per cell, so a ribbon's outline draws over its own fill and a later track over an earlier one. |
| <span id="getter-syntenyrenderstate">**syntenyRenderState**</span><br><code>SyntenyRenderState</code> | Aggregated per-frame render state, always resolved — "the view isn't measured yet" is `canRender`'s precondition. An empty `perTrack` is a real frame rather than a skip: the frame clears before drawing, so painting zero tracks is what drops a hidden track's ribbons. |
| <span id="getter-groundcolor">**groundColor**</span><br><code>string</code> | The band's ground — see `bandGroundColor`, which is the decision. Read here so the level's clear, its ribbons, its off-screen-mate strip and its SVG export all take it from one place. |
| <span id="getter-offscreenmatestrips">**offscreenMateStrips**</span><br><code>OffscreenMateStrip[]</code> | The off-screen mate strips this band draws, hit-tests and exports: one computed value for the overlay, the pointer handlers, the tooltip and the SVG export. |
| <span id="getter-hoveringfeature">**hoveringFeature**</span><br><code>boolean</code> | The pointer is over a ribbon somewhere in this band. Drives the canvas cursor, which is the only thing that says a ribbon can be clicked at all — the hover shading is subtle at the default 0.25 opacity. |
| <span id="getter-canrender">**canRender**</span><br><code>boolean</code> | Render-lifecycle precondition, overriding `RenderLifecycleMixin`'s default-true hook: the render callback sizes the canvas off `parentView.width`, and a paint before both rows are up would mark the band drawn over ribbons that have not started to fetch. |
| <span id="getter-paintinert">**paintInert**</span><br><code>boolean</code> | Overrides `RenderLifecycleMixin`'s hook: a band with no synteny track on it paints its ground this tick and nothing is coming, so it has finished rather than being pending. `renderBlocks` answers "did content reach the canvas" off the blocks it drew, which is the right answer for a track still fetching and the wrong one for a band with nothing to draw on it.<br><br>`connectedRows` is the other half: a band whose rows are not up has no tracks either and is *not* finished. This family carries a second guard one layer up — `ComparativeSurface.initPending`, for the level that exists from the moment its rows do while init adds its tracks several awaits later — but that one is about the init blob, not about the rows, so it does not stand in for this. |

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="getter-renderscanvas">[`rendersCanvas`](../renderlifecyclemixin#getter-renderscanvas)</span>, <span id="getter-paintsuperseded">[`paintSuperseded`](../renderlifecyclemixin#getter-paintsuperseded)</span>, <span id="getter-painted">[`painted`](../renderlifecyclemixin#getter-painted)</span></span>

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-displayfor">**displayFor**</span><br><code>(key: number) =&gt; LinearSyntenyDisplayModel &#124; undefined</code> | The display a pick hit belongs to. |
| <span id="method-offscreenmatedestination">**offscreenMateDestination**</span><br><code>(hit: OffscreenMateHit) =&gt; MateNavDestination &#124; undefined</code> | Where a click on a mark would send its row, which the hover prints as the click's promise; undefined for a row the stack no longer has. |
| <span id="method-pickfeatureat">**pickFeatureAt**</span><br><code>(x: number, y: number) =&gt; SyntenyPickResult &#124; undefined</code> | The ribbon under a canvas-relative point, topmost first — the band's hover, click and context menu all ask this. CPU picking rather than a GPU id buffer: ADR-019. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setheight">**setHeight**</span><br><code>(n: number) =&gt; void</code> |  |
| <span id="action-resizeheight">**resizeHeight**</span><br><code>(distance: number) =&gt; void</code> | Drag this band taller or shorter, clamped like every other band drag: the floor keeps the bar itself grabbable, and a band already thinner than the floor stays where it is rather than jumping up to it. The stack-wide drag (`resizeAllLevelHeights`) is this, per level, so the clamp is stated once. |
| <span id="action-showtrack">**showTrack**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, initialSnapshot?: object, displayInitialSnaps…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, initialSnapshot?: object, displayInitialSnapshot?: DisplayInitialSnapshot, inlineConf?: Record&lt;string, unknown&gt; &#124; undefined) =&gt; any</code></pre></dialog></span> |  |
| <span id="action-hidetrack">**hideTrack**</span><br><code>(trackId: string) =&gt; boolean</code> |  |
| <span id="action-toggletrack">**toggleTrack**</span><br><code>(trackId: string) =&gt; boolean</code> |  |
| <span id="action-launchtrack">**launchTrack**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, initialSnapshot?: object, displayInitialSnaps…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, initialSnapshot?: object, displayInitialSnapshot?: DisplayInitialSnapshot, inlineConf?: Record&lt;string, unknown&gt; &#124; undefined) =&gt; Promise&lt;any&gt;</code></pre></dialog></span> | showTrack for a track whose display state model may be lazily loaded: loads it, then shows |
| <span id="action-launchtoggletrack">**launchToggleTrack**</span><br><code>(trackId: string) =&gt; Promise&lt;boolean&gt;</code> | toggleTrack with launchTrack's loading behavior |
| <span id="action-sethoveredfeature">**setHoveredFeature**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(hit: SyntenyPickResult &#124; undefined) =&gt; LinearSyntenyDisplayMod…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(hit: SyntenyPickResult &#124; undefined) =&gt; LinearSyntenyDisplayModel &#124; undefined</code></pre></dialog></span> |  |
| <span id="action-setclickedfeature">**setClickedFeature**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(hit: SyntenyPickResult &#124; undefined) =&gt; LinearSyntenyDisplayMod…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(hit: SyntenyPickResult &#124; undefined) =&gt; LinearSyntenyDisplayModel &#124; undefined</code></pre></dialog></span> | Clicked-state twin of `setHoveredFeature`, across the whole view rather than this band alone |
| <span id="action-showoffscreenmatecontig">**showOffscreenMateContig**</span><br><code>(hit: OffscreenMateHit) =&gt; void</code> | What clicking a mark does: show where its alignments land on the facing row. The row scrolls to them, or gains the contig or a slice of it, and never loses a region it was showing. The click takes the follow anchor, and the Undo gives back the anchor and every row's viewport together. |
| <span id="action-startrenderingbackend">**startRenderingBackend**</span><br><code>(backend: SyntenyRenderingBackend) =&gt; void</code> |  |

<span data-pagefind-ignore>From [RenderLifecycleMixin](../renderlifecyclemixin): <span id="action-markcanvasdrawn">[`markCanvasDrawn`](../renderlifecyclemixin#action-markcanvasdrawn)</span>, <span id="action-resetcanvasdrawn">[`resetCanvasDrawn`](../renderlifecyclemixin#action-resetcanvasdrawn)</span>, <span id="action-stoprenderingbackend">[`stopRenderingBackend`](../renderlifecyclemixin#action-stoprenderingbackend)</span>, <span id="action-rendernow">[`renderNow`](../renderlifecyclemixin#action-rendernow)</span>, <span id="action-setoffscreen">[`setOffScreen`](../renderlifecyclemixin#action-setoffscreen)</span>, <span id="action-setrendererror">[`setRenderError`](../renderlifecyclemixin#action-setrendererror)</span>, <span id="action-attachrenderingbackend">[`attachRenderingBackend`](../renderlifecyclemixin#action-attachrenderingbackend)</span></span>
