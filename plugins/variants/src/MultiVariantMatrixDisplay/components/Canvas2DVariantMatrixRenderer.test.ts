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
    closePath: jest.fn(() => pathOps.push('closePath')),
    moveTo: jest.fn((x: number, y: number) => pathOps.push(`moveTo(${x},${y})`)),
    lineTo: jest.fn((x: number, y: number) => pathOps.push(`lineTo(${x},${y})`)),
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

describe('Canvas2DVariantMatrixRenderer', () => {
  describe('uploadCellData', () => {
    test('stores cell data for rendering', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantMatrixRenderer(canvas)

      renderer.uploadCellData({
        cellFeatureIndices: new Float32Array([0, 1]),
        cellRowIndices: new Uint32Array([0, 1]),
        cellColors: new Uint32Array([0xff0000ff, 0xff00ff00]),
        numCells: 2,
        numFeatures: 4,
      })

      renderer.render({
        canvasWidth: 400,
        canvasHeight: 300,
        rowHeight: 10,
        scrollTop: 0,
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
        cellColors: new Uint32Array([0xff204080]),
        numCells: 1,
        numFeatures: 4,
      })

      renderer.render({
        canvasWidth: 400,
        canvasHeight: 600,
        rowHeight: 20,
        scrollTop: 0,
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
        cellColors: new Uint32Array([0xff0000ff]),
        numCells: 1,
        numFeatures: 4,
      })

      // scrollTop=100 means y = 0*10 - 100 = -100, y+rowHeight = -90 < 0
      renderer.render({
        canvasWidth: 400,
        canvasHeight: 300,
        rowHeight: 10,
        scrollTop: 100,
      })

      expect(fillRectCalls.length).toBe(0)
    })

    test('skips cells below viewport', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantMatrixRenderer(canvas)

      renderer.uploadCellData({
        cellFeatureIndices: new Float32Array([0]),
        cellRowIndices: new Uint32Array([50]),
        cellColors: new Uint32Array([0xff0000ff]),
        numCells: 1,
        numFeatures: 4,
      })

      // y = 50*10 - 0 = 500 > 300
      renderer.render({
        canvasWidth: 400,
        canvasHeight: 300,
        rowHeight: 10,
        scrollTop: 0,
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
        cellColors: new Uint32Array([0xff0000ff]),
        numCells: 1,
        numFeatures: 0,
      })

      renderer.render({
        canvasWidth: 400,
        canvasHeight: 300,
        rowHeight: 10,
        scrollTop: 0,
      })

      expect(fillRectCalls.length).toBe(0)
    })

    test('sets correct fillStyle from color data', () => {
      const { canvas, ctx } = createMockCanvas()
      const renderer = new Canvas2DVariantMatrixRenderer(canvas)

      renderer.uploadCellData({
        cellFeatureIndices: new Float32Array([0]),
        cellRowIndices: new Uint32Array([0]),
        cellColors: new Uint32Array([0x7f204080]),
        numCells: 1,
        numFeatures: 4,
      })

      renderer.render({
        canvasWidth: 400,
        canvasHeight: 300,
        rowHeight: 10,
        scrollTop: 0,
      })

      expect(ctx.fillStyle).toBe(`rgba(128,64,32,${127 / 255})`)
    })
  })

  describe('dispose', () => {
    test('clears stored data', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantMatrixRenderer(canvas)

      renderer.uploadCellData({
        cellFeatureIndices: new Float32Array([0]),
        cellRowIndices: new Uint32Array([0]),
        cellColors: new Uint32Array([0xff0000ff]),
        numCells: 1,
        numFeatures: 4,
      })

      renderer.dispose()

      renderer.render({
        canvasWidth: 400,
        canvasHeight: 300,
        rowHeight: 10,
        scrollTop: 0,
      })

      expect(fillRectCalls.length).toBe(0)
    })
  })
})
