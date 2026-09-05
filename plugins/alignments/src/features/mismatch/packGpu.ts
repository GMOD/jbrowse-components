import { slangPass } from '@jbrowse/render-core/slangPass'

import * as mismatchShader from '../../shaders/slang/mismatch.generated.ts'
import { countMarks, markSelects } from '../mark.ts'
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
  const channels = MISMATCH_MARK.channels(data)
  const { positions, rows, kinds, kind, end } = channels
  const F_F32 = mismatchShader.INSTANCE_OFFSET_F32
  const F_U32 = mismatchShader.INSTANCE_OFFSET_U32
  const s32 = mismatchShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(
    countMarks(MISMATCH_MARK, data) * mismatchShader.INSTANCE_STRIDE_BYTES,
  )
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let o = 0
  for (let i = channels.start; i < end; i++) {
    if (markSelects(kinds, kind, i)) {
      u32[o + F_U32.position] = positions[i]!
      u32[o + F_U32.y] = rows[i]!
      u32[o + F_U32.base] = data.mismatchBases[i]!
      f32[o + F_F32.frequency] = data.mismatchFrequencies[i]! / 255
      f32[o + F_F32.qual] = data.mismatchQuals[i]!
      o += s32
    }
  }
  return buf
}
