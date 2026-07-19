import { MockHal } from '@jbrowse/render-core/hal'

import { GpuSyntenyRenderer, SYNTENY_PASSES } from './GpuSyntenyRenderer.ts'
import { UNIFORM_OFFSET_F32 as U } from './shaders/syntenyFillStraight.generated.ts'

import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

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
    hoveredInstanceId: -1,
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
  return { overdrawPx: 300, perTrack: new Map(perTrack) }
}

// pickFeatureAtPoint uses ctx.isPointInPath; the OffscreenCanvas path is
// patched to return true so the Flatbush bbox candidate (always one candidate
// for our 1-instance fixtures) is accepted as a hit.
function stubOffscreenIsPointInPath(returnValue: boolean) {
  const original = (globalThis as unknown as { OffscreenCanvas?: unknown })
    .OffscreenCanvas
  ;(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas =
    class {
      getContext() {
        return {
          beginPath() {},
          closePath() {},
          moveTo() {},
          lineTo() {},
          isPointInPath: () => returnValue,
        }
      }
    }
  return () => {
    ;(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas =
      original
  }
}

describe('GpuSyntenyRenderer CPU pick', () => {
  let restore: (() => void) | undefined

  afterEach(() => {
    restore?.()
    restore = undefined
  })

  test('pick returns hit when the point falls inside a feature', () => {
    restore = stubOffscreenIsPointInPath(true)
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    const state = makeState([[0, makeParams()]])
    renderer.uploadGeometry(0, makeInstanceData())

    expect(renderer.pick(50, 50, state)).toEqual({ key: 0, featureIndex: 0 })
  })

  test('pick returns undefined when the path does not match', () => {
    restore = stubOffscreenIsPointInPath(false)
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    const state = makeState([[0, makeParams()]])
    renderer.uploadGeometry(0, makeInstanceData())

    expect(renderer.pick(50, 50, state)).toBeUndefined()
  })

  test('off-canvas Y returns undefined without consulting the path', () => {
    restore = stubOffscreenIsPointInPath(true)
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    const state = makeState([[0, makeParams()]])
    renderer.uploadGeometry(0, makeInstanceData())

    expect(renderer.pick(50, 9999, state)).toBeUndefined()
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
    renderer.uploadGeometry(0, data)
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
})
