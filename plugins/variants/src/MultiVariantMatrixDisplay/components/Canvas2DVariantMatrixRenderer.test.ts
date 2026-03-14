import { Canvas2DVariantMatrixRenderer } from './Canvas2DVariantMatrixRenderer.ts'

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
    moveTo: jest.fn((...args) => pathOps.push(`moveTo(${args})`)),
    lineTo: jest.fn((...args) => pathOps.push(`lineTo(${args})`)),
    closePath: jest.fn(() => pathOps.push('closePath')),
    fill: jest.fn(() => pathOps.push('fill')),
    rect: jest.fn(),
    clip: jest.fn(),
    strokeRect: jest.fn(),
    stroke: jest.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => ctx),
  } as unknown as HTMLCanvasElement
  return { canvas, ctx, fillRectCalls, pathOps }
}

describe('Canvas2DVariantMatrixRenderer', () => {
  describe('uploadCellData', () => {
    test('stores cell data for rendering', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantMatrixRenderer(canvas)

      renderer.uploadCellData({
        cellFeatureIndices: new Float32Array([0, 1]),
        cellRowIndices: new Uint32Array([0, 1]),
        cellColors: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
        numCells: 2,
      })

      renderer.render({
        canvasWidth: 400,
        canvasHeight: 300,
        rowHeight: 10,
        scrollTop: 0,
        numFeatures: 4,
      })

      expect(fillRectCalls.length).toBe(2)
    })
  })

  describe('render', () => {
    test('draws rectangles at correct positions', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantMatrixRenderer(canvas)

      renderer.uploadCellData({
        cellFeatureIndices: new Float32Array([2]),
        cellRowIndices: new Uint32Array([3]),
        cellColors: new Uint8Array([128, 64, 32, 255]),
        numCells: 1,
      })

      renderer.render({
        canvasWidth: 400,
        canvasHeight: 600,
        rowHeight: 20,
        scrollTop: 0,
        numFeatures: 4,
      })

      expect(fillRectCalls.length).toBe(1)
      const [x, y, w, h] = fillRectCalls[0]!
      // featureIdx=2, cellWidth=400/4=100, so x=200
      expect(x).toBeCloseTo(200)
      // rowIdx=3, rowHeight=20, scrollTop=0, so y=60
      expect(y).toBeCloseTo(60)
      expect(w).toBeCloseTo(100)
      expect(h).toBe(20)
    })

    test('skips cells above viewport', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantMatrixRenderer(canvas)

      renderer.uploadCellData({
        cellFeatureIndices: new Float32Array([0]),
        cellRowIndices: new Uint32Array([0]),
        cellColors: new Uint8Array([255, 0, 0, 255]),
        numCells: 1,
      })

      // scrollTop=100 means y = 0*10 - 100 = -100, y+rowHeight = -90 < 0
      renderer.render({
        canvasWidth: 400,
        canvasHeight: 300,
        rowHeight: 10,
        scrollTop: 100,
        numFeatures: 4,
      })

      expect(fillRectCalls.length).toBe(0)
    })

    test('skips cells below viewport', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantMatrixRenderer(canvas)

      renderer.uploadCellData({
        cellFeatureIndices: new Float32Array([0]),
        cellRowIndices: new Uint32Array([50]),
        cellColors: new Uint8Array([255, 0, 0, 255]),
        numCells: 1,
      })

      // y = 50*10 - 0 = 500 > 300
      renderer.render({
        canvasWidth: 400,
        canvasHeight: 300,
        rowHeight: 10,
        scrollTop: 0,
        numFeatures: 4,
      })

      expect(fillRectCalls.length).toBe(0)
    })

    test('renders nothing with empty data', () => {
      const { canvas, fillRectCalls, ctx } = createMockCanvas()
      const renderer = new Canvas2DVariantMatrixRenderer(canvas)

      renderer.render({
        canvasWidth: 400,
        canvasHeight: 300,
        rowHeight: 10,
        scrollTop: 0,
        numFeatures: 4,
      })

      expect(fillRectCalls.length).toBe(0)
      expect(ctx.clearRect).toHaveBeenCalled()
    })

    test('renders nothing when numFeatures is 0', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantMatrixRenderer(canvas)

      renderer.uploadCellData({
        cellFeatureIndices: new Float32Array([0]),
        cellRowIndices: new Uint32Array([0]),
        cellColors: new Uint8Array([255, 0, 0, 255]),
        numCells: 1,
      })

      renderer.render({
        canvasWidth: 400,
        canvasHeight: 300,
        rowHeight: 10,
        scrollTop: 0,
        numFeatures: 0,
      })

      expect(fillRectCalls.length).toBe(0)
    })

    test('sets correct fillStyle from color data', () => {
      const { canvas, ctx } = createMockCanvas()
      const renderer = new Canvas2DVariantMatrixRenderer(canvas)

      renderer.uploadCellData({
        cellFeatureIndices: new Float32Array([0]),
        cellRowIndices: new Uint32Array([0]),
        cellColors: new Uint8Array([128, 64, 32, 127]),
        numCells: 1,
      })

      renderer.render({
        canvasWidth: 400,
        canvasHeight: 300,
        rowHeight: 10,
        scrollTop: 0,
        numFeatures: 4,
      })

      expect(ctx.fillStyle).toBe(
        `rgba(128,64,32,${127 / 255})`,
      )
    })
  })

  describe('destroy', () => {
    test('clears stored data', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantMatrixRenderer(canvas)

      renderer.uploadCellData({
        cellFeatureIndices: new Float32Array([0]),
        cellRowIndices: new Uint32Array([0]),
        cellColors: new Uint8Array([255, 0, 0, 255]),
        numCells: 1,
      })

      renderer.destroy()

      renderer.render({
        canvasWidth: 400,
        canvasHeight: 300,
        rowHeight: 10,
        scrollTop: 0,
        numFeatures: 4,
      })

      expect(fillRectCalls.length).toBe(0)
    })
  })
})
