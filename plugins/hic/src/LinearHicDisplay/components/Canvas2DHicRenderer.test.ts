import { Canvas2DHicRenderer } from './Canvas2DHicRenderer.ts'

Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

function createMockCanvas() {
  const pathOps: string[] = []
  const ctx = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(() => pathOps.push('beginPath')),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(() => pathOps.push('closePath')),
    fill: jest.fn(() => pathOps.push('fill')),
    fillStyle: '',
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => ctx),
  } as unknown as HTMLCanvasElement
  return { canvas, ctx, pathOps }
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

function makeRenderState(
  overrides?: Partial<{
    binWidth: number
    yScalar: number
    canvasWidth: number
    canvasHeight: number
    maxScore: number
    useLogScale: boolean
    viewScale: number
    viewOffsetX: number
  }>,
) {
  return {
    binWidth: 10,
    yScalar: 1,
    canvasWidth: 800,
    canvasHeight: 600,
    maxScore: 100,
    useLogScale: false,
    viewScale: 1,
    viewOffsetX: 0,
    ...overrides,
  }
}

describe('Canvas2DHicRenderer', () => {
  test('renders diamonds for uploaded contacts', () => {
    const { canvas, pathOps } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)

    renderer.uploadData({
      positions: new Float32Array([10, 20]),
      counts: new Float32Array([50]),
      numContacts: 1,
    })
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(makeRenderState())

    expect(pathOps).toContain('beginPath')
    expect(pathOps).toContain('closePath')
    expect(pathOps).toContain('fill')
  })

  test('does nothing with empty data', () => {
    const { canvas, pathOps, ctx } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)

    renderer.render(makeRenderState())

    expect(pathOps.length).toBe(0)
    expect(ctx.clearRect).toHaveBeenCalled()
  })

  test('does nothing without color ramp', () => {
    const { canvas, pathOps } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)

    renderer.uploadData({
      positions: new Float32Array([10, 20]),
      counts: new Float32Array([50]),
      numContacts: 1,
    })

    renderer.render(makeRenderState())

    expect(pathOps.length).toBe(0)
  })

  test('skips cells with near-zero alpha', () => {
    const { canvas, pathOps } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)

    const ramp = makeColorRamp()
    ramp[3] = 0 // first entry alpha = 0

    renderer.uploadData({
      positions: new Float32Array([0, 0]),
      counts: new Float32Array([0]),
      numContacts: 1,
    })
    renderer.uploadColorRamp(ramp)

    renderer.render(makeRenderState())

    expect(pathOps).not.toContain('fill')
  })

  test('renders multiple contacts', () => {
    const { canvas, pathOps } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)

    renderer.uploadData({
      positions: new Float32Array([0, 0, 10, 10, 20, 20]),
      counts: new Float32Array([50, 75, 90]),
      numContacts: 3,
    })
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(makeRenderState())

    const fillCount = pathOps.filter(op => op === 'fill').length
    expect(fillCount).toBe(3)
  })

  test('useLogScale affects color mapping', () => {
    const { canvas, ctx } = createMockCanvas()

    const linearRenderer = new Canvas2DHicRenderer(canvas)
    linearRenderer.uploadData({
      positions: new Float32Array([0, 0]),
      counts: new Float32Array([50]),
      numContacts: 1,
    })
    linearRenderer.uploadColorRamp(makeColorRamp())
    linearRenderer.render(makeRenderState({ useLogScale: false }))
    const linearColor = ctx.fillStyle

    const logRenderer = new Canvas2DHicRenderer(canvas)
    logRenderer.uploadData({
      positions: new Float32Array([0, 0]),
      counts: new Float32Array([50]),
      numContacts: 1,
    })
    logRenderer.uploadColorRamp(makeColorRamp())
    logRenderer.render(makeRenderState({ useLogScale: true }))
    const logColor = ctx.fillStyle

    expect(linearColor).not.toBe(logColor)
  })

  test('dispose clears data', () => {
    const { canvas, pathOps } = createMockCanvas()
    const renderer = new Canvas2DHicRenderer(canvas)

    renderer.uploadData({
      positions: new Float32Array([10, 20]),
      counts: new Float32Array([50]),
      numContacts: 1,
    })
    renderer.uploadColorRamp(makeColorRamp())
    renderer.dispose()

    renderer.render(makeRenderState())
    expect(pathOps).not.toContain('fill')
  })
})
