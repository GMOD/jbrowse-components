import {
  Canvas2DGlobalRenderingBackend,
  GpuGlobalRenderingBackend,
} from './globalRenderingBackend.ts'
import { MockHal } from './hal/mockHal.ts'

import type { FrameDimensions } from './renderingBackendBase.ts'

// The monolithic twin of perRegionRenderingBackend.test.ts, and it pins the same
// two things: the frame scaffold runs whether or not anything is drawn, and the
// "did real content reach the canvas" answer comes from the backend rather than
// from a display re-deriving it. RenderLifecycleMixin flips `canvasDrawn` — the
// loading scrim, `data-display-drawn`, every browser test's wait — only on true.

interface Data {
  value: number
}

const STATE: FrameDimensions = { canvasWidth: 800, canvasHeight: 100 }

class TestGpuBackend extends GpuGlobalRenderingBackend<Data, FrameDimensions> {
  seen: Data[] = []
  painted = true

  upload() {}

  protected draw(data: Data) {
    this.seen.push(data)
    return this.painted
  }
}

class TestCanvas2DBackend extends Canvas2DGlobalRenderingBackend<
  Data,
  FrameDimensions
> {
  seen: Data[] = []
  painted = true

  protected draw(data: Data) {
    this.seen.push(data)
    return this.painted
  }
}

function gpuBackend() {
  const hal = new MockHal([])
  const backend = new TestGpuBackend(hal, 256)
  return { hal, backend }
}

describe('GpuGlobalRenderingBackend.render frame scaffold', () => {
  test('sizes the backing store, then pairs beginFrame with endFrame', () => {
    const { hal, backend } = gpuBackend()

    backend.render({ value: 1 }, STATE)

    expect(hal.calls.map(c => c.method)).toEqual([
      'resize',
      'beginFrame',
      'endFrame',
    ])
    expect(hal.callsOf('resize')[0]!.args).toEqual([800, 100])
  })

  test('still opens and closes a frame when there is no data', () => {
    // beginFrame is what clears the canvas, so the frame with nothing to draw is
    // exactly the one that must still happen — otherwise the previous picture
    // stays up under a display that has moved on.
    const { hal, backend } = gpuBackend()

    backend.render(null, STATE)

    expect(hal.callsOf('beginFrame')).toHaveLength(1)
    expect(hal.callsOf('endFrame')).toHaveLength(1)
    expect(backend.seen).toEqual([])
  })

  test('reports what draw did, not that data was supplied', () => {
    const { backend } = gpuBackend()
    backend.painted = false

    expect(backend.render({ value: 1 }, STATE)).toBe(false)
    // and the payload still reached draw — the answer is the renderer's, taken
    // from what it did rather than from whether it was asked
    expect(backend.seen).toEqual([{ value: 1 }])
  })

  test('a null payload is false without consulting draw', () => {
    const { backend } = gpuBackend()

    expect(backend.render(null, STATE)).toBe(false)
  })

  test('true when draw painted', () => {
    const { backend } = gpuBackend()

    expect(backend.render({ value: 1 }, STATE)).toBe(true)
  })
})

describe('Canvas2DGlobalRenderingBackend.render frame scaffold', () => {
  function canvas2dBackend() {
    const canvas = document.createElement('canvas')
    return { canvas, backend: new TestCanvas2DBackend(canvas) }
  }

  test('prepares the canvas at the state size before drawing', () => {
    // The base owns prepareCanvas for the same reason the per-region base does:
    // a renderer that forgets it paints blurry on hi-DPI, and nothing fails.
    const { canvas, backend } = canvas2dBackend()

    backend.render({ value: 1 }, STATE)

    // jsdom leaves devicePixelRatio undefined, so getDpr() is 1 and the backing
    // store is the CSS size exactly
    expect([canvas.width, canvas.height]).toEqual([800, 100])
    expect(backend.seen).toEqual([{ value: 1 }])
  })

  test('prepares (and so clears) the canvas even with no data', () => {
    const { canvas, backend } = canvas2dBackend()

    expect(backend.render(null, STATE)).toBe(false)

    expect([canvas.width, canvas.height]).toEqual([800, 100])
    expect(backend.seen).toEqual([])
  })

  test('reports what draw did', () => {
    const { backend } = canvas2dBackend()

    expect(backend.render({ value: 1 }, STATE)).toBe(true)
    backend.painted = false
    expect(backend.render({ value: 1 }, STATE)).toBe(false)
  })
})
