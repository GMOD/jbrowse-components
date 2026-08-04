import { Canvas2DDotplotRenderer } from './Canvas2DDotplotRenderer.ts'

import type {
  DotplotGeometryData,
  DotplotRenderState,
} from './dotplotRenderingBackendTypes.ts'

Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

function createMockCanvas() {
  const strokeCalls: string[] = []
  const ctx = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(() => strokeCalls.push('stroke')),
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => ctx),
  } as unknown as HTMLCanvasElement
  return { canvas, ctx, strokeCalls }
}

// Build geometry with cumBp values (bpPerPx=1 → cumBp = pixel offset for simple cases).
function makeGeometry(count: number): DotplotGeometryData {
  const x1 = new Float64Array(count)
  const y1 = new Float64Array(count)
  const x2 = new Float64Array(count)
  const y2 = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    x1[i] = i * 10
    y1[i] = i * 10
    x2[i] = i * 10 + 5
    y2[i] = i * 10 + 5
  }
  return {
    x1,
    y1,
    x2,
    y2,
    colors: new Uint32Array(count).fill(0xff0000ff),
    instanceFeatureIdx: new Uint32Array(count),
    instanceCount: count,
    baseH: 0,
    baseV: 0,
  }
}

const DEFAULT_STATE: DotplotRenderState = {
  viewBpH: 0,
  viewBpV: 0,
  bpPerPxHInv: 1,
  bpPerPxVInv: 1,
  lineWidth: 2,
  alpha: 1,
  displayKeys: [0],
}

describe('Canvas2DDotplotRenderer', () => {
  // Segments are counted by lineTo, not by stroke: same-color runs are batched
  // into one path, so stroke count tracks color runs (see the batching test
  // below) while every segment still gets drawn.
  test('renders lines for uploaded geometry', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(3))
    renderer.render(DEFAULT_STATE)
    expect(ctx.lineTo).toHaveBeenCalledTimes(3)
  })

  test('batches same-color segments into one path, flushing on color change', () => {
    const { canvas, ctx, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    const geometry = makeGeometry(5)
    // two runs: three of one color then two of another
    geometry.colors.set([
      0xff0000ff, 0xff0000ff, 0xff0000ff, 0xff00ff00, 0xff00ff00,
    ])
    renderer.uploadGeometry(0, geometry)
    renderer.render(DEFAULT_STATE)
    expect(ctx.lineTo).toHaveBeenCalledTimes(5)
    expect(strokeCalls.length).toBe(2)
  })

  test('does nothing with zero instances', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(0))
    renderer.render(DEFAULT_STATE)
    expect(strokeCalls.length).toBe(0)
  })

  test('does nothing without uploadGeometry', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.render(DEFAULT_STATE)
    expect(strokeCalls.length).toBe(0)
  })

  test('applies view bp and bpPerPxInv to coordinates', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)

    // cumBp=100 for x1, cumBp=200 for y1.
    // With bpPerPxHInv=2 and viewBpH=5: sx1 = (100 - 5) * 2 = 190.
    // With bpPerPxVInv=3 and viewBpV=20/3: sy1 = 600 - (200 - 20/3) * 3 = 600 - 580 = 20.
    renderer.uploadGeometry(0, {
      x1: new Float64Array([100]),
      y1: new Float64Array([200]),
      x2: new Float64Array([150]),
      y2: new Float64Array([250]),
      colors: new Uint32Array([0xff0000ff]),
      instanceFeatureIdx: new Uint32Array([0]),
      instanceCount: 1,
      baseH: 0,
      baseV: 0,
    })

    renderer.render({
      viewBpH: 5,
      viewBpV: 20 / 3,
      bpPerPxHInv: 2,
      bpPerPxVInv: 3,
      lineWidth: 1,
      alpha: 1,
      displayKeys: [0],
    })

    expect(ctx.moveTo).toHaveBeenCalledWith(190, 20)
  })

  test('sets strokeStyle from color data', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)

    renderer.uploadGeometry(0, {
      x1: new Float64Array([0]),
      y1: new Float64Array([0]),
      x2: new Float64Array([1]),
      y2: new Float64Array([1]),
      colors: new Uint32Array([0xccbf4080]),
      instanceFeatureIdx: new Uint32Array([0]),
      instanceCount: 1,
      baseH: 0,
      baseV: 0,
    })

    renderer.render(DEFAULT_STATE)
    expect(ctx.strokeStyle).toMatch(/^rgba\(128,64,191,0\.8/)
  })

  // Opacity is a render parameter, not part of the packed color (the GPU twin
  // is `color.a * u.alpha` in dotplot.slang's fragment). SvgCanvas has no
  // globalAlpha, so it has to land in the rgba() string itself or the SVG
  // export would come out at full opacity.
  test('folds the plot-wide opacity into strokeStyle', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)

    renderer.uploadGeometry(0, {
      x1: new Float64Array([0]),
      y1: new Float64Array([0]),
      x2: new Float64Array([1]),
      y2: new Float64Array([1]),
      // opaque, as every packed dotplot color now is
      colors: new Uint32Array([0xffbf4080]),
      instanceFeatureIdx: new Uint32Array([0]),
      instanceCount: 1,
      baseH: 0,
      baseV: 0,
    })

    renderer.render({ ...DEFAULT_STATE, alpha: 0.25 })
    expect(ctx.strokeStyle).toBe('rgba(128,64,191,0.25)')
  })

  test('renders multiple tracks independently', () => {
    const { canvas, ctx, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(2))
    renderer.uploadGeometry(1, makeGeometry(3))
    renderer.render({
      ...DEFAULT_STATE,
      displayKeys: [0, 1],
    })
    expect(ctx.lineTo).toHaveBeenCalledTimes(5)
    // batches never span two displays, so each single-color track is one stroke
    expect(strokeCalls.length).toBe(2)
  })

  test('deleteGeometry removes a track', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(2))
    renderer.uploadGeometry(1, makeGeometry(3))
    renderer.deleteGeometry(0)
    renderer.render({
      ...DEFAULT_STATE,
      displayKeys: [0, 1],
    })
    expect(ctx.lineTo).toHaveBeenCalledTimes(3)
  })

  // Sizing is deferred to render (prepareCanvas), so dpr is re-read every frame
  // rather than latched at resize time.
  test('render sizes the backing store from the last resize', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(400, 300)
    expect(canvas.width).toBe(0)
    renderer.render(DEFAULT_STATE)
    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(300)
  })

  // prepareCanvas compares against the required backing size each frame rather
  // than trusting a cached one, so a clobbered backing store self-corrects.
  test('render restores a backing store that drifted from the CSS size', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(400, 300)
    renderer.render(DEFAULT_STATE)
    canvas.width = 999
    renderer.render(DEFAULT_STATE)
    expect(canvas.width).toBe(400)
  })

  test('dispose clears data so render is a no-op', () => {
    const { canvas, ctx, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(2))
    renderer.dispose()
    renderer.render(DEFAULT_STATE)
    expect(ctx.lineTo).not.toHaveBeenCalled()
    expect(strokeCalls.length).toBe(0)
  })
})
