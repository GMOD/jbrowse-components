import { MockHal } from '@jbrowse/render-core/hal'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_XYPLOT,
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
} from '@jbrowse/wiggle-core'

import { GpuWiggleRenderer, WIGGLE_PASSES } from './GpuWiggleRenderer.ts'
import {
  INSTANCE_OFFSET_F32 as FILL_F32,
  INSTANCE_OFFSET_U32 as FILL_U32,
  INSTANCE_STRIDE_WORDS as FILL_INSTANCE_STRIDE,
  UNIFORMS_SIZE_BYTES,
  UNIFORM_OFFSET_F32 as U,
  UNIFORM_OFFSET_I32 as UI,
} from './shaders/wiggle.generated.ts'
import {
  INSTANCE_OFFSET_F32 as F_F32,
  INSTANCE_OFFSET_U32 as F_U32,
  INSTANCE_STRIDE_WORDS as INSTANCE_STRIDE,
} from './shaders/wiggleLine.generated.ts'

import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { SourceRenderData } from '@jbrowse/wiggle-core'

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

function makeSource(overrides?: Partial<SourceRenderData>): SourceRenderData {
  return {
    featurePositions: new Uint32Array([100, 200, 200, 300]),
    featureScores: new Float32Array([5, 10]),
    numFeatures: 2,
    color: [1, 0, 0],
    rowIndex: 0,
    renderingType: RENDERING_TYPE_XYPLOT,
    ...overrides,
  }
}

function makeBlock(overrides?: Partial<RenderBlock>): RenderBlock {
  return {
    displayedRegionIndex: 0,
    start: 0,
    end: 1000,
    screenStartPx: 0,
    screenEndPx: 800,
    reversed: false,
    ...overrides,
  }
}

const DEFAULT_STATE = {
  canvasWidth: 800,
  canvasHeight: 400,
  renderingType: RENDERING_TYPE_XYPLOT,
  scaleType: SCALE_TYPE_LINEAR,
  symlogConstant: 1,
  domainY: [0, 20] as [number, number],
  numRows: 1,
  scatterPointSize: 2,
  lineWidth: 1,
  origin: 0,
}

describe('GpuWiggleRenderer', () => {
  // A step-line layer, so every word this checks is one the encoding carries —
  // prevScore/nextScore are the step-line pass's, and they live in the line
  // shader's record, which is why this reads the 'line' buffer
  // (wiggleInstanceBuffer.test.ts covers which mode writes what).
  it('uploads region data as interleaved buffer', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)
    const source = makeSource({ renderingType: RENDERING_TYPE_LINE })

    renderer.upload(0, [source])

    const buf = hal.getBuffer(0, 'line')
    expect(buf).toBeDefined()
    expect(buf!.count).toBe(2)
    expect(buf!.data.byteLength).toBe(2 * INSTANCE_STRIDE * 4)

    const f32 = new Float32Array(buf!.data)
    const u32 = new Uint32Array(buf!.data)
    expect(u32[F_U32.startEnd]).toBe(100)
    expect(u32[F_U32.startEnd + 1]).toBe(200)
    expect(f32[F_F32.score]).toBeCloseTo(5)
    // prev_score=0 for first feature (encodes "rise from zero" gap-before)
    expect(f32[F_F32.prevScore]).toBe(0)
    // next_score=score for adj-after — sources are [100,200],[200,300]
    expect(f32[F_F32.nextScore]).toBeCloseTo(5)
    // color [1,0,0] ABGR-packed → A=255,B=0,G=0,R=255
    expect(u32[F_U32.color]).toBe(0xff0000ff)
    expect(f32[F_F32.rowIndex]).toBe(0)
  })

  // The fill record has no room for the neighbour fields at all — that saving is
  // the point of the two shaders — so a fill region uploads the narrower buffer
  // and leaves the line pass without one.
  it('uploads the narrow record for a fill rendering, and no line buffer', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.upload(0, [makeSource({ renderingType: RENDERING_TYPE_XYPLOT })])

    const fill = hal.getBuffer(0, 'fill')
    expect(fill).toBeDefined()
    expect(fill!.count).toBe(2)
    expect(fill!.data.byteLength).toBe(2 * FILL_INSTANCE_STRIDE * 4)
    expect(FILL_INSTANCE_STRIDE).toBe(INSTANCE_STRIDE / 2)
    expect(hal.getBufferCount(0, 'line')).toBe(0)
  })

  it('releases the buffer when uploading empty sources', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.upload(0, [makeSource()])
    expect(hal.getBufferCount(0, 'fill')).toBe(2)

    renderer.upload(0, [])
    expect(hal.getBufferCount(0, 'fill')).toBe(0)
  })

  it('prunes inactive regions', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.upload(0, [makeSource()])
    renderer.upload(1, [makeSource()])
    renderer.upload(2, [makeSource()])

    renderer.release(1)

    expect(hal.getBufferCount(0, 'fill')).toBe(2)
    expect(hal.getBufferCount(1, 'fill')).toBe(0)
    expect(hal.getBufferCount(2, 'fill')).toBe(2)
  })

  it('renders blocks with correct frame lifecycle', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)
    const source = makeSource()

    renderer.upload(0, [source])
    renderer.renderBlocks(
      [makeBlock()],
      new Map([[0, [source]]]),
      DEFAULT_STATE,
    )

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

    expect(methods.indexOf('resize')).toBeLessThan(
      methods.indexOf('beginFrame'),
    )
    expect(methods.indexOf('beginFrame')).toBeLessThan(
      methods.indexOf('drawPass'),
    )
    expect(methods.indexOf('drawPass')).toBeLessThan(
      methods.indexOf('endFrame'),
    )
  })

  it('writes correct uniforms for XY plot', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)
    const source = makeSource()

    renderer.upload(0, [source])
    renderer.renderBlocks(
      [makeBlock()],
      new Map([[0, [source]]]),
      DEFAULT_STATE,
    )

    const f32 = hal.getLastUniformsF32()!
    const i32 = hal.getLastUniformsI32()!

    expect(f32[U.canvasHeight]).toBe(400)
    expect(i32[UI.scaleType]).toBe(SCALE_TYPE_LINEAR)
    expect(i32[UI.renderingType]).toBe(RENDERING_TYPE_XYPLOT)
    expect(f32[U.domainYMin]).toBe(0)
    expect(f32[U.domainYMax]).toBe(20)
    // zero MUST be 0.0 for hp-math precision
    expect(f32[U.zero]).toBe(0)
    // forward block: bpRangeX length component is positive
    expect(f32[U.bpRangeX + 2]!).toBeGreaterThan(0)
  })

  it('uses line pass for LINE rendering type', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)
    const source = makeSource({ renderingType: RENDERING_TYPE_LINE })

    renderer.upload(0, [source])
    renderer.renderBlocks([makeBlock()], new Map([[0, [source]]]), {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_LINE,
    })

    const drawCalls = hal.callsOf('drawPass')
    expect(drawCalls.length).toBe(1)
    expect(drawCalls[0]!.args[0]).toBe('line')
    expect(drawCalls[0]!.args[1]).toBe(0)
    // draws off the line record, which is the one it was packed into
    expect(drawCalls[0]!.args[2]).toBe('line')
  })

  // The buffer carries only the neighbor fields its own rendering reads, so the
  // pass has to follow the layers rather than the render state. Those two reach
  // the display through separate autoruns and the render one is registered
  // first, so the frame right after a plot-type switch really does see a state
  // that has moved and a region that has not — drawing the previous plot once is
  // correct; drawing the line pass over a fill-encoded buffer is not.
  it('draws the pass the region was encoded for, not the one the state names', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)
    const stale = makeSource({ renderingType: RENDERING_TYPE_XYPLOT })

    renderer.upload(0, [stale])
    renderer.renderBlocks([makeBlock()], new Map([[0, [stale]]]), {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_LINE,
    })

    expect(hal.callsOf('drawPass')[0]!.args[0]).toBe('fill')
  })

  // Nothing to draw either way — an empty pack releases the pass's buffer — so
  // this is only pinning that the missing-layer lookup doesn't throw.
  it('falls back to the render state when a region has no layers', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.upload(0, [])
    renderer.renderBlocks([makeBlock()], new Map([[0, []]]), {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_LINE,
    })

    expect(hal.callsOf('drawPass')[0]!.args[0]).toBe('line')
  })

  // Density is the composed rowRect × scoreScale shape (wiggleDensity.slang):
  // its own pass and pipeline, drawn off PASS_FILL's buffer because the two
  // entry shaders take the same shader-declared record.
  it('draws density through the composed pass, off the fill buffer', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)
    const source = makeSource({ renderingType: RENDERING_TYPE_DENSITY })

    renderer.upload(0, [source])
    expect(hal.getBufferCount(0, 'fill')).toBe(2)

    renderer.renderBlocks([makeBlock()], new Map([[0, [source]]]), {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_DENSITY,
    })

    const drawCalls = hal.callsOf('drawPass')
    expect(drawCalls.length).toBe(1)
    expect(drawCalls[0]!.args[0]).toBe('density')
    expect(drawCalls[0]!.args[2]).toBe('fill')
  })

  // Gate A of agent-docs/ideas/a-shape-composes-a-scale.md, instrumented as
  // bytes rather than writes counted: density's autoscale domain re-resolves
  // against the visible data on every pan, and because the score stays in the
  // instance buffer and the domain stays a uniform, that pan costs one uniform
  // block per drawn block and zero buffer bytes. The failure this pins against
  // is a CPU-side colour resolve into the instance lane, which would re-pack
  // and re-upload the whole buffer whenever the domain moved.
  it('a pan that moves the autoscale domain uploads zero buffer bytes', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)
    const source = makeSource({ renderingType: RENDERING_TYPE_DENSITY })
    const state = {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_DENSITY,
    }
    const uploadedBytes = () =>
      hal
        .callsOf('uploadBuffer')
        .reduce((total, c) => total + (c.args[2] as number), 0)

    renderer.upload(0, [source])
    const loadBytes = uploadedBytes()
    expect(loadBytes).toBe(2 * FILL_INSTANCE_STRIDE * 4)

    renderer.renderBlocks([makeBlock()], new Map([[0, [source]]]), state)

    // The pan: the block scrolls and autoscale re-resolves over the new
    // visible window, moving the domain.
    renderer.renderBlocks(
      [makeBlock({ start: 250, end: 1250 })],
      new Map([[0, [source]]]),
      { ...state, domainY: [0, 35] as [number, number] },
    )

    expect(uploadedBytes()).toBe(loadBytes)
    const f32 = hal.getLastUniformsF32()!
    expect(f32[U.domainYMax]).toBe(35)
    const writes = hal.callsOf('writeUniforms')
    expect(writes.length).toBe(2)
    expect(writes.at(-1)!.args[0]).toBe(UNIFORMS_SIZE_BYTES)
  })

  it('uses fill pass for XY plot rendering type', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)
    const source = makeSource()

    renderer.upload(0, [source])
    renderer.renderBlocks(
      [makeBlock()],
      new Map([[0, [source]]]),
      DEFAULT_STATE,
    )

    const drawCalls = hal.callsOf('drawPass')
    expect(drawCalls.length).toBe(1)
    expect(drawCalls[0]!.args[0]).toBe('fill')
  })

  it('skips blocks with no region in the map', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.renderBlocks(
      [makeBlock({ displayedRegionIndex: 99 })],
      new Map(),
      DEFAULT_STATE,
    )

    expect(hal.callsOf('drawPass').length).toBe(0)
    expect(hal.callsOf('beginFrame').length).toBe(1)
    expect(hal.callsOf('endFrame').length).toBe(1)
  })

  it('renders multiple blocks in one frame', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)
    const s0 = makeSource()
    const s1 = makeSource()

    renderer.upload(0, [s0])
    renderer.upload(1, [s1])

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
          start: 1000,
          end: 2000,
        }),
      ],
      new Map([
        [0, [s0]],
        [1, [s1]],
      ]),
      DEFAULT_STATE,
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
    const source = makeSource()

    renderer.upload(0, [source])
    renderer.renderBlocks(
      [makeBlock({ reversed: true })],
      new Map([[0, [source]]]),
      DEFAULT_STATE,
    )

    // reversed block pivots on bpEnd with a negated length component
    const f32 = hal.getLastUniformsF32()!
    expect(f32[U.bpRangeX + 2]!).toBeLessThan(0)
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

    renderer.upload(0, [source0, source1])

    // default sources are xyplot, so this is the fill record
    const buf = hal.getBuffer(0, 'fill')
    expect(buf!.count).toBe(4) // 2 features * 2 sources

    const f32 = new Float32Array(buf!.data)
    const u32 = new Uint32Array(buf!.data)
    expect(f32[FILL_F32.rowIndex]).toBe(0)
    // second source starts after the first source's two instances
    const src1 = 2 * FILL_INSTANCE_STRIDE
    expect(f32[src1 + FILL_F32.rowIndex]).toBe(1)
    // color [0,1,0] ABGR-packed → A=255,B=0,G=255,R=0
    expect(u32[src1 + FILL_U32.color]).toBe(0xff00ff00)
  })

  it('disposes cleanly', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)

    renderer.upload(0, [makeSource()])
    renderer.dispose()

    expect(hal.callsOf('dispose').length).toBe(1)
  })

  it('writes viewportWidth in CSS pixels regardless of devicePixelRatio', () => {
    // viewportWidth is what `extendToMinWidthX` divides MIN_FILL_WIDTH_PX by to
    // reach clip space, so it must be CSS px for the floor to stay a stable 1.5
    // CSS px across DPRs and match the Canvas2D WIGGLE_MIN_PX path (the same
    // generated constant). A DPR-scaled value silently halves the floor on
    // hi-DPI displays.
    const originalDpr = globalThis.devicePixelRatio
    try {
      globalThis.devicePixelRatio = 2
      const hal = new MockHal(WIGGLE_PASSES)
      const renderer = new GpuWiggleRenderer(hal)
      const source = makeSource()

      renderer.upload(0, [source])
      renderer.renderBlocks(
        [makeBlock({ screenStartPx: 0, screenEndPx: 800 })],
        new Map([[0, [source]]]),
        DEFAULT_STATE,
      )

      const f32 = hal.getLastUniformsF32()!
      expect(f32[U.viewportWidth]).toBe(800)
      // The other half of the same decision, and the opposite unit: the AA ramp
      // for the bar's horizontal cuts and the center-line capsule is sized in
      // DEVICE px, so this one is the screen density and not the CSS width
      // above. Pinned because nothing else fails if it is written as
      // `clip.pxH / canvasHeight` — that agrees with getDpr() until a canvas
      // taller than MAX_CANVAS_DIM_PX clamps its backing store.
      expect(f32[U.devicePixelRatio]).toBe(2)
    } finally {
      globalThis.devicePixelRatio = originalDpr
    }
  })

  it('writes the bicolor pivot into the origin uniform', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)
    const source = makeSource()

    renderer.upload(0, [source])
    renderer.renderBlocks([makeBlock()], new Map([[0, [source]]]), {
      ...DEFAULT_STATE,
      origin: 5,
    })

    const f32 = hal.getLastUniformsF32()!
    expect(f32[U.origin]).toBe(5)
  })

  it('handles log scale type in uniforms', () => {
    const hal = new MockHal(WIGGLE_PASSES)
    const renderer = new GpuWiggleRenderer(hal)
    const source = makeSource()

    renderer.upload(0, [source])
    renderer.renderBlocks([makeBlock()], new Map([[0, [source]]]), {
      ...DEFAULT_STATE,
      scaleType: SCALE_TYPE_LOG,
      symlogConstant: 1,
      domainY: [1, 1000],
    })

    const i32 = hal.getLastUniformsI32()!
    expect(i32[UI.scaleType]).toBe(SCALE_TYPE_LOG)
  })
})
