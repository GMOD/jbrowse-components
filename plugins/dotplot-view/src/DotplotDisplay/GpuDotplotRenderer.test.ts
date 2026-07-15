import { MockHal } from '@jbrowse/render-core/hal'

import { DOTPLOT_PASSES, GpuDotplotRenderer } from './GpuDotplotRenderer.ts'
import {
  FIELD_OFFSET_F32 as F,
  INSTANCE_STRIDE_F32,
  UNIFORM_OFFSET_F32 as U,
} from './shaders/dotplot.generated.ts'

import type {
  DotplotGeometryData,
  DotplotRenderState,
} from './dotplotRenderingBackendTypes.ts'

function makeGeometry(
  overrides: Partial<DotplotGeometryData> = {},
): DotplotGeometryData {
  return {
    x1: new Float64Array([100]),
    y1: new Float64Array([200]),
    x2: new Float64Array([150]),
    y2: new Float64Array([250]),
    colors: new Uint32Array([0xff0000ff]),
    instanceCount: 1,
    baseH: 0,
    baseV: 0,
    ...overrides,
  }
}

function makeState(
  overrides: Partial<DotplotRenderState> = {},
): DotplotRenderState {
  return {
    viewBpH: 0,
    viewBpV: 0,
    bpPerPxHInv: 1,
    bpPerPxVInv: 1,
    lineWidth: 2,
    displayKeys: [0],
    ...overrides,
  }
}

describe('GpuDotplotRenderer window-relative uniforms', () => {
  test('stores coords window-relative (cumBp - base) at upload', () => {
    const hal = new MockHal(DOTPLOT_PASSES)
    const renderer = new GpuDotplotRenderer(hal)
    renderer.resize(800, 600)
    renderer.uploadGeometry(
      0,
      makeGeometry({
        x1: new Float64Array([8e8 + 100]),
        y1: new Float64Array([5e8 + 200]),
        baseH: 8e8,
        baseV: 5e8,
      }),
    )
    const stored = new Float32Array(hal.getBuffer(0, 'line')!.data)
    expect(stored[F.x1]).toBe(100)
    expect(stored[F.y1]).toBe(200)
  })

  // panPx is the whole point of the window-relative scheme: it folds the
  // genome-scale (base - viewBp) delta on the CPU (float64) so a single Float32
  // coord projects correctly. base = 0 in the other fixtures, so this is the
  // only test exercising a non-trivial base.
  test('panPx projects a genome-scale coord to the correct screen X/Y', () => {
    const hal = new MockHal(DOTPLOT_PASSES)
    const renderer = new GpuDotplotRenderer(hal)
    renderer.resize(800, 600)
    const base = 1.5e9 // fetch-time base cumBp, past Float32 exact-int
    renderer.uploadGeometry(
      0,
      makeGeometry({
        x1: new Float64Array([base + 300]), // corner at cumBp = base + 300
        y1: new Float64Array([base + 700]),
        baseH: base,
        baseV: base,
      }),
    )
    // View panned 500px past the fetch base (bpPerPx = 1 on both axes).
    const offsetBp = base - 500
    renderer.render(makeState({ viewBpH: offsetBp, viewBpV: offsetBp }))

    const u = hal.getLastUniformsF32()!
    // panPx = (base - viewBp)/bpPerPx = 500
    expect(u[U.panPxH]!).toBeCloseTo(500, 2)
    expect(u[U.panPxV]!).toBeCloseTo(500, 2)
    // screenX = xRel*bpPerPxInv + panPx == (cumBp - viewBp)/bpPerPx
    const xRel = Math.fround(base + 300 - base)
    const screenX = xRel * u[U.bpPerPxHInv]! + u[U.panPxH]!
    expect(screenX).toBeCloseTo(base + 300 - offsetBp, 2)
  })

  test('each display uses its own base for panPx', () => {
    const hal = new MockHal(DOTPLOT_PASSES)
    const renderer = new GpuDotplotRenderer(hal)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry({ baseH: 1000, baseV: 2000 }))
    renderer.uploadGeometry(1, makeGeometry({ baseH: 3000, baseV: 4000 }))
    renderer.render(makeState({ displayKeys: [0, 1] }))
    // The last drawn key (1) leaves its uniforms: panPxH = base - viewBp = 3000.
    const u = hal.getLastUniformsF32()!
    expect(u[U.panPxH]!).toBeCloseTo(3000, 2)
    expect(u[U.panPxV]!).toBeCloseTo(4000, 2)
    expect(hal.callsOf('drawPass')).toHaveLength(2)
  })

  test('zero-instance upload deletes the region and its base', () => {
    const hal = new MockHal(DOTPLOT_PASSES)
    const renderer = new GpuDotplotRenderer(hal)
    renderer.resize(800, 600)
    renderer.uploadGeometry(0, makeGeometry())
    renderer.uploadGeometry(0, makeGeometry({ instanceCount: 0 }))
    renderer.render(makeState())
    // No base for key 0 → no draw.
    expect(hal.callsOf('drawPass')).toHaveLength(0)
  })

  test('instance stride shrank to the single-float layout', () => {
    expect(INSTANCE_STRIDE_F32).toBe(5)
  })
})
