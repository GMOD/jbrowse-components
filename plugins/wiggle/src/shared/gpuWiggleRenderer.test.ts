import { MockHal } from '@jbrowse/core/gpu/hal'

import { GpuWiggleRenderer, WIGGLE_PASSES } from './GpuWiggleRenderer.ts'
import {
  INSTANCE_STRIDE_F32 as INSTANCE_STRIDE,
  UNIFORM_OFFSET_F32 as U,
} from './shaders/wiggle.generated.ts'
import {
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_XYPLOT,
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
} from './wiggleComponentUtils.ts'

import type {
  SourceRenderData,
  WiggleRenderBlock,
} from './wiggleBackendTypes.ts'

// GpuWiggleRenderer reads window.devicePixelRatio
beforeAll(() => {
  ;(globalThis as Record<string, unknown>).window = { devicePixelRatio: 1 }
})

afterAll(() => {
  delete (globalThis as Record<string, unknown>).window
})

function makeSource(overrides?: Partial<SourceRenderData>): SourceRenderData {
  return {
    featurePositions: new Uint32Array([100, 200, 200, 300]),
    featureScores: new Float32Array([5, 10]),
    numFeatures: 2,
    color: [1, 0, 0],
    rowIndex: 0,
    ...overrides,
  }
}

function makeBlock(overrides?: Partial<WiggleRenderBlock>): WiggleRenderBlock {
  return {
    displayedRegionIndex: 0,
    bpRangeX: [0, 1000],
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
    ...overrides,
  }
}

describe('GpuWiggleRenderer', () => {
  it('uploads region data as interleaved buffer', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)
    const source = makeSource()

    renderer.uploadRegion(0, [source])

    const buf = hal.getBuffer(0, 'fill')
    expect(buf).toBeDefined()
    expect(buf!.count).toBe(2)
    expect(buf!.data.byteLength).toBe(2 * INSTANCE_STRIDE * 4)

    const f32 = new Float32Array(buf!.data)
    const u32 = new Uint32Array(buf!.data)
    // first instance: start=100, end=200
    expect(u32[0]).toBe(100)
    expect(u32[1]).toBe(200)
    // score=5.0
    expect(f32[2]).toBeCloseTo(5)
    // prev_score for first feature = itself
    expect(f32[3]).toBeCloseTo(5)
    // color ABGR-packed at slot 4: [1,0,0] normalized → A=255,B=0,G=0,R=255
    expect(u32[4]).toBe(0xff0000ff)
    // row_index at slot 5
    expect(f32[5]).toBe(0)
  })

  it('deletes region when uploading empty sources', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.uploadRegion(0, [makeSource()])
    expect(hal.getBufferCount(0, 'fill')).toBe(2)

    renderer.uploadRegion(0, [])
    expect(hal.getBufferCount(0, 'fill')).toBe(0)
    expect(hal.callsOf('deleteRegion').length).toBe(1)
  })

  it('prunes inactive regions', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.uploadRegion(0, [makeSource()])
    renderer.uploadRegion(1, [makeSource()])
    renderer.uploadRegion(2, [makeSource()])

    renderer.pruneRegions([0, 2])

    expect(hal.callsOf('deleteRegion')).toEqual([
      { method: 'deleteRegion', args: [1] },
    ])
    expect(hal.getBufferCount(0, 'fill')).toBe(2)
    expect(hal.getBufferCount(1, 'fill')).toBe(0)
    expect(hal.getBufferCount(2, 'fill')).toBe(2)
  })

  it('renders blocks with correct frame lifecycle', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.uploadRegion(0, [makeSource()])

    renderer.renderBlocks([makeBlock()], {
      canvasWidth: 800,
      canvasHeight: 400,
      renderingType: RENDERING_TYPE_XYPLOT,
      scaleType: SCALE_TYPE_LINEAR,
      domainY: [0, 20],
    })

    const methods = hal.calls.map(c => c.method)
    expect(methods).toContain('resize')
    expect(methods).toContain('beginFrame')
    expect(methods).toContain('setScissor')
    expect(methods).toContain('setViewport')
    expect(methods).toContain('writeUniforms')
    expect(methods).toContain('drawPass')
    expect(methods).toContain('clearScissor')
    expect(methods).toContain('clearViewport')
    expect(methods).toContain('endFrame')

    // resize before beginFrame
    expect(methods.indexOf('resize')).toBeLessThan(
      methods.indexOf('beginFrame'),
    )
    // beginFrame before drawPass
    expect(methods.indexOf('beginFrame')).toBeLessThan(
      methods.indexOf('drawPass'),
    )
    // drawPass before endFrame
    expect(methods.indexOf('drawPass')).toBeLessThan(
      methods.indexOf('endFrame'),
    )
  })

  it('writes correct uniforms for XY plot', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.uploadRegion(0, [makeSource()])

    renderer.renderBlocks([makeBlock()], {
      canvasWidth: 800,
      canvasHeight: 400,
      renderingType: RENDERING_TYPE_XYPLOT,
      scaleType: SCALE_TYPE_LINEAR,
      domainY: [0, 20],
    })

    const f32 = hal.getLastUniformsF32()!
    const i32 = hal.getLastUniformsI32()!

    expect(f32[U.canvasHeight]).toBe(400)
    expect(i32[U.scaleType]).toBe(SCALE_TYPE_LINEAR)
    expect(i32[U.renderingType]).toBe(RENDERING_TYPE_XYPLOT)
    expect(f32[U.domainYMin]).toBe(0)
    expect(f32[U.domainYMax]).toBe(20)
    // zero MUST be 0.0 for hp-math precision
    expect(f32[U.zero]).toBe(0)
    expect(f32[U.reversed]).toBe(0)
  })

  it('uses line pass for LINE rendering type', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.uploadRegion(0, [makeSource()])

    renderer.renderBlocks([makeBlock()], {
      canvasWidth: 800,
      canvasHeight: 400,
      renderingType: RENDERING_TYPE_LINE,
      scaleType: SCALE_TYPE_LINEAR,
      domainY: [0, 20],
    })

    const drawCalls = hal.callsOf('drawPass')
    expect(drawCalls.length).toBe(1)
    // passId='line', regionKey=0, bufferPassId='fill'
    expect(drawCalls[0]!.args[0]).toBe('line')
    expect(drawCalls[0]!.args[1]).toBe(0)
    expect(drawCalls[0]!.args[2]).toBe('fill')
  })

  it('uses fill pass for XY plot rendering type', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.uploadRegion(0, [makeSource()])

    renderer.renderBlocks([makeBlock()], {
      canvasWidth: 800,
      canvasHeight: 400,
      renderingType: RENDERING_TYPE_XYPLOT,
      scaleType: SCALE_TYPE_LINEAR,
      domainY: [0, 20],
    })

    const drawCalls = hal.callsOf('drawPass')
    expect(drawCalls.length).toBe(1)
    expect(drawCalls[0]!.args[0]).toBe('fill')
  })

  it('skips blocks with no uploaded data', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.renderBlocks([makeBlock({ displayedRegionIndex: 99 })], {
      canvasWidth: 800,
      canvasHeight: 400,
      renderingType: RENDERING_TYPE_XYPLOT,
      scaleType: SCALE_TYPE_LINEAR,
      domainY: [0, 20],
    })

    expect(hal.callsOf('drawPass').length).toBe(0)
    expect(hal.callsOf('beginFrame').length).toBe(1)
    expect(hal.callsOf('endFrame').length).toBe(1)
  })

  it('renders multiple blocks in one frame', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.uploadRegion(0, [makeSource()])
    renderer.uploadRegion(1, [makeSource()])

    renderer.renderBlocks(
      [
        makeBlock({
          displayedRegionIndex: 0,
          screenStartPx: 0,
          screenEndPx: 400,
        }),
        makeBlock({
          displayedRegionIndex: 1,
          screenStartPx: 400,
          screenEndPx: 800,
          bpRangeX: [1000, 2000],
        }),
      ],
      {
        canvasWidth: 800,
        canvasHeight: 400,
        renderingType: RENDERING_TYPE_XYPLOT,
        scaleType: SCALE_TYPE_LINEAR,
        domainY: [0, 20],
      },
    )

    expect(hal.callsOf('drawPass').length).toBe(2)
    expect(hal.callsOf('setScissor').length).toBe(2)
    expect(hal.callsOf('writeUniforms').length).toBe(2)
    expect(hal.callsOf('beginFrame').length).toBe(1)
    expect(hal.callsOf('endFrame').length).toBe(1)
  })

  it('handles reversed blocks', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.uploadRegion(0, [makeSource()])

    renderer.renderBlocks([makeBlock({ reversed: true })], {
      canvasWidth: 800,
      canvasHeight: 400,
      renderingType: RENDERING_TYPE_XYPLOT,
      scaleType: SCALE_TYPE_LINEAR,
      domainY: [0, 20],
    })

    const f32 = hal.getLastUniformsF32()!
    expect(f32[U.reversed]).toBe(1)
  })

  it('handles multiple sources with different row indices', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    const source0 = makeSource({ rowIndex: 0 })
    const source1 = makeSource({
      rowIndex: 1,
      color: [0, 1, 0],
      featureScores: new Float32Array([15, 20]),
    })

    renderer.uploadRegion(0, [source0, source1])

    const buf = hal.getBuffer(0, 'fill')
    expect(buf!.count).toBe(4) // 2 features * 2 sources

    const f32 = new Float32Array(buf!.data)
    const u32 = new Uint32Array(buf!.data)
    // first source row_index=0 at slot 5
    expect(f32[5]).toBe(0)
    // second source starts at offset 2*INSTANCE_STRIDE, row_index=1 at slot 5
    expect(f32[2 * INSTANCE_STRIDE + 5]).toBe(1)
    // second source color ABGR at slot 4: [0,1,0] → A=255,B=0,G=255,R=0
    expect(u32[2 * INSTANCE_STRIDE + 4]).toBe(0xff00ff00)
  })

  it('disposes cleanly', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.uploadRegion(0, [makeSource()])
    renderer.dispose()

    expect(hal.callsOf('dispose').length).toBe(1)
  })

  it('handles log scale type in uniforms', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.uploadRegion(0, [makeSource()])
    renderer.renderBlocks([makeBlock()], {
      canvasWidth: 800,
      canvasHeight: 400,
      renderingType: RENDERING_TYPE_XYPLOT,
      scaleType: SCALE_TYPE_LOG,
      domainY: [1, 1000],
    })

    const i32 = hal.getLastUniformsI32()!
    expect(i32[U.scaleType]).toBe(SCALE_TYPE_LOG)
  })
})
