import { LD_NOT_COMPUTED } from '@jbrowse/ld-core'
import { MockHal } from '@jbrowse/render-core/hal'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'

import { bandCellCount, bandPairIndex } from '../../VariantRPC/ldBand.ts'
import { drawLDBlocks } from './drawLDBlocks.ts'
import { generateLDColorRamp } from './ldColorRamp.ts'
import { LD_MARKS, interleaveLDInstances, ldMarkBlocks } from './ldMarks.ts'
import {
  UNIFORM_OFFSET_F32 as U,
  UNIFORM_OFFSET_U32 as UU,
} from './shaders/ldGenomic.iface.generated.ts'
import { INSTANCE_STRIDE_BYTES as UNIFORM_STRIDE } from './shaders/ldUniform.iface.generated.ts'

import type { LDRenderState, LDUploadData } from './ldRenderingBackendTypes.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'

Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

const COS45 = Math.SQRT1_2
const PASSES = LD_MARKS.map(m => m.pass)

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

// uniformW describes the packed matrix, so it lives on the data (see
// LDUploadData), not the per-frame render state.
function makeOneCell(overrides?: Partial<LDUploadData>): LDUploadData {
  return {
    boundaries: new Float32Array([0, 10, 20]),
    ldValues: new Float32Array([0.5]),
    numCells: 1,
    band: 1_000_000,
    uniformW: 10,
    metric: 'r2',
    ...overrides,
  }
}

// That same one-cell matrix in the other layout: per-cell positions and sizes
// in place of the uniform pitch.
function makeGenomicCell(overrides?: Partial<LDUploadData>): LDUploadData {
  return makeOneCell({
    positions: new Float32Array([0, 10]),
    cellSizes: new Float32Array([10, 10]),
    ...overrides,
  })
}

function render(data: LDUploadData | undefined, state = makeRenderState()) {
  const hal = new MockHal(PASSES)
  const backend = new GpuMarkBackend(hal, LD_MARKS)
  const regions = new Map<number, LDUploadData>()
  if (data) {
    regions.set(0, data)
    backend.upload(0, data)
  }
  const painted = backend.renderBlocks(
    ldMarkBlocks(state.canvasWidth),
    regions,
    state,
  )
  return { hal, backend, painted }
}

describe('the LD mark list', () => {
  it('uploads a uniform-pitch matrix as the value buffer alone', () => {
    const { hal } = render(makeOneCell())

    const buf = hal.getBuffer(0, 'main')
    expect(buf!.count).toBe(1)
    expect(buf!.data.byteLength).toBe(UNIFORM_STRIDE)
    expect(hal.getBufferCount(0, 'genomic')).toBe(0)
  })

  it('uploads a genomic matrix as the interleaved buffer alone', () => {
    const data = makeGenomicCell()
    const { hal } = render(data)

    const buf = hal.getBuffer(0, 'genomic')
    expect(buf!.count).toBe(1)
    expect(new Float32Array(buf!.data)).toEqual(
      new Float32Array(
        interleaveLDInstances({
          positions: data.positions!,
          cellSizes: data.cellSizes!,
          ldValues: data.ldValues,
          numCells: data.numCells,
        }),
      ),
    )
    expect(hal.getBufferCount(0, 'main')).toBe(0)
  })

  // A single cell is a real two-SNP matrix — numCells is the triangular count
  // n*(n-1)/2 — so only an empty one releases. An `n < 2` floor here once made
  // the GPU backend the only path that showed nothing.
  it('releases both buffers for a matrix with no cells', () => {
    const hal = new MockHal(PASSES)
    const backend = new GpuMarkBackend(hal, LD_MARKS)

    backend.upload(0, makeOneCell())
    expect(hal.getBufferCount(0, 'main')).toBe(1)

    backend.upload(
      0,
      makeOneCell({ ldValues: new Float32Array(0), numCells: 0 }),
    )
    expect(hal.getBufferCount(0, 'main')).toBe(0)
    expect(hal.getBufferCount(0, 'genomic')).toBe(0)
  })

  it('draws the pass the payload carries, uniform pitch', () => {
    const draws = render(makeOneCell()).hal.callsOf('drawPass')

    expect(draws.length).toBe(1)
    expect(draws[0]!.args[0]).toBe('main')
  })

  it('draws the pass the payload carries, genomic positions', () => {
    const draws = render(makeGenomicCell()).hal.callsOf('drawPass')

    expect(draws.length).toBe(1)
    expect(draws[0]!.args[0]).toBe('genomic')
  })

  it('writes the uniform block both shaders share', () => {
    const { hal } = render(
      makeOneCell({ band: 7, uniformW: 10 }),
      makeRenderState({ viewScale: 2, viewOffsetX: 30, yScalar: 0.5 }),
    )

    const f32 = hal.getLastUniformsF32()!
    const u32 = hal.getLastUniformsU32()!
    expect(f32[U.canvasSize]).toBe(800)
    expect(f32[U.canvasSize + 1]).toBe(600)
    expect(f32[U.yScalar]).toBe(0.5)
    expect(f32[U.viewScale]).toBe(2)
    expect(f32[U.viewOffsetX]).toBe(30)
    expect(f32[U.uniformW]).toBe(10)
    expect(u32[UU.band]).toBe(7)
  })

  // The ramp is the marks' `texture`, not a second upload cell: both passes
  // sample it, and the backend re-uploads only when the metric's table moves.
  it('binds the metric ramp to both passes, once per identity', () => {
    const hal = new MockHal(PASSES)
    const backend = new GpuMarkBackend(hal, LD_MARKS)
    const data = makeOneCell()
    const blocks = ldMarkBlocks(800)
    const regions = new Map([[0, data]])
    backend.upload(0, data)

    backend.renderBlocks(blocks, regions, makeRenderState())
    backend.renderBlocks(blocks, regions, makeRenderState())

    const texCalls = hal.callsOf('uploadTexture')
    expect(texCalls.map(c => c.args[0])).toEqual(['main', 'genomic'])
    expect(texCalls[0]!.args[2]).toBe(256)
    expect(texCalls[0]!.args[3]).toBe(1)
    expect(hal.getTexture('main')).toEqual(generateLDColorRamp('r2'))

    const dprime = new Map([[0, makeOneCell({ metric: 'dprime' })]])
    backend.renderBlocks(blocks, dprime, makeRenderState())
    expect(hal.callsOf('uploadTexture').length).toBe(4)
    expect(hal.getTexture('main')).toEqual(generateLDColorRamp('dprime'))
  })
})

// `renderBlocks` answers whether real content reached the canvas, and
// RenderLifecycleMixin flips `canvasDrawn` — the loading scrim,
// `data-display-drawn`, every readiness wait — off that answer alone.
describe('the LD mark list, paint reporting', () => {
  it('true once the matrix is in the region map', () => {
    expect(render(makeOneCell()).painted).toBe(true)
  })

  it('false with no payload at all', () => {
    const { painted, hal } = render(undefined)

    expect(painted).toBe(false)
    expect(hal.callsOf('drawPass').length).toBe(0)
  })

  // A window whose pairs are all out of band is a finished frame: the cleared
  // canvas IS the picture, and nothing later will upload bytes for it. The
  // monolithic backend answered false there, which left `canvasDrawn` unset for
  // good and held the loading scrim over an empty triangle.
  it('true for a matrix that computed no cells', () => {
    const { painted, hal } = render(
      makeOneCell({ ldValues: new Float32Array(0), numCells: 0 }),
    )

    expect(painted).toBe(true)
    expect(hal.getBufferCount(0, 'main')).toBe(0)
  })

  it('clears the canvas either way, drawn or not', () => {
    const { hal } = render(undefined)

    expect(hal.callsOf('beginFrame')).toHaveLength(1)
    expect(hal.callsOf('endFrame')).toHaveLength(1)
  })
})

function recordingCtx() {
  const pathOps: string[] = []
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(() => pathOps.push('clip')),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    stroke: jest.fn(),
    beginPath: jest.fn(() => pathOps.push('beginPath')),
    moveTo: jest.fn((...args: number[]) => pathOps.push(`moveTo(${args})`)),
    lineTo: jest.fn((...args: number[]) => pathOps.push(`lineTo(${args})`)),
    closePath: jest.fn(() => pathOps.push('closePath')),
    fill: jest.fn(() => pathOps.push('fill')),
  }
  return { ctx: ctx as unknown as MarkContext2D, raw: ctx, pathOps }
}

function paint(data: LDUploadData | undefined, state = makeRenderState()) {
  const { ctx, raw, pathOps } = recordingCtx()
  paintMarkBlocks(
    ctx,
    LD_MARKS,
    data ? new Map([[0, data]]) : new Map(),
    ldMarkBlocks(state.canvasWidth),
    state,
  )
  // `forEachClippedBlock` opens the block's clip with a beginPath/rect/clip of
  // its own, so the cell's path is what follows that clip.
  return { ctx: raw, pathOps: pathOps.slice(pathOps.indexOf('clip') + 1) }
}

// The shader's own transform (render-core `diagonalCellToClip`), so the
// assertions below are against what the GPU actually draws rather than against
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

function rampFill(ramp: Uint8Array, t: number) {
  const o = Math.round(t * 255) * 4
  const a = ramp[o + 3]! / 255
  return `rgba(${ramp[o]!},${ramp[o + 1]!},${ramp[o + 2]!},${a.toFixed(3)})`
}

describe('the LD painter', () => {
  it('draws one diamond per cell', () => {
    const { pathOps } = paint(makeOneCell())

    expect(pathOps).toContain('beginPath')
    expect(pathOps).toContain('closePath')
    expect(pathOps).toContain('fill')
  })

  it('paints nothing with no payload', () => {
    expect(paint(undefined).pathOps.length).toBe(0)
  })

  // One painter serves both layouts — it walks `boundaries`, which describe
  // either — so which mark takes the block decides nothing but that the cell is
  // painted exactly once.
  it('paints a genomic-layout matrix exactly once', () => {
    expect(paint(makeGenomicCell()).pathOps.filter(o => o === 'fill')).toEqual([
      'fill',
    ])
  })

  it('reads ldValue as the ramp position directly, and clamps at both ends', () => {
    const ramp = generateLDColorRamp('r2')

    expect(paint(makeOneCell()).ctx.fillStyle).toBe(rampFill(ramp, 0.5))
    expect(
      paint(makeOneCell({ ldValues: new Float32Array([1]) })).ctx.fillStyle,
    ).toBe(rampFill(ramp, 1))
  })

  // Every ramp a display can reach is opaque, which is why the painter has no
  // alpha gate: `generateLDColorRamp` returns one of two LUTs, both built by
  // `opaqueRampLut`. A translucent one would need a matching `discard` in
  // ldUniforms.slang, which gates on `ldValueComputed` alone — so a gate here
  // would be a Canvas2D-only skip.
  it.each(['r2', 'dprime'])('every %s ramp entry is opaque', metric => {
    const ramp = generateLDColorRamp(metric)
    for (let i = 0; i < 256; i++) {
      expect(ramp[i * 4 + 3]).toBe(255)
    }
  })

  // Genomic-positions mode gives every SNP its own Voronoi width, so the cell at
  // (i=1, j=0) spans a 10-wide column against a 30-tall row. The half-diagonal
  // form this replaced took the horizontal extent from `cw` and the vertical
  // from `ch`, which describes the rotated rect only when they are equal — so a
  // genomic matrix drew cells off-center, mis-shaped, and not tiling. Uniform
  // mode never exposed it (every boundary is `i * uniformW`).
  it('draws a cell whose two spans differ as the rotated rect', () => {
    const { pathOps } = paint(
      makeOneCell({ boundaries: new Float32Array([0, 10, 40]) }),
    )

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
  it('draws equal spans as the uniform-mode rhombus', () => {
    const { pathOps } = paint(makeOneCell())

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
    } as unknown as MarkContext2D

    drawLDBlocks(
      ctx,
      {
        boundaries,
        ldValues: new Float32Array(numCells).fill(0.5),
        numCells,
        band,
        uniformW: CELL,
        metric: 'r2',
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
    } as unknown as MarkContext2D

    drawLDBlocks(
      ctx,
      {
        boundaries,
        ldValues,
        numCells: ldValues.length,
        band: BAND,
        uniformW: CELL,
        metric: 'r2',
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
