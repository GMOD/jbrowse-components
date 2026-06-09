import { Canvas2DVariantMatrixRenderer } from './Canvas2DVariantMatrixRenderer.ts'

import type { VariantMatrixUploadData } from './variantMatrixRenderingBackendTypes.ts'

Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

function createMockCanvas() {
  const fillRectCalls: [number, number, number, number][] = []
  const pathOps: string[] = []
  const ctx = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    fillRect: jest.fn((...args: [number, number, number, number]) =>
      fillRectCalls.push(args),
    ),
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(() => pathOps.push('beginPath')),
    closePath: jest.fn(() => pathOps.push('closePath')),
    moveTo: jest.fn((x: number, y: number) =>
      pathOps.push(`moveTo(${x},${y})`),
    ),
    lineTo: jest.fn((x: number, y: number) =>
      pathOps.push(`lineTo(${x},${y})`),
    ),
    fill: jest.fn(() => pathOps.push('fill')),
    fillStyle: '',
    rect: jest.fn(),
    clip: jest.fn(),
  }
  const canvas = {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: jest.fn(() => ctx),
  } as unknown as HTMLCanvasElement
  return { canvas, ctx, fillRectCalls, pathOps }
}

const STATE = {
  canvasWidth: 400,
  canvasHeight: 300,
  rowHeight: 10,
  scrollTop: 0,
}

function makeData(
  overrides?: Partial<VariantMatrixUploadData>,
): VariantMatrixUploadData {
  return {
    cellFeatureIndices: new Float32Array([0]),
    cellRowIndices: new Uint32Array([0]),
    cellColors: new Uint32Array([0xff0000ff]),
    numCells: 1,
    numFeatures: 4,
    ...overrides,
  }
}

describe('Canvas2DVariantMatrixRenderer', () => {
  test('renders rectangles for uploaded cells', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    const renderer = new Canvas2DVariantMatrixRenderer(canvas)

    renderer.render(
      makeData({
        cellFeatureIndices: new Float32Array([0, 1]),
        cellRowIndices: new Uint32Array([0, 1]),
        cellColors: new Uint32Array([0xff0000ff, 0xff00ff00]),
        numCells: 2,
      }),
      STATE,
    )

    expect(fillRectCalls.length).toBe(2)
  })

  test('draws rectangles at correct positions', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    const renderer = new Canvas2DVariantMatrixRenderer(canvas)

    renderer.render(
      makeData({
        cellFeatureIndices: new Float32Array([2]),
        cellRowIndices: new Uint32Array([3]),
        cellColors: new Uint32Array([0xff204080]),
      }),
      { ...STATE, canvasHeight: 600, rowHeight: 20 },
    )

    // featureIndex 2 of 4 across width 400 => cellWidth 100, x = 200; the 0.3px
    // overdraw (f2) shifts each edge so sub-pixel columns antialias and blend.
    expect(fillRectCalls.length).toBe(1)
    const [x, y, w, h] = fillRectCalls[0]!
    expect(x).toBeCloseTo(199.7)
    expect(y).toBeCloseTo(59.7)
    expect(w).toBeCloseTo(100.3)
    expect(h).toBeCloseTo(20.3)
  })

  test('skips cells above viewport', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    const renderer = new Canvas2DVariantMatrixRenderer(canvas)

    renderer.render(makeData(), { ...STATE, scrollTop: 100 })

    expect(fillRectCalls.length).toBe(0)
  })

  test('skips cells below viewport', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    const renderer = new Canvas2DVariantMatrixRenderer(canvas)

    renderer.render(makeData({ cellRowIndices: new Uint32Array([50]) }), STATE)

    expect(fillRectCalls.length).toBe(0)
  })

  test('renders nothing with null data', () => {
    const { canvas, fillRectCalls, ctx } = createMockCanvas()
    const renderer = new Canvas2DVariantMatrixRenderer(canvas)

    renderer.render(null, STATE)

    expect(fillRectCalls.length).toBe(0)
    expect(ctx.clearRect).toHaveBeenCalled()
  })

  test('renders nothing when numFeatures is 0', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    const renderer = new Canvas2DVariantMatrixRenderer(canvas)

    renderer.render(makeData({ numFeatures: 0 }), STATE)

    expect(fillRectCalls.length).toBe(0)
  })

  test('sets correct fillStyle from color data', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DVariantMatrixRenderer(canvas)

    renderer.render(
      makeData({ cellColors: new Uint32Array([0x7f204080]) }),
      STATE,
    )

    expect(ctx.fillStyle).toBe(`rgba(128,64,32,${127 / 255})`)
  })
})
