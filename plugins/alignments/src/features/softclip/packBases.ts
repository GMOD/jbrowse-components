// Softclip-base bases reuse the mismatch pass's shader/geometry — same
// instanced quad with a base-letter slot.
import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'
import { instancePass } from '../../shared/instancePass.ts'

import type { CigarUploadData } from '../../shared/uploadTypes.ts'

export const PASS_SOFTCLIP_BASES = 'softclipBases'

export const SOFTCLIP_BASES_PASS = instancePass({
  id: PASS_SOFTCLIP_BASES,
  mod: mismatchShader,
  pack: packSoftclipBases,
})

export function packSoftclipBases(data: CigarUploadData): ArrayBuffer {
  const n = data.softclipBasePositions.length
  const F_F32 = mismatchShader.INSTANCE_OFFSET_F32
  const F_U32 = mismatchShader.INSTANCE_OFFSET_U32
  const s32 = mismatchShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(n * mismatchShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.softclipBasePositions
  const ys = data.softclipBaseYs
  const bases = data.softclipBaseBases
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F_U32.position] = pos[i]!
    u32[o + F_U32.y] = ys[i]!
    u32[o + F_U32.base] = bases[i]!
    // Softclip bases are always fully opaque, and the mismatch shader's
    // sub-pixel fade lerps from pxPerBp up to 1.0 by frequency — so full
    // frequency (not a 0 left-as-default) is what pins alpha at 1. Matches the
    // Canvas2D drawSoftclipBases path, which never fades.
    f32[o + F_F32.frequency] = 1
  }
  return buf
}
