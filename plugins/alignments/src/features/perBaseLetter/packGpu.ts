import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as mismatchShader from '../../LinearAlignmentsDisplay/shaders/slang/mismatch.generated.ts'

import type { PerBaseLetterUploadData } from './types.ts'

export const PASS_PER_BASE_LETTER = 'perBaseLetter'

// Reuses the mismatch shader: one themed 1bp quad per base, colored from the
// base-color UBO uniforms. Per-base lettering is exactly "draw every aligned
// base like a mismatch base", so the shader is shared rather than duplicated.
export const PER_BASE_LETTER_PASS = slangPass({
  id: PASS_PER_BASE_LETTER,
  mod: mismatchShader,
})

export function packPerBaseLetter(data: PerBaseLetterUploadData): ArrayBuffer {
  const n = data.perBaseLetterPositions.length
  const F = mismatchShader.FIELD_OFFSET_F32
  const s32 = mismatchShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * mismatchShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.perBaseLetterPositions
  const ys = data.perBaseLetterYs
  const bases = data.perBaseLetterBases
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.position] = pos[i]!
    u32[o + F.y] = ys[i]!
    u32[o + F.base] = bases[i]!
    // frequency=1: every covered base is fully drawn (sub-pixel alpha at zoom-out
    // still applies via the shader, same as a 100%-frequency mismatch).
    f32[o + F.frequency] = 1
  }
  return buf
}
