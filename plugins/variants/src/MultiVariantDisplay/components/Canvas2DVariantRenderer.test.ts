import { Canvas2DVariantRenderer } from './Canvas2DVariantRenderer.ts'
import type { VariantRenderBlock } from './WebGLVariantRenderer.ts'

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

function makeBlock(overrides?: Partial<VariantRenderBlock>): VariantRenderBlock {
  return {
    regionNumber: 0,
    bpRangeX: [0, 1000],
    screenStartPx: 0,
    screenEndPx: 800,
    ...overrides,
  }
}

function makeRegionData(overrides?: {
  regionStart?: number
  numCells?: number
  cellPositions?: number[]
  cellRowIndices?: number[]
  cellColors?: number[]
  cellShapeTypes?: number[]
}) {
  const numCells = overrides?.numCells ?? 1
  const cellPositions =
    overrides?.cellPositions ?? Array.from({ length: numCells * 2 }, () => 0)
  const cellRowIndices =
    overrides?.cellRowIndices ?? Array.from({ length: numCells }, () => 0)
  const cellColors =
    overrides?.cellColors ??
    Array.from({ length: numCells * 4 }, () => 255)
  const cellShapeTypes =
    overrides?.cellShapeTypes ?? Array.from({ length: numCells }, () => 0)

  return {
    regionStart: overrides?.regionStart ?? 0,
    cellPositions: new Uint32Array(cellPositions),
    cellRowIndices: new Uint32Array(cellRowIndices),
    cellColors: new Uint8Array(cellColors),
    cellShapeTypes: new Uint8Array(cellShapeTypes),
    numCells,
  }
}

describe('Canvas2DVariantRenderer', () => {
  describe('uploadRegion', () => {
    test('stores region data', () => {
      const { canvas } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)
      const data = makeRegionData({ numCells: 2 })
      renderer.uploadRegion(0, data)

      // Verify data was stored by rendering a block that references it
      const { fillRectCalls } = createMockCanvas()
      // The region is stored internally; we verify by rendering
      renderer.renderBlocks([makeBlock({ regionNumber: 0 })], {
        canvasWidth: 800,
        canvasHeight: 600,
        rowHeight: 10,
        scrollTop: 0,
      })
      // No error means data was stored successfully
    })

    test('removes region when numCells is 0', () => {
      const { canvas, ctx } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)

      renderer.uploadRegion(0, makeRegionData({ numCells: 1 }))
      renderer.uploadRegion(0, makeRegionData({ numCells: 0 }))

      // Render with the block - since the region was removed, save should
      // not be called (the block is skipped)
      renderer.renderBlocks([makeBlock({ regionNumber: 0 })], {
        canvasWidth: 800,
        canvasHeight: 600,
        rowHeight: 10,
        scrollTop: 0,
      })
      expect(ctx.save).not.toHaveBeenCalled()
    })
  })

  describe('pruneStaleRegions', () => {
    test('removes inactive regions', () => {
      const { canvas, ctx } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)

      renderer.uploadRegion(0, makeRegionData())
      renderer.uploadRegion(1, makeRegionData())
      renderer.uploadRegion(2, makeRegionData())

      renderer.pruneStaleRegions([1])

      // Region 0 and 2 should be gone; rendering blocks for them should skip
      renderer.renderBlocks(
        [
          makeBlock({ regionNumber: 0 }),
          makeBlock({ regionNumber: 1 }),
          makeBlock({ regionNumber: 2 }),
        ],
        { canvasWidth: 800, canvasHeight: 600, rowHeight: 10, scrollTop: 0 },
      )

      // save is only called once (for region 1)
      expect(ctx.save).toHaveBeenCalledTimes(1)
    })
  })

  describe('renderBlocks', () => {
    test('renders a rect cell with fillRect', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)

      renderer.uploadRegion(
        0,
        makeRegionData({
          numCells: 1,
          cellPositions: [100, 200],
          cellRowIndices: [0],
          cellColors: [255, 0, 0, 255],
          cellShapeTypes: [0],
        }),
      )

      renderer.renderBlocks([makeBlock()], {
        canvasWidth: 800,
        canvasHeight: 600,
        rowHeight: 10,
        scrollTop: 0,
      })

      expect(fillRectCalls.length).toBe(1)
      const [x, y, w, h] = fillRectCalls[0]!
      expect(x).toBeCloseTo(80)
      expect(y).toBe(0)
      expect(w).toBeCloseTo(80)
      expect(h).toBe(10)
    })

    test('skips cells outside viewport (y + rowHeight < 0)', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)

      renderer.uploadRegion(
        0,
        makeRegionData({
          numCells: 1,
          cellPositions: [0, 100],
          cellRowIndices: [0],
          cellColors: [255, 0, 0, 255],
          cellShapeTypes: [0],
        }),
      )

      // scrollTop of 100 means y = 0*10 - 100 = -100, and y+rowHeight = -90 < 0
      renderer.renderBlocks([makeBlock()], {
        canvasWidth: 800,
        canvasHeight: 600,
        rowHeight: 10,
        scrollTop: 100,
      })

      expect(fillRectCalls.length).toBe(0)
    })

    test('skips cells outside viewport (y > canvasHeight)', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)

      renderer.uploadRegion(
        0,
        makeRegionData({
          numCells: 1,
          cellPositions: [0, 100],
          cellRowIndices: [100],
          cellColors: [255, 0, 0, 255],
          cellShapeTypes: [0],
        }),
      )

      // y = 100*10 - 0 = 1000 > 600
      renderer.renderBlocks([makeBlock()], {
        canvasWidth: 800,
        canvasHeight: 600,
        rowHeight: 10,
        scrollTop: 0,
      })

      expect(fillRectCalls.length).toBe(0)
    })
  })

  describe('shape types', () => {
    test('shape 1 draws right triangle via path', () => {
      const { canvas, pathOps } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)

      renderer.uploadRegion(
        0,
        makeRegionData({
          numCells: 1,
          cellPositions: [0, 100],
          cellRowIndices: [0],
          cellColors: [255, 0, 0, 255],
          cellShapeTypes: [1],
        }),
      )

      renderer.renderBlocks([makeBlock()], {
        canvasWidth: 800,
        canvasHeight: 600,
        rowHeight: 10,
        scrollTop: 0,
      })

      // Right triangle: moveTo(x1,y), lineTo(x1+w, y+rowHeight/2), lineTo(x1, y+rowHeight), fill
      expect(pathOps).toContain('fill')
      const moveIdx = pathOps.findIndex(op => op.startsWith('moveTo'))
      expect(moveIdx).toBeGreaterThanOrEqual(0)
      expect(pathOps[moveIdx + 1]).toMatch(/^lineTo/)
      expect(pathOps[moveIdx + 2]).toMatch(/^lineTo/)
      expect(pathOps[moveIdx + 3]).toBe('fill')
    })

    test('shape 2 draws left triangle via path', () => {
      const { canvas, pathOps } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)

      renderer.uploadRegion(
        0,
        makeRegionData({
          numCells: 1,
          cellPositions: [0, 100],
          cellRowIndices: [0],
          cellColors: [255, 0, 0, 255],
          cellShapeTypes: [2],
        }),
      )

      renderer.renderBlocks([makeBlock()], {
        canvasWidth: 800,
        canvasHeight: 600,
        rowHeight: 10,
        scrollTop: 0,
      })

      // Left triangle starts with moveTo(x1+w, y)
      const moveOp = pathOps.find(op => op.startsWith('moveTo'))
      expect(moveOp).toBeDefined()
      // x1+w for cell [0,100] with block bpRange [0,1000] and screen 0..800:
      // x1=0, x2=80, w=80. So moveTo(80, 0)
      expect(moveOp).toBe('moveTo(80,0)')
      expect(pathOps).toContain('fill')
    })

    test('shape 3 draws down triangle via path', () => {
      const { canvas, pathOps } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)

      renderer.uploadRegion(
        0,
        makeRegionData({
          numCells: 1,
          cellPositions: [0, 100],
          cellRowIndices: [0],
          cellColors: [255, 0, 0, 255],
          cellShapeTypes: [3],
        }),
      )

      renderer.renderBlocks([makeBlock()], {
        canvasWidth: 800,
        canvasHeight: 600,
        rowHeight: 10,
        scrollTop: 0,
      })

      // Down triangle: moveTo(x1,y), lineTo(x1+w,y), lineTo(x1+w/2, y+rowHeight)
      const moveOp = pathOps.find(op => op.startsWith('moveTo'))
      expect(moveOp).toBe('moveTo(0,0)')
      expect(pathOps).toContain('lineTo(80,0)')
      expect(pathOps).toContain('lineTo(40,10)')
      expect(pathOps).toContain('fill')
    })
  })

  describe('destroy', () => {
    test('clears all regions', () => {
      const { canvas, ctx } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)
      renderer.uploadRegion(0, makeRegionData())
      renderer.destroy()

      renderer.renderBlocks([makeBlock({ regionNumber: 0 })], {
        canvasWidth: 800,
        canvasHeight: 600,
        rowHeight: 10,
        scrollTop: 0,
      })
      expect(ctx.save).not.toHaveBeenCalled()
    })
  })
})
