import { MockHal } from '@jbrowse/core/gpu/hal'

import {
  GpuHicRenderer,
  HIC_INSTANCE_STRIDE_F32,
  HIC_PASSES,
} from './GpuHicRenderer.ts'

import type { HicRenderState } from './hicBackendTypes.ts'

function makeRenderState(overrides?: Partial<HicRenderState>): HicRenderState {
  return {
    canvasWidth: 800,
    canvasHeight: 600,
    binWidth: 10,
    yScalar: 1,
    maxScore: 100,
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

    renderer.uploadData({
      positions: new Float32Array([10, 20, 30, 40]),
      counts: new Float32Array([5, 15]),
      numContacts: 2,
    })

    const buf = hal.getBuffer(0, 'main')
    expect(buf).toBeDefined()
    expect(buf!.count).toBe(2)
    expect(buf!.data.byteLength).toBe(2 * HIC_INSTANCE_STRIDE_F32 * 4)

    const f32 = new Float32Array(buf!.data)
    // first contact: px=10, py=20, count=5.0
    expect(f32[0]).toBe(10)
    expect(f32[1]).toBe(20)
    expect(f32[2]).toBe(5)
  })

  it('deletes region on empty upload', () => {
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)

    renderer.uploadData({
      positions: new Float32Array([10, 20]),
      counts: new Float32Array([5]),
      numContacts: 1,
    })
    expect(hal.getBufferCount(0, 'main')).toBe(1)

    renderer.uploadData({
      positions: new Float32Array([]),
      counts: new Float32Array([]),
      numContacts: 0,
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

    renderer.uploadData({
      positions: new Float32Array([10, 20]),
      counts: new Float32Array([5]),
      numContacts: 1,
    })

    renderer.render(makeRenderState())

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

    renderer.uploadData({
      positions: new Float32Array([10, 20]),
      counts: new Float32Array([5]),
      numContacts: 1,
    })

    renderer.render(makeRenderState({ useLogScale: true }))

    const u32 = hal.getLastUniformsU32()!
    expect(u32[7]).toBe(1)
  })

  it('skips draw when no data uploaded', () => {
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)

    renderer.render(makeRenderState())

    expect(hal.callsOf('drawPass').length).toBe(0)
    expect(hal.callsOf('beginFrame').length).toBe(1)
    expect(hal.callsOf('endFrame').length).toBe(1)
  })

  it('renders frame lifecycle in correct order', () => {
    const hal = new MockHal(HIC_PASSES)
    const renderer = new GpuHicRenderer(hal)

    renderer.uploadData({
      positions: new Float32Array([10, 20]),
      counts: new Float32Array([5]),
      numContacts: 1,
    })

    renderer.render(makeRenderState())

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
