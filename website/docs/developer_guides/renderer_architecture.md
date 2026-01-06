---
id: renderer_architecture
title: Renderer architecture
---

This guide explains the internal architecture of JBrowse 2's renderer system,
including the class hierarchy, RPC serialization, and how different renderer
types handle features and transferables.

## Overview

JBrowse 2 renderers run in a web worker to keep the main thread responsive. The
renderer system handles:

1. Serializing render arguments from client to worker
2. Fetching features from data adapters
3. Rendering to canvas or creating React elements
4. Serializing results back to the client
5. Transferring large data (like `ImageBitmap`) efficiently

## Renderer class hierarchy

```
RendererType (base)
└── ServerSideRendererType (RPC bridge)
    ├── FeatureRendererType (feature fetching + serialization)
    │   ├── CircularChordRendererType
    │   ├── ArcRenderer
    │   ├── DivSequenceRenderer
    │   ├── WiggleBaseRenderer (canvas)
    │   ├── MultiVariantBaseRenderer (canvas)
    │   └── BoxRendererType (layout management)
    │       ├── LollipopRenderer
    │       ├── SvgFeatureRenderer
    │       ├── PileupRenderer (canvas)
    │       └── CanvasFeatureRenderer (canvas)
    ├── HicRenderer
    └── DotplotRenderer (canvas)
```

## Base classes

### RendererType

The base class that all renderers extend. Provides:

- `ReactComponent` - The React component used for rendering
- `configSchema` - Configuration schema for the renderer
- `render(props)` - Creates a React element (called by subclasses after
  processing)

### ServerSideRendererType

Handles the RPC bridge between client and worker:

- `serializeArgsInClient()` - Prepares arguments for sending to worker
- `deserializeArgsInWorker()` - Reconstructs arguments in worker
- `serializeResultsInWorker()` - Prepares results for sending back
- `deserializeResultsInClient()` - Reconstructs results on client
- `renderInClient()` - Calls RPC to trigger worker-side rendering
- `renderInWorker()` - Orchestrates the worker-side render process

### FeatureRendererType

Adds feature fetching and serialization:

- `getFeatures()` - Fetches features from the data adapter
- `featurePassesFilters()` - Applies filter chain to features
- `getExpandedRegion()` - Optionally expands the fetch region
- Serializes/deserializes features as JSON for transport

### BoxRendererType

Adds layout management for collision detection:

- `createLayoutInWorker()` - Creates a layout session for positioning features
- `serializeLayout()` - Converts layout to JSON
- `deserializeLayoutInClient()` - Reconstructs layout on client
- Layout caching via `layoutSessions` for performance

## Two rendering patterns

### Pattern 1: React-based renderers

For renderers that create React/SVG elements (e.g., `SvgFeatureRenderer`,
`CircularChordRendererType`):

```typescript
class MyRenderer extends FeatureRendererType {
  async render(renderArgs) {
    // 1. Fetch features
    const features = await this.getFeatures(renderArgs)

    // 2. Pass to parent which creates React element
    const result = await super.render({ ...renderArgs, features })

    // 3. Return features for serialization
    return { ...result, features }
  }
}
```

The result goes through `serializeResultsInWorker()` which:

1. Converts features Map to JSON array
2. Strips React elements (can't be serialized)

Then `deserializeResultsInClient()`:

1. Reconstructs features from JSON
2. Creates React element via `ReactComponent`

### Pattern 2: Canvas-based renderers with rpcResult

For renderers that draw to canvas and return `ImageBitmap` (e.g.,
`PileupRenderer`, `WiggleBaseRenderer`):

```typescript
import { rpcResult } from '@jbrowse/core/util/librpc'
import { isImageBitmap } from '@jbrowse/core/util/offscreenCanvasPonyfill'

class MyCanvasRenderer extends FeatureRendererType {
  async render(renderProps) {
    // 1. Fetch features
    const features = await this.getFeatures(renderProps)

    // 2. Render to canvas
    const { width, height, regions, bpPerPx } = renderProps
    const region = regions[0]!
    const canvasWidth = (region.end - region.start) / bpPerPx

    const res = await renderToAbstractCanvas(
      canvasWidth,
      height,
      renderProps,
      ctx => this.draw(ctx, { ...renderProps, features }),
    )

    // 3. Return with explicit transferables
    const serialized = { ...res, height, width: canvasWidth }
    if (isImageBitmap(res.imageData)) {
      return rpcResult(serialized, [res.imageData])
    }
    return serialized
  }
}
```

Key differences:

1. **No `super.render()` call** - Canvas renderers handle everything themselves
2. **Uses `rpcResult()`** - Explicitly specifies transferables for efficient
   transfer
3. **No feature serialization** - Features are rendered to canvas, not returned
4. **Uses `isImageBitmap()`** - Safe check that works in Node.js tests

## The rpcResult pattern

The `rpcResult()` function from `librpc-web-mod` wraps return values with
explicit transferables:

```typescript
import { rpcResult } from '@jbrowse/core/util/librpc'

// Without rpcResult - ImageBitmap would be copied (slow)
return { imageData: bitmap, width, height }

// With rpcResult - ImageBitmap is transferred (fast, zero-copy)
return rpcResult({ imageData: bitmap, width, height }, [bitmap])
```

When `renderInWorker()` sees an `rpcResult`, it passes through directly without
calling `serializeResultsInWorker()`:

```typescript
async renderInWorker(args) {
  const results = await this.render(args2)

  // rpcResult bypasses serialization
  if (typeof results === 'object' && '__rpcResult' in results) {
    return results
  }

  // Normal results go through serialization
  return this.serializeResultsInWorker(results, args2)
}
```

The `rpcResult` wrapper is automatically unwrapped in
`RpcMethodType.deserializeReturn()`, so downstream code receives the actual
value regardless of whether a web worker was used.

## Feature handling

### Fetching features

`FeatureRendererType.getFeatures()` handles:

1. Getting the data adapter from cache
2. Expanding the region if needed (via `getExpandedRegion()`)
3. Calling `adapter.getFeatures()` or `getFeaturesInMultipleRegions()`
4. Filtering features via `featurePassesFilters()`
5. Returning a `Map<string, Feature>`

### Feature serialization

For React-based renderers, features are serialized:

```typescript
// Worker side: Map<string, Feature> → SimpleFeatureSerialized[]
serializeResultsInWorker(result) {
  return {
    ...serialized,
    features: features instanceof Map
      ? iterMap(features.values(), f => f.toJSON(), features.size)
      : undefined,
  }
}

// Client side: SimpleFeatureSerialized[] → Map<string, SimpleFeature>
deserializeResultsInClient(result) {
  const features = new Map(
    result.features?.map(f => SimpleFeature.fromJSON(f)).map(f => [f.id(), f])
  )
  return { ...result, features }
}
```

Canvas renderers skip this by returning `rpcResult()` directly.

## Layout management

`BoxRendererType` manages layouts for collision detection:

```typescript
class BoxRendererType extends FeatureRendererType {
  layoutSessions: Record<string, LayoutSession> = {}

  createLayoutInWorker(args) {
    const { layout } = this.getWorkerSession(args)
    return layout.getSublayout(args.regions[0].refName)
  }

  async render(renderArgs) {
    const features = await this.getFeatures(renderArgs)
    const layout = this.createLayoutInWorker(renderArgs)
    return { features, layout }
  }
}
```

Layouts are cached by `sessionId + trackInstanceId` for incremental updates when
scrolling.

## Creating a new renderer

### Simple React-based renderer

```typescript
import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'

class MyRenderer extends FeatureRendererType {
  async render(renderArgs) {
    const features = await this.getFeatures(renderArgs)
    const result = await super.render({ ...renderArgs, features })
    return { ...result, features }
  }
}
```

### Canvas-based renderer

```typescript
import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas } from '@jbrowse/core/util'
import { isImageBitmap } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { rpcResult } from '@jbrowse/core/util/librpc'

class MyCanvasRenderer extends FeatureRendererType {
  async render(renderProps) {
    const features = await this.getFeatures(renderProps)
    const { height, regions, bpPerPx } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const res = await renderToAbstractCanvas(width, height, renderProps, ctx =>
      this.draw(ctx, { ...renderProps, features }),
    )

    const serialized = { ...res, height, width }
    if (isImageBitmap(res.imageData)) {
      return rpcResult(serialized, [res.imageData])
    }
    return serialized
  }

  draw(ctx, props) {
    // Custom canvas drawing logic
    const { features } = props
    for (const feature of features.values()) {
      // Draw feature...
    }
  }
}
```

### Renderer with layout (box-style)

```typescript
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'

class MyBoxRenderer extends BoxRendererType {
  // Uses default render() which fetches features and creates layout
  // Override only if you need custom behavior
}
```

## Utility functions

### expandRegion

Expands a region by a number of base pairs:

```typescript
import { expandRegion } from '@jbrowse/core/pluggableElementTypes/renderers/util'

getExpandedRegion(region, renderArgs) {
  const bpExpansion = 100  // expand by 100bp each direction
  return expandRegion(region, bpExpansion)
}
```

### collectTransferables

Helper to collect all transferable objects from a render result:

```typescript
import { collectTransferables } from '@jbrowse/core/util'

const serialized = { ...res, layout, height, width }
return rpcResult(serialized, collectTransferables(res))
```

This handles:

- `ImageBitmap` (canvas image data)
- `flatbush` ArrayBuffer (spatial index)
- `subfeatureFlatbush` ArrayBuffer (secondary spatial index)

### Verifying transfers work

After transfer, ArrayBuffers become "detached" (byteLength = 0) in the worker.
You can verify transfers are working by checking:

```typescript
import { isDetachedBuffer } from '@jbrowse/core/util/transferables'

// In worker, after rpcResult returns:
console.log('Buffer detached:', isDetachedBuffer(flatbush.data))
// Should be true if transfer worked
```

In Chrome DevTools, the Performance panel shows `postMessage` events and whether
transferables were used (look for "Transferable" in the details).

## SVG export

During SVG export, there's no `ImageBitmap` available. Canvas renderers handle
this by always using `rpcResult()` with `collectTransferables()`:

```typescript
// collectTransferables returns [] when no ImageBitmap
return rpcResult(serialized, collectTransferables(res))
```

The serialization methods handle both cases:

- Live layout objects get serialized via `serializeRegion()`
- Already-serialized layouts pass through unchanged
