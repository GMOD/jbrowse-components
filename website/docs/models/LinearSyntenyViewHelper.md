---
id: linearsyntenyviewhelper
title: LinearSyntenyViewHelper
sidebar_label: General -> LinearSyntenyViewHelper
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyViewHelper/stateModelFactory.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearSyntenyViewHelper.md)

## Overview

Holds one level of a linear synteny comparison: its track list, height and level
index, composed with the shared rendering-lifecycle state.

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [RenderLifecycleMixin](../renderlifecyclemixin)

**Volatiles:** [canvasDrawn](../renderlifecyclemixin#volatile-canvasdrawn),
[currentRenderingBackend](../renderlifecyclemixin#volatile-currentrenderingbackend),
[renderTick](../renderlifecyclemixin#volatile-rendertick),
[autorunsInstalled](../renderlifecyclemixin#volatile-autorunsinstalled),
[renderError](../renderlifecyclemixin#volatile-rendererror)

**Actions:** [markCanvasDrawn](../renderlifecyclemixin#action-markcanvasdrawn),
[resetCanvasDrawn](../renderlifecyclemixin#action-resetcanvasdrawn),
[stopRenderingBackend](../renderlifecyclemixin#action-stoprenderingbackend),
[renderNow](../renderlifecyclemixin#action-rendernow),
[setRenderError](../renderlifecyclemixin#action-setrendererror),
[attachRenderingBackend](../renderlifecyclemixin#action-attachrenderingbackend)

<details open>
<summary>LinearSyntenyViewHelper - Properties</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```ts
// type signature
type type = string
// code
type: 'LinearSyntenyViewHelper'
```

#### property: tracks

```ts
// type signature
type tracks = IArrayType<IAnyType>
// code
tracks: types.array(pluginManager.pluggableMstType('track', 'stateModel'))
```

#### property: height

```ts
// type signature
type height = IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.stripDefault(types.number, 100)
```

#### property: level

```ts
// type signature
type level = ISimpleType<number>
// code
level: types.number
```

</details>

<details open>
<summary>LinearSyntenyViewHelper - Getters</summary>

#### getter: gpuRenderingBackend

Typed accessor for the slot-mixin-owned `currentRenderingBackend`. All synteny
displays within the level upload their geometry to the same backend and render
onto one canvas.

```ts
type gpuRenderingBackend = SyntenyRenderingBackend | undefined
```

#### getter: parentView

```ts
type parentView = ParentViewDuck
```

#### getter: assemblyNames

```ts
type assemblyNames = string[]
```

#### getter: linearSyntenyDisplays

All synteny displays under this level's tracks.

```ts
type linearSyntenyDisplays = (ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }, { ...; }>> & ... 9 more ... & IStateTreeNode<...>)[]
```

#### getter: numFeats

```ts
type numFeats = number
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
type displaysByKey = Map<number, ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }, { ...; }>> & ... 9 more ... & IStateTreeNode<...>>
```

</details>

<details open>
<summary>LinearSyntenyViewHelper - Actions</summary>

#### action: setHeight

```ts
type setHeight = (n: number) => void
```

#### action: showTrack

```ts
type showTrack = (trackId: string, initialSnapshot?: any) => any
```

#### action: hideTrack

```ts
type hideTrack = (trackId: string) => boolean
```

#### action: toggleTrack

```ts
type toggleTrack = (trackId: string) => void
```

#### action: startRenderingBackend

```ts
type startRenderingBackend = (backend: SyntenyRenderingBackend) => void
```

</details>
