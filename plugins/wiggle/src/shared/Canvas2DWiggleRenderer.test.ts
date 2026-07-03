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

import type { SourceRenderData } from '@jbrowse/wiggle-core'

function createMockCanvas() {
  const fillRectCalls: [number, number, number, number][] = []
  const rectCalls: [number, number, number, number][] = []
  const arcCalls: [number, number, number][] = []
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
    rect: jest.fn((x: number, y: number, w: number, h: number) => {
      rectCalls.push([x, y, w, h])
    }),
    arc: jest.fn((x: number, y: number, r: number) => {
      arcCalls.push([x, y, r])
    }),
    fill: jest.fn(),
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
  return { canvas, ctx, fillRectCalls, rectCalls, arcCalls }
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

  const defaultBlock = {
    displayedRegionIndex: 0,
    start: 0,
    end: 1000,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
  }
  const defaultState = {
    domainY: [0, 10] as [number, number],
    scaleType: SCALE_TYPE_LINEAR,
    renderingType: RENDERING_TYPE_XYPLOT,
    canvasWidth: 800,
    canvasHeight: 200,
    numRows: 1,
    scatterPointSize: 2,
  }

  test('renderBlocks draws XY plot rectangles', () => {
    const { canvas, ctx, fillRectCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source = makeSource([5, 8], [0, 500], [500, 1000])

    renderer.renderBlocks(
      [defaultBlock],
      new Map([[0, [source]]]),
      defaultState,
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
      [{ ...defaultBlock, displayedRegionIndex: 99 }],
      new Map(),
      defaultState,
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

    renderer.renderBlocks([defaultBlock], new Map([[0, [source]]]), {
      ...defaultState,
      renderingType: RENDERING_TYPE_DENSITY,
    })

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

    renderer.renderBlocks([defaultBlock], new Map([[0, [source]]]), {
      ...defaultState,
      renderingType: RENDERING_TYPE_LINE,
    })

    expect(ctx.beginPath).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  test('renderBlocks scatter draws a bar for a wide bin', () => {
    const { canvas, rectCalls, arcCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    // 0..1000bp spans the whole 800px block, far wider than the 2px point
    const source = makeSource([5], [0], [1000])

    renderer.renderBlocks([defaultBlock], new Map([[0, [source]]]), {
      ...defaultState,
      renderingType: RENDERING_TYPE_SCATTER,
    })

    // exclude the full-height clip rect; scatter bars have height === pointSize
    const bars = rectCalls.filter(
      ([, , , h]) => h === defaultState.scatterPointSize,
    )
    expect(bars.length).toBe(1)
    expect(arcCalls.length).toBe(0)
  })

  test('renderBlocks scatter draws a small square for tiny point-like bins', () => {
    const { canvas, rectCalls, arcCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    // a zero-width feature at bp 500 → x = 400px; the default 2px point is
    // below the small-point threshold, so a crisp square is drawn (not a disc)
    const source = makeSource([5], [500], [500])

    renderer.renderBlocks([defaultBlock], new Map([[0, [source]]]), {
      ...defaultState,
      renderingType: RENDERING_TYPE_SCATTER,
    })

    const squares = rectCalls.filter(
      ([, , , h]) => h === defaultState.scatterPointSize,
    )
    expect(squares.length).toBe(1)
    expect(arcCalls.length).toBe(0)
    // centered on the bp: x = cx - radius = 400 - 1
    expect(squares[0]![0]).toBeCloseTo(399)
  })

  test('renderBlocks scatter draws an AA disc for larger point sizes', () => {
    const { canvas, rectCalls, arcCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source = makeSource([5], [500], [500])

    renderer.renderBlocks([defaultBlock], new Map([[0, [source]]]), {
      ...defaultState,
      renderingType: RENDERING_TYPE_SCATTER,
      scatterPointSize: 8,
    })

    expect(arcCalls.length).toBe(1)
    const [cx, , r] = arcCalls[0]!
    expect(cx).toBeCloseTo(400)
    expect(r).toBeCloseTo(4)
    // no square rows (only the full-height clip rect)
    expect(rectCalls.filter(([, , , h]) => h === 8).length).toBe(0)
  })

  // Regression: a reversed block maps feature start→right edge, end→left edge,
  // so x1 > x2. The fill must span the full mirrored cell (left=min, w=|x2-x1|),
  // not collapse to the WIGGLE_MIN_PX floor anchored at the wrong edge.
  // bpRange [0,1000]→screen [0,800] reversed: bp 0→800px, bp 500→400px.
  test.each([
    ['xyplot', RENDERING_TYPE_XYPLOT],
    ['density', RENDERING_TYPE_DENSITY],
    ['scatter', RENDERING_TYPE_SCATTER],
  ])(
    'reversed block fills the full mirrored cell (%s)',
    (_name, renderingType) => {
      const { canvas, fillRectCalls, rectCalls } = createMockCanvas()
      Object.defineProperty(window, 'devicePixelRatio', {
        value: 1,
        writable: true,
      })

      const renderer = new Canvas2DWiggleRenderer(canvas)
      const source = makeSource([5], [0], [500])

      renderer.renderBlocks(
        [{ ...defaultBlock, reversed: true }],
        new Map([[0, [source]]]),
        { ...defaultState, renderingType },
      )

      // scatter draws its wide-bin bar via ctx.rect (filter out the full-height
      // clip rect); xyplot/density draw via fillRect
      const calls =
        renderingType === RENDERING_TYPE_SCATTER
          ? rectCalls.filter(([, , , h]) => h === defaultState.scatterPointSize)
          : fillRectCalls
      expect(calls.length).toBe(1)
      const [x, , w] = calls[0]!
      expect(x).toBeCloseTo(400)
      expect(w).toBeCloseTo(400.8)
    },
  )

  test('multi-row sources render at correct vertical offsets', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source0 = { ...makeSource([5], [0], [1000]), rowIndex: 0 }
    const source1 = { ...makeSource([8], [0], [1000]), rowIndex: 1 }

    renderer.renderBlocks([defaultBlock], new Map([[0, [source0, source1]]]), {
      ...defaultState,
      numRows: 2,
    })

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
  start: 0,
  end: 1000,
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
  numRows: 1,
  scatterPointSize: 2,
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
