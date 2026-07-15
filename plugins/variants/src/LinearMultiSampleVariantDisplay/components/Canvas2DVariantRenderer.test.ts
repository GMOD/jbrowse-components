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
    test('inversion (SHAPE_TRI_LEFT) draws a left-pointing triangle via path', () => {
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

      // Left triangle: moveTo(x1+w, y), lineTo(x1, y+rowHeight/2), lineTo(x1+w,
      // y+rowHeight), fill.
      const moveOp = pathOps.find(op => op.startsWith('moveTo'))
      expect(moveOp).toBe('moveTo(80,0)')
      expect(pathOps).toContain('lineTo(0,5)')
      expect(pathOps).toContain('lineTo(80,10)')
      expect(pathOps).toContain('fill')
    })
  })

  // On a reversed (horizontally-flipped) region makeBpMapper mirrors bp→px, so
  // the same feature lands on the opposite side of the block with its full span
  // intact. This locks in the min/abs geometry the GPU shader (variant.slang)
  // mirrors — regressing either path collapses a reversed variant to a sliver.
  describe('reversed regions', () => {
    test('rect keeps its full span, mirrored to the opposite edge', () => {
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

      renderer.renderBlocks(
        [makeBlock({ reversed: true })],
        regions,
        DEFAULT_STATE,
      )

      // Forward this cell is x=80,w=80; reversed it mirrors to the right edge
      // (800 - 200*0.8 = 640) with the same 80px width — not a collapsed sliver.
      expect(fillRectCalls.length).toBe(1)
      const [x, y, w, h] = fillRectCalls[0]!
      expect(x).toBeCloseTo(640)
      expect(w).toBeCloseTo(80)
      expect(y).toBe(0)
      expect(h).toBe(10)
    })
  })
})
