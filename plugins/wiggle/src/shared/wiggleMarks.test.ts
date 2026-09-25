import { rampLutOf } from '@jbrowse/core/util/colorRamp'
import { MockHal } from '@jbrowse/render-core/hal'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
  SCALE_TYPE_LINEAR,
  SCALE_TYPE_LOG,
} from '@jbrowse/wiggle-core'

import {
  INSTANCE_OFFSET_F32 as FILL_F32,
  INSTANCE_OFFSET_U32 as FILL_U32,
  INSTANCE_STRIDE_WORDS as FILL_INSTANCE_STRIDE,
  UNIFORMS_SIZE_BYTES,
  UNIFORM_OFFSET_F32 as U,
  UNIFORM_OFFSET_I32 as UI,
  UNIFORM_SLOT_ARRAYS,
} from './shaders/wiggle.generated.ts'
import {
  INSTANCE_OFFSET_F32 as F_F32,
  INSTANCE_OFFSET_U32 as F_U32,
  INSTANCE_STRIDE_WORDS as INSTANCE_STRIDE,
} from './shaders/wiggleLine.generated.ts'
import { INSTANCE_STRIDE_WORDS as CENTER_INSTANCE_STRIDE } from './shaders/wiggleLineCenter.generated.ts'
import { WIGGLE_MARKS } from './wiggleMarks.ts'

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
  diameterPx: 2,
  lineWidth: 1,
  origin: 0,
  pivot: 0,
  cuts: [0],
  innerColors: [],
}

describe('the wiggle mark list', () => {
  // A step-line layer, so this reads the 'line' buffer
  // (wiggleInstanceBuffer.test.ts covers which mode writes what).
  it('uploads region data as interleaved buffer', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const source = makeSource({ renderingType: RENDERING_TYPE_LINE })

    backend.upload(0, [source])

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

  // The fill record has no room for the neighbour fields at all, so a fill
  // region uploads the narrower buffer and leaves both line passes without one.
  it('uploads the narrow record for a fill rendering, and no line buffer', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)

    backend.upload(0, [makeSource({ renderingType: RENDERING_TYPE_XYPLOT })])

    const fill = hal.getBuffer(0, 'fill')
    expect(fill).toBeDefined()
    expect(fill!.count).toBe(2)
    expect(fill!.data.byteLength).toBe(2 * FILL_INSTANCE_STRIDE * 4)
    expect(FILL_INSTANCE_STRIDE).toBeLessThan(INSTANCE_STRIDE)
    expect(hal.getBufferCount(0, 'line')).toBe(0)
    expect(hal.getBufferCount(0, 'lineCenter')).toBe(0)
  })

  // Each line rendering owns its record, so a center-line region uploads only
  // the center line's and releases the step line's.
  it('uploads a center line into its own buffer, and no step-line buffer', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const step = makeSource({ renderingType: RENDERING_TYPE_LINE })
    const center = makeSource({ renderingType: RENDERING_TYPE_LINE_CENTER })

    backend.upload(0, [step])
    expect(hal.getBufferCount(0, 'line')).toBe(2)

    backend.upload(0, [center])
    const buf = hal.getBuffer(0, 'lineCenter')
    expect(buf!.count).toBe(2)
    expect(buf!.data.byteLength).toBe(2 * CENTER_INSTANCE_STRIDE * 4)
    expect(hal.getBufferCount(0, 'line')).toBe(0)

    backend.renderBlocks([makeBlock()], new Map([[0, [center]]]), {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_LINE_CENTER,
    })
    const [draw] = hal.callsOf('drawPass')
    expect(draw!.args[0]).toBe('lineCenter')
    expect(draw!.args[2]).toBeUndefined()
  })

  it('releases the buffer when uploading empty sources', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)

    backend.upload(0, [makeSource()])
    expect(hal.getBufferCount(0, 'fill')).toBe(2)

    backend.upload(0, [])
    expect(hal.getBufferCount(0, 'fill')).toBe(0)
  })

  it('prunes inactive regions', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)

    backend.upload(0, [makeSource()])
    backend.upload(1, [makeSource()])
    backend.upload(2, [makeSource()])

    backend.release(1)

    expect(hal.getBufferCount(0, 'fill')).toBe(2)
    expect(hal.getBufferCount(1, 'fill')).toBe(0)
    expect(hal.getBufferCount(2, 'fill')).toBe(2)
  })

  it('renders blocks with correct frame lifecycle', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const source = makeSource()

    backend.upload(0, [source])
    backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), DEFAULT_STATE)

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
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const source = makeSource()

    backend.upload(0, [source])
    backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), DEFAULT_STATE)

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
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const source = makeSource({ renderingType: RENDERING_TYPE_LINE })

    backend.upload(0, [source])
    backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_LINE,
    })

    const drawCalls = hal.callsOf('drawPass')
    expect(drawCalls.length).toBe(1)
    expect(drawCalls[0]!.args[0]).toBe('line')
    expect(drawCalls[0]!.args[1]).toBe(0)
    // no lender: the line mark owns the record it was packed into, and only
    // density borrows one
    expect(drawCalls[0]!.args[2]).toBeUndefined()
  })

  // The buffer carries only the fields its own rendering reads, so the pass has
  // to follow the layers rather than the render state. Those two reach
  // the display through separate autoruns and the render one is registered
  // first, so the frame right after a plot-type switch really does see a state
  // that has moved and a region that has not — drawing the previous plot once is
  // correct; drawing the line pass over a fill-encoded buffer is not.
  it('draws the pass the region was encoded for, not the one the state names', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const stale = makeSource({ renderingType: RENDERING_TYPE_XYPLOT })

    backend.upload(0, [stale])
    backend.renderBlocks([makeBlock()], new Map([[0, [stale]]]), {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_LINE,
    })

    expect(hal.callsOf('drawPass')[0]!.args[0]).toBe('fill')
  })

  // The band is its own record, so a whiskers line region holds two buffers.
  // The band draws last and composites behind the line already there.
  it('draws a whiskers band after the line it sits behind', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const band = makeSource({
      renderingType: RENDERING_TYPE_LINE_CENTER,
      negColor: [0, 0, 1],
      band: { minScores: new Float32Array([1, 2]) },
    })
    const mean = makeSource({ renderingType: RENDERING_TYPE_LINE_CENTER })

    backend.upload(0, [band, mean])
    backend.renderBlocks([makeBlock()], new Map([[0, [band, mean]]]), {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_LINE_CENTER,
    })

    expect(hal.getBufferCount(0, 'band')).toBe(2)
    expect(hal.getBufferCount(0, 'lineCenter')).toBe(2)
    expect(hal.callsOf('drawPass').map(c => c.args.slice(0, 1))).toEqual([
      ['lineCenter'],
      ['band'],
    ])
  })

  // Nothing to draw either way — an empty pack releases the pass's buffer — so
  // this is only pinning that the missing-layer lookup doesn't throw.
  it('falls back to the render state when a region has no layers', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)

    backend.upload(0, [])
    backend.renderBlocks([makeBlock()], new Map([[0, []]]), {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_LINE,
    })

    expect(hal.callsOf('drawPass')[0]!.args[0]).toBe('line')
  })

  // Density is the composed rowRect × scoreScale shape (wiggleDensity.slang):
  // its own pass and pipeline, drawn off PASS_FILL's buffer because the two
  // entry shaders take the same shader-declared record.
  it('draws density through the composed pass, off the fill buffer', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const source = makeSource({ renderingType: RENDERING_TYPE_DENSITY })

    backend.upload(0, [source])
    expect(hal.getBufferCount(0, 'fill')).toBe(2)

    backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_DENSITY,
    })

    const drawCalls = hal.callsOf('drawPass')
    expect(drawCalls.length).toBe(1)
    expect(drawCalls[0]!.args[0]).toBe('density')
    expect(drawCalls[0]!.args[2]).toBe('fill')
  })

  // Gate A of agent-docs/architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md, instrumented as
  // bytes rather than writes counted: density's autoscale domain re-resolves
  // against the visible data on every pan, and because the score stays in the
  // instance buffer and the domain stays a uniform, that pan costs one uniform
  // block per drawn block and zero buffer bytes. The failure this pins against
  // is a CPU-side colour resolve into the instance lane, which would re-pack
  // and re-upload the whole buffer whenever the domain moved.
  it('a pan that moves the autoscale domain uploads zero buffer bytes', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const source = makeSource({ renderingType: RENDERING_TYPE_DENSITY })
    const state = {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_DENSITY,
    }
    const uploadedBytes = () =>
      hal
        .callsOf('uploadBuffer')
        .reduce((total, c) => total + (c.args[2] as number), 0)

    backend.upload(0, [source])
    const loadBytes = uploadedBytes()
    expect(loadBytes).toBe(2 * FILL_INSTANCE_STRIDE * 4)

    backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), state)

    // The pan: the block scrolls and autoscale re-resolves over the new
    // visible window, moving the domain.
    backend.renderBlocks(
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

  it('writes each cut and the colour of each band between two of them', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const source = makeSource({ renderingType: RENDERING_TYPE_LINE })
    backend.upload(0, [source])
    backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_LINE,
      pivot: -2,
      cuts: [-2, 0, 2],
      innerColors: [
        [0.5, 0.5, 0.5],
        [0, 1, 0],
      ],
    })
    const f32 = hal.getLastUniformsF32()!
    expect(hal.getLastUniformsI32()![UI.numCuts]).toBe(3)
    const [cutsAt] = UNIFORM_SLOT_ARRAYS.cuts
    expect([...f32.slice(cutsAt, cutsAt + 3)]).toEqual([-2, 0, 2])
    const [firstInner, secondInner] = UNIFORM_SLOT_ARRAYS.innerColor
    expect([...f32.slice(firstInner, firstInner + 4)]).toEqual([
      0.5, 0.5, 0.5, 1,
    ])
    expect([...f32.slice(secondInner, secondInner + 4)]).toEqual([0, 1, 0, 1])
  })

  const texUploads = (hal: MockHal, pass: string) =>
    hal.callsOf('uploadTexture').filter(c => c.args[0] === pass).length

  // The gradient gauge (agent-docs/architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md):
  // a gradient on bars, points or density is a uniform flag and one 256×1 LUT
  // upload to the pass that draws — no new shader, no buffer byte. The LUT
  // bytes are the cached table Canvas2D indexes too (densityColorParity.test.ts
  // holds the colour parity). An autoscale pan re-colours every bar, and must
  // still cost one uniform write: the failure this pins is a colour baked into
  // the instance lane from the domain.
  describe.each([
    ['density', RENDERING_TYPE_DENSITY],
    ['xyplot', RENDERING_TYPE_XYPLOT],
    ['scatter', RENDERING_TYPE_SCATTER],
  ] as const)('a gradient on %s', (_name, renderingType) => {
    const pass = renderingType === RENDERING_TYPE_DENSITY ? 'density' : 'fill'

    it('is a uniform flag and one LUT texture upload, and a pan re-uploads nothing', () => {
      const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
      const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
      const source = makeSource({ renderingType })
      const state = {
        ...DEFAULT_STATE,
        renderingType,
        rampLut: rampLutOf({ scheme: 'viridis' }),
      }

      backend.upload(0, [source])
      const uploadedBufferBytes = () =>
        hal
          .callsOf('uploadBuffer')
          .reduce((total, c) => total + (c.args[2] as number), 0)
      const loadBytes = uploadedBufferBytes()
      backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), state)

      expect(texUploads(hal, pass)).toBe(1)
      expect(
        hal.callsOf('uploadTexture').find(c => c.args[0] === pass)!.args,
      ).toEqual([pass, 256 * 4, 256, 1])
      expect(hal.getLastUniformsI32()![UI.rampLut]).toBe(1)
      expect(hal.getTexture(pass)).toEqual(rampLutOf({ scheme: 'viridis' }))
      const textureCalls = hal.callsOf('uploadTexture').length

      backend.renderBlocks(
        [makeBlock({ start: 250, end: 1250 })],
        new Map([[0, [source]]]),
        { ...state, domainY: [0, 35] as [number, number] },
      )
      expect(hal.callsOf('uploadTexture').length).toBe(textureCalls)
      expect(uploadedBufferBytes()).toBe(loadBytes)
      expect(hal.getLastUniformsF32()![U.domainYMax]).toBe(35)
      const writes = hal.callsOf('writeUniforms')
      expect(writes.length).toBe(2)
      expect(writes.at(-1)!.args[0]).toBe(UNIFORMS_SIZE_BYTES)
    })

    // With no gradient the pass binds an inert LUT once — the shader owns a
    // sampler unconditionally, and a textured pass with no texture never draws
    // on the WebGPU HAL — while the uniform flag keeps it unsampled.
    it('binds an inert LUT once and leaves the flag off without one', () => {
      const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
      const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
      const source = makeSource({ renderingType })
      const state = { ...DEFAULT_STATE, renderingType }

      backend.upload(0, [source])
      backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), state)
      backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), state)

      expect(texUploads(hal, pass)).toBe(1)
      expect(hal.getTexture(pass)).toEqual(new Uint8Array(256 * 4))
      expect(hal.getLastUniformsI32()![UI.rampLut]).toBe(0)

      backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), {
        ...state,
        rampLut: rampLutOf({ scheme: 'viridis' }),
      })
      expect(texUploads(hal, pass)).toBe(2)
      expect(hal.getLastUniformsI32()![UI.rampLut]).toBe(1)
    })
  })

  it('a line leaves the gradient flag off: its colour still parts in two', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const source = makeSource({ renderingType: RENDERING_TYPE_LINE })
    backend.upload(0, [source])
    backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), {
      ...DEFAULT_STATE,
      renderingType: RENDERING_TYPE_LINE,
      rampLut: rampLutOf({ scheme: 'viridis' }),
    })
    expect(hal.getLastUniformsI32()![UI.rampLut]).toBe(0)
  })

  it('uses fill pass for XY plot rendering type', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const source = makeSource()

    backend.upload(0, [source])
    backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), DEFAULT_STATE)

    const drawCalls = hal.callsOf('drawPass')
    expect(drawCalls.length).toBe(1)
    expect(drawCalls[0]!.args[0]).toBe('fill')
  })

  it('skips blocks with no region in the map', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)

    backend.renderBlocks(
      [makeBlock({ displayedRegionIndex: 99 })],
      new Map(),
      DEFAULT_STATE,
    )

    expect(hal.callsOf('drawPass').length).toBe(0)
    expect(hal.callsOf('beginFrame').length).toBe(1)
    expect(hal.callsOf('endFrame').length).toBe(1)
  })

  it('renders multiple blocks in one frame', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const s0 = makeSource()
    const s1 = makeSource()

    backend.upload(0, [s0])
    backend.upload(1, [s1])

    backend.renderBlocks(
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
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const source = makeSource()

    backend.upload(0, [source])
    backend.renderBlocks(
      [makeBlock({ reversed: true })],
      new Map([[0, [source]]]),
      DEFAULT_STATE,
    )

    // reversed block pivots on bpEnd with a negated length component
    const f32 = hal.getLastUniformsF32()!
    expect(f32[U.bpRangeX + 2]!).toBeLessThan(0)
  })

  it('handles multiple sources with different row indices', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)

    const source0 = makeSource({ rowIndex: 0 })
    const source1 = makeSource({
      rowIndex: 1,
      color: [0, 1, 0],
      featureScores: new Float32Array([15, 20]),
    })

    backend.upload(0, [source0, source1])

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
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)

    backend.upload(0, [makeSource()])
    backend.dispose()

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
      const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
      const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
      const source = makeSource()

      backend.upload(0, [source])
      backend.renderBlocks(
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
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const source = makeSource()

    backend.upload(0, [source])
    backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), {
      ...DEFAULT_STATE,
      origin: 5,
      pivot: 5,
      cuts: [5],
      innerColors: [],
    })

    const f32 = hal.getLastUniformsF32()!
    expect(f32[U.origin]).toBe(5)
  })

  it('handles log scale type in uniforms', () => {
    const hal = new MockHal(WIGGLE_MARKS.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, WIGGLE_MARKS)
    const source = makeSource()

    backend.upload(0, [source])
    backend.renderBlocks([makeBlock()], new Map([[0, [source]]]), {
      ...DEFAULT_STATE,
      scaleType: SCALE_TYPE_LOG,
      symlogConstant: 1,
      domainY: [1, 1000],
    })

    const i32 = hal.getLastUniformsI32()!
    expect(i32[UI.scaleType]).toBe(SCALE_TYPE_LOG)
  })
})
