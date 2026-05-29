---
id: renderlifecyclemixin
title: RenderLifecycleMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/gpu/RenderLifecycleMixin.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/RenderLifecycleMixin.md)

## Docs

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

### RenderLifecycleMixin - Volatiles

#### volatile: canvasDrawn

flips true on first paint; read by test selectors to detect render

```js
// type signature
false
// code
canvasDrawn: false
```

#### volatile: currentRenderingBackend

current backend reference, updated on context-loss recovery. Typed `unknown`
(not generic `B`) on purpose: this mixin is composed by every display via a
non-generic factory, so the per-display backend type `B` isn't known here — it's
supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the
autoruns. Don't "fix" the cast.

```js
// type signature
unknown
// code
currentRenderingBackend: undefined as unknown
```

#### volatile: renderTick

counter the render autorun observes; bumped to force a re-render

```js
// type signature
number
// code
renderTick: 0
```

#### volatile: autorunsInstalled

guards attachRenderingBackend so the autorun pair spawns once per instance

```js
// type signature
false
// code
autorunsInstalled: false
```

### RenderLifecycleMixin - Actions

#### action: markCanvasDrawn

```js
// type signature
markCanvasDrawn: () => void
```

#### action: resetCanvasDrawn

```js
// type signature
resetCanvasDrawn: () => void
```

#### action: stopRenderingBackend

```js
// type signature
stopRenderingBackend: () => void
```

#### action: renderNow

```js
// type signature
renderNow: () => void
```

#### action: attachRenderingBackend

attach a GPU/Canvas2D backend and install the upload + render autorun pair
(idempotent — re-calling only swaps the backend)

```js
// type signature
attachRenderingBackend: <B>(backend: B, cbs: RenderingBackendCallbacks<B>) => void
```
