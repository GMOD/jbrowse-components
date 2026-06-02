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
    instanceCount: count,
  }
}

const DEFAULT_STATE: DotplotRenderState = {
  viewBpH: 0,
  viewBpV: 0,
  bpPerPxHInv: 1,
  bpPerPxVInv: 1,
  lineWidth: 2,
  displayKeys: [0],
}

describe('Canvas2DDotplotRenderer', () => {
  test('renders lines for uploaded geometry', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(3))
    renderer.render(DEFAULT_STATE)
    expect(strokeCalls.length).toBe(3)
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
      instanceCount: 1,
    })

    renderer.render({
      viewBpH: 5,
      viewBpV: 20 / 3,
      bpPerPxHInv: 2,
      bpPerPxVInv: 3,
      lineWidth: 1,
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
      instanceCount: 1,
    })

    renderer.render(DEFAULT_STATE)
    expect(ctx.strokeStyle).toMatch(/^rgba\(128,64,191,0\.8/)
  })

  test('renders multiple tracks independently', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(2))
    renderer.uploadGeometry(1, makeGeometry(3))
    renderer.render({
      ...DEFAULT_STATE,
      displayKeys: [0, 1],
    })
    expect(strokeCalls.length).toBe(5)
  })

  test('deleteGeometry removes a track', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(2))
    renderer.uploadGeometry(1, makeGeometry(3))
    renderer.deleteGeometry(0)
    renderer.render({
      ...DEFAULT_STATE,
      displayKeys: [0, 1],
    })
    expect(strokeCalls.length).toBe(3)
  })

  test('resize sets canvas dimensions', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(400, 300)
    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(300)
  })

  test('resize is idempotent for same dimensions', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(400, 300)
    canvas.width = 999
    renderer.resize(400, 300)
    expect(canvas.width).toBe(999)
  })

  test('dispose clears data so render is a no-op', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry(2))
    renderer.dispose()
    renderer.render(DEFAULT_STATE)
    expect(strokeCalls.length).toBe(0)
  })
})
