# Path 2: Persistent WebGL Canvas Architecture

This document outlines the architectural changes needed for a "true" WebGL implementation where data is uploaded once and zoom/pan only updates uniforms.

## The Goal

```
Current (Canvas 2D / Path 1):
  User zooms → mobx reaction fires → RPC call → worker renders → ImageBitmap transfer → display

Desired (Path 2):
  User zooms → update uniform → GPU re-renders → done (no RPC, no data transfer)
```

## Why Current Architecture Prevents This

JBrowse's rendering is built around:

1. **Worker-based rendering** - Rendering happens in web workers to avoid blocking main thread
2. **ImageBitmap transfer** - Workers can't access DOM, so they render to OffscreenCanvas and transfer ImageBitmap
3. **Block-based re-rendering** - Each "block" is an independent render unit that gets re-rendered on state changes
4. **Mobx reactions** - Any observable change triggers the render reaction

The WebGL context must live on the **main thread** to receive immediate uniform updates. But rendering on the main thread could block the UI.

## Proposed Architecture

### Option A: Main Thread WebGL with Deferred Data Processing

```
┌─────────────────────────────────────────────────────────────────┐
│                      MAIN THREAD                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WebGLPileupDisplay (extends BaseLinearDisplay)                 │
│  ├── Persistent WebGL canvas (never recreated)                  │
│  ├── GPU buffers (uploaded when features change)                │
│  ├── Uniforms (updated on zoom/pan - instant!)                  │
│  └── requestAnimationFrame render loop                          │
│                                                                  │
│  On zoom/pan:                                                    │
│    → Update uniforms only                                        │
│    → GPU re-renders (~1ms)                                       │
│                                                                  │
│  On region change (scroll beyond buffer):                        │
│    → Request new features from adapter (async)                  │
│    → When ready, upload to GPU buffers                          │
│    → Continue rendering with new data                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                              │ Feature data (when region changes)
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         WORKER                                   │
├─────────────────────────────────────────────────────────────────┤
│  BamAdapter.getFeatures()                                        │
│  └── Returns features as transferable ArrayBuffers               │
│      (positions, flags, mapqs as Float32Arrays)                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Changes Required

#### 1. New Display Type: `WebGLPileupDisplay`

Instead of using `ServerSideRenderedBlock`, this display manages its own WebGL canvas:

```typescript
// Conceptual model
const WebGLPileupDisplay = types
  .compose(BaseLinearDisplay, types.model({
    type: types.literal('WebGLPileupDisplay'),
  }))
  .volatile(() => ({
    webglCanvas: null as HTMLCanvasElement | null,
    webglContext: null as WebGL2RenderingContext | null,
    gpuBuffers: null as GPUBuffers | null,
    currentFeatures: [] as Feature[],
  }))
  .views(self => ({
    // Track which genomic region is loaded in GPU
    get loadedRegion() { ... },
    // Check if current view is within loaded region
    get needsDataFetch() { ... },
  }))
  .actions(self => ({
    // Called when component mounts
    initWebGL(canvas: HTMLCanvasElement) {
      self.webglCanvas = canvas
      self.webglContext = canvas.getContext('webgl2')
      // Create shaders, programs, VAOs
    },

    // Called when features arrive from adapter
    uploadFeaturesToGPU(features: Feature[]) {
      self.currentFeatures = features
      // Convert to typed arrays
      // gl.bufferData() to upload
      self.gpuBuffers = { ... }
    },

    // Called on EVERY zoom/pan (but very fast)
    updateUniforms(domainX: [number, number], rangeY: [number, number]) {
      const gl = self.webglContext
      gl.uniform2f(uniforms.domainX, domainX[0], domainX[1])
      gl.uniform2f(uniforms.rangeY, rangeY[0], rangeY[1])
      // Render immediately
      this.render()
    },

    render() {
      const gl = self.webglContext
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, self.currentFeatures.length)
    },
  }))
```

#### 2. Custom React Component

Instead of using `PrerenderedCanvas`, a custom component that:
- Creates and owns the WebGL canvas
- Handles mouse events directly for zoom/pan
- Calls `updateUniforms()` on interaction (no mobx reaction delay)

```tsx
const WebGLPileupRendering = observer(function WebGLPileupRendering({ model }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) {
      model.initWebGL(canvasRef.current)
    }
    return () => model.destroyWebGL()
  }, [])

  // Direct event handling - no mobx involved
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const newDomain = computeZoomedDomain(model.domain, e)
    model.updateUniforms(newDomain, model.rangeY)  // Instant!
  }, [model])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newDomain = computePannedDomain(model.domain, e)
      model.updateUniforms(newDomain, model.rangeY)  // Instant!
    }
  }, [model])

  return (
    <canvas
      ref={canvasRef}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      style={{ width: '100%', height: model.height }}
    />
  )
})
```

#### 3. Data Fetching Strategy

Fetch data for a larger region than visible, so zoom/pan within that region doesn't need new data:

```typescript
actions(self => ({
  async fetchFeaturesForRegion(region: Region) {
    // Expand region by 2x on each side
    const expandedRegion = {
      ...region,
      start: region.start - (region.end - region.start),
      end: region.end + (region.end - region.start),
    }

    const features = await self.adapter.getFeatures(expandedRegion)
    self.uploadFeaturesToGPU(features)
    self.loadedRegion = expandedRegion
  },

  // Check on each view change
  maybeRefetchData() {
    if (self.needsDataFetch) {
      self.fetchFeaturesForRegion(self.visibleRegion)
    }
  },
}))
```

#### 4. Integration with LinearGenomeView

The view's zoom/pan would need to call the display's `updateUniforms()` directly:

```typescript
// In LinearGenomeView or custom view model
afterCreate() {
  // Instead of mobx reaction triggering full re-render,
  // directly update WebGL uniforms
  onAction(self, action => {
    if (action.name === 'zoomTo' || action.name === 'scrollTo') {
      for (const track of self.tracks) {
        for (const display of track.displays) {
          if (display.type === 'WebGLPileupDisplay') {
            display.updateUniforms(self.visibleDomain, display.rangeY)
          }
        }
      }
    }
  })
}
```

### Files That Would Need Changes

| File | Change |
|------|--------|
| `plugins/alignments/src/WebGLPileupDisplay/model.ts` | **NEW** - Display model with WebGL state |
| `plugins/alignments/src/WebGLPileupDisplay/components/WebGLRendering.tsx` | **NEW** - React component with WebGL canvas |
| `plugins/alignments/src/index.ts` | Register new display type |
| `plugins/linear-genome-view/src/LinearGenomeView/model.ts` | Add WebGL-aware zoom/pan actions |
| `packages/core/src/BaseLinearDisplay/` | Possibly add hooks for non-RPC rendering |

### Tradeoffs

**Advantages:**
- True smooth zoom/pan (uniform updates only)
- No RPC overhead on zoom/pan
- No ImageBitmap transfer on zoom/pan
- GPU handles all coordinate transformations

**Disadvantages:**
- Significant architectural changes
- Main thread WebGL (but rendering is fast)
- Need to manage data prefetching
- Different code path from other displays
- Feature interactivity (click/hover) needs separate handling
- Can't use existing block-based caching

### Hybrid Approach

A middle ground could be:

1. Use Path 1 (drop-in WebGL renderer) for initial implementation
2. Add a "prefetch buffer" that loads extra data
3. Implement a "fast path" that skips RPC when zooming within buffered region
4. Gradually expand to full Path 2 if benefits justify complexity

### Performance Comparison

| Scenario | Canvas 2D | Path 1 (WebGL + RPC) | Path 2 (Persistent WebGL) |
|----------|-----------|---------------------|---------------------------|
| Initial render | 50-200ms | 20-50ms | 20-50ms |
| Zoom within region | 50-200ms (full re-render) | 20-50ms (full re-render) | **<5ms** (uniform update) |
| Pan within region | 50-200ms (full re-render) | 20-50ms (full re-render) | **<5ms** (uniform update) |
| Color scheme change | 50-200ms | 20-50ms | **<1ms** (uniform update) |
| Region change | 50-200ms | 20-50ms | 20-50ms + upload |

### Recommendation

1. **Start with Path 1** - Get WebGL rendering working within existing architecture
2. **Measure performance** - See if GPU acceleration alone is sufficient
3. **If needed, evolve to Path 2** - Add persistent canvas for specific high-performance needs
4. **Consider GenomeSpy integration** - Their architecture already solves this; could potentially embed/adapt their rendering layer

The GenomeSpy approach (upload once, transform via uniforms) is the gold standard, but requires either:
- Embedding GenomeSpy's renderer into JBrowse
- Significant refactoring of JBrowse's display architecture
- A hybrid where certain display types opt out of the standard rendering pipeline
