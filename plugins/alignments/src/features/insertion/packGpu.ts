import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as insertionShader from '../../shaders/slang/insertion.generated.ts'

import type { CigarUploadData } from '../../shared/uploadTypes.ts'

export const PASS_INSERTION = 'insertion'

export const INSERTION_PASS = slangPass({
  id: PASS_INSERTION,
  mod: insertionShader,
})

// Reads from the merged interbase array's first `numInsertions` entries —
// the worker lays out interbases as (insertions, softclips, hardclips).
export function packInsertions(data: CigarUploadData): ArrayBuffer {
  const n = data.numInsertions
  const F = insertionShader.FIELD_OFFSET_F32
  const s32 = insertionShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * insertionShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.interbasePositions
  const ys = data.interbaseYs
  const lens = data.interbaseLengths
  const freq = data.interbaseFrequencies
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.position] = pos[i]!
    u32[o + F.y] = ys[i]!
    u32[o + F.length] = lens[i]!
    f32[o + F.frequency] = freq[i]! / 255
  }
  return buf
}
