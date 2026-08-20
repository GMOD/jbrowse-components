import { slangPass } from '@jbrowse/render-core/slangPass'

import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'

import type { PerBaseLetterUploadData } from './types.ts'

// Reuses the mismatch shader: one themed 1bp quad per base, colored from the
// base-color UBO uniforms. Per-base lettering is exactly "draw every aligned
// base like a mismatch base", so the shader is shared rather than duplicated.
export const PER_BASE_LETTER_PASS = {
  ...slangPass({
    id: 'perBaseLetter',
    mod: mismatchShader,
  }),
  pack: packPerBaseLetter,
}

function packPerBaseLetter(data: PerBaseLetterUploadData): ArrayBuffer {
  const n = data.perBaseLetterPositions.length
  const F_F32 = mismatchShader.INSTANCE_OFFSET_F32
  const F_U32 = mismatchShader.INSTANCE_OFFSET_U32
  const s32 = mismatchShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(n * mismatchShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.perBaseLetterPositions
  const ys = data.perBaseLetterYs
  const bases = data.perBaseLetterBases
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F_U32.position] = pos[i]!
    u32[o + F_U32.y] = ys[i]!
    u32[o + F_U32.base] = bases[i]!
    // frequency=1: every covered base is fully drawn (sub-pixel alpha at zoom-out
    // still applies via the shader, same as a 100%-frequency mismatch).
    f32[o + F_F32.frequency] = 1
  }
  return buf
}
