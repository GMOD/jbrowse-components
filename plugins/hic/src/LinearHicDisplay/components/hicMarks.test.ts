import { MockHal } from '@jbrowse/render-core/hal'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'

import { packTestInstances } from '../../testInstances.ts'
import { generateColorRamp } from './colorRamp.ts'
import { HIC_MARKS, hicMarkBlocks } from './hicMarks.ts'
import {
  INSTANCE_STRIDE_BYTES,
  UNIFORM_OFFSET_F32 as U,
  UNIFORM_OFFSET_U32 as UU,
} from './shaders/hic.iface.generated.ts'

import type {
  HicRenderState,
  HicUploadData,
} from './hicRenderingBackendTypes.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'

Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true })

const PASSES = HIC_MARKS.map(m => m.pass)

function makeData({
  positions = [10, 20],
  counts = [50],
  ...overrides
}: {
  positions?: number[]
  counts?: number[]
} & Partial<Omit<HicUploadData, 'instances'>> = {}): HicUploadData {
  return {
    instances: packTestInstances(positions, counts),
    numContacts: counts.length,
    binWidth: 10,
    ...overrides,
  }
}

function makeRenderState(overrides?: Partial<HicRenderState>): HicRenderState {
  return {
    canvasWidth: 800,
    canvasHeight: 600,
    yScalar: 1,
    colorMaxScore: 100,
    useLogScale: false,
    colorScheme: 'juicebox',
    viewScale: 1,
    viewOffsetX: 0,
    ...overrides,
  }
}

function render(data: HicUploadData | undefined, state = makeRenderState()) {
  const hal = new MockHal(PASSES)
  const backend = new GpuMarkBackend(hal, HIC_MARKS)
  const regions = new Map<number, HicUploadData>()
  if (data) {
    regions.set(0, data)
    backend.upload(0, data)
  }
  const painted = backend.renderBlocks(
    hicMarkBlocks(state.canvasWidth),
    regions,
    state,
  )
  return { hal, backend, painted }
}

describe('the hic mark list', () => {
  it('uploads the worker-packed instance buffer untouched', () => {
    const hal = new MockHal(PASSES)
    const backend = new GpuMarkBackend(hal, HIC_MARKS)
    const uploads = jest.spyOn(hal, 'uploadBuffer')
    const instances = packTestInstances([10, 20, 30, 40], [5, 15])

    backend.upload(0, { instances, numContacts: 2, binWidth: 10 })

    const buf = hal.getBuffer(0, 'main')
    expect(buf!.count).toBe(2)
    expect(buf!.data.byteLength).toBe(2 * INSTANCE_STRIDE_BYTES)
    // Zero-copy: the pack is the identity, so the HAL is handed that exact
    // object. Asserted on the argument, not on `buf.data`, because MockHal
    // copies on upload exactly as both real HALs do.
    expect(uploads.mock.calls[0]![2]).toBe(instances)
  })

  it('releases the buffer for a matrix with no contacts', () => {
    const hal = new MockHal(PASSES)
    const backend = new GpuMarkBackend(hal, HIC_MARKS)

    backend.upload(0, makeData())
    expect(hal.getBufferCount(0, 'main')).toBe(1)

    backend.upload(0, makeData({ positions: [], counts: [] }))
    expect(hal.getBufferCount(0, 'main')).toBe(0)
  })

  it('writes the uniform block for one frame', () => {
    const { hal } = render(
      makeData(),
      makeRenderState({ viewOffsetX: 400, useLogScale: true }),
    )

    const f32 = hal.getLastUniformsF32()!
    const u32 = hal.getLastUniformsU32()!
    expect(f32[U.canvasSize]).toBe(800)
    expect(f32[U.canvasSize + 1]).toBe(600)
    expect(f32[U.binWidth]).toBe(10)
    expect(f32[U.yScalar]).toBe(1)
    expect(f32[U.colorMaxScore]).toBe(100)
    expect(f32[U.viewScale]).toBe(1)
    expect(f32[U.viewOffsetX]).toBe(400)
    expect(u32[UU.useLogScale]).toBe(1)
  })

  it('renders the frame lifecycle in order', () => {
    const { hal } = render(makeData())

    const methods = hal.calls
      .filter(c =>
        [
          'resize',
          'beginFrame',
          'writeUniforms',
          'drawPass',
          'endFrame',
        ].includes(c.method),
      )
      .map(c => c.method)

    expect(methods).toEqual([
      'resize',
      'beginFrame',
      'writeUniforms',
      'drawPass',
      'endFrame',
    ])
  })

  // The palette is the mark's `texture`, not a second upload cell: the backend
  // binds it per pass and re-uploads only when the scheme's table moves.
  it('uploads the scheme ramp once, and again only when the scheme changes', () => {
    const hal = new MockHal(PASSES)
    const backend = new GpuMarkBackend(hal, HIC_MARKS)
    const data = makeData()
    const blocks = hicMarkBlocks(800)
    const regions = new Map([[0, data]])
    backend.upload(0, data)

    backend.renderBlocks(blocks, regions, makeRenderState())
    backend.renderBlocks(blocks, regions, makeRenderState())

    const texCalls = hal.callsOf('uploadTexture')
    expect(texCalls.length).toBe(1)
    expect(texCalls[0]!.args[0]).toBe('main')
    expect(texCalls[0]!.args[2]).toBe(256)
    expect(texCalls[0]!.args[3]).toBe(1)
    expect(hal.getTexture('main')).toEqual(generateColorRamp('juicebox'))

    backend.renderBlocks(
      blocks,
      regions,
      makeRenderState({ colorScheme: 'viridis' }),
    )
    expect(hal.callsOf('uploadTexture').length).toBe(2)
    expect(hal.getTexture('main')).toEqual(generateColorRamp('viridis'))
  })
})

// `renderBlocks` answers whether real content reached the canvas, and
// RenderLifecycleMixin flips `canvasDrawn` — the loading scrim,
// `data-display-drawn`, every readiness wait — off that answer alone.
describe('the hic mark list, paint reporting', () => {
  it('true once the matrix is in the region map', () => {
    expect(render(makeData()).painted).toBe(true)
  })

  it('false with no payload at all', () => {
    const { painted, hal } = render(undefined)
    expect(painted).toBe(false)
    expect(hal.callsOf('drawPass').length).toBe(0)
  })

  // The cleared canvas is the whole picture for an empty matrix, and no later
  // frame will upload bytes for it. `false` here left `canvasDrawn` unset for
  // good, and the scrim stayed over a channel that is simply empty in this
  // window.
  it('true for a region that fetched no contacts, with nothing drawn', () => {
    const { painted, hal } = render(makeData({ positions: [], counts: [] }))
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
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
  }
  return { ctx: ctx as unknown as MarkContext2D, raw: ctx }
}

function paint(data: HicUploadData | undefined, state = makeRenderState()) {
  const { ctx, raw } = recordingCtx()
  paintMarkBlocks(
    ctx,
    HIC_MARKS,
    data ? new Map([[0, data]]) : new Map(),
    hicMarkBlocks(state.canvasWidth),
    state,
  )
  return raw
}

describe('the hic painter', () => {
  it('fills one rect per contact', () => {
    const ctx = paint(makeData())

    expect(ctx.fillRect).toHaveBeenCalledTimes(1)
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 10, 10)
  })

  it('applies yScalar through the ctx stack and viewScale on the coordinates', () => {
    const ctx = paint(
      makeData(),
      makeRenderState({ viewScale: 2, viewOffsetX: 100, yScalar: 0.5 }),
    )

    expect(ctx.translate).toHaveBeenCalledWith(100, 0)
    expect(ctx.scale).toHaveBeenCalledWith(1, 0.5)
    expect(ctx.rotate).toHaveBeenCalledWith(-Math.PI / 4)
    expect(ctx.fillRect).toHaveBeenCalledWith(20, 40, 20, 20)
    expect(ctx.restore).toHaveBeenCalled()
  })

  it('paints nothing with no payload', () => {
    expect(paint(undefined).fillRect).not.toHaveBeenCalled()
  })

  // The juicebox ramp fades alpha to 0 at the bottom, and hic.slang's fragment
  // discards on the same `MIN_VISIBLE_ALPHA` test.
  it('skips a bin the ramp leaves effectively transparent', () => {
    const ctx = paint(makeData({ positions: [0, 0], counts: [0] }))

    expect(ctx.fillRect).not.toHaveBeenCalled()
  })

  it('paints every contact of a multi-contact matrix', () => {
    const ctx = paint(
      makeData({ positions: [0, 0, 10, 10, 20, 20], counts: [50, 75, 90] }),
    )

    expect(ctx.fillRect).toHaveBeenCalledTimes(3)
  })

  it('maps counts differently under a log scale', () => {
    const linear = paint(makeData({ positions: [0, 0], counts: [50] }))
    const log = paint(
      makeData({ positions: [0, 0], counts: [50] }),
      makeRenderState({ useLogScale: true }),
    )

    expect(linear.fillStyle).not.toBe(log.fillStyle)
  })

  // Canvas2D pays a full fillRect per contact, and a panned viewport redraws a
  // matrix that partly sits off-screen (pan is a redraw over the buffered
  // static-block fetch), so the draw loop culls on the rotated x axis.
  // A cull that eats a visible bin is worse than no cull, hence the edge cases.
  describe('off-screen culling', () => {
    // screen x of a cell's apex-ward corner is `((px+py)/√2)*viewScale + off`
    const screenX = (px: number, py: number) => ((px + py) / Math.SQRT2) * 1
    const W = 10

    function drawnAt(px: number, py: number, canvasWidth: number) {
      const ctx = paint(
        makeData({ positions: [px, py], binWidth: W }),
        makeRenderState({ canvasWidth }),
      )
      return ctx.fillRect.mock.calls.length === 1
    }

    it('drops a cell entirely right of the canvas', () => {
      expect(screenX(1200, 1200)).toBeGreaterThan(800)
      expect(drawnAt(1200, 1200, 800)).toBe(false)
    })

    it('drops a cell entirely left of the canvas', () => {
      expect(drawnAt(-500, -500, 800)).toBe(false)
    })

    it('keeps a cell straddling the left edge', () => {
      // apex corner is off-screen left, but the cell's far corner
      // (px+W, py+W) — 2*binWidth further along the sum axis — is on-screen
      const px = -W / 2
      expect(screenX(px, px)).toBeLessThan(0)
      expect(screenX(px + W, px + W)).toBeGreaterThan(0)
      expect(drawnAt(px, px, 800)).toBe(true)
    })

    it('keeps a cell straddling the right edge', () => {
      const px = (800 * Math.SQRT2 - 5) / 2
      expect(screenX(px, px)).toBeLessThan(800)
      expect(screenX(px + W, px + W)).toBeGreaterThan(800)
      expect(drawnAt(px, px, 800)).toBe(true)
    })
  })
})
