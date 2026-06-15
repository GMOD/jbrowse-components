import { Canvas2DVariantRenderer } from './Canvas2DVariantRenderer.ts'

import type {
  VariantRenderBlock,
  VariantUploadData,
} from './variantRenderingBackendTypes.ts'

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

function makeBlock(
  overrides?: Partial<VariantRenderBlock>,
): VariantRenderBlock {
  return {
    displayedRegionIndex: 0,
    start: 0,
    end: 1000,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
    ...overrides,
  }
}

// Default opaque-white cell color (ABGR u32 — A=255 B=255 G=255 R=255).
const DEFAULT_COLOR = 0xffffffff

function makeRegionData(overrides?: {
  numCells?: number
  cellPositions?: number[]
  cellRowIndices?: number[]
  cellColors?: number[]
  cellShapeTypes?: number[]
}): VariantUploadData {
  const numCells = overrides?.numCells ?? 1
  return {
    cellPositions: new Uint32Array(
      overrides?.cellPositions ?? new Array(numCells * 2).fill(0),
    ),
    cellRowIndices: new Uint32Array(
      overrides?.cellRowIndices ?? new Array(numCells).fill(0),
    ),
    cellColors: new Uint32Array(
      overrides?.cellColors ?? new Array(numCells).fill(DEFAULT_COLOR),
    ),
    cellShapeTypes: new Uint8Array(
      overrides?.cellShapeTypes ?? new Array(numCells).fill(0),
    ),
    numCells,
  }
}

const DEFAULT_STATE = {
  canvasWidth: 800,
  canvasHeight: 600,
  rowHeight: 10,
  scrollTop: 0,
}

describe('Canvas2DVariantRenderer', () => {
  describe('renderBlocks', () => {
    test('renders a rect cell with fillRect', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)
      const regions = new Map([
        [
          0,
          makeRegionData({
            numCells: 1,
            cellPositions: [100, 200],
            cellRowIndices: [0],
            cellColors: [0xff0000ff],
            cellShapeTypes: [0],
          }),
        ],
      ])

      renderer.renderBlocks([makeBlock()], regions, DEFAULT_STATE)

      expect(fillRectCalls.length).toBe(1)
      const [x, y, w, h] = fillRectCalls[0]!
      expect(x).toBeCloseTo(80)
      expect(y).toBe(0)
      expect(w).toBeCloseTo(80)
      expect(h).toBe(10)
    })

    test('skips empty regions (numCells === 0)', () => {
      const { canvas, ctx } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)
      const regions = new Map([[0, makeRegionData({ numCells: 0 })]])

      renderer.renderBlocks(
        [makeBlock({ displayedRegionIndex: 0 })],
        regions,
        DEFAULT_STATE,
      )

      expect(ctx.save).not.toHaveBeenCalled()
    })

    test('skips blocks with no region in the map', () => {
      const { canvas, ctx } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)
      const regions = new Map([[1, makeRegionData()]])

      renderer.renderBlocks(
        [
          makeBlock({ displayedRegionIndex: 0 }),
          makeBlock({ displayedRegionIndex: 1 }),
          makeBlock({ displayedRegionIndex: 2 }),
        ],
        regions,
        DEFAULT_STATE,
      )

      // save is only called once (for region 1)
      expect(ctx.save).toHaveBeenCalledTimes(1)
    })

    test('skips cells outside viewport (y + rowHeight < 0)', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)
      const regions = new Map([
        [
          0,
          makeRegionData({
            numCells: 1,
            cellPositions: [0, 100],
            cellRowIndices: [0],
            cellColors: [0xff0000ff],
            cellShapeTypes: [0],
          }),
        ],
      ])

      // scrollTop of 100 means y = 0*10 - 100 = -100, and y+rowHeight = -90 < 0
      renderer.renderBlocks([makeBlock()], regions, {
        ...DEFAULT_STATE,
        scrollTop: 100,
      })

      expect(fillRectCalls.length).toBe(0)
    })

    test('skips cells outside viewport (y > canvasHeight)', () => {
      const { canvas, fillRectCalls } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)
      const regions = new Map([
        [
          0,
          makeRegionData({
            numCells: 1,
            cellPositions: [0, 100],
            cellRowIndices: [100],
            cellColors: [0xff0000ff],
            cellShapeTypes: [0],
          }),
        ],
      ])

      // y = 100*10 - 0 = 1000 > 600
      renderer.renderBlocks([makeBlock()], regions, DEFAULT_STATE)

      expect(fillRectCalls.length).toBe(0)
    })
  })

  describe('shape types', () => {
    test('shape 1 draws right triangle via path', () => {
      const { canvas, pathOps } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)
      const regions = new Map([
        [
          0,
          makeRegionData({
            numCells: 1,
            cellPositions: [0, 100],
            cellRowIndices: [0],
            cellColors: [0xff0000ff],
            cellShapeTypes: [1],
          }),
        ],
      ])

      renderer.renderBlocks([makeBlock()], regions, DEFAULT_STATE)

      // Right triangle: moveTo(x1,y), lineTo(x1+w, y+rowHeight/2), lineTo(x1, y+rowHeight), fill
      expect(pathOps).toContain('fill')
      const moveIdx = pathOps.findIndex(op => op.startsWith('moveTo'))
      expect(moveIdx).toBeGreaterThanOrEqual(0)
      expect(pathOps[moveIdx + 1]).toMatch(/^lineTo/)
      expect(pathOps[moveIdx + 2]).toMatch(/^lineTo/)
      expect(pathOps.indexOf('fill', moveIdx)).toBeGreaterThan(moveIdx + 2)
    })

    test('shape 2 draws left triangle via path', () => {
      const { canvas, pathOps } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)
      const regions = new Map([
        [
          0,
          makeRegionData({
            numCells: 1,
            cellPositions: [0, 100],
            cellRowIndices: [0],
            cellColors: [0xff0000ff],
            cellShapeTypes: [2],
          }),
        ],
      ])

      renderer.renderBlocks([makeBlock()], regions, DEFAULT_STATE)

      // Left triangle starts with moveTo(x1+w, y)
      const moveOp = pathOps.find(op => op.startsWith('moveTo'))
      expect(moveOp).toBeDefined()
      expect(moveOp).toBe('moveTo(80,0)')
      expect(pathOps).toContain('fill')
    })

    test('shape 3 zoomed in draws a full down triangle', () => {
      const { canvas, pathOps } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)
      const regions = new Map([
        [
          0,
          makeRegionData({
            numCells: 1,
            cellPositions: [0, 100],
            cellRowIndices: [0],
            cellColors: [0xff0000ff],
            cellShapeTypes: [3],
          }),
        ],
      ])

      renderer.renderBlocks([makeBlock()], regions, DEFAULT_STATE)

      // span = 80px ≥ INS_TRI_SPAN_PX so triBlend = 1: a triangle whose base
      // is capped at INS_TRI_SPAN_PX (10px), centered on the span center (px
      // 40), collapsing to an apex (bottom width 0) at that same center.
      const moveOp = pathOps.find(op => op.startsWith('moveTo'))
      expect(moveOp).toBe('moveTo(35,0)')
      expect(pathOps).toContain('lineTo(45,0)')
      expect(pathOps).toContain('lineTo(40,10)')
      expect(pathOps).toContain('fill')
    })

    test('shape 3 zoomed out collapses to a thin vertical line', () => {
      const { canvas, pathOps } = createMockCanvas()
      const renderer = new Canvas2DVariantRenderer(canvas)
      const regions = new Map([
        [
          0,
          // 1bp span; the 800bp/800px block below is 1px/bp, so the span is 1px
          // on screen — below INS_LINE_SPAN_PX, so the glyph is a full-height
          // 2px-wide box rather than a triangle.
          makeRegionData({
            numCells: 1,
            cellPositions: [500, 501],
            cellRowIndices: [0],
            cellColors: [0xff0000ff],
            cellShapeTypes: [3],
          }),
        ],
      ])

      renderer.renderBlocks([makeBlock({ end: 800 })], regions, DEFAULT_STATE)

      // center = px 500.5; topWidth == bottomWidth == 2 (a rectangle, not a
      // triangle): top and bottom edges are equal width.
      const moveOp = pathOps.find(op => op.startsWith('moveTo'))
      expect(moveOp).toBe('moveTo(499.5,0)')
      expect(pathOps).toContain('lineTo(501.5,0)')
      expect(pathOps).toContain('lineTo(501.5,10)')
      expect(pathOps).toContain('lineTo(499.5,10)')
      expect(pathOps).toContain('fill')
    })
  })
})
