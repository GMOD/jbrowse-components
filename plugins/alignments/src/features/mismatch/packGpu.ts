import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'

import type { MismatchUploadData } from './types.ts'

export const PASS_MISMATCH = 'mismatch'

export const MISMATCH_PASS = slangPass({
  id: PASS_MISMATCH,
  mod: mismatchShader,
})

export function packMismatches(data: MismatchUploadData): ArrayBuffer {
  const n = data.mismatchPositions.length
  const F = mismatchShader.FIELD_OFFSET_F32
  const s32 = mismatchShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * mismatchShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.mismatchPositions
  const ys = data.mismatchYs
  const bases = data.mismatchBases
  const freq = data.mismatchFrequencies
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.position] = pos[i]!
    u32[o + F.y] = ys[i]!
    u32[o + F.base] = bases[i]!
    f32[o + F.frequency] = freq[i]! / 255
  }
  return buf
}
