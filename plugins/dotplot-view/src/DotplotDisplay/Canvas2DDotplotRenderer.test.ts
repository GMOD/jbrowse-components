import { Canvas2DDotplotRenderer } from './Canvas2DDotplotRenderer.ts'

import type { DotplotGeometryData, DotplotRenderState } from './dotplotBackendTypes.ts'

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
  const zeros = new Float32Array(count).fill(0)
  const x1Hi = new Float32Array(count)
  const y1Hi = new Float32Array(count)
  const x2Hi = new Float32Array(count)
  const y2Hi = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    x1Hi[i] = i * 10
    y1Hi[i] = i * 10
    x2Hi[i] = i * 10 + 5
    y2Hi[i] = i * 10 + 5
  }
  return {
    x1Hi, x1Lo: zeros.slice(),
    y1Hi, y1Lo: zeros.slice(),
    x2Hi, x2Lo: zeros.slice(),
    y2Hi, y2Lo: zeros.slice(),
    padHs: zeros.slice(), padVs: zeros.slice(),
    colors: new Uint32Array(count).fill(0xff0000ff),
    instanceCount: count,
  }
}

// Default render state: viewBp=0, bpPerPxInv=1, no offset.
const DEFAULT_STATE: DotplotRenderState = {
  viewBpHHi: 0, viewBpHLo: 0, bpPerPxHInv: 1,
  viewBpVHi: 0, viewBpVLo: 0, bpPerPxVInv: 1,
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

    // Store cumBp=100 for x1 and cumBp=200 for y1.
    // With bpPerPxHInv=2 and viewBpH=5: sx1 = (100 - 5) * 2 = 190.
    // With bpPerPxVInv=3 and viewBpV=20/3: sy1 = 600 - (200 - 20/3) * 3 = 600 - 580 = 20.
    renderer.uploadGeometry(0, {
      x1Hi: new Float32Array([100]), x1Lo: new Float32Array([0]),
      y1Hi: new Float32Array([200]), y1Lo: new Float32Array([0]),
      x2Hi: new Float32Array([150]), x2Lo: new Float32Array([0]),
      y2Hi: new Float32Array([250]), y2Lo: new Float32Array([0]),
      padHs: new Float32Array([0]), padVs: new Float32Array([0]),
      colors: new Uint32Array([0xff0000ff]),
      instanceCount: 1,
    })

    const viewBpH = 5       // = offsetX / scaleX = 10 / 2
    const viewBpV = 20 / 3  // = offsetY / scaleY = 20 / 3
    renderer.render({
      viewBpHHi: 0, viewBpHLo: viewBpH, bpPerPxHInv: 2,
      viewBpVHi: 0, viewBpVLo: viewBpV, bpPerPxVInv: 3,
      lineWidth: 1,
      displayKeys: [0],
    })

    expect(ctx.moveTo).toHaveBeenCalledWith(190, 20)
  })

  test('sets strokeStyle from color data', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)

    const zeros = new Float32Array([0])
    renderer.uploadGeometry(0, {
      x1Hi: zeros.slice(), x1Lo: zeros.slice(),
      y1Hi: zeros.slice(), y1Lo: zeros.slice(),
      x2Hi: new Float32Array([1]), x2Lo: zeros.slice(),
      y2Hi: new Float32Array([1]), y2Lo: zeros.slice(),
      padHs: zeros.slice(), padVs: zeros.slice(),
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
