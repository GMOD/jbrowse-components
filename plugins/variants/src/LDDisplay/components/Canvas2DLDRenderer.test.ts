import { Canvas2DLDRenderer } from './Canvas2DLDRenderer.ts'

import type { LDUploadData } from './ldRenderingBackendTypes.ts'

Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

const COS45 = Math.SQRT1_2

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
    canvasWidth: number
    canvasHeight: number
    yScalar: number
    signedLD: boolean
    viewScale: number
    viewOffsetX: number
    uniformW: number
  }>,
) {
  return {
    canvasWidth: 800,
    canvasHeight: 600,
    yScalar: 1,
    signedLD: false,
    viewScale: 1,
    viewOffsetX: 0,
    uniformW: 10,
    ...overrides,
  }
}

function makeOneCell(overrides?: {
  boundaries?: Float32Array
  ldValues?: Float32Array
}): LDUploadData {
  return {
    boundaries: overrides?.boundaries ?? new Float32Array([0, 10, 20]),
    ldValues: overrides?.ldValues ?? new Float32Array([0.5]),
    numCells: 1,
  }
}

describe('Canvas2DLDRenderer', () => {
  test('renders diamond when data is passed', () => {
    const { canvas, pathOps } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(makeOneCell(), makeRenderState())

    expect(pathOps).toContain('beginPath')
    expect(pathOps).toContain('closePath')
    expect(pathOps).toContain('fill')
  })

  test('does nothing with null data', () => {
    const { canvas, pathOps, ctx } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)

    renderer.render(null, makeRenderState())

    expect(pathOps.length).toBe(0)
    expect(ctx.clearRect).toHaveBeenCalled()
  })

  test('does nothing without color ramp', () => {
    const { canvas, pathOps } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)

    renderer.render(makeOneCell(), makeRenderState())

    expect(pathOps.length).toBe(0)
  })

  test('produces correct diamond rotated coordinates', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    const px = 0
    const py = 10
    const cw = 10
    const ch = 10

    renderer.render(
      makeOneCell(),
      makeRenderState({ viewScale: 1, viewOffsetX: 0, yScalar: 1 }),
    )

    const corners = [
      [px, py],
      [px + cw, py],
      [px + cw, py + ch],
      [px, py + ch],
    ]
    const expected = corners.map(([cx, cy]) => {
      const rx = (cx! + cy!) * COS45
      const ry = (-cx! + cy!) * COS45
      return [rx, ry]
    })

    expect(ctx.moveTo).toHaveBeenCalledWith(
      expect.closeTo(expected[0]![0]!, 5),
      expect.closeTo(expected[0]![1]!, 5),
    )
    expect(ctx.lineTo).toHaveBeenCalledTimes(3)
  })

  test('signedLD mode maps -1..1 to 0..1 for ramp lookup', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(
      makeOneCell({ ldValues: new Float32Array([-1]) }),
      makeRenderState({ signedLD: true }),
    )

    expect(ctx.fillStyle).toBe('rgba(0,0,0,1.000)')
  })

  test('signedLD maps 1 to ramp end', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(
      makeOneCell({ ldValues: new Float32Array([1]) }),
      makeRenderState({ signedLD: true }),
    )

    expect(ctx.fillStyle).toBe('rgba(255,255,255,1.000)')
  })

  test('unsigned mode uses ldValue directly as ramp position', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(
      makeOneCell({ ldValues: new Float32Array([0.5]) }),
      makeRenderState({ signedLD: false }),
    )

    expect(ctx.fillStyle).toBe('rgba(128,128,128,1.000)')
  })

  test('skips cells with near-zero alpha', () => {
    const { canvas, pathOps } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)

    const ramp = makeColorRamp()
    ramp[3] = 0
    renderer.uploadColorRamp(ramp)

    renderer.render(
      makeOneCell({ ldValues: new Float32Array([0]) }),
      makeRenderState({ signedLD: false }),
    )

    expect(pathOps).not.toContain('fill')
  })
})
