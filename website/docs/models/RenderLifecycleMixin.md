---
id: renderlifecyclemixin
title: RenderLifecycleMixin
sidebar_label: Mixin -> RenderLifecycleMixin
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/render-core/src/RenderLifecycleMixin.ts).

## Overview

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

## Members

| Member                                                       | Kind      | Defined by           | Description                                                                                                                 |
| ------------------------------------------------------------ | --------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [canvasDrawn](#volatile-canvasdrawn)                         | Volatiles | RenderLifecycleMixin | flips true on first paint; read by test selectors to detect render                                                          |
| [currentRenderingBackend](#volatile-currentrenderingbackend) | Volatiles | RenderLifecycleMixin | current backend reference, updated on context-loss recovery.                                                                |
| [renderTick](#volatile-rendertick)                           | Volatiles | RenderLifecycleMixin | counter the render autorun observes; bumped to force a re-render                                                            |
| [autorunsInstalled](#volatile-autorunsinstalled)             | Volatiles | RenderLifecycleMixin | guards attachRenderingBackend so the autorun pair spawns once per instance                                                  |
| [renderError](#volatile-rendererror)                         | Volatiles | RenderLifecycleMixin | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                 |
| [markCanvasDrawn](#action-markcanvasdrawn)                   | Actions   | RenderLifecycleMixin |                                                                                                                             |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                 | Actions   | RenderLifecycleMixin |                                                                                                                             |
| [stopRenderingBackend](#action-stoprenderingbackend)         | Actions   | RenderLifecycleMixin |                                                                                                                             |
| [renderNow](#action-rendernow)                               | Actions   | RenderLifecycleMixin |                                                                                                                             |
| [setRenderError](#action-setrendererror)                     | Actions   | RenderLifecycleMixin | set/clear the render-backend error.                                                                                         |
| [attachRenderingBackend](#action-attachrenderingbackend)     | Actions   | RenderLifecycleMixin | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend) |

<details>
<summary>RenderLifecycleMixin - Volatiles</summary>

#### volatile: canvasDrawn

flips true on first paint; read by test selectors to detect render

```ts
// type signature
type canvasDrawn = false
// code
canvasDrawn: false
```

#### volatile: currentRenderingBackend

current backend reference, updated on context-loss recovery. Typed `unknown`
(not generic `B`) on purpose: this mixin is composed by every display via a
non-generic factory, so the per-display backend type `B` isn't known here — it's
supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the
autoruns. Don't "fix" the cast.

```ts
// type signature
type currentRenderingBackend = undefined
// code
currentRenderingBackend: undefined
```

#### volatile: renderTick

counter the render autorun observes; bumped to force a re-render

```ts
// type signature
type renderTick = number
// code
renderTick: 0
```

#### volatile: autorunsInstalled

guards attachRenderingBackend so the autorun pair spawns once per instance

```ts
// type signature
type autorunsInstalled = false
// code
autorunsInstalled: false
```

#### volatile: renderError

the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.
Single source of truth for the render-error terminal state:
`useRenderingBackend` writes it from the canvas-init mechanism so the model —
not React-local hook state — owns every terminal state. Read by `displayPhase`
(whose `renderError` term outranks `loading`, suppressing the scrim) and by
`DisplayChrome` (shows the retry overlay).

```ts
// type signature
type renderError = undefined
// code
renderError: undefined
```

</details>

<details>
<summary>RenderLifecycleMixin - Actions</summary>

#### action: setRenderError

set/clear the render-backend error. Called by `useRenderingBackend`: with the
error when the canvas factory rejects (or context-loss re-init fails), and with
`undefined` on successful (re)init and on retry.

```ts
type setRenderError = (error: unknown) => void
```

#### action: attachRenderingBackend

attach a GPU/Canvas2D backend and install the upload + render autorun pair
(idempotent — re-calling only swaps the backend)

```ts
type attachRenderingBackend = <B>(
  backend: B,
  cbs: RenderingBackendCallbacks<B>,
) => void
```

</details>

<details>
<summary>RenderLifecycleMixin - Actions (other undocumented members)</summary>

| Member                                                             | Type         |
| ------------------------------------------------------------------ | ------------ |
| <span id="action-markcanvasdrawn">markCanvasDrawn</span>           | `() => void` |
| <span id="action-resetcanvasdrawn">resetCanvasDrawn</span>         | `() => void` |
| <span id="action-stoprenderingbackend">stopRenderingBackend</span> | `() => void` |
| <span id="action-rendernow">renderNow</span>                       | `() => void` |

</details>
