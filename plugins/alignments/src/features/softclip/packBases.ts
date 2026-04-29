import { slangPass } from '@jbrowse/core/gpu/slangPass'

// Softclip-base bases reuse the mismatch pass's shader/geometry — same
// instanced quad with a base-letter slot. The frequency slot stays 0 since
// softclip bases are always fully opaque.
import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'

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
  const pos = data.softclipBasePositions
  const ys = data.softclipBaseYs
  const bases = data.softclipBaseBases
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.position] = pos[i]!
    u32[o + F.y] = ys[i]!
    u32[o + F.base] = bases[i]!
  }
  return buf
}
