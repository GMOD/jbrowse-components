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

| Member                                                       | Kind      | Description                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [canvasDrawn](#volatile-canvasdrawn)                         | Volatiles | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                                                                                                                                                                          |
| [currentRenderingBackend](#volatile-currentrenderingbackend) | Volatiles | current backend reference, updated on context-loss recovery. Typed `unknown` (not generic `B`) on purpose: this mixin is composed by every display via a non-generic factory, so the per-display backend type `B` isn't known here — it's supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the autoruns. Don't "fix" the cast.                                                                       |
| [renderTick](#volatile-rendertick)                           | Volatiles | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                                                                                                                                                                            |
| [autorunsInstalled](#volatile-autorunsinstalled)             | Volatiles | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                                                                                                                                                                                  |
| [renderError](#volatile-rendererror)                         | Volatiles | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined. Single source of truth for the render-error terminal state: `useRenderingBackend` writes it from the canvas-init mechanism so the model — not React-local hook state — owns every terminal state. Read by `displayPhase` (whose `renderError` term outranks `loading`, suppressing the scrim) and by `DisplayChrome` (shows the retry overlay). |
| [markCanvasDrawn](#action-markcanvasdrawn)                   | Actions   |                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                 | Actions   |                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [stopRenderingBackend](#action-stoprenderingbackend)         | Actions   |                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [renderNow](#action-rendernow)                               | Actions   |                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [setRenderError](#action-setrendererror)                     | Actions   | set/clear the render-backend error. Called by `useRenderingBackend`: with the error when the canvas factory rejects (or context-loss re-init fails), and with `undefined` on successful (re)init and on retry.                                                                                                                                                                                                              |
| [attachRenderingBackend](#action-attachrenderingbackend)     | Actions   | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                                                                                                                                                                                 |

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

#### action: markCanvasDrawn

```ts
type markCanvasDrawn = () => void
```

#### action: resetCanvasDrawn

```ts
type resetCanvasDrawn = () => void
```

#### action: stopRenderingBackend

```ts
type stopRenderingBackend = () => void
```

#### action: renderNow

```ts
type renderNow = () => void
```

</details>
