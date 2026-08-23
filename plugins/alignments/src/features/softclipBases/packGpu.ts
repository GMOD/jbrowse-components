import { slangPass } from '@jbrowse/render-core/slangPass'

import { QUAL_UNAVAILABLE } from '../../shaders/slang/mismatch.consts.generated.ts'
// Softclip-base bases reuse the mismatch pass's shader/geometry — same
// instanced quad with a base-letter slot.
import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'
import { countMarks } from '../mark.ts'
import { SOFTCLIP_BASES_MARK } from './mark.ts'

import type { SoftclipBasesUploadData } from './types.ts'

export const SOFTCLIP_BASES_PASS = {
  ...slangPass({
    id: 'softclipBases',
    mod: mismatchShader,
  }),
  pack: packSoftclipBases,
}

export function packSoftclipBases(data: SoftclipBasesUploadData): ArrayBuffer {
  const mark = SOFTCLIP_BASES_MARK
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
      u32[o + F_U32.base] = data.softclipBaseBases[i]!
      // The mark declares this layer opaque, and these two slots are what make
      // that true on the GPU: the shared shader applies both of its fades to
      // whatever the instance carries.
      //
      // Softclip bases are always fully opaque, and the mismatch shader's
      // sub-pixel fade lerps from pxPerBp up to 1.0 by frequency — so full
      // frequency (not a 0 left-as-default) is what pins alpha at 1.
      f32[o + F_F32.frequency] = 1
      // Same argument for the second fade: a clipped base has no quality to
      // report, so it packs the sentinel. Leaving the slot at its 0 default used
      // to mean the same thing and now means Phred 0, which would fade every
      // clipped base to nothing under the mismatch-alpha setting.
      f32[o + F_F32.qual] = QUAL_UNAVAILABLE
      o += s32
    }
  }
  return buf
}
