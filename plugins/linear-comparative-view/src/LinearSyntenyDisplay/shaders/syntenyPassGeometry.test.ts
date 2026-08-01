// Each mode's fill pass and clicked-outline pass draw the SAME polygon from the
// same geometry function, differing only in the fragment. That is what makes
// the outline trace the fill instead of approximating it. Two things have to
// hold for it, and neither is checked by the compiler:
//
//   - the two passes agree on vertex count and instance layout, since the
//     outline pass is drawn from the fill pass's instance buffer
//     (GpuSyntenyRenderer.render -> drawPass(edgePass, key, fillPass)), and
//   - VERTS_PER_INSTANCE matches CURVE_SEGMENTS. The shader codegen parses that
//     constant straight out of the source and can't resolve an imported
//     identifier, so the curve passes spell 48u literally; nothing else would
//     notice if CURVE_SEGMENTS moved and they didn't.
import fs from 'node:fs'
import path from 'node:path'

import * as edgeCurve from './syntenyEdgeCurve.iface.generated.ts'
import * as edgeStraight from './syntenyEdgeStraight.iface.generated.ts'
import * as fillCurve from './syntenyFillCurve.iface.generated.ts'
import * as fillStraight from './syntenyFillStraight.iface.generated.ts'

const VERTS_PER_SEGMENT = 6

function curveSegmentsFromSource() {
  const src = fs.readFileSync(
    path.join(__dirname, 'syntenyTypes.slang'),
    'utf8',
  )
  const m = /const uint CURVE_SEGMENTS = (\d+)u/.exec(src)
  if (!m) {
    throw new Error('CURVE_SEGMENTS not found in syntenyTypes.slang')
  }
  return Number(m[1])
}

describe('synteny pass geometry', () => {
  test('curve passes emit CURVE_SEGMENTS * 6 verts', () => {
    const expected = curveSegmentsFromSource() * VERTS_PER_SEGMENT
    expect(fillCurve.VERTS_PER_INSTANCE).toBe(expected)
    expect(edgeCurve.VERTS_PER_INSTANCE).toBe(expected)
  })

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
