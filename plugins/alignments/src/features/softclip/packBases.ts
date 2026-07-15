import { slangPass } from '@jbrowse/render-core/slangPass'

// Softclip-base bases reuse the mismatch pass's shader/geometry — same
// instanced quad with a base-letter slot.
import * as mismatchShader from '../../LinearAlignmentsDisplay/shaders/slang/mismatch.generated.ts'

import type { CigarUploadData } from '../../shared/uploadTypes.ts'

export const PASS_SOFTCLIP_BASES = 'softclipBases'

export const SOFTCLIP_BASES_PASS = slangPass({
  id: PASS_SOFTCLIP_BASES,
  mod: mismatchShader,
})

export function packSoftclipBases(data: CigarUploadData): ArrayBuffer {
  const n = data.softclipBasePositions.length
  const F = mismatchShader.FIELD_OFFSET_F32
  const s32 = mismatchShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * mismatchShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.softclipBasePositions
  const ys = data.softclipBaseYs
  const bases = data.softclipBaseBases
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.position] = pos[i]!
    u32[o + F.y] = ys[i]!
    u32[o + F.base] = bases[i]!
    // Softclip bases are always fully opaque, and the mismatch shader's
    // sub-pixel fade lerps from pxPerBp up to 1.0 by frequency — so full
    // frequency (not a 0 left-as-default) is what pins alpha at 1. Matches the
    // Canvas2D drawSoftclipBases path, which never fades.
    f32[o + F.frequency] = 1
  }
  return buf
}
