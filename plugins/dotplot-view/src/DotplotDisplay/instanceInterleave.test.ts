import {
  interleaveInstances,
  patchInstanceColors,
} from './instanceInterleave.ts'
import { FIELD_OFFSET_F32 as F } from './shaders/dotplot.iface.generated.ts'

import type { DotplotGeometryData } from './dotplotRenderingBackendTypes.ts'

// Distinct, deterministic values in every lane so a mis-targeted patch (wrong
// stride/offset, or clobbering a neighbour lane) shows up as a byte diff.
function makeData(colors: Uint32Array): DotplotGeometryData {
  const n = colors.length
  const seq = (base: number) =>
    Float64Array.from({ length: n }, (_, i) => base + i)
  return {
    x1: seq(1000),
    y1: seq(2000),
    x2: seq(3000),
    y2: seq(4000),
    colors,
    instanceFeatureIdx: Uint32Array.from({ length: n }, (_, i) => i),
    instanceCount: n,
    baseH: 0,
    baseV: 0,
  }
}

describe('patchInstanceColors', () => {
  // The recolor fast path in GpuDotplotRenderer.getInterleaved reuses a packed
  // buffer and rewrites only the color lane. That is correct iff it lands
  // byte-identical to a full re-interleave carrying the new colors over the
  // same geometry — this asserts exactly that. Same gate as the synteny twin in
  // linear-comparative-view.
  test('equals a full re-interleave with the new colors', () => {
    const data = makeData(
      Uint32Array.from([0x11111111, 0x22222222, 0x33333333]),
    )
    const newColors = Uint32Array.from([0xaabbccdd, 0x01020304, 0xfffefdfc])

    const patched = interleaveInstances(data)
    patchInstanceColors(patched, newColors)

    const fullReinterleave = interleaveInstances(makeData(newColors))
    expect(new Uint8Array(patched)).toEqual(new Uint8Array(fullReinterleave))
  })
})

describe('interleaveInstances', () => {
  // The window-relative conversion happens here, at the upload boundary —
  // geometry stays absolute Float64 cumBp so the Canvas2D and SVG paths can
  // read it directly. See BP_PRECISION.md §"Synteny + dotplot".
  test('stores coordinates relative to the per-axis base', () => {
    const data: DotplotGeometryData = {
      ...makeData(Uint32Array.from([0xff0000ff])),
      x1: Float64Array.from([8e8 + 100]),
      y1: Float64Array.from([5e8 + 200]),
      x2: Float64Array.from([8e8 + 150]),
      y2: Float64Array.from([5e8 + 250]),
      baseH: 8e8,
      baseV: 5e8,
    }

    const f = new Float32Array(interleaveInstances(data))

    expect(f[F.x1]).toBe(100)
    expect(f[F.y1]).toBe(200)
    expect(f[F.x2]).toBe(150)
    expect(f[F.y2]).toBe(250)
  })
})
