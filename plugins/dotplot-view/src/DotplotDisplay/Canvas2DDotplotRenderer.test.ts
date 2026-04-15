import { Canvas2DDotplotRenderer } from './Canvas2DDotplotRenderer.ts'

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

function makeGeometry(count: number) {
  const x1s = new Float32Array(count)
  const y1s = new Float32Array(count)
  const x2s = new Float32Array(count)
  const y2s = new Float32Array(count)
  // red, full alpha: R=0xFF in bits 0-7, A=0xFF in bits 24-31
  const colors = new Uint32Array(count).fill(0xff0000ff)
  for (let i = 0; i < count; i++) {
    x1s[i] = i * 10
    y1s[i] = i * 10
    x2s[i] = i * 10 + 5
    y2s[i] = i * 10 + 5
  }
  return { x1s, y1s, x2s, y2s, colors, instanceCount: count }
}

const SCALE_1 = [{ regionKey: 0, scaleX: 1, scaleY: 1 }] as const

describe('Canvas2DDotplotRenderer', () => {
  function renderState(
    offsetX: number,
    offsetY: number,
    lineWidth: number,
    trackScales: readonly { regionKey: number; scaleX: number; scaleY: number }[],
  ) {
    return { offsetX, offsetY, lineWidth, trackScales }
  }

  test('renders lines for uploaded geometry', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadRegion(0, makeGeometry(3))
    renderer.render(renderState(0, 0, 2, SCALE_1))
    expect(strokeCalls.length).toBe(3)
  })

  test('does nothing with zero instances', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadRegion(0, makeGeometry(0))
    renderer.render(renderState(0, 0, 2, SCALE_1))
    expect(strokeCalls.length).toBe(0)
  })

  test('does nothing without uploadRegion', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.render(renderState(0, 0, 2, SCALE_1))
    expect(strokeCalls.length).toBe(0)
  })

  test('applies scale and offset to coordinates', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)

    renderer.uploadRegion(0, {
      x1s: new Float32Array([100]),
      y1s: new Float32Array([200]),
      x2s: new Float32Array([150]),
      y2s: new Float32Array([250]),
      colors: new Uint32Array([0xff0000ff]),
      instanceCount: 1,
    })

    const scaleX = 2
    const scaleY = 3
    const offsetX = 10
    const offsetY = 20
    renderer.render(
      renderState(offsetX, offsetY, 1, [{ regionKey: 0, scaleX, scaleY }]),
    )

    expect(ctx.moveTo).toHaveBeenCalledWith(190, 20)
  })

  test('sets strokeStyle from color data', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)

    renderer.uploadRegion(0, {
      x1s: new Float32Array([0]),
      y1s: new Float32Array([0]),
      x2s: new Float32Array([1]),
      y2s: new Float32Array([1]),
      colors: new Uint32Array([0xccbf4080]),
      instanceCount: 1,
    })

    renderer.render(renderState(0, 0, 1, SCALE_1))
    expect(ctx.strokeStyle).toMatch(/^rgba\(128,64,191,0\.8/)
  })

  test('renders multiple tracks independently', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadRegion(0, makeGeometry(2))
    renderer.uploadRegion(1, makeGeometry(3))
    renderer.render(
      renderState(0, 0, 2, [
        { regionKey: 0, scaleX: 1, scaleY: 1 },
        { regionKey: 1, scaleX: 1, scaleY: 1 },
      ]),
    )
    expect(strokeCalls.length).toBe(5)
  })

  test('deleteRegion removes a track', () => {
    const { canvas, strokeCalls } = createMockCanvas()
    const renderer = new Canvas2DDotplotRenderer(canvas)
    renderer.resize(800, 600)
    renderer.uploadRegion(0, makeGeometry(2))
    renderer.uploadRegion(1, makeGeometry(3))
    renderer.deleteRegion(0)
    renderer.render(
      renderState(0, 0, 2, [
        { regionKey: 0, scaleX: 1, scaleY: 1 },
        { regionKey: 1, scaleX: 1, scaleY: 1 },
      ]),
    )
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
    renderer.uploadRegion(0, makeGeometry(2))
    renderer.dispose()
    renderer.render(renderState(0, 0, 1, SCALE_1))
    expect(strokeCalls.length).toBe(0)
  })
})
