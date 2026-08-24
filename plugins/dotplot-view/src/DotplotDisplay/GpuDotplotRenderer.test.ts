import { MockHal } from '@jbrowse/render-core/hal'

import { DOTPLOT_PASSES, GpuDotplotRenderer } from './GpuDotplotRenderer.ts'
import {
  INSTANCE_OFFSET_F32 as F_F32,
  INSTANCE_OFFSET_U32 as F_U32,
  INSTANCE_STRIDE_WORDS,
  UNIFORM_OFFSET_F32 as U,
} from './shaders/dotplot.generated.ts'
import { fakeDotplotInstanceData } from './testUtils.ts'

import type {
  DotplotGeometryData,
  DotplotRenderState,
} from './dotplotRenderingBackendTypes.ts'

function makeGeometry(
  overrides: Partial<DotplotGeometryData> = {},
): DotplotGeometryData {
  return {
    ...fakeDotplotInstanceData(1, {
      x1: new Float64Array([100]),
      y1: new Float64Array([200]),
      x2: new Float64Array([150]),
      y2: new Float64Array([250]),
    }),
    colors: new Uint32Array([0xff0000ff]),
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
    alpha: 1,
    displayKeys: [0],
    ...overrides,
  }
}

describe('GpuDotplotRenderer window-relative uniforms', () => {
  test('stores coords window-relative (cumBp - base) at upload', () => {
    const hal = new MockHal(DOTPLOT_PASSES)
    const renderer = new GpuDotplotRenderer(hal)
    renderer.resize(800, 600)
    renderer.upload(
      0,
      makeGeometry({
        x1: new Float64Array([8e8 + 100]),
        y1: new Float64Array([5e8 + 200]),
        baseH: 8e8,
        baseV: 5e8,
      }),
    )
    const stored = new Float32Array(hal.getBuffer(0, 'line')!.data)
    expect(stored[F_F32.x1]).toBe(100)
    expect(stored[F_F32.y1]).toBe(200)
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
    renderer.upload(
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

  // The shader's AA ramp is 0.5/dpr CSS px, because it measures in CSS px while
  // the viewport is device px. It cannot read the ratio itself, so a missing
  // write here leaves the uniform at 0 and the ramp at infinity — every line
  // would vanish. Same uniform, same reason, as the synteny passes.
  test('supplies the device pixel ratio the AA ramp is sized by', () => {
    const hal = new MockHal(DOTPLOT_PASSES)
    const renderer = new GpuDotplotRenderer(hal)
    renderer.resize(800, 600)
    renderer.upload(0, makeGeometry())
    renderer.render(makeState())
    expect(hal.getLastUniformsF32()![U.devicePixelRatio]).toBeGreaterThan(0)
  })

  test('each display uses its own base for panPx', () => {
    const hal = new MockHal(DOTPLOT_PASSES)
    const renderer = new GpuDotplotRenderer(hal)
    renderer.resize(800, 600)
    renderer.upload(0, makeGeometry({ baseH: 1000, baseV: 2000 }))
    renderer.upload(1, makeGeometry({ baseH: 3000, baseV: 4000 }))
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
    renderer.upload(0, makeGeometry())
    renderer.upload(0, makeGeometry({ instanceCount: 0 }))
    renderer.render(makeState())
    // No base for key 0 → no draw.
    expect(hal.callsOf('drawPass')).toHaveLength(0)
  })

  test('instance stride shrank to the single-float layout', () => {
    expect(INSTANCE_STRIDE_WORDS).toBe(5)
  })

  // Opacity rides a uniform rather than the packed color, so an opacity drag is
  // a uniform write — no recolor, no re-pack, no re-upload. The Canvas2D twin
  // is the strokeStyle test in Canvas2DDotplotRenderer.test.ts.
  test('the opacity slider writes a uniform and uploads nothing', () => {
    const hal = new MockHal(DOTPLOT_PASSES)
    const renderer = new GpuDotplotRenderer(hal)
    renderer.resize(800, 600)
    renderer.upload(0, makeGeometry())
    hal.calls = []

    renderer.render(makeState({ alpha: 0.25 }))

    expect(hal.getLastUniformsF32()![U.alpha]).toBe(0.25)
    expect(hal.callsOf('uploadBuffer')).toEqual([])
  })
})

// The rpcProps/gpuProps split means a colorBy change or an alpha-slider drag
// hands the backend a new geometry object over the SAME coordinate arrays. The
// re-upload is unavoidable (the HAL has no partial-buffer update); re-packing
// the four coordinate lanes is not. Same fast path as GpuSyntenyRenderer.
describe('GpuDotplotRenderer recolor', () => {
  test('a recolor over unchanged geometry only rewrites the color lane', () => {
    const hal = new MockHal(DOTPLOT_PASSES)
    const renderer = new GpuDotplotRenderer(hal)
    renderer.resize(800, 600)
    const geom = makeGeometry({
      x1: new Float64Array([8e8 + 100]),
      y1: new Float64Array([5e8 + 200]),
      baseH: 8e8,
      baseV: 5e8,
    })
    renderer.upload(0, geom)

    renderer.upload(0, {
      ...geom,
      colors: new Uint32Array([0x0000ff80]),
    })

    const stored = hal.getBuffer(0, 'line')!
    const f = new Float32Array(stored.data)
    const u = new Uint32Array(stored.data)
    // New color, coordinates still window-relative against the same base.
    expect(u[F_U32.color]).toBe(0x0000ff80)
    expect(f[F_F32.x1]).toBe(100)
    expect(f[F_F32.y1]).toBe(200)
  })

  test('new geometry arrays repack rather than patch', () => {
    const hal = new MockHal(DOTPLOT_PASSES)
    const renderer = new GpuDotplotRenderer(hal)
    renderer.resize(800, 600)
    renderer.upload(0, makeGeometry())

    renderer.upload(0, makeGeometry({ x1: new Float64Array([700]) }))

    const f = new Float32Array(hal.getBuffer(0, 'line')!.data)
    expect(f[F_F32.x1]).toBe(700)
  })

  // A departed track's cached bytes have to go with its buffer, or the next
  // display to take that key patches colors into the wrong geometry.
  test('release drops the cached pack', () => {
    const hal = new MockHal(DOTPLOT_PASSES)
    const renderer = new GpuDotplotRenderer(hal)
    renderer.resize(800, 600)
    const geom = makeGeometry()
    renderer.upload(0, geom)
    renderer.release(0)

    // Same geomToken as before the delete: a surviving cache entry would answer
    // from the stale buffer instead of repacking.
    renderer.upload(0, {
      ...geom,
      colors: new Uint32Array([0xabcdef01]),
    })

    const stored = hal.getBuffer(0, 'line')!
    expect(new Uint32Array(stored.data)[F_U32.color]).toBe(0xabcdef01)
    expect(new Float32Array(stored.data)[F_F32.x1]).toBe(100)
  })
})
