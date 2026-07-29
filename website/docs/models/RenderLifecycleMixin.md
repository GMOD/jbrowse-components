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
`self.attachRenderingBackend(backend, { upload, render })` from their own
`startRenderingBackend(backend)` action. The mixin owns:

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

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-markcanvasdrawn">**markCanvasDrawn**</span><br><code>() =&gt; void</code> |  |
| <span id="action-resetcanvasdrawn">**resetCanvasDrawn**</span><br><code>() =&gt; void</code> |  |
| <span id="action-stoprenderingbackend">**stopRenderingBackend**</span><br><code>() =&gt; void</code> |  |
| <span id="action-rendernow">**renderNow**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setrendererror">**setRenderError**</span><br><code>(error: unknown) =&gt; void</code> | set/clear the render-backend error. Called by `useRenderingBackend`: with the error when the canvas factory rejects (or context-loss re-init fails), and with `undefined` on successful (re)init and on retry. |
| <span id="action-attachrenderingbackend">**attachRenderingBackend**</span><br><code>&lt;B&gt;(backend: B, cbs: RenderingBackendCallbacks&lt;B&gt;) =&gt; void</code> | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend) |
