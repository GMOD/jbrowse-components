import { slangPass } from '@jbrowse/render-core/slangPass'

import * as insertionShader from '../../shaders/slang/insertion.generated.ts'
import { countMarks, markSelects } from '../mark.ts'
import { INSERTION_PACK_MARK } from './mark.ts'

import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'

export const INSERTION_PASS = {
  ...slangPass({
    id: 'insertion',
    mod: insertionShader,
  }),
  pack: packInsertions,
}

// The insertion mark's own slice of the merged interbase array, uploaded as the
// painter and the hit test read it — see `insertionMark` for where that bound is
// declared.
export function packInsertions(data: InterbaseUploadData): ArrayBuffer {
  const mark = INSERTION_PACK_MARK
  const channels = mark.channels(data)
  const { positions, rows, end } = channels
  const F_F32 = insertionShader.INSTANCE_OFFSET_F32
  const F_U32 = insertionShader.INSTANCE_OFFSET_U32
  const s32 = insertionShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(
    countMarks(mark, data) * insertionShader.INSTANCE_STRIDE_BYTES,
  )
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let o = 0
  for (let i = channels.start; i < end; i++) {
    if (markSelects(channels, i)) {
      u32[o + F_U32.position] = positions[i]!
      u32[o + F_U32.y] = rows[i]!
      u32[o + F_U32.length] = data.interbaseLengths[i]!
      f32[o + F_F32.frequency] = data.interbaseFrequencies[i]! / 255
      o += s32
    }
  }
  return buf
}
