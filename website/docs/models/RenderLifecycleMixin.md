---
id: renderlifecyclemixin
title: RenderLifecycleMixin
sidebar_label: Mixin -> RenderLifecycleMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/render-core/src/RenderLifecycleMixin.ts).

Owns the GPU draw lifecycle for any display that paints to a canvas.

Plugins compose this mixin (directly or via `MultiRegionDisplayMixin` /
`GlobalDataDisplayMixin`) and call
`self.attachRenderingBackend(backend, () => ({ upload, render }))` from their
own `startRenderingBackend(backend)` action. **The second argument is a thunk
because it runs exactly once**, on the first attach: `startRenderingBackend`
fires again on every context-loss recovery, and the autoruns keep the callbacks
they were given first. Anything the callbacks close over — an upload sync's memo
of what it last sent — is built inside it, so it lives as long as the callbacks
that read it rather than being allocated per recovery and discarded. The mixin
owns:

- `canvasDrawn` — observable flag read by test-selector `data-testid` attributes
  to detect first paint.
- `currentRenderingBackend` — the backend reference, updated on context-loss
  recovery. Autoruns read it each tick so they re-fire against the new one
  without being reinstalled.
- `renderTick` — counter the render autorun observes; bumped by `renderNow()`
  (tab-visibility restore) and after every upload (ensures render re-fires when
  an upload happens but renderState identity stays stable).
- `autorunsInstalled` — guards `attachRenderingBackend` so the autorun pair is
  spawned once per model instance, not once per backend assignment.

The `upload` callback runs in one autorun, `render` in another. Inside each,
every observable read is auto-tracked by MobX — no getter-layer indirection, no
multi-entry config. `render` returns `true` when the backend actually painted
content (flips `canvasDrawn`), `false` to skip this tick (e.g. `renderState` not
yet computed or no regions loaded).

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-canvasdrawn">**canvasDrawn**</span><br><code>canvasDrawn: false</code> | flips true on first paint; read by test selectors to detect render |
| <span id="volatile-currentrenderingbackend">**currentRenderingBackend**</span><br><code>currentRenderingBackend: undefined</code> | current backend reference, updated on context-loss recovery. Typed `unknown` (not generic `B`) on purpose: this mixin is composed by every display via a non-generic factory, so the per-display backend type `B` isn't known here — it's supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the autoruns. Don't "fix" the cast. |
| <span id="volatile-rendertick">**renderTick**</span><br><code>renderTick: 0</code> | counter the render autorun observes; bumped to force a re-render |
| <span id="volatile-autorunsinstalled">**autorunsInstalled**</span><br><code>autorunsInstalled: false</code> | guards attachRenderingBackend so the autorun pair spawns once per instance |
| <span id="volatile-rendererror">**renderError**</span><br><code>renderError: undefined</code> | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined. Single source of truth for the render-error terminal state: `useRenderingBackend` writes it from the canvas-init mechanism so the model — not React-local hook state — owns every terminal state. Read by `displayPhase` (whose `renderError` term outranks `loading`, suppressing the scrim) and by `DisplayChrome` (shows the retry overlay). |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-canrender">**canRender**</span><br><code>boolean</code> | Overridable precondition (default true): both lifecycle autoruns skip their callback entirely while this is false, so a display never has to open its own `upload`/`render` with a readiness check.<br><br>The LGV mixins override it with `view.initialized`, because before the view is measured its geometry throws by design (`view.width`, and so `visibleRegions` / `trackWidthPx` with it) and a throw in either callback is routed to `renderError` — surfacing "not measured yet" as the GPU render-error banner. Because it's an observable read inside the autoruns, the pair re-fires the moment it flips. This is the *precondition* axis only: whether any data has arrived stays the render callback's own gate (return `false` to skip a tick), which is why `renderState` getters can be plain resolved values. |
| <span id="getter-renderscanvas">**rendersCanvas**</span><br><code>boolean</code> | Overridable hook (default true): whether this display paints a canvas in its **current** configuration, as opposed to a deliberate static placeholder (LD with the triangle off, sequence past base resolution — both render a message where the `<canvas>` would go, so `canvasRef` is never called and `canvasDrawn` can never flip).<br><br>Lives here, beside `canvasDrawn`, because every consumer of "has this display painted" needs the pair — and until 2026-08 each family declared its own copy (per-region hard-coded `true`, global carried the hook for LD), so a display could express the state only to whichever family it happened to compose. See `painted` below for the reader that was missed. |
| <span id="getter-paintinert">**paintInert**</span><br><code>boolean</code> | Overridable hook (default false): the display has reached a state it will not paint its way out of, so `painted` below should answer *finished* rather than *pending*. Both LGV fetch families fill it with `!!error` — a fetch that failed before first paint keeps its canvas mounted, since the error bar is an overlay rather than a subtree replacement, so nothing ever draws into it. Named for `fetchInert` on the comparative side.<br><br>A hook rather than a read of `error` here, for two reasons that both bite: this package is a leaf and `error` belongs to the fetch mixins, and declaring that name here would *collide* with `FetchMixin`'s volatile — `types.compose` gives the collision to its later argument, and the two families compose the two mixins in opposite orders. |
| <span id="getter-painted">**painted**</span><br><code>boolean</code> | **The first-paint answer every consumer outside the display should read**, `canvasDrawn` being only the raw flag: a display that is deliberately not painting a canvas has finished, and saying otherwise is a lie that never resolves.<br><br>The two `rendersCanvas: false` states each had three of their four consumers wired by hand — the loading scrim (`rendersCanvas` / `loadingSuppressed`) and the SVG export (`svgReadyExtraTerminal`) — while the fourth, `data-display-drawn`, went on publishing `"false"` forever off the raw flag. That attribute is what `PENDING_DISPLAYS` (`@jbrowse/browser-test-utils`) selects on, so a zoomed-out reference sequence track made every `waitForDisplaysDone` on the page burn its full timeout — silently, since that wait swallows its own. Same shape as `fetchInert` on the comparative side: the reader you forget is the one outside the display, so the display has to publish one name for it.<br><br>`paintInert` is the third term and the same argument once more, for the state where a display *would* paint a canvas and never gets to — a fetch that failed before first paint. See that hook. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-markcanvasdrawn">**markCanvasDrawn**</span><br><code>() =&gt; void</code> |  |
| <span id="action-resetcanvasdrawn">**resetCanvasDrawn**</span><br><code>() =&gt; void</code> |  |
| <span id="action-stoprenderingbackend">**stopRenderingBackend**</span><br><code>() =&gt; void</code> |  |
| <span id="action-rendernow">**renderNow**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setrendererror">**setRenderError**</span><br><code>(error: unknown) =&gt; void</code> | set/clear the render-backend error. Called by `useRenderingBackend`: with the error when the canvas factory rejects (or context-loss re-init fails), and with `undefined` on successful (re)init and on retry. |
| <span id="action-attachrenderingbackend">**attachRenderingBackend**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>&lt;B&gt;(backend: B, setup: () =&gt; RenderingBackendCallbacks&lt;B&gt;) =&gt; v…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>&lt;B&gt;(backend: B, setup: () =&gt; RenderingBackendCallbacks&lt;B&gt;) =&gt; void</code></pre></dialog></span> | attach a GPU/Canvas2D backend and install the upload + render autorun pair. Idempotent: re-calling swaps the backend and does not run `setup` again, so the callbacks and everything they close over are the first call's. |
