import { MockHal } from '@jbrowse/render-core/hal'

import { KIND_BASE, KIND_CIGAR_I } from '../LinearSyntenyRPC/syntenyColors.ts'
import { GpuSyntenyRenderer, SYNTENY_PASSES } from './GpuSyntenyRenderer.ts'
import {
  INSTANCE_STRIDE_BYTES,
  UNIFORM_OFFSET_F32 as U,
} from './shaders/syntenyFillStraight.generated.ts'
import { stubPickCtx } from './testUtils.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'

function makeMockCanvas(width = 800, height = 100): HTMLCanvasElement {
  return { width, height } as unknown as HTMLCanvasElement
}

function makeInstanceData(count = 1): SyntenyInstanceData {
  const bp = (v: number) => new Float32Array(count).fill(v)
  return {
    // window-relative bp; base0/base1 = 0 so these equal cumBp
    bp1: bp(10),
    bp2: bp(100),
    bp3: bp(110),
    bp4: bp(20),
    base0: 0,
    base1: 0,
    colors: new Uint32Array(count).fill(0x80808080),
    kinds: new Uint8Array(count),
    instanceFeatureIdx: new Uint32Array(count),
    alignmentLengths: new Float32Array(count).fill(10000),
    instanceCount: count,
  }
}

function makeParams(
  overrides: Partial<SyntenyTrackRenderParams> = {},
): SyntenyTrackRenderParams {
  return {
    yTop: 0,
    height: 100,
    alpha: 1,
    fadeThinAlignments: true,
    minAlignmentLength: 0,
    hoveredFeatureId: 0,
    clickedFeatureId: 0,
    offsetPx0: 0,
    offsetPx1: 0,
    bpPerPx0: 1,
    bpPerPx1: 1,
    drawCurves: false,
    ...overrides,
  }
}

function makeState(
  perTrack: [number, SyntenyTrackRenderParams][],
): SyntenyRenderState {
  return { overdrawPx: 300, groundColor: '#fff', perTrack: new Map(perTrack) }
}

describe('GpuSyntenyRenderer CPU pick', () => {
  let restore: (() => void) | undefined

  afterEach(() => {
    restore?.()
    restore = undefined
  })

  test('pick returns hit when the point falls inside a feature', () => {
    restore = stubPickCtx(true).restore
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    const state = makeState([[0, makeParams()]])
    renderer.upload(0, makeInstanceData())

    expect(renderer.pick(50, 50, state)).toEqual({ key: 0, instanceIndex: 0 })
  })

  test('pick returns undefined when the path does not match', () => {
    restore = stubPickCtx(false).restore
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    const state = makeState([[0, makeParams()]])
    renderer.upload(0, makeInstanceData())

    expect(renderer.pick(50, 50, state)).toBeUndefined()
  })

  test('off-canvas Y returns undefined without consulting the path', () => {
    restore = stubPickCtx(true).restore
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    const state = makeState([[0, makeParams()]])
    renderer.upload(0, makeInstanceData())

    expect(renderer.pick(50, 9999, state)).toBeUndefined()
  })
})

test('an empty render paints the background with no draw calls', () => {
  // What a level with no synteny display left asks for — see the render
  // callback in LinearSyntenyViewHelper/stateModelFactory. The repaint is what
  // erases the departed track, so it must not be skipped.
  const hal = new MockHal(SYNTENY_PASSES)
  const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
  renderer.render(makeState([]))

  expect(hal.calls.map(c => c.method)).toEqual(['beginFrame', 'endFrame'])
})

describe('GpuSyntenyRenderer clicked outline', () => {
  // Two features, three instances: feature 1's base + CIGAR tile, feature 2's
  // base. Only the first is a clicked-outline silhouette.
  function makeClickableData(): SyntenyInstanceData {
    return {
      ...makeInstanceData(3),
      kinds: Uint8Array.from([KIND_BASE, KIND_CIGAR_I, KIND_BASE]),
      instanceFeatureIdx: Uint32Array.from([0, 0, 1]),
    }
  }

  // The regression this buffer exists for: the edge pass used to be drawn
  // against the fill pass's buffer, so it ran the vertex shader over every
  // instance in the region to outline one ribbon. It now gets a buffer of its
  // own holding just that ribbon, and draws with no bufferPassId.
  test('draws the edge pass against a one-instance buffer of its own', () => {
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    renderer.upload(0, makeClickableData())

    renderer.render(makeState([[0, makeParams({ clickedFeatureId: 1 })]]))

    expect(hal.getBufferCount(0, 'fillStraight')).toBe(3)
    expect(hal.getBufferCount(0, 'edgeStraight')).toBe(1)
    expect(hal.callsOf('drawPass').map(c => c.args)).toEqual([
      ['fillStraight', 0, undefined],
      ['edgeStraight', 0, undefined],
    ])
  })

  test('re-renders the same selection without re-uploading', () => {
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    renderer.upload(0, makeClickableData())
    const state = makeState([[0, makeParams({ clickedFeatureId: 1 })]])

    renderer.render(state)
    hal.calls = []
    renderer.render(state)

    expect(hal.callsOf('uploadBuffer')).toEqual([])
  })

  // A drawCurves toggle moves the outline to the other edge pass. The old
  // pass's buffer has to go, or it sits on the GPU unreferenced for the life of
  // the region.
  test('a drawCurves toggle moves the buffer to the other edge pass', () => {
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    renderer.upload(0, makeClickableData())

    renderer.render(makeState([[0, makeParams({ clickedFeatureId: 1 })]]))
    hal.calls = []
    renderer.render(
      makeState([[0, makeParams({ clickedFeatureId: 1, drawCurves: true })]]),
    )

    expect(hal.getBufferCount(0, 'edgeStraight')).toBe(0)
    expect(hal.getBufferCount(0, 'edgeCurve')).toBe(1)
    expect(hal.callsOf('deleteBuffer').map(c => c.args)).toContainEqual([
      0,
      'edgeStraight',
    ])
  })

  test('a new selection repacks the outline', () => {
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    const data = makeClickableData()
    renderer.upload(0, data)

    renderer.render(makeState([[0, makeParams({ clickedFeatureId: 1 })]]))
    renderer.render(makeState([[0, makeParams({ clickedFeatureId: 2 })]]))

    // Feature 2 is instance 2, so the packed record must be that one's.
    const packed = hal.getBuffer(0, 'edgeStraight')!
    const full = hal.getBuffer(0, 'fillStraight')!
    expect(packed.count).toBe(1)
    expect(new Uint8Array(packed.data)).toEqual(
      new Uint8Array(full.data).slice(
        2 * INSTANCE_STRIDE_BYTES,
        3 * INSTANCE_STRIDE_BYTES,
      ),
    )
  })

  // The clicked feature can live in a different region than the one being
  // drawn — every region renders with the same clickedFeatureId. An empty
  // upload leaves no buffer, so the pass must be skipped rather than issued.
  test('skips the edge pass when the clicked feature is not in the region', () => {
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    renderer.upload(0, makeClickableData())

    renderer.render(makeState([[0, makeParams({ clickedFeatureId: 99 })]]))

    expect(hal.callsOf('drawPass').map(c => c.args[0])).toEqual([
      'fillStraight',
    ])
  })

  // New geometry for a region invalidates the outline packed from the old.
  test('re-uploaded geometry drops the stale outline buffer', () => {
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    renderer.upload(0, makeClickableData())
    renderer.render(makeState([[0, makeParams({ clickedFeatureId: 1 })]]))

    renderer.upload(0, makeClickableData())

    expect(hal.getBufferCount(0, 'edgeStraight')).toBe(0)
  })
})

describe('GpuSyntenyRenderer window-relative uniforms', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 1,
      writable: true,
    })
  })

  // The panPx uniform is the whole point of the window-relative scheme: it
  // folds the genome-scale (base - viewportStart) delta on the CPU (float64) so
  // a single Float32 corner projects correctly. base0/base1 = 0 in the other
  // fixtures, so this is the only test that exercises a non-trivial base.
  test('panPx projects a genome-scale corner to the correct screen X', () => {
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas(800, 100))
    const base = 1.5e9 // fetch-time base cumBp, past Float32 exact-int
    const data: SyntenyInstanceData = {
      ...makeInstanceData(1),
      base0: base,
      base1: base,
      bp1: Float32Array.from([300]), // corner at cumBp = base + 300
    }
    renderer.upload(0, data)
    // Render with the view panned 500px past the fetch base (bpPerPx = 1).
    const offsetPx = base - 500
    renderer.render(
      makeState([
        [0, makeParams({ offsetPx0: offsetPx, offsetPx1: offsetPx })],
      ]),
    )
    const u = hal.getLastUniformsF32()!
    // panPx0 = (base - offsetPx*bpPerPx)/bpPerPx = 500
    expect(u[U.panPx0]!).toBeCloseTo(500, 2)
    // screenX = bp1*bpPerPxInv0 + panPx0 == true (cumBp/bpPerPx - offsetPx)
    const screenX = data.bp1[0]! * u[U.bpPerPxInv0]! + u[U.panPx0]!
    expect(screenX).toBeCloseTo((base + 300) / 1 - offsetPx, 2)
  })

  // The shaders size their AA ramps at one OUTPUT pixel, but measure in CSS px,
  // so they need the ratio between the two (aaHalfPx in syntenyTypes.slang).
  // It has to be the same getDpr() that `resolution` is divided by, or the
  // ramps and the geometry disagree about what a pixel is.
  test.each([1, 2])('writes devicePixelRatio (dpr=%i) with resolution', dpr => {
    Object.defineProperty(window, 'devicePixelRatio', {
      value: dpr,
      writable: true,
    })
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas(800, 100))
    renderer.upload(0, makeInstanceData(1))
    renderer.render(makeState([[0, makeParams({})]]))

    const u = hal.getLastUniformsF32()!
    expect(u[U.devicePixelRatio]).toBe(dpr)
    // resolution is the CSS-px size the same ratio implies
    expect(u[U.resolution]).toBe(800 / dpr)
    expect(u[U.resolution + 1]).toBe(100 / dpr)
  })
})
