import { MockHal } from '@jbrowse/render-core/hal'

import { packTestInstances } from '../../testInstances.ts'
import { GpuHicRenderer, HIC_PASSES } from './GpuHicRenderer.ts'
// the packed layout is the generated shader's, so assert against it directly
import { INSTANCE_STRIDE_BYTES } from './shaders/hic.iface.generated.ts'

import type {
  HicRenderState,
  HicUploadData,
} from './hicRenderingBackendTypes.ts'

function makeData(overrides?: Partial<HicUploadData>): HicUploadData {
  return {
    instances: packTestInstances([10, 20], [5]),
    numContacts: 1,
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
    viewScale: 1,
    viewOffsetX: 400,
    ...overrides,
  }
}

describe('GpuHicRenderer', () => {
  it('uploads interleaved contact data', () => {
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)

    const uploads = jest.spyOn(hal, 'uploadBuffer')
    const instances = packTestInstances([10, 20, 30, 40], [5, 15])
    renderer.upload('data', { instances, numContacts: 2, binWidth: 10 })

    const buf = hal.getBuffer(0, 'main')
    expect(buf).toBeDefined()
    expect(buf!.count).toBe(2)
    expect(buf!.data.byteLength).toBe(2 * INSTANCE_STRIDE_BYTES)

    // Zero-copy: the worker's payload IS the vertex buffer, so the renderer has
    // to hand the HAL that exact object rather than re-interleaving it first —
    // the O(numContacts) main-thread pack this replaced. Asserted on the
    // argument, not on `buf.data`, because MockHal copies on upload exactly as
    // both real HALs do.
    expect(uploads.mock.calls[0]![2]).toBe(instances)

    // first contact: px=10, py=20, count=5.0
    expect(instances[0]).toBe(10)
    expect(instances[1]).toBe(20)
    expect(instances[2]).toBe(5)
  })

  it('deletes region on empty upload', () => {
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)

    renderer.upload('data', {
      instances: packTestInstances([10, 20], [5]),
      numContacts: 1,
      binWidth: 10,
    })
    expect(hal.getBufferCount(0, 'main')).toBe(1)

    renderer.upload('data', {
      instances: packTestInstances([], []),
      numContacts: 0,
      binWidth: 10,
    })
    expect(hal.getBufferCount(0, 'main')).toBe(0)
  })

  it('uploads color ramp texture', () => {
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)

    const ramp = new Uint8Array(256 * 4)
    renderer.uploadColorRamp(ramp)

    const texCalls = hal.callsOf('uploadTexture')
    expect(texCalls.length).toBe(1)
    expect(texCalls[0]!.args[0]).toBe('main')
    // width=256, height=1
    expect(texCalls[0]!.args[2]).toBe(256)
    expect(texCalls[0]!.args[3]).toBe(1)
  })

  it('renders with correct uniforms', () => {
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)

    const data = makeData()
    renderer.upload('data', data)

    renderer.render(data, makeRenderState())

    const f32 = hal.getLastUniformsF32()!
    const u32 = hal.getLastUniformsU32()!
    expect(f32[0]).toBe(800) // canvas_width
    expect(f32[1]).toBe(600) // canvas_height
    expect(f32[2]).toBe(10) // bin_width
    expect(f32[3]).toBe(1) // y_scalar
    expect(f32[4]).toBe(100) // max_score
    expect(f32[5]).toBe(1) // view_scale
    expect(f32[6]).toBe(400) // view_offset_x
    expect(u32[7]).toBe(0) // use_log_scale=false -> 0
  })

  it('sets log scale flag in uniforms', () => {
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)

    const data = makeData()
    renderer.upload('data', data)

    renderer.render(data, makeRenderState({ useLogScale: true }))

    const u32 = hal.getLastUniformsU32()!
    expect(u32[7]).toBe(1)
  })

  it('skips draw when no data uploaded', () => {
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)

    renderer.render(null, makeRenderState())

    expect(hal.callsOf('drawPass').length).toBe(0)
    expect(hal.callsOf('beginFrame').length).toBe(1)
    expect(hal.callsOf('endFrame').length).toBe(1)
  })

  it('renders frame lifecycle in correct order', () => {
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)

    const data = makeData()
    renderer.upload('data', data)

    renderer.render(data, makeRenderState())

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
})

// `render` answers whether real content reached the canvas, and
// RenderLifecycleMixin flips `canvasDrawn` — the loading scrim,
// `data-display-drawn`, every readiness wait — off that answer alone.
//
// The display's model used to give the answer instead, from whether `rpcData`
// existed. That is a weaker claim than this renderer makes: it draws only once a
// HAL buffer is actually filled, so the frame between "the fetch landed" and
// "the upload autorun ran" painted nothing and reported drawn. Nothing in tree
// catches that — `waitForDisplaysDone` swallows its own timeout, so a display
// that lies about being painted reads as a slightly slow one, and a capture
// lands on it blank.
describe('GpuHicRenderer paint reporting', () => {
  it('true once the data is uploaded and drawn', () => {
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)
    const data = makeData()
    renderer.upload('data', data)

    expect(renderer.render(data, makeRenderState())).toBe(true)
  })

  it('false while the payload is here but its buffer is not', () => {
    // The render autorun can reach the backend before the upload one has pushed
    // bytes. Nothing was drawn, so nothing should claim otherwise.
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)

    expect(renderer.render(makeData(), makeRenderState())).toBe(false)
  })

  it('true for a region that fetched no contacts', () => {
    // The cleared canvas is the whole picture for an empty matrix, and no later
    // frame will upload bytes for it. `false` here left `canvasDrawn` unset for
    // good, and `computeLoadingTerm` held the scrim over a channel that was
    // simply empty in this window.
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)
    const empty = makeData({ numContacts: 0 })
    renderer.upload('data', empty)

    expect(renderer.render(empty, makeRenderState())).toBe(true)
    expect(hal.callsOf('drawPass').length).toBe(0)
  })

  it('false with no payload at all', () => {
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)

    expect(renderer.render(null, makeRenderState())).toBe(false)
  })

  it('clears the canvas on every one of those, drawn or not', () => {
    // beginFrame is what clears, so the frame that draws nothing still has to
    // open and close one or the previous picture stays up under a display that
    // has moved on.
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)
    renderer.render(null, makeRenderState())

    expect(hal.callsOf('beginFrame')).toHaveLength(1)
    expect(hal.callsOf('endFrame')).toHaveLength(1)
  })
})
