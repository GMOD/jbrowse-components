import { abgrToCssRgba, cssColorToABGR } from '@jbrowse/core/util/colorBits'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
  getNiceDomain,
} from '@jbrowse/wiggle-core'

import {
  Canvas2DWiggleRenderer,
  drawWiggleToCtx,
} from './Canvas2DWiggleRenderer.ts'

import type {
  SourceRenderData,
  WiggleRenderingType,
} from '@jbrowse/wiggle-core'

function createMockCanvas() {
  const fillRectCalls: [number, number, number, number][] = []
  const rectCalls: [number, number, number, number][] = []
  const arcCalls: [number, number, number][] = []
  // The style in effect at each batch flush — how the per-instance color tests
  // tell one stroke/fill batch from the next.
  const strokeStyles: string[] = []
  const fillStyles: string[] = []
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
    fill: jest.fn(() => {
      fillStyles.push(ctx.fillStyle)
    }),
    clip: jest.fn(),
    stroke: jest.fn(() => {
      strokeStyles.push(ctx.strokeStyle)
    }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: '',
    lineCap: '',
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => ctx),
  } as unknown as HTMLCanvasElement
  return {
    canvas,
    ctx,
    fillRectCalls,
    rectCalls,
    arcCalls,
    strokeStyles,
    fillStyles,
  }
}

function makeSource(
  scores: number[],
  startBps: number[],
  endBps: number[],
  // The rendering this layer was ENCODED for, which is what both backends
  // branch on. It has to match the state each test draws with, because
  // production cannot separate them: `buildSourceRenderData` reads one
  // `gpuProps.renderingType` to choose the layer set AND to stamp every layer
  // with it. A fixture that sets them apart describes a frame that only exists
  // mid-switch, and `draws the plot its layers were encoded for` below is the
  // test that owns that case.
  renderingType: WiggleRenderingType = RENDERING_TYPE_XYPLOT,
) {
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
    renderingType,
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
    lineWidth: 1,
    origin: 0,
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

  test('bicolor pivot moves the bar baseline and flips growth direction', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    // domain [0,10], height 200 → scoreToY(s) = (1 - s/10) * 200. Pivot 5 puts
    // the baseline at y=100: score 8 grows up (top y=40, h=60), score 2 grows
    // down (top y=100, h=60).
    const source = makeSource([8, 2], [0, 500], [500, 1000])

    renderer.renderBlocks([defaultBlock], new Map([[0, [source]]]), {
      ...defaultState,
      origin: 5,
    })

    expect(fillRectCalls.length).toBe(2)
    expect(fillRectCalls[0]![1]).toBeCloseTo(40)
    expect(fillRectCalls[0]![3]).toBeCloseTo(60)
    expect(fillRectCalls[1]![1]).toBeCloseTo(100)
    expect(fillRectCalls[1]![3]).toBeCloseTo(60)
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
    const source = makeSource(
      [5, 8],
      [0, 500],
      [500, 1000],
      RENDERING_TYPE_LINE,
    )

    renderer.renderBlocks([defaultBlock], new Map([[0, [source]]]), {
      ...defaultState,
      renderingType: RENDERING_TYPE_LINE,
    })

    expect(ctx.beginPath).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  test('renderBlocks scatter draws a point for a wide bin, not a bar', () => {
    const { canvas, rectCalls, arcCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    // 0..1000bp spans the whole 800px block, far wider than the 2px point, but
    // scatter always draws a point marker centered on the midpoint (bp 500 →
    // 400px), never a bar spanning the bin
    const source = makeSource([5], [0], [1000], RENDERING_TYPE_SCATTER)

    renderer.renderBlocks([defaultBlock], new Map([[0, [source]]]), {
      ...defaultState,
      renderingType: RENDERING_TYPE_SCATTER,
    })

    // a single point-size square, not a wide bar (exclude the full-height clip
    // rect); default 2px point is below the small-point threshold → crisp square
    const squares = rectCalls.filter(
      ([, , , h]) => h === defaultState.scatterPointSize,
    )
    expect(squares.length).toBe(1)
    expect(squares[0]![2]).toBe(defaultState.scatterPointSize)
    // centered on the bp midpoint: x = cx - radius = 400 - 1
    expect(squares[0]![0]).toBeCloseTo(399)
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
    const source = makeSource([5], [500], [500], RENDERING_TYPE_SCATTER)

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
    const source = makeSource([5], [500], [500], RENDERING_TYPE_SCATTER)

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
  // so x1 > x2. The fill must span the full mirrored cell, not collapse to the
  // WIGGLE_MIN_PX floor anchored at the wrong edge.
  //
  // bpRange [0,1000]→screen [0,800] reversed: bp 0→800px, bp 500→400px, so the
  // true cell is [400,800]. The bar is anchored on the bin's *start* (x1=800,
  // matching extendToMinWidthX in wiggle.slang) and widened away from it, so the
  // WIGGLE_FUDGE_FACTOR overhang lands at 399.2 — past the bp-500 edge, which is
  // the seam with the next bin genomically. Forward it overhangs the other way,
  // for the same reason: a bar always bleeds into its genomic successor.
  test.each([
    ['xyplot', RENDERING_TYPE_XYPLOT],
    ['density', RENDERING_TYPE_DENSITY],
  ])(
    'reversed block fills the full mirrored cell (%s)',
    (_name, renderingType) => {
      const { canvas, fillRectCalls } = createMockCanvas()
      Object.defineProperty(window, 'devicePixelRatio', {
        value: 1,
        writable: true,
      })

      const renderer = new Canvas2DWiggleRenderer(canvas)
      const source = makeSource([5], [0], [500], renderingType)

      renderer.renderBlocks(
        [{ ...defaultBlock, reversed: true }],
        new Map([[0, [source]]]),
        { ...defaultState, renderingType },
      )

      expect(fillRectCalls.length).toBe(1)
      const [x, , w] = fillRectCalls[0]!
      expect(x).toBeCloseTo(399.2)
      expect(w).toBeCloseTo(400.8)
      // The anchored start edge is exact; only the fudge overhangs.
      expect(x + w).toBeCloseTo(800)
    },
  )

  // The case the start-edge anchor exists for. Zoomed out to 100kb over 800px a
  // 1bp bin is 0.008px, so even with the fudge it hits the WIGGLE_MIN_PX floor
  // and the anchor decides the whole placement. bp 50000 sits at x=400 in both
  // orientations, so the bar hangs off the opposite side of it depending on
  // which way the block runs — and both match the [x1, x1±1.5] the shader's
  // extendToMinWidthX produces exactly, the fudge being absorbed by the floor.
  test.each([
    ['forward', false, 400],
    ['reversed', true, 398.5],
  ])(
    'sub-floor bin is floored away from its start edge (%s)',
    (_n, rev, x0) => {
      const { canvas, fillRectCalls } = createMockCanvas()
      Object.defineProperty(window, 'devicePixelRatio', {
        value: 1,
        writable: true,
      })

      const renderer = new Canvas2DWiggleRenderer(canvas)
      renderer.renderBlocks(
        [{ ...defaultBlock, end: 100000, reversed: rev }],
        new Map([[0, [makeSource([5], [50000], [50001])]]]),
        defaultState,
      )

      expect(fillRectCalls.length).toBe(1)
      const [x, , w] = fillRectCalls[0]!
      expect(w).toBeCloseTo(1.5)
      expect(x).toBeCloseTo(x0)
    },
  )

  test('reversed block centers a scatter point on the mirrored midpoint', () => {
    const { canvas, rectCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    // feature 0..500bp reversed: bp 0→800px, bp 500→400px, midpoint → 600px
    const source = makeSource([5], [0], [500], RENDERING_TYPE_SCATTER)

    renderer.renderBlocks(
      [{ ...defaultBlock, reversed: true }],
      new Map([[0, [source]]]),
      { ...defaultState, renderingType: RENDERING_TYPE_SCATTER },
    )

    const squares = rectCalls.filter(
      ([, , , h]) => h === defaultState.scatterPointSize,
    )
    expect(squares.length).toBe(1)
    // centered on the mirrored midpoint: x = 600 - radius = 599
    expect(squares[0]![0]).toBeCloseTo(599)
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
  lineWidth: 1,
  origin: 0,
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
        rpcDataMap: new Map([
          [0, [makeSource([5], [0], [100], RENDERING_TYPE_LINE)]],
        ]),
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
        rpcDataMap: new Map([
          [0, [makeSource([5, 8], [0, 100], [100, 200], RENDERING_TYPE_LINE)]],
        ]),
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
        rpcDataMap: new Map([
          [0, [makeSource([5, 8], [0, 300], [100, 400], RENDERING_TYPE_LINE)]],
        ]),
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

// Whiskers attaches a per-instance packed color to every layer it emits, and
// the shader colors each instance from it. Only drawXYPlot used to read it, so
// line / linecenter / scatter painted a whole band in one tint — an on-screen
// (GPU) vs Canvas2D-fallback vs SVG-export divergence on signed data.
describe('per-instance colors reach every Canvas2D draw fn', () => {
  const red = cssColorToABGR('red')
  const blue = cssColorToABGR('blue')

  function drawTwoTone(renderingType: WiggleRenderingType) {
    const mock = createMockCanvas()
    // adjacent so the step-line stays one run: only the color splits the batch
    const source = {
      ...makeSource([5, 8], [0, 100], [100, 200], renderingType),
      colorsAbgr: new Uint32Array([red, blue]),
    }
    drawWiggleToCtx(
      mock.ctx as unknown as CanvasRenderingContext2D,
      {
        rpcDataMap: new Map([[0, [source]]]),
        encode: (s: SourceRenderData[]) => s,
      },
      [lineBlock],
      { ...lineState, renderingType },
    )
    return mock
  }

  test.each([
    ['line', RENDERING_TYPE_LINE],
    ['linecenter', RENDERING_TYPE_LINE_CENTER],
  ] as const)('%s strokes one batch per color', (_name, renderingType) => {
    const { strokeStyles } = drawTwoTone(renderingType)
    expect(strokeStyles).toEqual([abgrToCssRgba(red), abgrToCssRgba(blue)])
  })

  test('scatter fills one batch per color', () => {
    const { fillStyles } = drawTwoTone(RENDERING_TYPE_SCATTER)
    expect(fillStyles).toEqual([abgrToCssRgba(red), abgrToCssRgba(blue)])
  })

  test('xyplot switches fillStyle per feature', () => {
    const { ctx, fillRectCalls } = drawTwoTone(RENDERING_TYPE_XYPLOT)
    expect(fillRectCalls).toHaveLength(2)
    expect(ctx.fillStyle).toBe(abgrToCssRgba(blue))
  })

  // Without per-instance colors nothing changes: still one batch in the layer
  // color, so the common (non-whiskers) path keeps its single stroke/fill.
  test('a layer with no per-instance colors still draws in one batch', () => {
    const mock = createMockCanvas()
    drawWiggleToCtx(
      mock.ctx as unknown as CanvasRenderingContext2D,
      {
        rpcDataMap: new Map([
          [0, [makeSource([5, 8], [0, 100], [100, 200], RENDERING_TYPE_LINE)]],
        ]),
        encode: (s: SourceRenderData[]) => s,
      },
      [lineBlock],
      lineState,
    )
    expect(mock.strokeStyles).toEqual(['rgb(128,128,128)'])
  })
})

// The interpolated line bridges non-adjacent bins on purpose (sporadic gaps in
// reduced BigWig data must not dash it), so only a hole past the layer's
// gapLimitBp breaks the run. The threshold is computed once in
// buildSourceRenderData and carried on the layer, so these breaks land in the
// same places the GPU's NO_PREV_START encoding puts them.
describe('drawLineCenter gap breaks', () => {
  const centerState = {
    ...lineState,
    renderingType: RENDERING_TYPE_LINE_CENTER,
  }
  // block maps 1000bp onto 800px, so 1bp = 0.8px. Centers at 50, 150 and 700bp
  // => 40, 120 and 560px. The last gap is 550bp, the first 100bp.
  function drawWithLimit(gapLimitBp?: number) {
    const mock = createMockCanvas()
    drawWiggleToCtx(
      mock.ctx as unknown as CanvasRenderingContext2D,
      {
        rpcDataMap: new Map([
          [
            0,
            [
              {
                ...makeSource(
                  [5, 5, 5],
                  [0, 100, 650],
                  [100, 200, 750],
                  RENDERING_TYPE_LINE_CENTER,
                ),
                gapLimitBp,
              },
            ],
          ],
        ]),
        encode: (s: SourceRenderData[]) => s,
      },
      [lineBlock],
      centerState,
    )
    return mock.ctx
  }

  test('no limit connects every consecutive pair (previous behavior)', () => {
    const ctx = drawWithLimit()
    const moves = ctx.moveTo.mock.calls as [number, number][]
    const lines = ctx.lineTo.mock.calls as [number, number][]
    // one moveTo to open, then a segment to each subsequent midpoint
    expect(moves).toHaveLength(1)
    expect(moves[0]![0]).toBeCloseTo(40)
    expect(lines.map(l => l[0])).toEqual([40, 120, 560])
  })

  test('a hole past the limit restarts the run instead of drawing a chord', () => {
    // 300bp limit: the 100bp gap stays connected, the 550bp one breaks
    const ctx = drawWithLimit(300)
    const moves = ctx.moveTo.mock.calls as [number, number][]
    const lines = ctx.lineTo.mock.calls as [number, number][]
    expect(moves.map(m => m[0])).toEqual([40, 560])
    // no segment spans 120 -> 560; the second run opens with its own dot
    expect(lines.map(l => l[0])).toEqual([40, 120, 560])
    expect(lines.at(-1)).toEqual(moves.at(-1))
  })

  test('a limit wider than every gap leaves the line whole', () => {
    const ctx = drawWithLimit(10_000)
    expect(ctx.moveTo.mock.calls).toHaveLength(1)
  })
})

// The sub-1 log domain, end to end through the draw rather than through the
// normalizer: getNiceDomain deliberately keeps a log domain under 1 (a
// mappability track, a methylation fraction, any normalized ratio), and both
// backends used to floor the log at 1, so every bar in such a track drew with
// zero height along the baseline while the axis spread its ticks down the full
// plot. Nothing in the repo renders one — no config, fixture or figure spec has
// a log track under 1 — so this is where it gets looked at.
describe('a log domain entirely under 1', () => {
  const domainY = getNiceDomain({
    scaleType: 'log',
    domain: [0.01, 0.5],
    bounds: [undefined, undefined],
  })
  const logState = {
    domainY,
    scaleType: SCALE_TYPE_LOG,
    renderingType: RENDERING_TYPE_XYPLOT,
    canvasWidth: 800,
    canvasHeight: 200,
    numRows: 1,
    scatterPointSize: 2,
    lineWidth: 1,
    origin: 0,
  }

  function barHeights(scores: number[]) {
    const { ctx } = createMockCanvas()
    const starts = scores.map((_, i) => i * 100)
    drawWiggleToCtx(
      ctx as unknown as CanvasRenderingContext2D,
      {
        rpcDataMap: new Map([
          [
            0,
            [
              makeSource(
                scores,
                starts,
                starts.map(s => s + 100),
              ),
            ],
          ],
        ]),
        encode: (s: SourceRenderData[]) => s,
      },
      [lineBlock],
      logState,
    )
    return (ctx.fillRect.mock.calls as [number, number, number, number][]).map(
      ([, , , h]) => h,
    )
  }

  test('the domain nices to a real span under 1', () => {
    expect(domainY).toEqual([0.0078125, 0.5])
  })

  test('scans across the domain draw at increasing heights', () => {
    // one octave apart, so on a base-2 log axis the steps are even
    const heights = barHeights([0.015625, 0.0625, 0.25])
    expect(heights).toHaveLength(3)
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]!).toBeGreaterThan(heights[i - 1]!)
    }
    // and none of them collapsed onto the baseline, which is the whole bug
    expect(Math.min(...heights)).toBeGreaterThan(0)
  })

  test('the domain endpoints reach the floor and the ceiling', () => {
    const [atMin, atMax] = barHeights([domainY[0], domainY[1]])
    expect(atMin).toBe(0)
    expect(atMax).toBe(200)
  })
})

// The one frame where the layer and the state disagree. Encode and render are
// separate autoruns and render is registered first, so a plot-type switch shows
// a state that has moved over a region that has not — and this backend has to
// answer it the way `GpuWiggleRenderer` does, by drawing what the layers were
// encoded FOR. Reading `state` instead pairs the new painter with the old
// layers, which is neither plot: the layer SET is chosen by the rendering
// (`buildSourceRenderData`'s `filled` splits whiskers by sign) and so is
// `gapLimitBp`.
//
// Only this test may build a source whose rendering differs from its state.
describe('a plot-type switch mid-frame', () => {
  test('draws the plot its layers were encoded for, not the state’s', () => {
    const { canvas, ctx, fillRectCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    // Layers encoded for xyplot; the state has already moved to linecenter.
    const source = makeSource(
      [5, 8],
      [0, 500],
      [500, 1000],
      RENDERING_TYPE_XYPLOT,
    )

    renderer.renderBlocks([lineBlock], new Map([[0, [source]]]), {
      ...lineState,
      renderingType: RENDERING_TYPE_LINE_CENTER,
    })

    // Bars, because that is what these layers are. A stroked path here would be
    // the interpolated line drawn over whiskers bands split for stacking.
    expect(fillRectCalls).toHaveLength(2)
    expect(ctx.stroke).not.toHaveBeenCalled()
  })
})
