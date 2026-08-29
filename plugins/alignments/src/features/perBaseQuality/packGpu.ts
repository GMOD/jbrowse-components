import { slangPass } from '@jbrowse/render-core/slangPass'

import * as perBaseQualityShader from '../../shaders/slang/packedColorQuad.generated.ts'
import { countMarks, markEnd, markStart } from '../mark.ts'
import { qualityAbgr } from './colors.ts'
import { PER_BASE_QUALITY_MARK } from './mark.ts'

import type { PerBaseQualityUploadData } from './types.ts'

export const PER_BASE_QUALITY_PASS = {
  ...slangPass({
    id: 'perBaseQuality',
    mod: perBaseQualityShader,
  }),
  pack: packPerBaseQuality,
}

export function packPerBaseQuality(
  data: PerBaseQualityUploadData,
): ArrayBuffer {
  const mark = PER_BASE_QUALITY_MARK
  const rows = mark.rows(data)
  const F_U32 = perBaseQualityShader.INSTANCE_OFFSET_U32
  const s32 = perBaseQualityShader.INSTANCE_STRIDE_WORDS
  const end = markEnd(mark, data, rows)
  const buf = new ArrayBuffer(
    countMarks(mark, data) * perBaseQualityShader.INSTANCE_STRIDE_BYTES,
  )
  const u32 = new Uint32Array(buf)
  let o = 0
  for (let i = markStart(mark, data); i < end; i++) {
    if (mark.selects(data, i)) {
      u32[o + F_U32.position] = mark.startBp(data, i)
      u32[o + F_U32.y] = rows[i]!
      // The ramp `qualityCssColors` is built from, so the fill and the vertex
      // buffer cannot carry different colours for one score.
      u32[o + F_U32.packedColor] = qualityAbgr[data.perBaseQualScores[i]!]!
      o += s32
    }
  }
  return buf
}
