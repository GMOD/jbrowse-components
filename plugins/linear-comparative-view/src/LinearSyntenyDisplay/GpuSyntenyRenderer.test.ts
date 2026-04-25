import { GpuSyntenyRenderer, SYNTENY_PASSES } from './GpuSyntenyRenderer.ts'
import { MockHal } from '../../../../packages/core/src/gpu/hal/mockHal.ts'

import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyBackendTypes.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

// Extends MockHal so readPickingPixelAsync returns a manually-resolved promise,
// letting tests control exactly when the GPU readback "completes".
class ControlledMockHal extends MockHal {
  private resolvers: ((val: number) => void)[] = []

  override readPickingPixelAsync(_x: number, _y: number): Promise<number> {
    return new Promise(resolve => this.resolvers.push(resolve))
  }

  resolveNextPick(value: number) {
    this.resolvers.shift()?.(value)
  }

  pendingReadbacks() {
    return this.resolvers.length
  }
}

function makeMockCanvas(width = 800, height = 100): HTMLCanvasElement {
  return { width, height } as unknown as HTMLCanvasElement
}

function makeInstanceData(): SyntenyInstanceData {
  const count = 1
  return {
    x1: new Float32Array(count).fill(10),
    x2: new Float32Array(count).fill(100),
    x3: new Float32Array(count).fill(110),
    x4: new Float32Array(count).fill(20),
    colors: new Uint32Array(count).fill(0x80808080),
    kinds: new Uint8Array(count),
    instanceFeatureIdx: new Uint32Array(count),
    featureIds: new Float32Array(count).fill(1),
    queryTotalLengths: new Float32Array(count).fill(10000),
    padTops: new Float32Array(count).fill(0),
    padBottoms: new Float32Array(count).fill(0),
    instanceCount: count,
    nonCigarInstanceCount: count,
    geometryBpPerPx0: 1,
    geometryBpPerPx1: 1,
    refOffset0: 0,
    refOffset1: 0,
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
    offset0: 0,
    offset1: 0,
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
  return { maxOffScreenPx: 300, perTrack: new Map(perTrack) }
}

async function flushPromises() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

describe('GpuSyntenyRenderer async pick — generation counter', () => {
  test('in-flight pick result is delivered when not cancelled', async () => {
    const hal = new ControlledMockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    renderer.uploadGeometry(0, makeInstanceData())
    renderer.render(makeState([[0, makeParams()]]))

    const onResult = jest.fn()
    renderer.pick(50, 50, onResult)
    expect(hal.pendingReadbacks()).toBe(1)

    hal.resolveNextPick(0) // featureIndex 0
    await flushPromises()

    expect(onResult).toHaveBeenCalledWith({ key: 0, featureIndex: 0 })
  })

  test('off-canvas pick calls onResult synchronously with undefined (no readback started)', () => {
    const hal = new ControlledMockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    renderer.uploadGeometry(0, makeInstanceData())
    renderer.render(makeState([[0, makeParams()]]))

    const onResult = jest.fn()
    renderer.pick(-99999, -99999, onResult)

    expect(hal.pendingReadbacks()).toBe(0)
    expect(onResult).toHaveBeenCalledWith(undefined)
  })

  // Regression test for: mouse leaving canvas while a GPU readback is in
  // flight causes hover state to re-set after handleMouseLeave clears it.
  // Fix: each pick() call captures the current hoverGeneration; the async
  // result is silently dropped if the generation has advanced by the time it
  // resolves (i.e. a newer pick — the cancel-pick from handleMouseLeave —
  // was queued in the meantime).
  test('in-flight hover pick is discarded when a newer pick is queued before it resolves', async () => {
    const hal = new ControlledMockHal(SYNTENY_PASSES)
    const renderer = new GpuSyntenyRenderer(hal, makeMockCanvas())
    renderer.uploadGeometry(0, makeInstanceData())
    renderer.render(makeState([[0, makeParams()]]))

    const onHover = jest.fn()
    const onLeave = jest.fn()

    // Simulates dispatchHoverPick on mouse-move over a feature
    renderer.pick(50, 50, onHover)
    expect(hal.pendingReadbacks()).toBe(1)

    // Simulates the cancel-pick dispatched by handleMouseLeave before the
    // readback above has resolved.
    renderer.pick(-99999, -99999, onLeave)

    // Resolve the now-stale hover readback
    hal.resolveNextPick(0)
    await flushPromises()

    // The hover callback must NOT fire — its generation was superseded
    expect(onHover).not.toHaveBeenCalled()
    // The leave callback fires with undefined (no track at the off-canvas coord)
    expect(onLeave).toHaveBeenCalledWith(undefined)
  })
})
