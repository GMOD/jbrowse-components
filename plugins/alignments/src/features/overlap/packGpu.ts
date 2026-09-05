import { slangPass } from '@jbrowse/render-core/slangPass'

import * as overlapShader from '../../shaders/slang/overlap.generated.ts'
import { countMarks, markSelects } from '../mark.ts'
import { OVERLAP_MARK } from './mark.ts'

import type { OverlapsUploadData } from './types.ts'

export const OVERLAP_PASS = {
  ...slangPass({
    id: 'overlap',
    mod: overlapShader,
  }),
  pack: packOverlaps,
}

function packOverlaps(data: OverlapsUploadData): ArrayBuffer {
  const channels = OVERLAP_MARK.channels(data)
  const { positions, rows, kinds, kind, end } = channels
  const F_F32 = overlapShader.INSTANCE_OFFSET_F32
  const F_U32 = overlapShader.INSTANCE_OFFSET_U32
  const s32 = overlapShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(
    countMarks(OVERLAP_MARK, data) * overlapShader.INSTANCE_STRIDE_BYTES,
  )
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let o = 0
  for (let i = channels.start; i < end; i++) {
    if (markSelects(kinds, kind, i)) {
      u32[o + F_U32.startOff] = positions[i * 2]!
      u32[o + F_U32.endOff] = positions[i * 2 + 1]!
      f32[o + F_F32.y] = rows[i]!
      o += s32
    }
  }
  return buf
}
