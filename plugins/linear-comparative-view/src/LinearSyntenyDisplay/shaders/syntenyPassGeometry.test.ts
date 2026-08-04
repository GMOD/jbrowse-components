// Each mode's fill pass and clicked-outline pass draw the SAME polygon from the
// same geometry function, differing only in the fragment. That is what makes
// the outline trace the fill instead of approximating it. What has to hold for
// it, and isn't checked by the compiler, is that the two passes agree on vertex
// count and instance layout — the outline pass is drawn from the fill pass's
// instance buffer (GpuSyntenyRenderer.render -> drawPass(edgePass, key,
// fillPass)).
//
// A third check used to live here: that the curve passes' VERTS_PER_INSTANCE
// still equalled CURVE_SEGMENTS * 6. They spelled `48u` because the codegen
// could not resolve an identifier from an imported module, so nothing but this
// test would have noticed CURVE_SEGMENTS moving. It resolves imports now and
// the shaders say `CURVE_SEGMENTS * 6u`, which is the same statement made by
// construction.
import * as edgeCurve from './syntenyEdgeCurve.iface.generated.ts'
import * as edgeStraight from './syntenyEdgeStraight.iface.generated.ts'
import * as fillCurve from './syntenyFillCurve.iface.generated.ts'
import * as fillStraight from './syntenyFillStraight.iface.generated.ts'

const VERTS_PER_SEGMENT = 6

describe('synteny pass geometry', () => {
  test('straight passes emit one quad', () => {
    expect(fillStraight.VERTS_PER_INSTANCE).toBe(VERTS_PER_SEGMENT)
    expect(edgeStraight.VERTS_PER_INSTANCE).toBe(VERTS_PER_SEGMENT)
  })

  test('each mode’s fill and outline pass share an instance layout', () => {
    for (const [fill, edge] of [
      [fillStraight, edgeStraight],
      [fillCurve, edgeCurve],
    ] as const) {
      expect(edge.INSTANCE_STRIDE_BYTES).toBe(fill.INSTANCE_STRIDE_BYTES)
      expect(edge.FIELD_OFFSET_F32).toEqual(fill.FIELD_OFFSET_F32)
      expect(edge.UNIFORM_OFFSET_F32).toEqual(fill.UNIFORM_OFFSET_F32)
      expect(edge.UNIFORMS_SIZE_BYTES).toBe(fill.UNIFORMS_SIZE_BYTES)
    }
  })

  test('all four passes share the uniform block', () => {
    // GpuSyntenyRenderer writes one uniform buffer and reads its offsets off
    // syntenyFillStraight, on the stated assumption that all four agree.
    for (const mod of [fillCurve, edgeStraight, edgeCurve]) {
      expect(mod.UNIFORM_OFFSET_F32).toEqual(fillStraight.UNIFORM_OFFSET_F32)
      expect(mod.UNIFORMS_SIZE_BYTES).toBe(fillStraight.UNIFORMS_SIZE_BYTES)
    }
  })
})
