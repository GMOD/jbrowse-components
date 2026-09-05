import { slangPass } from '@jbrowse/render-core/slangPass'

import * as gapShader from '../../shaders/slang/gap.generated.ts'
import { countMarks, markSelects } from '../mark.ts'
import { DELETION_MARK, SKIP_MARK } from './mark.ts'

import type { PileupMark } from '../mark.ts'
import type { GapUploadData } from './types.ts'

// Two passes over one worker payload and one shader, each taking its own kind
// out of `gapTypes` through its mark — so the two buffers together still hold
// each gap exactly once. See `gap/mark.ts` for why the split is a visibility
// decision rather than a geometric one, and PILEUP_LAYERS for the gating.
export const DELETION_PASS = {
  ...slangPass({ id: 'deletion', mod: gapShader }),
  pack: (data: GapUploadData) => packGaps(data, DELETION_MARK),
}

export const SKIP_PASS = {
  ...slangPass({ id: 'skip', mod: gapShader }),
  pack: (data: GapUploadData) => packGaps(data, SKIP_MARK),
}

export function packGaps(data: GapUploadData, mark: PileupMark<GapUploadData>) {
  const channels = mark.channels(data)
  const { positions, rows, kinds, kind, end } = channels
  const F_F32 = gapShader.INSTANCE_OFFSET_F32
  const F_U32 = gapShader.INSTANCE_OFFSET_U32
  const s32 = gapShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(
    countMarks(mark, data) * gapShader.INSTANCE_STRIDE_BYTES,
  )
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let o = 0
  for (let i = channels.start; i < end; i++) {
    if (markSelects(kinds, kind, i)) {
      u32[o + F_U32.startOff] = positions[i * 2]!
      u32[o + F_U32.endOff] = positions[i * 2 + 1]!
      u32[o + F_U32.y] = rows[i]!
      // The shader still branches on it: one `.slang` serves both passes, so the
      // attribute conveys which branch even though it is constant per buffer.
      u32[o + F_U32.gapType] = data.gapTypes[i]!
      f32[o + F_F32.frequency] = data.gapFrequencies[i]! / 255
      o += s32
    }
  }
  return buf
}
