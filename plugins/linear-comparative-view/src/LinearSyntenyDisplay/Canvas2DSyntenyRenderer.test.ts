import { Canvas2DSyntenyRenderer } from './Canvas2DSyntenyRenderer.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

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
    colors: new Float32Array(count * 4).fill(0.5),
    featureIds: new Float32Array(count).fill(1),
    isCurves: new Float32Array(count).fill(0),
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

  test('render with no data does nothing', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)
    expect(ctx.beginPath).not.toHaveBeenCalled()
  })

  test('render draws linear parallelogram for straight features', () => {
    const { canvas, ctx, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(makeInstanceData(1))
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)

    // Should draw one parallelogram: beginPath, moveTo, 3x lineTo, closePath, fill
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
    const data = makeInstanceData(1, {
      isCurves: new Float32Array([1]),
    })
    renderer.uploadGeometry(data)
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)

    // Curve mode: 16 segments for each side → many lineTo calls
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
      makeInstanceData(1, {
        queryTotalLengths: new Float32Array([100]),
      }),
    )
    renderer.render(0, 0, 100, 1, 1, 300, 500, 1, 0, 0)

    expect(pathOps.filter(op => op === 'fill')).toHaveLength(0)
  })

  test('skips features with zero alpha', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    const colors = new Float32Array([0.5, 0.5, 0.5, 0])
    renderer.uploadGeometry(makeInstanceData(1, { colors }))
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)

    expect(pathOps.filter(op => op === 'fill')).toHaveLength(0)
  })

  test('culls features outside viewport', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(
      makeInstanceData(1, {
        x1: new Float32Array([5000]),
        x2: new Float32Array([6000]),
        x3: new Float32Array([6000]),
        x4: new Float32Array([5000]),
      }),
    )
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)

    expect(pathOps.filter(op => op === 'fill')).toHaveLength(0)
  })

  test('draws stroke for clicked features', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(makeInstanceData(1))
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 1)

    expect(ctx.stroke).toHaveBeenCalled()
  })

  test('pick returns -1 with no data', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    expect(renderer.pick(100, 50)).toBe(-1)
  })

  test('pick returns -1 before render is called', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.uploadGeometry(makeInstanceData(1))
    expect(renderer.pick(50, 50)).toBe(-1)
  })

  test('pick returns feature index when isPointInPath matches', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(makeInstanceData(1))
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)
    expect(renderer.pick(50, 50)).toBe(0)
  })

  test('pick returns -1 when isPointInPath does not match', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => false)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(makeInstanceData(1))
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)
    expect(renderer.pick(50, 50)).toBe(-1)
  })

  test('pick invokes callback with result', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(makeInstanceData(1))
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)
    const cb = jest.fn()
    renderer.pick(50, 50, cb)
    expect(cb).toHaveBeenCalledWith(0)
  })

  test('pick returns last feature when multiple overlap (top-most wins)', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(makeInstanceData(3))
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)
    // last drawn (index 2) should be picked first
    expect(renderer.pick(50, 50)).toBe(2)
  })

  test('pick skips features below minAlignmentLength', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(
      makeInstanceData(1, {
        queryTotalLengths: new Float32Array([100]),
      }),
    )
    // render with minAlignmentLength=500, which excludes the feature
    renderer.render(0, 0, 100, 1, 1, 300, 500, 1, 0, 0)
    expect(renderer.pick(50, 50)).toBe(-1)
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
      makeInstanceData(1, {
        colors: new Float32Array([0.5, 0.5, 0.5, 0]),
      }),
    )
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)
    expect(renderer.pick(50, 50)).toBe(-1)
    expect(ctx.isPointInPath).not.toHaveBeenCalled()
  })

  test('pick builds curve path for curved features', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(
      makeInstanceData(1, {
        isCurves: new Float32Array([1]),
      }),
    )
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)
    expect(renderer.pick(50, 50)).toBe(0)
    // curve path uses lineTo for segments, not just 4 corners
    expect(ctx.lineTo.mock.calls.length).toBeGreaterThan(4)
  })

  test('pick returns -1 after destroy', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    ctx.isPointInPath = jest.fn(() => true)
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(makeInstanceData(1))
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)
    renderer.destroy()
    expect(renderer.pick(50, 50)).toBe(-1)
  })

  test('pick handles selective matching across multiple features', () => {
    const { canvas, ctx } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    // only the second feature (index 1) matches
    let callCount = 0
    ctx.isPointInPath = jest.fn(() => {
      callCount++
      // reverse iteration: feature 2 checked first, then 1, then 0
      return callCount === 2
    })
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.resize(800, 100)
    renderer.uploadGeometry(makeInstanceData(3))
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)
    // reverse order: checks index 2 (miss), index 1 (hit)
    expect(renderer.pick(50, 50)).toBe(1)
  })

  test('destroy cleans up data', () => {
    const { canvas, pathOps } = createMockCanvas()
    canvas.width = 800
    canvas.height = 100
    const renderer = new Canvas2DSyntenyRenderer(canvas)
    renderer.uploadGeometry(makeInstanceData(1))
    renderer.destroy()
    renderer.render(0, 0, 100, 1, 1, 300, 0, 1, 0, 0)
    expect(pathOps.filter(op => op === 'fill')).toHaveLength(0)
  })
})
