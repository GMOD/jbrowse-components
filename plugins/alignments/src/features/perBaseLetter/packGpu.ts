import { slangPass } from '@jbrowse/render-core/slangPass'

import { QUAL_UNAVAILABLE } from '../../shaders/slang/mismatch.consts.generated.ts'
import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'
import { countMarks } from '../mark.ts'
import { PER_BASE_LETTER_MARK } from './mark.ts'

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

export function packPerBaseLetter(data: PerBaseLetterUploadData): ArrayBuffer {
  const mark = PER_BASE_LETTER_MARK
  const rows = mark.rows(data)
  const F_F32 = mismatchShader.INSTANCE_OFFSET_F32
  const F_U32 = mismatchShader.INSTANCE_OFFSET_U32
  const s32 = mismatchShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(
    countMarks(mark, data) * mismatchShader.INSTANCE_STRIDE_BYTES,
  )
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let o = 0
  for (let i = 0; i < rows.length; i++) {
    if (mark.selects(data, i)) {
      u32[o + F_U32.position] = mark.startBp(data, i)
      u32[o + F_U32.y] = rows[i]!
      u32[o + F_U32.base] = data.perBaseLetterBases[i]!
      // The mark declares this layer opaque, and the two fades the shared shader
      // applies are what the instance has to neutralize for that to be true.
      //
      // frequency=1: every covered base is drawn, which is the mode. The lerp
      // reaches 1 at full frequency whatever the zoom, so a 0 left at the
      // buffer's default would fade every base to `pxPerBp` instead.
      f32[o + F_F32.frequency] = 1
      // qual = the no-quality SENTINEL, not the 0 the buffer starts at. A
      // lettered base is every aligned base, so there is no per-base quality to
      // report — and 0 is a real Phred score, the worst one, which
      // `qualityFade` sends to alpha 0 and `vs_main` then discards. Left at the
      // default, this pass drew NOTHING on the GPU whenever "fade by base
      // quality" was on, while Canvas2D drew every base opaque. The
      // softclip-bases packer, which shares this shader, already spelled the
      // same argument out; this one shared the shader without it.
      f32[o + F_F32.qual] = QUAL_UNAVAILABLE
      o += s32
    }
  }
  return buf
}
