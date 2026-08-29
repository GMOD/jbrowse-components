import { LD_NOT_COMPUTED } from '@jbrowse/ld-core'

import { bandCellCount, bandPairIndex } from '../../VariantRPC/ldBand.ts'
import { Canvas2DLDRenderer, drawLDBlocks } from './Canvas2DLDRenderer.ts'
import { generateLDColorRamp } from './ldColorRamp.ts'

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
    band: 1_000_000,
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

  // Every ramp a display can reach is opaque, which is why the painter has no
  // alpha gate: `generateLDColorRamp` returns one of four LUTs, all built by
  // `opaqueRampLut`. A translucent one would need a matching `discard` in
  // ldUniforms.slang, which gates on `ldValueComputed` alone — so a gate here
  // would be a Canvas2D-only skip.
  test.each(['r2', 'dprime'])(
    'every %s ramp entry is opaque, signed and unsigned',
    metric => {
      for (const signedLD of [false, true]) {
        const ramp = generateLDColorRamp(metric, signedLD)
        for (let i = 0; i < 256; i++) {
          expect(ramp[i * 4 + 3]).toBe(255)
        }
      }
    },
  )
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

// The band walk consumes `ldValues` with a running `k++`, so the order cells
// come out in IS the slot order. `bandPairIndex` computes a slot from (i, j)
// independently, which makes it an oracle for the walk rather than a restatement
// of it: if the two disagree, every cell from the disagreement onward is painted
// with another pair's value.
//
// Every other test in this family passes a band wide enough to collapse to the
// full triangle, where `bandRowFirstColumn` is 0 everywhere and the walk's band
// arithmetic never runs.
describe('drawLDBlocks over a real band', () => {
  const N = 12
  const BAND = 5
  const CELL = 10

  function drawBanded(band: number) {
    const boundaries = new Float32Array(N + 1)
    for (let i = 0; i <= N; i++) {
      boundaries[i] = i * CELL
    }
    const numCells = bandCellCount(N, band)
    const moveTos: [number, number][] = []
    const ctx = {
      beginPath: jest.fn(),
      moveTo: jest.fn((x: number, y: number) => moveTos.push([x, y])),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      fillStyle: '',
    } as unknown as Parameters<typeof drawLDBlocks>[0]

    drawLDBlocks(
      ctx,
      {
        boundaries,
        ldValues: new Float32Array(numCells).fill(0.5),
        numCells,
        band,
        signedLD: false,
        uniformW: CELL,
      },
      makeColorRamp(),
      makeRenderState({ viewScale: 1, yScalar: 1, viewOffsetX: 0 }),
    )

    // Invert the rotation the draw applies: x0 = (px+py)*s, y0 = (py-px)*s.
    const s = COS45
    return moveTos.map(([x0, y0]) => ({
      i: Math.round((x0 / s + y0 / s) / 2 / CELL),
      j: Math.round((x0 / s - y0 / s) / 2 / CELL),
    }))
  }

  test('paints each slot at the cell bandPairIndex assigns it', () => {
    const drawn = drawBanded(BAND)

    expect(drawn).toHaveLength(bandCellCount(N, BAND))
    // Compared as a triple so a failure names the cell that drifted, not just
    // the slot number it drifted to.
    drawn.forEach(({ i, j }, slot) => {
      expect([i, j, bandPairIndex(i, j, BAND)]).toEqual([i, j, slot])
    })
  })

  test('paints nothing outside the band', () => {
    for (const { i, j } of drawBanded(BAND)) {
      expect(i - j).toBeLessThanOrEqual(BAND)
      expect(i - j).toBeGreaterThan(0)
    }
  })

  test('collapses to the full triangle at band >= n - 1', () => {
    const drawn = drawBanded(N - 1)
    expect(drawn).toHaveLength((N * (N - 1)) / 2)
    drawn.forEach(({ i, j }, slot) => {
      expect(bandPairIndex(i, j, N - 1)).toBe(slot)
    })
  })
})

// A cell holding `LD_NOT_COMPUTED` has no value to show, so it is left as
// background — the same thing an out-of-band cell already looks like, since the
// walk never reaches one. Painting it instead maps the sentinel through
// `mapLDValue`'s clamp to t = 0, which for r² is the ramp's white end at alpha
// 255: an opaque diamond claiming linkage equilibrium for a pair nothing
// measured.
describe('drawLDBlocks over a cell nothing computed', () => {
  const N = 4
  const BAND = N - 1
  const CELL = 10

  function drawWith(ldValues: Float32Array) {
    const boundaries = new Float32Array(N + 1)
    for (let i = 0; i <= N; i++) {
      boundaries[i] = i * CELL
    }
    const moveTos: [number, number][] = []
    const ctx = {
      beginPath: jest.fn(),
      moveTo: jest.fn((x: number, y: number) => moveTos.push([x, y])),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      fillStyle: '',
    } as unknown as Parameters<typeof drawLDBlocks>[0]

    drawLDBlocks(
      ctx,
      {
        boundaries,
        ldValues,
        numCells: ldValues.length,
        band: BAND,
        signedLD: false,
        uniformW: CELL,
      },
      makeColorRamp(),
      makeRenderState({ viewScale: 1, yScalar: 1, viewOffsetX: 0 }),
    )

    const s = COS45
    return moveTos.map(([x0, y0]) => ({
      i: Math.round((x0 / s + y0 / s) / 2 / CELL),
      j: Math.round((x0 / s - y0 / s) / 2 / CELL),
    }))
  }

  const numCells = bandCellCount(N, BAND)
  // (2, 0) — a cell in the interior of the walk, so skipping it also has to
  // leave every later cell on its own coordinates
  const skipped = bandPairIndex(2, 0, BAND)

  test('leaves it unpainted, and paints every other cell', () => {
    const values = new Float32Array(numCells).fill(0.5)
    values[skipped] = LD_NOT_COMPUTED
    const drawn = drawWith(values)

    expect(drawn).toHaveLength(numCells - 1)
    expect(drawn).not.toContainEqual({ i: 2, j: 0 })
    // and the cells after it did not slide up into the vacated slot
    for (const { i, j } of drawn) {
      expect(bandPairIndex(i, j, BAND)).not.toBe(skipped)
    }
    expect(new Set(drawn.map(({ i, j }) => `${i},${j}`)).size).toBe(
      numCells - 1,
    )
  })

  test('paints a real 0 in that same cell', () => {
    const values = new Float32Array(numCells).fill(0.5)
    values[skipped] = 0
    const drawn = drawWith(values)

    expect(drawn).toHaveLength(numCells)
    expect(drawn).toContainEqual({ i: 2, j: 0 })
  })
})
