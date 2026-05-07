import { GpuSyntenyRenderer, SYNTENY_PASSES } from './GpuSyntenyRenderer.ts'
import { MockHal } from '../../../../packages/core/src/gpu/hal/mockHal.ts'

import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

function makeMockCanvas(width = 800, height = 100): HTMLCanvasElement {
  return { width, height } as unknown as HTMLCanvasElement
}

function makeInstanceData(count = 1): SyntenyInstanceData {
  const z = () => new Float32Array(count)
  const lo = (v: number) => new Float32Array(count).fill(v)
  return {
    bp1Hi: z(),
    bp1Lo: lo(10),
    bp2Hi: z(),
    bp2Lo: lo(100),
    bp3Hi: z(),
    bp3Lo: lo(110),
    bp4Hi: z(),
    bp4Lo: lo(20),
    colors: new Uint32Array(count).fill(0x80808080),
    kinds: new Uint8Array(count),
    instanceFeatureIdx: new Uint32Array(count),
    queryTotalLengths: new Float32Array(count).fill(10000),
    padTops: new Float32Array(count).fill(0),
    padBottoms: new Float32Array(count).fill(0),
    instanceCount: count,
    nonCigarInstanceCount: count,
  }
}

function makeParams(
  overrides: Partial<SyntenyTrackRenderParams> = {},
): SyntenyTrackRenderParams {
  return {
    yTop: 0,
    height: 100,
    alpha: 1,
    minAlignmentLength: 0,
    hoveredFeatureId: 0,
    clickedFeatureId: 0,
    offsetPx0: 0,
    offsetPx1: 0,
    bpPerPx0: 1,
    bpPerPx1: 1,
    drawCurves: false,
    isSyriMode: false,
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
    renderer.uploadGeometry(0, makeInstanceData())
    renderer.render(makeState([[0, makeParams()]]))

    expect(renderer.pick(50, 50)).toEqual({ key: 0, featureIndex: 0 })
  })

  test('pick returns undefined when the path does not match', () => {
    restore = stubOffscreenIsPointInPath(false)
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    renderer.uploadGeometry(0, makeInstanceData())
    renderer.render(makeState([[0, makeParams()]]))

    expect(renderer.pick(50, 50)).toBeUndefined()
  })

  test('off-canvas Y returns undefined without consulting the path', () => {
    restore = stubOffscreenIsPointInPath(true)
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    renderer.uploadGeometry(0, makeInstanceData())
    renderer.render(makeState([[0, makeParams()]]))

    expect(renderer.pick(50, 9999)).toBeUndefined()
  })

  test('pick before render returns undefined', () => {
    restore = stubOffscreenIsPointInPath(true)
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    renderer.uploadGeometry(0, makeInstanceData())

    expect(renderer.pick(50, 50)).toBeUndefined()
  })

  test('pick after dispose returns undefined', () => {
    restore = stubOffscreenIsPointInPath(true)
    const hal = new MockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    renderer.uploadGeometry(0, makeInstanceData())
    renderer.render(makeState([[0, makeParams()]]))
    renderer.dispose()

    expect(renderer.pick(50, 50)).toBeUndefined()
  })
})
