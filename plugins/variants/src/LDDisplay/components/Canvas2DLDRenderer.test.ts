import { Canvas2DLDRenderer } from './Canvas2DLDRenderer.ts'

import type { LDRenderState, LDUploadData } from './ldRenderingBackendTypes.ts'

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

function makeRenderState(overrides?: Partial<LDRenderState>): LDRenderState {
  return {
    canvasWidth: 800,
    canvasHeight: 600,
    yScalar: 1,
    viewScale: 1,
    viewOffsetX: 0,
    ...overrides,
  }
}

// signedLD/uniformW describe the packed matrix, so they live on the data (see
// LDUploadData), not the per-frame render state.
function makeOneCell(overrides?: Partial<LDUploadData>): LDUploadData {
  return {
    boundaries: new Float32Array([0, 10, 20]),
    ldValues: new Float32Array([0.5]),
    numCells: 1,
    signedLD: false,
    uniformW: 10,
    ...overrides,
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
      makeOneCell({ ldValues: new Float32Array([-1]), signedLD: true }),
      makeRenderState(),
    )

    expect(ctx.fillStyle).toBe('rgba(0,0,0,1.000)')
  })

  test('signedLD maps 1 to ramp end', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(
      makeOneCell({ ldValues: new Float32Array([1]), signedLD: true }),
      makeRenderState(),
    )

    expect(ctx.fillStyle).toBe('rgba(255,255,255,1.000)')
  })

  test('unsigned mode uses ldValue directly as ramp position', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(
      makeOneCell({ ldValues: new Float32Array([0.5]), signedLD: false }),
      makeRenderState(),
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
      makeOneCell({ ldValues: new Float32Array([0]), signedLD: false }),
      makeRenderState(),
    )

    expect(pathOps).not.toContain('fill')
  })
  // The shader's own transform (render-core `diagonalCellToClip`), so the
  // assertion below is against what the GPU actually draws rather than against
  // a second copy of the Canvas2D arithmetic.
  function shaderCorner(
    x: number,
    y: number,
    state: LDRenderState = makeRenderState(),
  ) {
    const rx = (x + y) * COS45
    const ry = (-x + y) * COS45
    return [
      rx * state.viewScale + state.viewOffsetX,
      ry * state.viewScale * state.yScalar,
    ]
  }

  // Genomic-positions mode gives every SNP its own Voronoi width, so the cell at
  // (i=1, j=0) spans a 10-wide column against a 30-tall row. The half-diagonal
  // form this replaced took the horizontal extent from `cw` and the vertical
  // from `ch`, which describes the rotated rect only when they are equal — so a
  // genomic matrix drew cells off-center, mis-shaped, and not tiling. Uniform
  // mode never exposed it (every boundary is `i * uniformW`), and neither did
  // this file until now.
  test('a cell whose two spans differ is the rotated rect, not a half-diagonal rhombus', () => {
    const { canvas, pathOps } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(
      makeOneCell({ boundaries: new Float32Array([0, 10, 40]) }),
      makeRenderState(),
    )

    // pre-rotation rect x in [0,10] (column 0), y in [10,40] (row 1)
    expect(pathOps).toEqual([
      'beginPath',
      `moveTo(${shaderCorner(0, 10)})`,
      `lineTo(${shaderCorner(10, 10)})`,
      `lineTo(${shaderCorner(10, 40)})`,
      `lineTo(${shaderCorner(0, 40)})`,
      'closePath',
      'fill',
    ])
  })

  // The equal-span case is what every uniform-mode matrix is, so the fix had to
  // leave it byte-identical: there the rotated rect IS the half-diagonal rhombus.
  test('equal spans still draw the uniform-mode rhombus', () => {
    const { canvas, pathOps } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    renderer.render(makeOneCell(), makeRenderState())

    expect(pathOps).toEqual([
      'beginPath',
      `moveTo(${shaderCorner(0, 10)})`,
      `lineTo(${shaderCorner(10, 10)})`,
      `lineTo(${shaderCorner(10, 20)})`,
      `lineTo(${shaderCorner(0, 20)})`,
      'closePath',
      'fill',
    ])
  })
})

// `render` answers whether real content reached the canvas, and
// RenderLifecycleMixin flips `canvasDrawn` — the loading scrim,
// `data-display-drawn`, every readiness wait — off that answer alone.
//
// The display's model used to give it, from whether `rpcData` existed, which
// this backend cannot honour: it paints nothing until `uploadColorRamp` has run.
// The frame between the fetch landing and the ramp arriving therefore reported
// drawn over a blank canvas, and nothing catches that — `waitForDisplaysDone`
// swallows its own timeout, so a display that lies about being painted reads as
// a slightly slow one and a capture lands on it blank.
describe('Canvas2DLDRenderer paint reporting', () => {
  test('false before the colour ramp arrives, true after', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)
    const data = makeOneCell()

    expect(renderer.render(data, makeRenderState())).toBe(false)

    renderer.uploadColorRamp(makeColorRamp())
    expect(renderer.render(data, makeRenderState())).toBe(true)
  })

  test('false with no payload', () => {
    const { canvas } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)
    renderer.uploadColorRamp(makeColorRamp())

    expect(renderer.render(null, makeRenderState())).toBe(false)
  })

  test('prepares the canvas either way, so a stale picture cannot survive', () => {
    const { canvas, ctx } = createMockCanvas()
    const renderer = new Canvas2DLDRenderer(canvas)
    renderer.render(null, makeRenderState())

    expect(ctx.clearRect).toHaveBeenCalled()
  })
})
