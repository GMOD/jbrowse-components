import { Canvas2DSyntenyRenderer } from './Canvas2DSyntenyRenderer.ts'

import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyBackendTypes.ts'
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

function makeInstanceData(
  count: number,
  overrides?: Partial<SyntenyInstanceData>,
): SyntenyInstanceData {
  return {
    x1: new Float32Array(count).fill(10),
    x2: new Float32Array(count).fill(100),
    x3: new Float32Array(count).fill(110),
    x4: new Float32Array(count).fill(20),
    colors: new Uint32Array(count).fill(0x80808080),
    kinds: new Uint8Array(count),
    instanceFeatureIdx: new Uint32Array(count),
    featureIds: new Float32Array(count).fill(1),
    queryTotalLengths: new Float32Array(count).fill(10000),
    padTops: new Float32Array(count).fill(0),
    padBottoms: new Float32Array(count).fill(0),
    instanceCount: count,
    nonCigarInstanceCount: count,
    geometryBpPerPx0: 1,
    geometryBpPerPx1: 1,
    refOffset0: 0,
    refOffset1: 0,
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
    offset0: 0,
    offset1: 0,
    bpPerPx0: 1,
    bpPerPx1: 1,
    drawCurves: false,
    ...overrides,
  }
}

function makeState(
  perTrack: [number, SyntenyTrackRenderParams][],
  maxOffScreenPx = 300,
): SyntenyRenderState {
  return { maxOffScreenPx, perTrack: new Map(perTrack) }
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

  test('render draws curved features with multiple segments', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.render(makeState([[0, makeParams({ drawCurves: true })]]))

    const lineToCount = pathOps.filter(op => op.startsWith('lineTo')).length
    expect(lineToCount).toBeGreaterThan(4)
  })

  test('filters out features below minAlignmentLength', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(
      0,
      makeInstanceData(1, { queryTotalLengths: new Float32Array([100]) }),
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
    renderer.uploadGeometry(
      0,
      makeInstanceData(1, {
        x1: new Float32Array([5000]),
        x2: new Float32Array([6000]),
        x3: new Float32Array([6000]),
        x4: new Float32Array([5000]),
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

  test('pick returns undefined with no state', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    expect(renderer.pick(100, 50)).toBeUndefined()
  })

  test('pick returns undefined before render is called', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.uploadGeometry(0, makeInstanceData(1))
    expect(renderer.pick(50, 50)).toBeUndefined()
  })

  test('pick returns hit with key + featureIndex', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.render(makeState([[0, makeParams()]]))
    expect(renderer.pick(50, 50)).toEqual({ key: 0, featureIndex: 0 })
  })

  test('pick returns undefined when isPointInPath does not match', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => false)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.render(makeState([[0, makeParams()]]))
    expect(renderer.pick(50, 50)).toBeUndefined()
  })

  test('pick invokes callback with hit', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.render(makeState([[0, makeParams()]]))
    const cb = jest.fn()
    renderer.pick(50, 50, cb)
    expect(cb).toHaveBeenCalledWith({ key: 0, featureIndex: 0 })
  })

  test('pick returns last feature when multiple overlap (top-most wins)', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(3))
    renderer.render(makeState([[0, makeParams()]]))
    expect(renderer.pick(50, 50)).toEqual({ key: 0, featureIndex: 2 })
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
    renderer.render(
      makeState([
        [0, makeParams({ yTop: 0, height: 200 })],
        [1, makeParams({ yTop: 0, height: 200 })],
      ]),
    )
    expect(renderer.pick(50, 50)?.key).toBe(1)
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
    renderer.render(
      makeState([
        [0, makeParams({ yTop: 0, height: 100 })],
        [1, makeParams({ yTop: 100, height: 100 })],
      ]),
    )
    // y=50 is within track 0 only
    expect(renderer.pick(50, 50)?.key).toBe(0)
    // y=150 is within track 1 only
    expect(renderer.pick(50, 150)?.key).toBe(1)
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
      makeInstanceData(1, { queryTotalLengths: new Float32Array([100]) }),
    )
    renderer.render(makeState([[0, makeParams({ minAlignmentLength: 500 })]]))
    expect(renderer.pick(50, 50)).toBeUndefined()
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
    renderer.render(makeState([[0, makeParams()]]))
    expect(renderer.pick(50, 50)).toBeUndefined()
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
    renderer.render(makeState([[0, makeParams({ drawCurves: true })]]))
    expect(renderer.pick(50, 50)).toEqual({ key: 0, featureIndex: 0 })
    expect(ctx.lineTo.mock.calls.length).toBeGreaterThan(4)
  })

  test('pick returns undefined after dispose', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(0, makeInstanceData(1))
    renderer.render(makeState([[0, makeParams()]]))
    renderer.dispose()
    expect(renderer.pick(50, 50)).toBeUndefined()
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
    renderer.render(makeState([[0, makeParams()]]))
    expect(renderer.pick(50, 50)).toEqual({ key: 0, featureIndex: 1 })
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
