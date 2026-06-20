import { Canvas2DSyntenyRenderer } from './Canvas2DSyntenyRenderer.ts'

import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

function createMockCanvas() {
  const pathOps: string[] = []
  const ctx = {
    setTransform: jest.fn(),
    fillRect: jest.fn(),
    beginPath: jest.fn(() => pathOps.push('beginPath')),
    moveTo: jest.fn((x: number, y: number) =>
      pathOps.push(`moveTo(${x.toFixed(1)},${y.toFixed(1)})`),
    ),
    lineTo: jest.fn((x: number, y: number) =>
      pathOps.push(`lineTo(${x.toFixed(1)},${y.toFixed(1)})`),
    ),
    bezierCurveTo: jest.fn(
      (
        cp1x: number,
        cp1y: number,
        cp2x: number,
        cp2y: number,
        x: number,
        y: number,
      ) =>
        pathOps.push(
          `bezierCurveTo(${cp1x.toFixed(1)},${cp1y.toFixed(1)},${cp2x.toFixed(1)},${cp2y.toFixed(1)},${x.toFixed(1)},${y.toFixed(1)})`,
        ),
    ),
    closePath: jest.fn(() => pathOps.push('closePath')),
    fill: jest.fn(() => pathOps.push('fill')),
    stroke: jest.fn(),
    isPointInPath: jest.fn(() => false),
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
  return { canvas, ctx, pathOps }
}

function bpHiLo(values: number[]) {
  const hi = new Float32Array(values.length)
  const lo = new Float32Array(values)
  return { hi, lo }
}

function makeInstanceData(
  count: number,
  overrides?: Partial<SyntenyInstanceData>,
): SyntenyInstanceData {
  const c1 = bpHiLo(Array.from({ length: count }, () => 10))
  const c2 = bpHiLo(Array.from({ length: count }, () => 100))
  const c3 = bpHiLo(Array.from({ length: count }, () => 110))
  const c4 = bpHiLo(Array.from({ length: count }, () => 20))
  return {
    bp1Hi: c1.hi,
    bp1Lo: c1.lo,
    bp2Hi: c2.hi,
    bp2Lo: c2.lo,
    bp3Hi: c3.hi,
    bp3Lo: c3.lo,
    bp4Hi: c4.hi,
    bp4Lo: c4.lo,
    colors: new Uint32Array(count).fill(0x80808080),
    kinds: new Uint8Array(count),
    instanceFeatureIdx: new Uint32Array(count),
    alignmentLengths: new Float32Array(count).fill(10000),
    instanceCount: count,
    ...overrides,
  }
}

function makeParams(
  overrides?: Partial<SyntenyTrackRenderParams>,
): SyntenyTrackRenderParams {
  return {
    yTop: 0,
    height: 100,
    alpha: 1,
    minAlignmentLength: 0,
    hoveredFeatureId: 0,
    clickedFeatureId: 0,
    offsetPx0: 0,
    offsetPx1: 0,
    bpPerPx0: 1,
    bpPerPx1: 1,
    drawCurves: false,
    ...overrides,
  }
}

function makeState(
  perTrack: [number, SyntenyTrackRenderParams][],
  overdrawPx = 300,
): SyntenyRenderState {
  return { overdrawPx, perTrack: new Map(perTrack) }
}

describe('Canvas2DSyntenyRenderer', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })
  })

  test('constructor throws if 2d context unavailable', () => {
    const canvas = {
      getContext: jest.fn(() => null),
    } as unknown as HTMLCanvasElement
    expect(() => new Canvas2DSyntenyRenderer(canvas)).toThrow(
      'Canvas 2D context not available',
    )
  })

  test('render with no uploaded geometry does nothing', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.render(makeState([[0, makeParams()]]))
    expect(ctx.beginPath).not.toHaveBeenCalled()
  })

  test('render draws linear parallelogram for straight features', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.render(makeState([[0, makeParams()]]))

    expect(pathOps.filter(op => op === 'beginPath')).toHaveLength(1)
    expect(pathOps.filter(op => op === 'fill')).toHaveLength(1)
    expect(pathOps.filter(op => op === 'closePath')).toHaveLength(1)
  })

  test('bakes yTop into draw coordinates rather than the canvas transform', () => {
    // Regression: the SVG-export raster pre-scales the canvas via ctx.scale(dpr),
    // so drawSyntenyTrack must NOT own the transform (a setTransform there
    // clobbered the raster scale and rendered the ribbon at half size). It draws
    // in logical coords with yTop folded into the y values instead.
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 300
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 300)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.render(makeState([[0, makeParams({ yTop: 100, height: 100 })]]))

    // straight-feature path: top edge at y=yTop (100), bottom at yTop+height (200)
    const ys = pathOps
      .filter(op => op.startsWith('moveTo') || op.startsWith('lineTo'))
      .map(op => Number(/,([\d.]+)\)/.exec(op)![1]))
    expect(Math.min(...ys)).toBeCloseTo(100)
    expect(Math.max(...ys)).toBeCloseTo(200)
  })

  test('render draws curved features with native cubic beziers', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.render(makeState([[0, makeParams({ drawCurves: true })]]))

    const bezierCount = pathOps.filter(op =>
      op.startsWith('bezierCurveTo'),
    ).length
    expect(bezierCount).toBe(2)
  })

  test('filters out features below minAlignmentLength', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(
      0,
      makeInstanceData(1, { alignmentLengths: new Float32Array([100]) }),
    )
    renderer.render(makeState([[0, makeParams({ minAlignmentLength: 500 })]]))

    expect(pathOps.filter(op => op === 'fill')).toHaveLength(0)
  })

  test('skips features with zero alpha', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(
      0,
      makeInstanceData(1, { colors: new Uint32Array([0x00808080]) }),
    )
    renderer.render(makeState([[0, makeParams()]]))

    expect(pathOps.filter(op => op === 'fill')).toHaveLength(0)
  })

  test('culls features outside viewport', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    const c1 = bpHiLo([5000])
    const c2 = bpHiLo([6000])
    const c3 = bpHiLo([6000])
    const c4 = bpHiLo([5000])
    renderer.uploadGeometry(
      0,
      makeInstanceData(1, {
        bp1Hi: c1.hi,
        bp1Lo: c1.lo,
        bp2Hi: c2.hi,
        bp2Lo: c2.lo,
        bp3Hi: c3.hi,
        bp3Lo: c3.lo,
        bp4Hi: c4.hi,
        bp4Lo: c4.lo,
      }),
    )
    renderer.render(makeState([[0, makeParams()]]))

    expect(pathOps.filter(op => op === 'fill')).toHaveLength(0)
  })

  test('draws stroke for clicked features', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.render(makeState([[0, makeParams({ clickedFeatureId: 1 })]]))

    expect(ctx.stroke).toHaveBeenCalled()
  })

  test('clicked outline strokes only side edges, not top/bottom (GPU parity)', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.render(makeState([[0, makeParams({ clickedFeatureId: 1 })]]))

    // Path ops after the fill belong to the clicked outline. The GPU edge
    // passes outline only the two connecting edges (left sx1→sx4, right
    // sx2→sx3) — two disjoint subpaths, no top/bottom genome-axis edges and
    // no closing edge.
    const outline = pathOps.slice(pathOps.indexOf('fill') + 1)
    expect(outline).toEqual([
      'beginPath',
      'moveTo(10.0,0.0)',
      'lineTo(20.0,100.0)',
      'moveTo(100.0,0.0)',
      'lineTo(110.0,100.0)',
    ])
    expect(outline).not.toContain('closePath')
  })

  test('sub-pixel BASE ribbon fades its stroke alpha by on-screen width', () => {
    const { canvas, ctx } = createMockCanvas()
    const strokeAlphas: number[] = []
    ctx.stroke = jest.fn(() => {
      const m = /rgba\(\d+,\d+,\d+,([\d.]+)\)/.exec(ctx.strokeStyle)
      if (m) {
        strokeAlphas.push(+m[1]!)
      }
    })
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    // top width = |10.5-10| = 0.5px, bottom width = |20.5-20| = 0.5px → maxW 0.5
    const c1 = bpHiLo([10])
    const c2 = bpHiLo([10.5])
    const c3 = bpHiLo([20.5])
    const c4 = bpHiLo([20])
    renderer.uploadGeometry(
      0,
      makeInstanceData(1, {
        bp1Hi: c1.hi,
        bp1Lo: c1.lo,
        bp2Hi: c2.hi,
        bp2Lo: c2.lo,
        bp3Hi: c3.hi,
        bp3Lo: c3.lo,
        bp4Hi: c4.hi,
        bp4Lo: c4.lo,
        colors: new Uint32Array([0x80808080]),
      }),
    )
    renderer.render(makeState([[0, makeParams()]]))

    // base alpha 0x80/255, scaled by the 0.5px on-screen width
    expect(strokeAlphas).toHaveLength(1)
    expect(strokeAlphas[0]!).toBeCloseTo((0x80 / 255) * 0.5, 3)
  })

  test('deleteGeometry removes a track from rendering', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.deleteGeometry(0)
    renderer.render(makeState([[0, makeParams()]]))

    expect(pathOps.filter(op => op === 'fill')).toHaveLength(0)
  })

  test('multi-track render iterates all keys', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 200
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 200)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.uploadGeometry(1, makeInstanceData(1))
    renderer.render(
      makeState([
        [0, makeParams({ yTop: 0, height: 100 })],
        [1, makeParams({ yTop: 100, height: 100 })],
      ]),
    )

    expect(pathOps.filter(op => op === 'fill')).toHaveLength(2)
  })

  test('pick returns hit with key + featureIndex', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    const state = makeState([[0, makeParams()]])
    expect(renderer.pick(50, 50, state)).toEqual({ key: 0, featureIndex: 0 })
  })

  test('pick returns undefined when isPointInPath does not match', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => false)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    const state = makeState([[0, makeParams()]])
    expect(renderer.pick(50, 50, state)).toBeUndefined()
  })

  test('pick returns last feature when multiple overlap (top-most wins)', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(3))
    const state = makeState([[0, makeParams()]])
    expect(renderer.pick(50, 50, state)).toEqual({ key: 0, featureIndex: 2 })
  })

  test('pick prefers later track when multiple overlap', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 200
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 200)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.uploadGeometry(1, makeInstanceData(1))
    const state = makeState([
      [0, makeParams({ yTop: 0, height: 200 })],
      [1, makeParams({ yTop: 0, height: 200 })],
    ])
    expect(renderer.pick(50, 50, state)?.key).toBe(1)
  })

  test('pick respects per-track yTop range', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 200
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 200)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.uploadGeometry(1, makeInstanceData(1))
    const state = makeState([
      [0, makeParams({ yTop: 0, height: 100 })],
      [1, makeParams({ yTop: 100, height: 100 })],
    ])
    // y=50 is within track 0 only
    expect(renderer.pick(50, 50, state)?.key).toBe(0)
    // y=150 is within track 1 only
    expect(renderer.pick(50, 150, state)?.key).toBe(1)
  })

  test('pick skips features below minAlignmentLength', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(
      0,
      makeInstanceData(1, { alignmentLengths: new Float32Array([100]) }),
    )
    const state = makeState([[0, makeParams({ minAlignmentLength: 500 })]])
    expect(renderer.pick(50, 50, state)).toBeUndefined()
    expect(ctx.isPointInPath).not.toHaveBeenCalled()
  })

  test('pick skips features with zero alpha', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(
      0,
      makeInstanceData(1, { colors: new Uint32Array([0x00808080]) }),
    )
    const state = makeState([[0, makeParams()]])
    expect(renderer.pick(50, 50, state)).toBeUndefined()
    expect(ctx.isPointInPath).not.toHaveBeenCalled()
  })

  test('pick builds curve path for curved features', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    const state = makeState([[0, makeParams({ drawCurves: true })]])
    expect(renderer.pick(50, 50, state)).toEqual({ key: 0, featureIndex: 0 })
    expect(ctx.bezierCurveTo.mock.calls.length).toBeGreaterThan(0)
  })

  test('pick after dispose returns undefined (cache cleared)', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.dispose()
    const state = makeState([[0, makeParams()]])
    expect(renderer.pick(50, 50, state)).toBeUndefined()
  })

  test('pick handles selective matching across multiple features', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    let callCount = 0
    ctx.isPointInPath = jest.fn(() => {
      callCount++
      return callCount === 2
    })
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(3))
    const state = makeState([[0, makeParams()]])
    expect(renderer.pick(50, 50, state)).toEqual({ key: 0, featureIndex: 1 })
  })

  test('dispose cleans up data', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.dispose()
    renderer.render(makeState([[0, makeParams()]]))
    expect(pathOps.filter(op => op === 'fill')).toHaveLength(0)
  })
})
