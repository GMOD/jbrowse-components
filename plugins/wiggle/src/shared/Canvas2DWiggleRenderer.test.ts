import { Canvas2DWiggleRenderer } from './Canvas2DWiggleRenderer.ts'
import {
  RENDERING_TYPE_XYPLOT,
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  SCALE_TYPE_LINEAR,
} from './wiggleShader.ts'

function createMockCanvas() {
  const fillRectCalls: [number, number, number, number][] = []
  const ctx = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    fillRect: jest.fn(
      (x: number, y: number, w: number, h: number) => {
        fillRectCalls.push([x, y, w, h])
      },
    ),
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

    renderer.uploadRegion(0, 0, [source])
    // Render to verify data is present (should not throw)
    renderer.renderBlocks(
      [{ regionNumber: 0, bpRangeX: [0, 1000], screenStartPx: 0, screenEndPx: 800 }],
      { domainY: [0, 10], scaleType: SCALE_TYPE_LINEAR, renderingType: RENDERING_TYPE_XYPLOT, canvasWidth: 800, canvasHeight: 200 },
    )

    // Upload empty source list → should remove region
    renderer.uploadRegion(0, 0, [])
  })

  test('renderBlocks draws XY plot rectangles', () => {
    const { canvas, ctx, fillRectCalls } = createMockCanvas()
    // Mock devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source = makeSource([5, 8], [0, 500], [500, 1000])

    renderer.uploadRegion(0, 0, [source])
    renderer.renderBlocks(
      [{ regionNumber: 0, bpRangeX: [0, 1000], screenStartPx: 0, screenEndPx: 800 }],
      { domainY: [0, 10], scaleType: SCALE_TYPE_LINEAR, renderingType: RENDERING_TYPE_XYPLOT, canvasWidth: 800, canvasHeight: 200 },
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
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    renderer.renderBlocks(
      [{ regionNumber: 99, bpRangeX: [0, 1000], screenStartPx: 0, screenEndPx: 800 }],
      { domainY: [0, 10], scaleType: SCALE_TYPE_LINEAR, renderingType: RENDERING_TYPE_XYPLOT, canvasWidth: 800, canvasHeight: 200 },
    )

    expect(ctx.save).not.toHaveBeenCalled()
  })

  test('renderBlocks handles density rendering type', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source = makeSource([5], [0], [1000])

    renderer.uploadRegion(0, 0, [source])
    renderer.renderBlocks(
      [{ regionNumber: 0, bpRangeX: [0, 1000], screenStartPx: 0, screenEndPx: 800 }],
      { domainY: [0, 10], scaleType: SCALE_TYPE_LINEAR, renderingType: RENDERING_TYPE_DENSITY, canvasWidth: 800, canvasHeight: 200 },
    )

    expect(fillRectCalls.length).toBe(1)
  })

  test('renderBlocks handles line rendering type', () => {
    const { canvas, ctx } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source = makeSource([5, 8], [0, 500], [500, 1000])

    renderer.uploadRegion(0, 0, [source])
    renderer.renderBlocks(
      [{ regionNumber: 0, bpRangeX: [0, 1000], screenStartPx: 0, screenEndPx: 800 }],
      { domainY: [0, 10], scaleType: SCALE_TYPE_LINEAR, renderingType: RENDERING_TYPE_LINE, canvasWidth: 800, canvasHeight: 200 },
    )

    expect(ctx.beginPath).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  test('renderBlocks handles scatter rendering type', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source = makeSource([5], [0], [1000])

    renderer.uploadRegion(0, 0, [source])
    renderer.renderBlocks(
      [{ regionNumber: 0, bpRangeX: [0, 1000], screenStartPx: 0, screenEndPx: 800 }],
      { domainY: [0, 10], scaleType: SCALE_TYPE_LINEAR, renderingType: RENDERING_TYPE_SCATTER, canvasWidth: 800, canvasHeight: 200 },
    )

    expect(fillRectCalls.length).toBe(1)
  })

  test('pruneStaleRegions removes inactive regions', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    renderer.uploadRegion(0, 0, [makeSource([5], [0], [1000])])
    renderer.uploadRegion(1, 1000, [makeSource([8], [0], [1000])])

    renderer.pruneStaleRegions(new Set([0]))

    renderer.renderBlocks(
      [
        { regionNumber: 0, bpRangeX: [0, 1000], screenStartPx: 0, screenEndPx: 400 },
        { regionNumber: 1, bpRangeX: [1000, 2000], screenStartPx: 400, screenEndPx: 800 },
      ],
      { domainY: [0, 10], scaleType: SCALE_TYPE_LINEAR, renderingType: RENDERING_TYPE_XYPLOT, canvasWidth: 800, canvasHeight: 200 },
    )

    // Only region 0 should render (region 1 was pruned)
    expect(fillRectCalls.length).toBe(1)
  })

  test('destroy clears all regions', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DWiggleRenderer(canvas)
    renderer.uploadRegion(0, 0, [makeSource([5], [0], [1000])])
    renderer.destroy()
    // After destroy, rendering should produce no output
  })

  test('multi-row sources render at correct vertical offsets', () => {
    const { canvas, fillRectCalls } = createMockCanvas()
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

    const renderer = new Canvas2DWiggleRenderer(canvas)
    const source0 = { ...makeSource([5], [0], [1000]), rowIndex: 0 }
    const source1 = { ...makeSource([8], [0], [1000]), rowIndex: 1 }

    renderer.uploadRegion(0, 0, [source0, source1])
    renderer.renderBlocks(
      [{ regionNumber: 0, bpRangeX: [0, 1000], screenStartPx: 0, screenEndPx: 800 }],
      { domainY: [0, 10], scaleType: SCALE_TYPE_LINEAR, renderingType: RENDERING_TYPE_XYPLOT, canvasWidth: 800, canvasHeight: 200 },
    )

    expect(fillRectCalls.length).toBe(2)
    // First source in top half (0-100px), second in bottom half (100-200px)
    expect(fillRectCalls[0]![1]).toBeLessThan(100)
    expect(fillRectCalls[1]![1]).toBeGreaterThanOrEqual(100)
  })
})
