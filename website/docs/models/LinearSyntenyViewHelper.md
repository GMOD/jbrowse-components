---
id: linearsyntenyviewhelper
title: LinearSyntenyViewHelper
sidebar_label: General -> LinearSyntenyViewHelper
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-comparative-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyViewHelper/stateModelFactory.ts).

## Overview

Holds one level of a linear synteny comparison: its track list, height and level
index, composed with the shared rendering-lifecycle state.

## Members

| Member                                                       | Kind       | Defined by                                      | Description                                                                                                                 |
| ------------------------------------------------------------ | ---------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                           | Properties | LinearSyntenyViewHelper                         |                                                                                                                             |
| [type](#property-type)                                       | Properties | LinearSyntenyViewHelper                         |                                                                                                                             |
| [tracks](#property-tracks)                                   | Properties | LinearSyntenyViewHelper                         |                                                                                                                             |
| [height](#property-height)                                   | Properties | LinearSyntenyViewHelper                         |                                                                                                                             |
| [level](#property-level)                                     | Properties | LinearSyntenyViewHelper                         |                                                                                                                             |
| [gpuRenderingBackend](#getter-gpurenderingbackend)           | Getters    | LinearSyntenyViewHelper                         | Typed accessor for the slot-mixin-owned `currentRenderingBackend`.                                                          |
| [parentView](#getter-parentview)                             | Getters    | LinearSyntenyViewHelper                         |                                                                                                                             |
| [assemblyNames](#getter-assemblynames)                       | Getters    | LinearSyntenyViewHelper                         |                                                                                                                             |
| [linearSyntenyDisplays](#getter-linearsyntenydisplays)       | Getters    | LinearSyntenyViewHelper                         | All synteny displays under this level's tracks.                                                                             |
| [numFeats](#getter-numfeats)                                 | Getters    | LinearSyntenyViewHelper                         |                                                                                                                             |
| [settled](#getter-settled)                                   | Getters    | LinearSyntenyViewHelper                         | Canvas has painted and no display is still fetching, so what's on screen is the final settled content.                      |
| [geometryByDisplayKey](#getter-geometrybydisplaykey)         | Getters    | LinearSyntenyViewHelper                         | Per-display GPU geometry keyed by displayKey.                                                                               |
| [syntenyRenderState](#getter-syntenyrenderstate)             | Getters    | LinearSyntenyViewHelper                         | Aggregated per-frame render state.                                                                                          |
| [displaysByKey](#getter-displaysbykey)                       | Getters    | LinearSyntenyViewHelper                         | Reverse lookup key → display, used to dispatch pick results.                                                                |
| [setHeight](#action-setheight)                               | Actions    | LinearSyntenyViewHelper                         |                                                                                                                             |
| [showTrack](#action-showtrack)                               | Actions    | LinearSyntenyViewHelper                         |                                                                                                                             |
| [hideTrack](#action-hidetrack)                               | Actions    | LinearSyntenyViewHelper                         |                                                                                                                             |
| [toggleTrack](#action-toggletrack)                           | Actions    | LinearSyntenyViewHelper                         |                                                                                                                             |
| [startRenderingBackend](#action-startrenderingbackend)       | Actions    | LinearSyntenyViewHelper                         |                                                                                                                             |
| [canvasDrawn](#volatile-canvasdrawn)                         | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | flips true on first paint; read by test selectors to detect render                                                          |
| [currentRenderingBackend](#volatile-currentrenderingbackend) | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | current backend reference, updated on context-loss recovery.                                                                |
| [renderTick](#volatile-rendertick)                           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | counter the render autorun observes; bumped to force a re-render                                                            |
| [autorunsInstalled](#volatile-autorunsinstalled)             | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | guards attachRenderingBackend so the autorun pair spawns once per instance                                                  |
| [renderError](#volatile-rendererror)                         | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                 |
| [markCanvasDrawn](#action-markcanvasdrawn)                   | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                             |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                 | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                             |
| [stopRenderingBackend](#action-stoprenderingbackend)         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                             |
| [renderNow](#action-rendernow)                               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                             |
| [setRenderError](#action-setrendererror)                     | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) | set/clear the render-backend error.                                                                                         |
| [attachRenderingBackend](#action-attachrenderingbackend)     | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend) |

<details>
<summary>LinearSyntenyViewHelper - Properties</summary>

| Member                                   | Type                                               |
| ---------------------------------------- | -------------------------------------------------- |
| <span id="property-id">id</span>         | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-type">type</span>     | `string`                                           |
| <span id="property-tracks">tracks</span> | `IArrayType<IAnyType>`                             |
| <span id="property-height">height</span> | `IOptionalIType<ISimpleType<number>, [undefined]>` |
| <span id="property-level">level</span>   | `ISimpleType<number>`                              |

</details>

<details>
<summary>LinearSyntenyViewHelper - Getters</summary>

#### getter: gpuRenderingBackend

Typed accessor for the slot-mixin-owned `currentRenderingBackend`. All synteny
displays within the level upload their geometry to the same backend and render
onto one canvas.

```ts
type gpuRenderingBackend = SyntenyRenderingBackend | undefined
```

#### getter: linearSyntenyDisplays

All synteny displays under this level's tracks.

```ts
type linearSyntenyDisplays = (ModelInstanceTypeProps<_OverrideProps<…>> & ... 9 more ... & IStateTreeNode<...>)[]
```

#### getter: settled

Canvas has painted and no display is still fetching, so what's on screen is the
final settled content. Drives the `synteny_canvas_done` test-id, which
screenshot capture and the browser-test suites wait on before snapshotting — so
it must mean "done", not just "first paint".

```ts
type settled = boolean
```

#### getter: geometryByDisplayKey

Per-display GPU geometry keyed by displayKey. The upload autorun diffs this map
— new entries upload, vanished entries evict.

```ts
type geometryByDisplayKey = Map<number, SyntenyInstanceData>
```

#### getter: syntenyRenderState

Aggregated per-frame render state. Every display in the level draws starting at
yTop=0 since each level owns its own canvas.

```ts
type syntenyRenderState = SyntenyRenderState | undefined
```

#### getter: displaysByKey

Reverse lookup key → display, used to dispatch pick results.

```ts
type displaysByKey = Map<number, ModelInstanceTypeProps<_OverrideProps<…>> & ... 9 more ... & IStateTreeNode<...>>
```

</details>

<details>
<summary>LinearSyntenyViewHelper - Getters (other undocumented members)</summary>

| Member                                               | Type             |
| ---------------------------------------------------- | ---------------- |
| <span id="getter-parentview">parentView</span>       | `ParentViewDuck` |
| <span id="getter-assemblynames">assemblyNames</span> | `string[]`       |
| <span id="getter-numfeats">numFeats</span>           | `number`         |

</details>

<details>
<summary>LinearSyntenyViewHelper - Actions</summary>

| Member                                                               | Type                                              |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| <span id="action-setheight">setHeight</span>                         | `(n: number) => void`                             |
| <span id="action-showtrack">showTrack</span>                         | `(trackId: string, initialSnapshot?: any) => any` |
| <span id="action-hidetrack">hideTrack</span>                         | `(trackId: string) => boolean`                    |
| <span id="action-toggletrack">toggleTrack</span>                     | `(trackId: string) => boolean`                    |
| <span id="action-startrenderingbackend">startRenderingBackend</span> | `(backend: SyntenyRenderingBackend) => void`      |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from RenderLifecycleMixin</summary>

[RenderLifecycleMixin →](../renderlifecyclemixin)

**Volatiles**

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

**Actions**

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

| Member                                                             | Type         |
| ------------------------------------------------------------------ | ------------ |
| <span id="action-markcanvasdrawn">markCanvasDrawn</span>           | `() => void` |
| <span id="action-resetcanvasdrawn">resetCanvasDrawn</span>         | `() => void` |
| <span id="action-stoprenderingbackend">stopRenderingBackend</span> | `() => void` |
| <span id="action-rendernow">renderNow</span>                       | `() => void` |

</details>
