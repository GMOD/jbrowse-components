---
id: dotplotview
title: DotplotView
sidebar_label: View -> DotplotView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`dotplot-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`. `init.views` lists the two
assemblies on the axes and `tracks` the synteny track(s) to plot (self-vs-self
is allowed):

```js
{
  type: 'DotplotView',
  init: {
    views: [{ assembly: 'hg38' }, { assembly: 'mm10' }],
    tracks: ['hg38_vs_mm10.paf'],
    colorBy: 'query',
  },
}
```

Other `init` fields: `autoDiagonalize`, `minAlignmentLength`, and a per-axis
`loc` on each `views` entry — see the `init` property below.

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  | DotplotView |
| <span id="property-type">**type**</span><br><code>type: types.literal('DotplotView')</code> |  | DotplotView |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, defaultHeight)</code> |  | DotplotView |
| <span id="property-trackselectortype">**trackSelectorType**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>trackSelectorType: types.stripDefault(types.string, 'hierarchic…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>trackSelectorType: types.stripDefault(types.string, 'hierarchical')</code></pre></dialog></span> | vestigial: the hierarchical selector is the only one that exists, so this value is ignored. Retained because saved sessions and configs persist it. | DotplotView |
| <span id="property-assemblynames">**assemblyNames**</span><br><code>assemblyNames: types.stripDefault(types.array(types.string), [])</code> |  | DotplotView |
| <span id="property-drawcigar">**drawCigar**</span><br><code>drawCigar: types.stripDefault(types.boolean, true)</code> |  | DotplotView |
| <span id="property-lodmode">**lodMode**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>lodMode: types.stripDefault( types.enumeration('LodMode', ['aut…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>lodMode: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.enumeration('LodMode', ['auto', 'fine', 'coarse']),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;'auto',&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | Level-of-detail tier override for PIF adapters. 'auto' uses the adapter's bpPerPx threshold; 'fine'/'coarse' force a tier. Stored view-level so all displays render at the same tier and the menu doesn't need to fan out per display. | DotplotView |
| <span id="property-lockaspectratio">**lockAspectRatio**</span><br><code>lockAspectRatio: types.stripDefault(types.boolean, false)</code> | When true, hview and vview are kept at the same bpPerPx so the dotplot stays square. Wheel zoom already preserves the ratio; box-zoom and other independent ops trigger an autorun resync. | DotplotView |
| <span id="property-linewidth">**lineWidth**</span><br><code>lineWidth: types.stripDefault(types.number, defaultLineWidth)</code> | Screen-space line width (CSS pixels) applied to every dotplot display in this view. View-level because the GPU pass renders all displays with one uniform. | DotplotView |
| <span id="property-hview">**hview**</span><br><code>hview: types.optional(DotplotHView, {})</code> |  | DotplotView |
| <span id="property-vview">**vview**</span><br><code>vview: types.optional(DotplotVView, {})</code> |  | DotplotView |
| <span id="property-tracks">**tracks**</span><br><code>tracks: types.array(pm.pluggableMstType('track', 'stateModel'))</code> |  | DotplotView |
| <span id="property-viewtrackconfigs">**viewTrackConfigs**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>viewTrackConfigs: types.stripDefault( types.array(pm.pluggableC…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>viewTrackConfigs: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.array(pm.pluggableConfigSchemaType('track')),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;[],&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | this represents tracks specific to this view specifically used for read vs ref dotplots where this track would not really apply elsewhere | DotplotView |
| <span id="property-init">**init**</span><br><code>init: types.frozen&lt;DotplotViewInit &#124; undefined&gt;()</code> | used for initializing the view from a session snapshot | DotplotView |
| <span id="property-showcolorlegend">**showColorLegend**</span><br><code>showColorLegend: types.stripDefault(types.boolean, false)</code> | Show the floating color-by legend in the top-right of the plot. Dismissible via the legend's close button; re-enable from the color-by (palette) menu. | DotplotView |
| <span id="property-colorby">**colorBy**</span><br><code>colorBy: types.stripDefault(types.string, 'default')</code> | The color-by mode the whole plot renders with, unless a track overrides it in `trackColorBy`. | DotplotView |
| <span id="property-trackcolorby">**trackColorBy**</span><br><code>trackColorBy: types.map(types.string)</code> | trackId -> color-by mode for that track alone. Absent means the track follows the plot-wide `colorBy`. | DotplotView |
| <span id="property-trackcolors">**trackColors**</span><br><code>trackColors: types.map(types.string)</code> | trackId -> explicit color under `colorBy: 'track'`. Absent means the track takes an automatic slot from the palette. | DotplotView |
| <span id="property-displayname">**displayName**</span><br><code>displayName: types.maybe(types.string)</code> | <span data-pagefind-ignore>displayName is displayed in the header of the view, or assembly names being used if none is specified</span> | [BaseViewModel](../baseviewmodel#property-displayname) |
| <span id="property-minimized">**minimized**</span><br><code>minimized: types.stripDefault(types.boolean, false)</code> |  | [BaseViewModel](../baseviewmodel#property-minimized) |
| <span id="property-highlight">**highlight**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>highlight: types.stripDefault( types.array(types.frozen&lt;Highlig…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>highlight: types.stripDefault(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.array(types.frozen&lt;HighlightType&gt;()),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;[],&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | <span data-pagefind-ignore>translucent highlight bands, seeded from URL params or session JSON and added interactively via the rubber-band menu</span> | [HighlightsMixin](../highlightsmixin#property-highlight) |
| <span id="property-showhighlightchips">**showHighlightChips**</span><br><code>showHighlightChips: types.stripDefault(types.boolean, false)</code> | <span data-pagefind-ignore>controls whether the interactive highlight chip (link icon + context menu) is drawn on each highlight band; off by default</span> | [HighlightsMixin](../highlightsmixin#property-showhighlightchips) |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-volatilewidth">**volatileWidth**</span><br><code>volatileWidth: undefined as number &#124; undefined</code> |  | DotplotView |
| <span id="volatile-volatileerror">**volatileError**</span><br><code>volatileError: undefined as unknown</code> |  | DotplotView |
| <span id="volatile-cursormode">**cursorMode**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>cursorMode: localStorageGetItem(LS_CURSOR_MODE) === 'move' ? 'm…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>cursorMode:&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;localStorageGetItem(LS_CURSOR_MODE) === 'move' ? 'move' : 'crosshair'</code></pre></dialog></span> | these are 'personal preferences', stored in volatile and loaded/written to localStorage | DotplotView |
| <span id="volatile-importformsyntenytrackselections">**importFormSyntenyTrackSelections**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>importFormSyntenyTrackSelections: observable.array&lt;ImportFormSy…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>importFormSyntenyTrackSelections:&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;observable.array&lt;ImportFormSyntenyTrack&gt;()</code></pre></dialog></span> |  | DotplotView |
| <span id="volatile-width">**width**</span><br><code>width: 800</code> |  | [BaseViewModel](../baseviewmodel#volatile-width) |
| <span id="volatile-canvasdrawn">**canvasDrawn**</span><br><code>canvasDrawn: false</code> | <span data-pagefind-ignore>flips true on first paint; read by test selectors to detect render</span> | [RenderLifecycleMixin](../renderlifecyclemixin#volatile-canvasdrawn) |
| <span id="volatile-currentrenderingbackend">**currentRenderingBackend**</span><br><code>currentRenderingBackend: undefined</code> | <span data-pagefind-ignore>current backend reference, updated on context-loss recovery. Typed `unknown` (not generic `B`) on purpose: this mixin is composed by every display via a non-generic factory, so the per-display backend type `B` isn't known here — it's supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the autoruns. Don't "fix" the cast.</span> | [RenderLifecycleMixin](../renderlifecyclemixin#volatile-currentrenderingbackend) |
| <span id="volatile-rendertick">**renderTick**</span><br><code>renderTick: 0</code> | <span data-pagefind-ignore>counter the render autorun observes; bumped to force a re-render</span> | [RenderLifecycleMixin](../renderlifecyclemixin#volatile-rendertick) |
| <span id="volatile-autorunsinstalled">**autorunsInstalled**</span><br><code>autorunsInstalled: false</code> | <span data-pagefind-ignore>guards attachRenderingBackend so the autorun pair spawns once per instance</span> | [RenderLifecycleMixin](../renderlifecyclemixin#volatile-autorunsinstalled) |
| <span id="volatile-rendererror">**renderError**</span><br><code>renderError: undefined</code> | <span data-pagefind-ignore>the render-backend (GPU/Canvas2D init or context-loss) error, or undefined. Single source of truth for the render-error terminal state: `useRenderingBackend` writes it from the canvas-init mechanism so the model — not React-local hook state — owns every terminal state. Read by `displayPhase` (whose `renderError` term outranks `loading`, suppressing the scrim) and by `DisplayChrome` (shows the retry overlay).</span> | [RenderLifecycleMixin](../renderlifecyclemixin#volatile-rendererror) |
| <span id="volatile-awaitingautodiagonalize">**awaitingAutoDiagonalize**</span><br><code>awaitingAutoDiagonalize: false</code> | <span data-pagefind-ignore>True while the init autorun is waiting on the diagonalize RPC. Gates the canvas off — otherwise the user watches an undiagonalized hairball flash before the reorder kicks in.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#volatile-awaitingautodiagonalize) |
| <span id="volatile-pendingautodiagonalize">**pendingAutoDiagonalize**</span><br><code>pendingAutoDiagonalize: false</code> | <span data-pagefind-ignore>A reorder this init asked for that has not succeeded yet. Raised before any render can paint, and lowered only once the pass RESOLVES — a skipped or thrown reorder leaves it up, so the view's `settled` gate never reports done on an undiagonalized view and the capture fails loudly (times out) instead of committing a hairball.<br><br>One flag rather than a requested/complete pair: the two only ever moved together, and every state a pair can drift into either wedges the gate shut or opens it on the wrong pass.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#volatile-pendingautodiagonalize) |
| <span id="volatile-diagonalizestatus">**diagonalizeStatus**</span><br><code>diagonalizeStatus: undefined as RpcStatus &#124; undefined</code> | <span data-pagefind-ignore>Live status from the auto-diagonalize RPC (download %, parse, algorithm phase) shown on the reordering spinner; undefined outside that wait.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#volatile-diagonalizestatus) |
| <span id="volatile-diagonalizestoptoken">**diagonalizeStopToken**</span><br><code>diagonalizeStopToken: undefined as StopToken &#124; undefined</code> | <span data-pagefind-ignore>Stop token for the in-flight auto-diagonalize, so the spinner's Cancel can abort it; undefined when none is running.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#volatile-diagonalizestoptoken) |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-width">**width**</span><br><code>number</code> |  |
| <span id="getter-borderx">**borderX**</span><br><code>number</code> | Left margin: fits the vertical (vview) axis labels. Derived purely from that axis's regions + zoom — never from viewWidth — so it can't feed back through viewWidth = width - borderX into a render loop. |
| <span id="getter-bordery">**borderY**</span><br><code>number</code> | Bottom margin: fits the horizontal (hview) axis labels. See borderX. |
| <span id="getter-assemblyerrors">**assemblyErrors**</span><br><code>string</code> |  |
| <span id="getter-assembliesinitialized">**assembliesInitialized**</span><br><code>boolean</code> |  |
| <span id="getter-initialized">**initialized**</span><br><code>boolean</code> |  |
| <span id="getter-hticks">**hticks**</span><br><code>Tick[]</code> |  |
| <span id="getter-vticks">**vticks**</span><br><code>Tick[]</code> |  |
| <span id="getter-htickpositions">**hTickPositions**</span><br><code>PositionedTick[]</code> |  |
| <span id="getter-vtickpositions">**vTickPositions**</span><br><code>PositionedTick[]</code> |  |
| <span id="getter-hassomethingtoshow">**hasSomethingToShow**</span><br><code>boolean</code> |  |
| <span id="getter-initpending">**initPending**</span><br><code>boolean</code> | An `init` blob that has not been applied yet — `installInitAutorun` clears it as the last thing an apply pass does. The plot is assembling itself: the axes can already exist, and be initialized, while the tracks or the region restriction are still to come, which is why the `settled` gate reads this. |
| <span id="getter-showimportform">**showImportForm**</span><br><code>boolean</code> | Whether to show the import form |
| <span id="getter-showloading">**showLoading**</span><br><code>boolean</code> | Whether to show a loading indicator instead of the import form or view |
| <span id="getter-loadingmessage">**loadingMessage**</span><br><code>"Loading" &#124; undefined</code> | Label for the generic loading spinner. The auto-diagonalize wait is a separate render branch (DiagonalizeLoadingScreen), so this only covers the plain "view not ready" case. |
| <span id="getter-viewwidth">**viewWidth**</span><br><code>number</code> | Plot area width. Floored at 0: the axis borders have their own MIN_BORDER floor, so a container narrower than that would otherwise yield a negative canvas dimension and a negative maxBpPerPx. |
| <span id="getter-viewheight">**viewHeight**</span><br><code>number</code> | Plot area height. Floored at 0, see viewWidth. |
| <span id="getter-hblocklabelkeystohide">**hblockLabelKeysToHide**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="getter-vblocklabelkeystohide">**vblockLabelKeysToHide**</span><br><code>Set&lt;string&gt;</code> |  |
| <span id="getter-views">**views**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;…&gt; &amp; ... 10 more ... &amp; IStateTreeNode&lt;.…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;…&gt; &amp; ... 10 more ... &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> |  |
| <span id="getter-dotplotdisplays">**dotplotDisplays**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;_OverrideProps&lt;Omit&lt;…&gt;, { ...; }&gt;&gt; &amp; ..…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;_OverrideProps&lt;Omit&lt;…&gt;, { ...; }&gt;&gt; &amp; ... 12 more ... &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> | DotplotDisplays under each track, indexed to match `tracks`. |
| <span id="getter-colorabletracks">**colorableTracks**</span><br><code>ColorableTrack[]</code> | Every track that can take a palette slot, in paint order, paired with whatever color the user pinned on it. |
| <span id="getter-trackcolorassignments">**trackColorAssignments**</span><br><code>Map&lt;string, string&gt;</code> | trackId -> the color it draws in under `colorBy: 'track'`. Assigned across the whole plot rather than per display so an automatic slot can't duplicate a color pinned on a sibling. |
| <span id="getter-uniformcolorby">**uniformColorBy**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>"track" &#124; "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "referenc…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>"track" &#124; "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "reference" &#124; "identity" &#124; "meanQueryIdentity" &#124; "mappingQuality" &#124; undefined</code></pre></dialog></span> | The mode to report as "the plot's mode" — undefined when tracks disagree, so the menu shows nothing checked and the legend says so instead of picking one track's answer for everyone. |
| <span id="getter-colorlegendchips">**colorLegendChips**</span><br><code>ColorChip[]</code> | Legend rows naming the overlaid tracks — non-empty only when they are colored by track, or by different modes. |
| <span id="getter-alpha">**alpha**</span><br><code>number</code> | Plot-wide alpha. See colorBy: resolved here so the no-display case is answered once. Matches the display schema's own default. |
| <span id="getter-minalignmentlength">**minAlignmentLength**</span><br><code>number</code> | Plot-wide minimum alignment length filter, in bp. See colorBy. |
| <span id="getter-settled">**settled**</span><br><code>boolean</code> | Canvas has painted and no display is still fetching, so what's on screen is the final settled content. Drives the `dotplot_webgl_canvas_done` test-id that screenshot capture and the browser-test suites wait on — so it must mean "done", not just "first paint". |
| <span id="getter-haslodcapableadapter">**hasLodCapableAdapter**</span><br><code>boolean</code> | True if any track has an adapter with tiered storage. Used to gate the LOD menu — only the indexed PIF adapters have tiers. |
| <span id="getter-geometrybydisplaykey">**geometryByDisplayKey**</span><br><code>Map&lt;number, DotplotGeometryData&gt;</code> | Per-display GPU geometry keyed by `displayKey`. The upload autorun diffs this map: new entries upload, vanished entries evict. Drawn in insertion order, so tracks paint bottom-of-the-list last. |
| <span id="getter-dotplotrenderstate">**dotplotRenderState**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ viewBpH: number; viewBpV: number; bpPerPxHInv: number; bpPerP…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ viewBpH: number; viewBpV: number; bpPerPxHInv: number; bpPerPxVInv: number; lineWidth: number; displayKeys: number[]; }</code></pre></dialog></span> | Aggregated per-frame render state — a resolved value, never undefined; "the view isn't measured yet" is the `canRender` precondition below.<br><br>An empty `displayKeys` is a real frame, not a skip: both backends clear before drawing, so painting zero displays is what wipes the plot when the last track is hidden. Gating the render pass on it left the departed track's pixels on the canvas (its buffer was deleted, but nothing repainted). |
| <span id="getter-canrender">**canRender**</span><br><code>boolean</code> | Render-lifecycle precondition (overrides `RenderLifecycleMixin`'s default-true hook): before the axes have regions and a measured width there is nothing to paint against. Gating the autorun pair here is what lets `dotplotRenderState` stay a resolved getter. |
| <span id="getter-error">**error**</span><br><code>unknown</code> |  |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-trackcolorfor">**trackColorFor**</span><br><code>(trackId: string) =&gt; string</code> |  |
| <span id="method-resolvecolorby">**resolveColorBy**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string) =&gt; "track" &#124; "default" &#124; "strand" &#124; "query" &#124;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string) =&gt; "track" &#124; "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "reference" &#124; "identity" &#124; "meanQueryIdentity" &#124; "mappingQuality"</code></pre></dialog></span> | The mode one track renders with: its own override, else the plot-wide mode. |
| <span id="method-getcoords">**getCoords**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(mousedown: Coord, mouseup: Coord) =&gt; { x1: PxToBpResult; x2: P…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(mousedown: Coord, mouseup: Coord) =&gt; { x1: PxToBpResult; x2: PxToBpResult; y1: PxToBpResult; y2: PxToBpResult; } &#124; undefined</code></pre></dialog></span> | Both corners of a drag rect, in bp on each axis. The vertical axis lays out bottom-up, so its pixels are flipped through viewHeight first. Undefined for a drag too small to be a selection — the same threshold the interaction hook uses to tell a drag from a click. |
| <span id="method-gethhighlightcoords">**getHHighlightCoords**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(region: { assemblyName?: string &#124; undefined; refName: string;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(region: { assemblyName?: string &#124; undefined; refName: string; start: number; end: number; }) =&gt; { width: number; left: number; } &#124; undefined</code></pre></dialog></span> | Map a highlight/bookmark region to {left, width} px on the horizontal axis. left is already screen-offset. Returns undefined when the region isn't on hview's assembly/displayed regions. |
| <span id="method-getvhighlightcoords">**getVHighlightCoords**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(region: { assemblyName?: string &#124; undefined; refName: string;…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(region: { assemblyName?: string &#124; undefined; refName: string; start: number; end: number; }) =&gt; { top: number; height: number; } &#124; undefined</code></pre></dialog></span> | Map a highlight/bookmark region to {top, height} px on the vertical axis. The vview lays out bottom-to-top, so the band is y-flipped into screen space. Returns undefined when the region isn't on vview. |
| <span id="method-menuitems">**menuItems**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>() =&gt; (MenuDivider &#124; MenuSubHeader &#124; NormalMenuItem &#124; CheckboxM…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>() =&gt; (MenuDivider &#124; MenuSubHeader &#124; NormalMenuItem &#124; CheckboxMenuItem &#124; RadioMenuItem &#124; SubMenuItem &#124; CustomMenuItem &#124; { ...; } &#124; { ...; })[]</code></pre></dialog></span> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setimportformsyntenytrack">**setImportFormSyntenyTrack**</span><br><code>(arg: number, val: ImportFormSyntenyTrack) =&gt; void</code> |  | DotplotView |
| <span id="action-startrenderingbackend">**startRenderingBackend**</span><br><code>(backend: DotplotRenderingBackend) =&gt; void</code> |  | DotplotView |
| <span id="action-setcursormode">**setCursorMode**</span><br><code>(mode: CursorMode) =&gt; void</code> |  | DotplotView |
| <span id="action-setdrawcigar">**setDrawCigar**</span><br><code>(flag: boolean) =&gt; void</code> |  | DotplotView |
| <span id="action-setlodmode">**setLodMode**</span><br><code>(value: LodMode) =&gt; void</code> |  | DotplotView |
| <span id="action-setlockaspectratio">**setLockAspectRatio**</span><br><code>(flag: boolean) =&gt; void</code> |  | DotplotView |
| <span id="action-setlinewidth">**setLineWidth**</span><br><code>(value: number) =&gt; void</code> |  | DotplotView |
| <span id="action-setshowcolorlegend">**setShowColorLegend**</span><br><code>(arg: boolean) =&gt; void</code> |  | DotplotView |
| <span id="action-setcolorby">**setColorBy**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(value: "track" &#124; "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(value: "track" &#124; "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "reference" &#124; "identity" &#124; "meanQueryIdentity" &#124; "mappingQuality") =&gt; void</code></pre></dialog></span> | Set the plot-wide mode. Clears every per-track override, so picking a mode from the top level of the palette menu really does mean "all tracks". | DotplotView |
| <span id="action-settrackcolorby">**setTrackColorBy**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(trackId: string, value: "track" &#124; "default" &#124; "strand" &#124; "quer…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(trackId: string, value: "track" &#124; "default" &#124; "strand" &#124; "query" &#124; "target" &#124; "reference" &#124; "identity" &#124; "meanQueryIdentity" &#124; "mappingQuality" &#124; undefined) =&gt; void</code></pre></dialog></span> | Point one track at its own mode, or back at the plot-wide one. | DotplotView |
| <span id="action-settrackcolor">**setTrackColor**</span><br><code>(trackId: string, value: string &#124; undefined) =&gt; void</code> | Pin one track's color under `colorBy: 'track'`, or release it back to an automatic palette slot. | DotplotView |
| <span id="action-cleartrackcolorsettings">**clearTrackColorSettings**</span><br><code>() =&gt; void</code> |  | DotplotView |
| <span id="action-setalpha">**setAlpha**</span><br><code>(value: number) =&gt; void</code> |  | DotplotView |
| <span id="action-setminalignmentlength">**setMinAlignmentLength**</span><br><code>(value: number) =&gt; void</code> |  | DotplotView |
| <span id="action-clearview">**clearView**</span><br><code>() =&gt; void</code> | returns to the import form | DotplotView |
| <span id="action-setwidth">**setWidth**</span><br><code>(newWidth: number) =&gt; number</code> |  | DotplotView |
| <span id="action-setheight">**setHeight**</span><br><code>(newHeight: number) =&gt; number</code> |  | DotplotView |
| <span id="action-seterror">**setError**</span><br><code>(e: unknown) =&gt; void</code> |  | DotplotView |
| <span id="action-setinit">**setInit**</span><br><code>(init?: DotplotViewInit &#124; undefined) =&gt; void</code> |  | DotplotView |
| <span id="action-zoomout">**zoomOut**</span><br><code>() =&gt; void</code> |  | DotplotView |
| <span id="action-zoomin">**zoomIn**</span><br><code>() =&gt; void</code> |  | DotplotView |
| <span id="action-activatetrackselector">**activateTrackSelector**</span><br><code>() =&gt; Widget</code> |  | DotplotView |
| <span id="action-showtrack">**showTrack**</span><br><code>(trackId: string, initialSnapshot?: any) =&gt; any</code> |  | DotplotView |
| <span id="action-hidetrack">**hideTrack**</span><br><code>(trackId: string) =&gt; boolean</code> |  | DotplotView |
| <span id="action-toggletrack">**toggleTrack**</span><br><code>(trackId: string) =&gt; boolean</code> |  | DotplotView |
| <span id="action-setassemblynames">**setAssemblyNames**</span><br><code>(target: string, query: string) =&gt; void</code> |  | DotplotView |
| <span id="action-zoomintomousecoords">**zoomInToMouseCoords**</span><br><code>(mousedown: Coord, mouseup: Coord) =&gt; void</code> | zooms into clicked and dragged region | DotplotView |
| <span id="action-addhighlightfrommousecoords">**addHighlightFromMouseCoords**</span><br><code>(mousedown: Coord, mouseup: Coord) =&gt; void</code> | highlights the clicked and dragged region: the x-span becomes a band on the horizontal axis and the y-span a band on the vertical axis, so the drag rect is their intersection | DotplotView |
| <span id="action-showallregions">**showAllRegions**</span><br><code>() =&gt; void</code> |  | DotplotView |
| <span id="action-initializedisplayedregions">**initializeDisplayedRegions**</span><br><code>() =&gt; void</code> |  | DotplotView |
| <span id="action-ondotplotview">**onDotplotView**</span><br><code>(mousedown: Coord, mouseup: Coord) =&gt; void</code> | creates a linear synteny view from the clicked and dragged region | DotplotView |
| <span id="action-exportsvg">**exportSvg**</span><br><code>(opts?: ExportSvgOptions) =&gt; Promise&lt;void&gt;</code> | creates an svg export and save using FileSaver | DotplotView |
| <span id="action-applysquare">**applySquare**</span><br><code>(ratio: number) =&gt; void</code> | Set both axes to the average bpPerPx (hview divided by `ratio`), re-anchoring each on the locus that was at its center. setBpPerPx alone would leave offsetPx untouched while bpPerPx changed under it, scrolling the plot; the centerAt calls are what hold it still. | DotplotView |
| <span id="action-squareview">**squareView**</span><br><code>() =&gt; void</code> | Equalize both axes' bpPerPx. Also what the aspect-ratio lock applies to absorb divergence from box-zoom and other per-axis operations — deliberately not clamped to either axis's own maxBpPerPx, since a shared bpPerPx that fits the larger genome necessarily exceeds the smaller axis's limit, and it converges in one step where a clamped one would ping-pong between the two maxima. | DotplotView |
| <span id="action-squareviewproportional">**squareViewProportional**</span><br><code>() =&gt; void</code> |  | DotplotView |
| <span id="action-setdisplayname">**setDisplayName**</span><br><code>(name: string) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setdisplayname) |
| <span id="action-setminimized">**setMinimized**</span><br><code>(flag: boolean) =&gt; void</code> |  | [BaseViewModel](../baseviewmodel#action-setminimized) |
| <span id="action-markcanvasdrawn">**markCanvasDrawn**</span><br><code>() =&gt; void</code> |  | [RenderLifecycleMixin](../renderlifecyclemixin#action-markcanvasdrawn) |
| <span id="action-resetcanvasdrawn">**resetCanvasDrawn**</span><br><code>() =&gt; void</code> |  | [RenderLifecycleMixin](../renderlifecyclemixin#action-resetcanvasdrawn) |
| <span id="action-stoprenderingbackend">**stopRenderingBackend**</span><br><code>() =&gt; void</code> |  | [RenderLifecycleMixin](../renderlifecyclemixin#action-stoprenderingbackend) |
| <span id="action-rendernow">**renderNow**</span><br><code>() =&gt; void</code> |  | [RenderLifecycleMixin](../renderlifecyclemixin#action-rendernow) |
| <span id="action-setrendererror">**setRenderError**</span><br><code>(error: unknown) =&gt; void</code> | <span data-pagefind-ignore>set/clear the render-backend error. Called by `useRenderingBackend`: with the error when the canvas factory rejects (or context-loss re-init fails), and with `undefined` on successful (re)init and on retry.</span> | [RenderLifecycleMixin](../renderlifecyclemixin#action-setrendererror) |
| <span id="action-attachrenderingbackend">**attachRenderingBackend**</span><br><code>&lt;B&gt;(backend: B, cbs: RenderingBackendCallbacks&lt;B&gt;) =&gt; void</code> | <span data-pagefind-ignore>attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)</span> | [RenderLifecycleMixin](../renderlifecyclemixin#action-attachrenderingbackend) |
| <span id="action-addtohighlights">**addToHighlights**</span><br><code>(highlight: HighlightType) =&gt; void</code> |  | [HighlightsMixin](../highlightsmixin#action-addtohighlights) |
| <span id="action-sethighlight">**setHighlight**</span><br><code>(highlight?: HighlightType[] &#124; undefined) =&gt; void</code> |  | [HighlightsMixin](../highlightsmixin#action-sethighlight) |
| <span id="action-removehighlight">**removeHighlight**</span><br><code>(highlight: HighlightType) =&gt; void</code> |  | [HighlightsMixin](../highlightsmixin#action-removehighlight) |
| <span id="action-updatehighlight">**updateHighlight**</span><br><code>(old: HighlightType, updates: Partial&lt;HighlightType&gt;) =&gt; void</code> |  | [HighlightsMixin](../highlightsmixin#action-updatehighlight) |
| <span id="action-setshowhighlightchips">**setShowHighlightChips**</span><br><code>(arg: boolean) =&gt; void</code> |  | [HighlightsMixin](../highlightsmixin#action-setshowhighlightchips) |
| <span id="action-setawaitingautodiagonalize">**setAwaitingAutoDiagonalize**</span><br><code>(arg: boolean) =&gt; void</code> |  | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#action-setawaitingautodiagonalize) |
| <span id="action-beginautodiagonalize">**beginAutoDiagonalize**</span><br><code>(requested: boolean) =&gt; void</code> | <span data-pagefind-ignore>Declare the gate at the top of one init apply pass: a reorder is pending iff THIS init asked for one. Assigning rather than raising is what hands the gate over cleanly — a superseded init that asked for a reorder and then skipped it would otherwise leave the flag up with nothing coming, wedging `settled` forever.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#action-beginautodiagonalize) |
| <span id="action-finishautodiagonalize">**finishAutoDiagonalize**</span><br><code>() =&gt; void</code> | <span data-pagefind-ignore>The init-time reorder resolved, so the view on screen is the diagonalized one — open the gate.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#action-finishautodiagonalize) |
| <span id="action-setdiagonalizestatus">**setDiagonalizeStatus**</span><br><code>(arg?: RpcStatus &#124; undefined) =&gt; void</code> |  | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#action-setdiagonalizestatus) |
| <span id="action-setdiagonalizestoptoken">**setDiagonalizeStopToken**</span><br><code>(arg?: StopToken &#124; undefined) =&gt; void</code> |  | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#action-setdiagonalizestoptoken) |
| <span id="action-cancelautodiagonalize">**cancelAutoDiagonalize**</span><br><code>() =&gt; void</code> | <span data-pagefind-ignore>Abort an in-flight auto-diagonalize; `withDiagonalizeProgress`'s finally clears the wait flag, revealing the (undiagonalized) view.</span> | [DiagonalizeProgressMixin](../diagonalizeprogressmixin#action-cancelautodiagonalize) |
