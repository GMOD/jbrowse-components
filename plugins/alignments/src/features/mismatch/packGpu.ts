import { slangPass } from '@jbrowse/render-core/slangPass'

import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'

import type { MismatchUploadData } from './types.ts'

export const PASS_MISMATCH = 'mismatch'

export const MISMATCH_PASS = {
  ...slangPass({
    id: PASS_MISMATCH,
    mod: mismatchShader,
  }),
  pack: packMismatches,
}

export function packMismatches(data: MismatchUploadData): ArrayBuffer {
  const n = data.mismatchPositions.length
  const F_F32 = mismatchShader.INSTANCE_OFFSET_F32
  const F_U32 = mismatchShader.INSTANCE_OFFSET_U32
  const s32 = mismatchShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(n * mismatchShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.mismatchPositions
  const ys = data.mismatchYs
  const bases = data.mismatchBases
  const freq = data.mismatchFrequencies
  const quals = data.mismatchQuals
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F_U32.position] = pos[i]!
    u32[o + F_U32.y] = ys[i]!
    u32[o + F_U32.base] = bases[i]!
    f32[o + F_F32.frequency] = freq[i]! / 255
    f32[o + F_F32.qual] = quals[i]!
  }
  return buf
}
