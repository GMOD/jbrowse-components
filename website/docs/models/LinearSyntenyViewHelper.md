---
id: linearsyntenyviewhelper
title: LinearSyntenyViewHelper
sidebar_label: General -> LinearSyntenyViewHelper
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-comparative-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyViewHelper/stateModelFactory.ts).

Holds one level of a linear synteny comparison: its track list, height and level
index, composed with the shared rendering-lifecycle state.

Nested in LinearComparativeView.levels, never in session.views: it is a track
container, not a view, and satisfies core's `TrackContainer` so the
track-selector and add-track widgets can write into it via the parent view's
`trackContainerFor`. The `LinearSyntenyViewHelper` name and `type` literal are
kept only because saved sessions persist them.

Members a composed model contributes are listed here too, so these tables are
the whole surface.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-id">**id**</span><br><code>id: ElementId</code> |  |
| <span id="property-type">**type**</span><br><code>type: 'LinearSyntenyViewHelper'</code> |  |
| <span id="property-tracks">**tracks**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>tracks: types.array( pluginManager.pluggableMstType('track', 's…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>tracks: types.array(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;pluginManager.pluggableMstType('track', 'stateModel'),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> |  |
| <span id="property-height">**height**</span><br><code>height: types.stripDefault(types.number, 100)</code> |  |
| <span id="property-level">**level**</span><br><code>level: types.number</code> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="volatile-canvasdrawn">**canvasDrawn**</span><br><code>canvasDrawn: false</code> | <span data-pagefind-ignore>flips true on first paint; read by test selectors to detect render</span> | [RenderLifecycleMixin](../renderlifecyclemixin#volatile-canvasdrawn) |
| <span id="volatile-currentrenderingbackend">**currentRenderingBackend**</span><br><code>currentRenderingBackend: undefined</code> | <span data-pagefind-ignore>current backend reference, updated on context-loss recovery. Typed `unknown` (not generic `B`) on purpose: this mixin is composed by every display via a non-generic factory, so the per-display backend type `B` isn't known here — it's supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the autoruns. Don't "fix" the cast.</span> | [RenderLifecycleMixin](../renderlifecyclemixin#volatile-currentrenderingbackend) |
| <span id="volatile-rendertick">**renderTick**</span><br><code>renderTick: 0</code> | <span data-pagefind-ignore>counter the render autorun observes; bumped to force a re-render</span> | [RenderLifecycleMixin](../renderlifecyclemixin#volatile-rendertick) |
| <span id="volatile-autorunsinstalled">**autorunsInstalled**</span><br><code>autorunsInstalled: false</code> | <span data-pagefind-ignore>guards attachRenderingBackend so the autorun pair spawns once per instance</span> | [RenderLifecycleMixin](../renderlifecyclemixin#volatile-autorunsinstalled) |
| <span id="volatile-rendererror">**renderError**</span><br><code>renderError: undefined</code> | <span data-pagefind-ignore>the render-backend (GPU/Canvas2D init or context-loss) error, or undefined. Single source of truth for the render-error terminal state: `useRenderingBackend` writes it from the canvas-init mechanism so the model — not React-local hook state — owns every terminal state. Read by `displayPhase` (whose `renderError` term outranks `loading`, suppressing the scrim) and by `DisplayChrome` (shows the retry overlay).</span> | [RenderLifecycleMixin](../renderlifecyclemixin#volatile-rendererror) |

## Getters

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="getter-gpurenderingbackend">**gpuRenderingBackend**</span><br><code>SyntenyRenderingBackend &#124; undefined</code> | Typed accessor for the slot-mixin-owned `currentRenderingBackend`. All synteny displays within the level upload their geometry to the same backend and render onto one canvas. | LinearSyntenyViewHelper |
| <span id="getter-parentview">**parentView**</span><br><code>ParentViewDuck</code> |  | LinearSyntenyViewHelper |
| <span id="getter-assemblynames">**assemblyNames**</span><br><code>string[]</code> |  | LinearSyntenyViewHelper |
| <span id="getter-linearsyntenydisplays">**linearSyntenyDisplays**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(ModelInstanceTypeProps&lt;_OverrideProps&lt;Omit&lt;…&gt;, { ...; }&gt;&gt; &amp; ..…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(ModelInstanceTypeProps&lt;_OverrideProps&lt;Omit&lt;…&gt;, { ...; }&gt;&gt; &amp; ... 12 more ... &amp; IStateTreeNode&lt;...&gt;)[]</code></pre></dialog></span> | All synteny displays under this level's tracks. | LinearSyntenyViewHelper |
| <span id="getter-displayerror">**displayError**</span><br><code>string &#124; undefined</code> | Every failed track's error in this level, combined into the one value the band has room to report — resolved here rather than per display because they all paint the same full-height band. On-screen only: it is one banner floating over the ribbons that did render, and a figure has nowhere to float one, so a failed track fails the SVG export outright from that display's own `awaitSvgReady`. | LinearSyntenyViewHelper |
| <span id="getter-settled">**settled**</span><br><code>boolean</code> | Canvas has painted and no display is still fetching, so what's on screen is the final settled content. Drives `synteny_canvas`'s `data-display-drawn` test-id, which screenshot capture and the browser-test suites wait on before snapshotting — so it must mean "done", not just "first paint". | LinearSyntenyViewHelper |
| <span id="getter-geometrybydisplaykey">**geometryByDisplayKey**</span><br><code>Map&lt;number, SyntenyInstanceData&gt;</code> | Per-display GPU geometry keyed by displayKey. The upload autorun diffs this map — new entries upload, vanished entries evict. | LinearSyntenyViewHelper |
| <span id="getter-syntenyrenderstate">**syntenyRenderState**</span><br><code>SyntenyRenderState</code> | Aggregated per-frame render state — a resolved value, never undefined; "the view isn't measured yet" is the `canRender` precondition below. Every display in the level draws starting at yTop=0 since each level owns its own canvas.<br><br>An empty `perTrack` is a real frame, not a skip: the row pair has no synteny track (a legal launch — the rows just stack with no ribbons), the one it had was hidden, or every one is minimized. The backend clears before drawing, so painting zero tracks is what drops a hidden track's ribbons. | LinearSyntenyViewHelper |
| <span id="getter-displaysbykey">**displaysByKey**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>Map&lt;number, ModelInstanceTypeProps&lt;_OverrideProps&lt;Omit&lt;…&gt;, { ..…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>Map&lt;number, ModelInstanceTypeProps&lt;_OverrideProps&lt;Omit&lt;…&gt;, { ...; }&gt;&gt; &amp; ... 12 more ... &amp; IStateTreeNode&lt;...&gt;&gt;</code></pre></dialog></span> | Reverse lookup key → display, used to dispatch pick results. | LinearSyntenyViewHelper |
| <span id="getter-canrender">**canRender**</span><br><code>boolean</code> | Render-lifecycle precondition (overrides `RenderLifecycleMixin`'s default-true hook): the render callback sizes the canvas off `parentView.width`, which throws by design before the view is measured. Gating the autorun pair here is what lets `syntenyRenderState` stay a resolved getter. | LinearSyntenyViewHelper |
| <span id="getter-renderscanvas">**rendersCanvas**</span><br><code>boolean</code> | <span data-pagefind-ignore>Overridable hook (default true): whether this display paints a canvas in its **current** configuration, as opposed to a deliberate static placeholder (LD with the triangle off, sequence past base resolution — both render a message where the `<canvas>` would go, so `canvasRef` is never called and `canvasDrawn` can never flip).<br><br>Lives here, beside `canvasDrawn`, because every consumer of "has this display painted" needs the pair — and until 2026-08 each family declared its own copy (per-region hard-coded `true`, global carried the hook for LD), so a display could express the state only to whichever family it happened to compose. See `painted` below for the reader that was missed.</span> | [RenderLifecycleMixin](../renderlifecyclemixin#getter-renderscanvas) |
| <span id="getter-paintinert">**paintInert**</span><br><code>boolean</code> | <span data-pagefind-ignore>Overridable hook (default false): the display has reached a state it will not paint its way out of, so `painted` below should answer *finished* rather than *pending*. Both LGV fetch families fill it with `!!error` — a fetch that failed before first paint keeps its canvas mounted, since the error bar is an overlay rather than a subtree replacement, so nothing ever draws into it. Named for `fetchInert` on the comparative side.<br><br>A hook rather than a read of `error` here, for two reasons that both bite: this package is a leaf and `error` belongs to the fetch mixins, and declaring that name here would *collide* with `FetchMixin`'s volatile — `types.compose` gives the collision to its later argument, and the two families compose the two mixins in opposite orders.</span> | [RenderLifecycleMixin](../renderlifecyclemixin#getter-paintinert) |
| <span id="getter-painted">**painted**</span><br><code>boolean</code> | <span data-pagefind-ignore>**The first-paint answer every consumer outside the display should read**, `canvasDrawn` being only the raw flag: a display that is deliberately not painting a canvas has finished, and saying otherwise is a lie that never resolves.<br><br>The two `rendersCanvas: false` states each had three of their four consumers wired by hand — the loading scrim (`rendersCanvas` / `loadingSuppressed`) and the SVG export (`svgReadyExtraTerminal`) — while the fourth, `data-display-drawn`, went on publishing `"false"` forever off the raw flag. That attribute is what `PENDING_DISPLAYS` (`@jbrowse/browser-test-utils`) selects on, so a zoomed-out reference sequence track made every `waitForDisplaysDone` on the page burn its full timeout — silently, since that wait swallows its own. Same shape as `fetchInert` on the comparative side: the reader you forget is the one outside the display, so the display has to publish one name for it.<br><br>`paintInert` is the third term and the same argument once more, for the state where a display *would* paint a canvas and never gets to — a fetch that failed before first paint. See that hook.</span> | [RenderLifecycleMixin](../renderlifecyclemixin#getter-painted) |

## Actions

<!-- prettier-ignore -->
| Member | Description | Defined by |
| --- | --- | --- |
| <span id="action-setheight">**setHeight**</span><br><code>(n: number) =&gt; void</code> |  | LinearSyntenyViewHelper |
| <span id="action-showtrack">**showTrack**</span><br><code>(trackId: string, initialSnapshot?: object) =&gt; any</code> |  | LinearSyntenyViewHelper |
| <span id="action-hidetrack">**hideTrack**</span><br><code>(trackId: string) =&gt; boolean</code> |  | LinearSyntenyViewHelper |
| <span id="action-toggletrack">**toggleTrack**</span><br><code>(trackId: string) =&gt; boolean</code> |  | LinearSyntenyViewHelper |
| <span id="action-sethoveredfeature">**setHoveredFeature**</span><br><code>(hit: SyntenyPickResult &#124; undefined) =&gt; void</code> | Point the whole level's hover state at one pick hit: the display whose geometry was hit takes the instance index, every other display clears. `undefined` (a miss) therefore clears the level. An action rather than a loop in the canvas component so the N writes land in one MobX batch, and so the canvas never has to resolve the pick key to a display model. | LinearSyntenyViewHelper |
| <span id="action-setclickedfeature">**setClickedFeature**</span><br><code>(hit: SyntenyPickResult &#124; undefined) =&gt; void</code> | Clicked-state twin of `setHoveredFeature`. | LinearSyntenyViewHelper |
| <span id="action-startrenderingbackend">**startRenderingBackend**</span><br><code>(backend: SyntenyRenderingBackend) =&gt; void</code> |  | LinearSyntenyViewHelper |
| <span id="action-markcanvasdrawn">**markCanvasDrawn**</span><br><code>() =&gt; void</code> |  | [RenderLifecycleMixin](../renderlifecyclemixin#action-markcanvasdrawn) |
| <span id="action-resetcanvasdrawn">**resetCanvasDrawn**</span><br><code>() =&gt; void</code> |  | [RenderLifecycleMixin](../renderlifecyclemixin#action-resetcanvasdrawn) |
| <span id="action-stoprenderingbackend">**stopRenderingBackend**</span><br><code>() =&gt; void</code> |  | [RenderLifecycleMixin](../renderlifecyclemixin#action-stoprenderingbackend) |
| <span id="action-rendernow">**renderNow**</span><br><code>() =&gt; void</code> |  | [RenderLifecycleMixin](../renderlifecyclemixin#action-rendernow) |
| <span id="action-setrendererror">**setRenderError**</span><br><code>(error: unknown) =&gt; void</code> | <span data-pagefind-ignore>set/clear the render-backend error. Called by `useRenderingBackend`: with the error when the canvas factory rejects (or context-loss re-init fails), and with `undefined` on successful (re)init and on retry.</span> | [RenderLifecycleMixin](../renderlifecyclemixin#action-setrendererror) |
| <span id="action-attachrenderingbackend">**attachRenderingBackend**</span><br><code>&lt;B&gt;(backend: B, cbs: RenderingBackendCallbacks&lt;B&gt;) =&gt; void</code> | <span data-pagefind-ignore>attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)</span> | [RenderLifecycleMixin](../renderlifecyclemixin#action-attachrenderingbackend) |
