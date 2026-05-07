import {
  Canvas2DWiggleRenderer,
  drawWiggleToCtx,
} from './Canvas2DWiggleRenderer.ts'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
  SCALE_TYPE_LINEAR,
} from './wiggleComponentUtils.ts'

import type { SourceRenderData } from './wiggleBackendTypes.ts'

function createMockCanvas() {
  const fillRectCalls: [number, number, number, number][] = []
  const ctx = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    fillRect: jest.fn((x: number, y: number, w: number, h: number) => {
      fillRectCalls.push([x, y, w, h])
    }),
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    stroke: jest.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => ctx),
  } as unknown as HTMLCanvasElement
  return { canvas, ctx, fillRectCalls }
}

function makeSource(scores: number[], startBps: number[], endBps: number[]) {
  const positions = new Uint32Array(scores.length * 2)
  for (let i = 0; i < scores.length; i++) {
    positions[i * 2] = startBps[i]!
    positions[i * 2 + 1] = endBps[i]!
  }
  return {
    featurePositions: positions,
    featureScores: new Float32Array(scores),
    numFeatures: scores.length,
    color: [0.5, 0.5, 0.5] as [number, number, number],
    rowIndex: 0,
  }
}

describe('Canvas2DWiggleRenderer', () => {
  test('constructor throws if 2d context unavailable', () => {
    const canvas = {
      getContext: jest.fn(() => null),
    } as unknown as HTMLCanvasElement
    expect(() => new Canvas2DWiggleRenderer(canvas)).toThrow(
      'Canvas 2D context not available',
    )
  })

  test('uploadRegion stores data and deletes on empty', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source = makeSource([5], [0], [100])

    renderer.uploadRegion(0, [source])
    // Render to verify data is present (should not throw)
    renderer.renderBlocks(
      [
        {
          displayedRegionIndex: 0,
          bpRangeX: [0, 1000],
          screenStartPx: 0,
          screenEndPx: 800,
          reversed: false,
        },
      ],
      {
        domainY: [0, 10],
        scaleType: SCALE_TYPE_LINEAR,
        renderingType: RENDERING_TYPE_XYPLOT,
        canvasWidth: 800,
        canvasHeight: 200,
      },
    )

    // Upload empty source list → should remove region
    renderer.uploadRegion(0, [])
  })

  test('renderBlocks draws XY plot rectangles', () => {
    const { canvas, ctx, fillRectCalls } = createMockCanvas()
    // Mock devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source = makeSource([5, 8], [0, 500], [500, 1000])

    renderer.uploadRegion(0, [source])
    renderer.renderBlocks(
      [
        {
          displayedRegionIndex: 0,
          bpRangeX: [0, 1000],
          screenStartPx: 0,
          screenEndPx: 800,
          reversed: false,
        },
      ],
      {
        domainY: [0, 10],
        scaleType: SCALE_TYPE_LINEAR,
        renderingType: RENDERING_TYPE_XYPLOT,
        canvasWidth: 800,
        canvasHeight: 200,
      },
    )

    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 800, 200)
    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.clip).toHaveBeenCalled()
    expect(ctx.restore).toHaveBeenCalled()
    expect(fillRectCalls.length).toBe(2)
  })

  test('renderBlocks skips regions with no data', () => {
    const { canvas, ctx } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    renderer.renderBlocks(
      [
        {
          displayedRegionIndex: 99,
          bpRangeX: [0, 1000],
          screenStartPx: 0,
          screenEndPx: 800,
          reversed: false,
        },
      ],
      {
        domainY: [0, 10],
        scaleType: SCALE_TYPE_LINEAR,
        renderingType: RENDERING_TYPE_XYPLOT,
        canvasWidth: 800,
        canvasHeight: 200,
      },
    )

    expect(ctx.save).not.toHaveBeenCalled()
  })

  test('renderBlocks handles density rendering type', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source = makeSource([5], [0], [1000])

    renderer.uploadRegion(0, [source])
    renderer.renderBlocks(
      [
        {
          displayedRegionIndex: 0,
          bpRangeX: [0, 1000],
          screenStartPx: 0,
          screenEndPx: 800,
          reversed: false,
        },
      ],
      {
        domainY: [0, 10],
        scaleType: SCALE_TYPE_LINEAR,
        renderingType: RENDERING_TYPE_DENSITY,
        canvasWidth: 800,
        canvasHeight: 200,
      },
    )

    expect(fillRectCalls.length).toBe(1)
  })

  test('renderBlocks handles line rendering type', () => {
    const { canvas, ctx } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source = makeSource([5, 8], [0, 500], [500, 1000])

    renderer.uploadRegion(0, [source])
    renderer.renderBlocks(
      [
        {
          displayedRegionIndex: 0,
          bpRangeX: [0, 1000],
          screenStartPx: 0,
          screenEndPx: 800,
          reversed: false,
        },
      ],
      {
        domainY: [0, 10],
        scaleType: SCALE_TYPE_LINEAR,
        renderingType: RENDERING_TYPE_LINE,
        canvasWidth: 800,
        canvasHeight: 200,
      },
    )

    expect(ctx.beginPath).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  test('renderBlocks handles scatter rendering type', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source = makeSource([5], [0], [1000])

    renderer.uploadRegion(0, [source])
    renderer.renderBlocks(
      [
        {
          displayedRegionIndex: 0,
          bpRangeX: [0, 1000],
          screenStartPx: 0,
          screenEndPx: 800,
          reversed: false,
        },
      ],
      {
        domainY: [0, 10],
        scaleType: SCALE_TYPE_LINEAR,
        renderingType: RENDERING_TYPE_SCATTER,
        canvasWidth: 800,
        canvasHeight: 200,
      },
    )

    expect(fillRectCalls.length).toBe(1)
  })

  test('pruneRegions removes inactive regions', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    renderer.uploadRegion(0, [makeSource([5], [0], [1000])])
    renderer.uploadRegion(1, [makeSource([8], [0], [1000])])

    renderer.pruneRegions([0])

    renderer.renderBlocks(
      [
        {
          displayedRegionIndex: 0,
          bpRangeX: [0, 1000],
          screenStartPx: 0,
          screenEndPx: 400,
          reversed: false,
        },
        {
          displayedRegionIndex: 1,
          bpRangeX: [1000, 2000],
          screenStartPx: 400,
          screenEndPx: 800,
          reversed: false,
        },
      ],
      {
        domainY: [0, 10],
        scaleType: SCALE_TYPE_LINEAR,
        renderingType: RENDERING_TYPE_XYPLOT,
        canvasWidth: 800,
        canvasHeight: 200,
      },
    )

    // Only region 0 should render (region 1 was pruned)
    expect(fillRectCalls.length).toBe(1)
  })

  test('dispose clears all regions', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DWiggleRenderer(canvas)
    renderer.uploadRegion(0, [makeSource([5], [0], [1000])])
    renderer.dispose()
  })

  test('multi-row sources render at correct vertical offsets', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source0 = { ...makeSource([5], [0], [1000]), rowIndex: 0 }
    const source1 = { ...makeSource([8], [0], [1000]), rowIndex: 1 }

    renderer.uploadRegion(0, [source0, source1])
    renderer.renderBlocks(
      [
        {
          displayedRegionIndex: 0,
          bpRangeX: [0, 1000],
          screenStartPx: 0,
          screenEndPx: 800,
          reversed: false,
        },
      ],
      {
        domainY: [0, 10],
        scaleType: SCALE_TYPE_LINEAR,
        renderingType: RENDERING_TYPE_XYPLOT,
        canvasWidth: 800,
        canvasHeight: 200,
      },
    )

    expect(fillRectCalls.length).toBe(2)
    // First source in top half (0-100px), second in bottom half (100-200px)
    expect(fillRectCalls[0]![1]).toBeLessThan(100)
    expect(fillRectCalls[1]![1]).toBeGreaterThanOrEqual(100)
  })
})

// Test parameters: bpRange [0,1000]→screen [0,800], domain [0,10], height 200.
// x = bp * 0.8, scoreY = (1 - score/10) * 200, zeroY = 200.
const lineBlock = {
  displayedRegionIndex: 0,
  bpRangeX: [0, 1000] as [number, number],
  screenStartPx: 0,
  screenEndPx: 800,
  reversed: false,
}
const lineState = {
  domainY: [0, 10] as [number, number],
  scaleType: SCALE_TYPE_LINEAR,
  renderingType: RENDERING_TYPE_LINE,
  canvasWidth: 800,
  canvasHeight: 200,
}
const zeroY = 200
const score5Y = 100
// Computed with same formula as renderer to stay consistent under float rounding.
const score8Y = (1 - 8 / 10) * 200

describe('drawLine path commands', () => {
  test('isolated feature: rise at x1, horizontal, drop at x2', () => {
    const { ctx } = createMockCanvas()
    drawWiggleToCtx(
      ctx as unknown as CanvasRenderingContext2D,
      {
        rpcDataMap: new Map([[0, [makeSource([5], [0], [100])]]]),
        encode: (s: SourceRenderData[]) => s,
      },
      [lineBlock],
      lineState,
    )

    const moves = ctx.moveTo.mock.calls as [number, number][]
    const lines = ctx.lineTo.mock.calls as [number, number][]
    // Single connected polyline: anchor at zero, rise, horizontal, drop.
    expect(moves).toHaveLength(1)
    expect(lines).toHaveLength(3)

    expect(moves[0]).toEqual([0, zeroY])
    expect(lines[0]).toEqual([0, score5Y])
    expect(lines[1]).toEqual([80, score5Y])
    expect(lines[2]).toEqual([80, zeroY])
  })

  test('adjacent pair: transition at junction, drop only at end', () => {
    const { ctx } = createMockCanvas()
    drawWiggleToCtx(
      ctx as unknown as CanvasRenderingContext2D,
      {
        rpcDataMap: new Map([[0, [makeSource([5, 8], [0, 100], [100, 200])]]]),
        encode: (s: SourceRenderData[]) => s,
      },
      [lineBlock],
      lineState,
    )

    const moves = ctx.moveTo.mock.calls as [number, number][]
    const lines = ctx.lineTo.mock.calls as [number, number][]
    // Single connected polyline since adjacent: one moveTo, five lineTo.
    expect(moves).toHaveLength(1)
    expect(lines).toHaveLength(5)

    // Rise from zero for first feature
    expect(moves[0]).toEqual([0, zeroY])
    expect(lines[0]).toEqual([0, score5Y])
    expect(lines[1]).toEqual([80, score5Y])

    // Vertical step at junction x=80 from prev scoreY (proves adjacency)
    expect(lines[2]![0]).toBe(80)
    expect(lines[2]![1]).toBeCloseTo(score8Y)
    expect(lines[3]![0]).toBe(160)
    expect(lines[3]![1]).toBeCloseTo(score8Y)

    // Drop to zero only at end (x=160)
    expect(lines[4]).toEqual([160, zeroY])
  })

  test('non-adjacent features: each has its own rise from zero and drop to zero', () => {
    const { ctx } = createMockCanvas()
    // gap between bp 100 and 300
    drawWiggleToCtx(
      ctx as unknown as CanvasRenderingContext2D,
      {
        rpcDataMap: new Map([[0, [makeSource([5, 8], [0, 300], [100, 400])]]]),
        encode: (s: SourceRenderData[]) => s,
      },
      [lineBlock],
      lineState,
    )

    const moves = ctx.moveTo.mock.calls as [number, number][]
    const lines = ctx.lineTo.mock.calls as [number, number][]
    // Two disjoint runs: 2 moveTos, each run has rise/horiz/drop = 3 lineTos.
    expect(moves).toHaveLength(2)
    expect(lines).toHaveLength(6)

    // Feature 0: anchor at zero, rise, horizontal, drop
    expect(moves[0]).toEqual([0, zeroY])
    expect(lines[0]).toEqual([0, score5Y])
    expect(lines[1]).toEqual([80, score5Y])
    expect(lines[2]).toEqual([80, zeroY])

    // Feature 1 rise from zero at x=240 (proves gap handling)
    expect(moves[1]).toEqual([240, zeroY])
    expect(lines[3]![0]).toBe(240)
    expect(lines[3]![1]).toBeCloseTo(score8Y)
    expect(lines[5]).toEqual([320, zeroY])
  })
})
