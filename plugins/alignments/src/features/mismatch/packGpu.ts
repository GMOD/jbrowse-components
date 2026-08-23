import { slangPass } from '@jbrowse/render-core/slangPass'

import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'
import { countMarks } from '../mark.ts'
import { MISMATCH_MARK } from './mark.ts'

import type { MismatchUploadData } from './types.ts'

export const MISMATCH_PASS = {
  ...slangPass({
    id: 'mismatch',
    mod: mismatchShader,
  }),
  pack: packMismatches,
}

export function packMismatches(data: MismatchUploadData): ArrayBuffer {
  const rows = MISMATCH_MARK.rows(data)
  const F_F32 = mismatchShader.INSTANCE_OFFSET_F32
  const F_U32 = mismatchShader.INSTANCE_OFFSET_U32
  const s32 = mismatchShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(
    countMarks(MISMATCH_MARK, data) * mismatchShader.INSTANCE_STRIDE_BYTES,
  )
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let o = 0
  for (let i = 0; i < rows.length; i++) {
    if (MISMATCH_MARK.selects(data, i)) {
      u32[o + F_U32.position] = MISMATCH_MARK.startBp(data, i)
      u32[o + F_U32.y] = rows[i]!
      u32[o + F_U32.base] = data.mismatchBases[i]!
      f32[o + F_F32.frequency] = data.mismatchFrequencies[i]! / 255
      f32[o + F_F32.qual] = data.mismatchQuals[i]!
      o += s32
    }
  }
  return buf
}
