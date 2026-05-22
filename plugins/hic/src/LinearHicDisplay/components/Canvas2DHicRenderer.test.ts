import { Canvas2DHicRenderer } from './Canvas2DHicRenderer.ts'

import type {
  HicRenderState,
  HicUploadData,
} from './hicBackendTypes.ts'

Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

function createMockCanvas() {
  const ctx = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    fillRect: jest.fn(),
    fillStyle: '',
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => ctx),
  } as unknown as HTMLCanvasElement
  return { canvas, ctx }
}

function makeColorRamp() {
  const ramp = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    ramp[i * 4] = i
    ramp[i * 4 + 1] = i
    ramp[i * 4 + 2] = i
    ramp[i * 4 + 3] = 255
  }
  return ramp
}

function makeData(overrides?: Partial<HicUploadData>): HicUploadData {
  return {
    positions: new Float32Array([10, 20]),
    counts: new Float32Array([50]),
    numContacts: 1,
    ...overrides,
  }
}

function makeRenderState(overrides?: Partial<HicRenderState>): HicRenderState {
  return {
    binWidth: 10,
    yScalar: 1,
    canvasWidth: 800,
    canvasHeight: 600,
    colorMaxScore: 100,
    useLogScale: false,
    viewScale: 1,
    viewOffsetX: 0,
    ...overrides,
  }
}

describe('Canvas2DHicRenderer', () => {
  test('renders fillRects for uploaded contacts', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(makeData(), makeRenderState())

    expect(ctx.fillRect).toHaveBeenCalledTimes(1)
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 10, 10)
  })

  test('applies viewport transform via ctx stack', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(
      makeData({ positions: new Float32Array([0, 0]) }),
      makeRenderState({ viewScale: 2, viewOffsetX: 100, yScalar: 0.5 }),
    )

    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.translate).toHaveBeenCalledWith(100, 0)
    expect(ctx.scale).toHaveBeenCalledWith(2, 1)
    expect(ctx.rotate).toHaveBeenCalledWith(-Math.PI / 4)
    expect(ctx.restore).toHaveBeenCalled()
  })

  test('does nothing with null data', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)

    renderer.render(null, makeRenderState())

    expect(ctx.fillRect).not.toHaveBeenCalled()
    expect(ctx.clearRect).toHaveBeenCalled()
  })

  test('does nothing without color ramp', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)

    renderer.render(makeData(), makeRenderState())

    expect(ctx.fillRect).not.toHaveBeenCalled()
  })

  test('skips cells with near-zero alpha', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)

    const ramp = makeColorRamp()
    ramp[3] = 0
    renderer.uploadColorRamp(ramp)

    renderer.render(
      makeData({
        positions: new Float32Array([0, 0]),
        counts: new Float32Array([0]),
      }),
      makeRenderState(),
    )

    expect(ctx.fillRect).not.toHaveBeenCalled()
  })

  test('renders multiple contacts', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(
      makeData({
        positions: new Float32Array([0, 0, 10, 10, 20, 20]),
        counts: new Float32Array([50, 75, 90]),
        numContacts: 3,
      }),
      makeRenderState(),
    )

    expect(ctx.fillRect).toHaveBeenCalledTimes(3)
  })

  test('useLogScale affects color mapping', () => {
    const { canvas, ctx } = createMockCanvas()

    const linearRenderer = new Canvas2DHicRenderer(canvas)
    linearRenderer.uploadColorRamp(makeColorRamp())
    linearRenderer.render(
      makeData({ positions: new Float32Array([0, 0]) }),
      makeRenderState({ useLogScale: false }),
    )
    const linearColor = ctx.fillStyle

    const logRenderer = new Canvas2DHicRenderer(canvas)
    logRenderer.uploadColorRamp(makeColorRamp())
    logRenderer.render(
      makeData({ positions: new Float32Array([0, 0]) }),
      makeRenderState({ useLogScale: true }),
    )
    const logColor = ctx.fillStyle

    expect(linearColor).not.toBe(logColor)
  })
})
