---
id: nonblockcanvasdisplaymixin
title: NonBlockCanvasDisplayMixin
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/BaseLinearDisplay/models/NonBlockCanvasDisplayMixin.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/NonBlockCanvasDisplayMixin.md)

## Docs

Mixin for non-block-based displays that render to a single canvas. Provides
common state for tracking rendering offset, loading state, and canvas
references.

Used by displays like LinearReadCloudDisplay, LinearReadArcsDisplay, and
LinearHicDisplay that render across the entire view width rather than in
discrete blocks.

### NonBlockCanvasDisplayMixin - Getters

#### getter: drawn

Whether the display has been rendered at least once

```js
// type
boolean
```

### NonBlockCanvasDisplayMixin - Actions

#### action: setLastDrawnOffsetPx

Set the offsetPx at which the canvas was rendered

```js
// type signature
setLastDrawnOffsetPx: (n: number) => void
```

#### action: setLastDrawnBpPerPx

Set the bpPerPx at which the canvas was rendered

```js
// type signature
setLastDrawnBpPerPx: (n: number) => void
```

#### action: setLoading

Set loading state

```js
// type signature
setLoading: (f: boolean) => void
```

#### action: setRef

Set reference to the canvas element

```js
// type signature
setRef: (ref: HTMLCanvasElement) => void
```

#### action: setRenderingImageData

Set the rendering imageData from RPC

```js
// type signature
setRenderingImageData: (imageData: ImageBitmap) => void
```

#### action: setRenderingStopToken

Set the rendering stop token

```js
// type signature
setRenderingStopToken: (token?: StopToken) => void
```

#### action: setStatusMessage

Set the status message displayed during loading

```js
// type signature
setStatusMessage: (msg?: string) => void
```
