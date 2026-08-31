import { slangPass } from '@jbrowse/render-core/slangPass'

import * as modificationShader from '../../shaders/slang/packedColorQuad.generated.ts'
import { countMarks, markEnd, markStart } from '../mark.ts'
import { MODIFICATION_MARK } from './mark.ts'

import type { ModificationUploadData } from './types.ts'

// Pass descriptor exported so GpuAlignmentsRenderer's pileup-layer registry can
// name it without re-importing the shader module — keeps the modification
// shader, its pass shape and its packer in one place.
export const MODIFICATION_PASS = {
  ...slangPass({
    id: 'modification',
    mod: modificationShader,
  }),
  pack: packModifications,
}

function packModifications(data: ModificationUploadData): ArrayBuffer {
  const rows = MODIFICATION_MARK.rows(data)
  const end = markEnd(MODIFICATION_MARK, data, rows)
  const F_U32 = modificationShader.INSTANCE_OFFSET_U32
  const s32 = modificationShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(
    countMarks(MODIFICATION_MARK, data) *
      modificationShader.INSTANCE_STRIDE_BYTES,
  )
  const u32 = new Uint32Array(buf)
  let o = 0
  for (let i = markStart(MODIFICATION_MARK, data); i < end; i++) {
    if (MODIFICATION_MARK.selects(data, i)) {
      u32[o + F_U32.position] = MODIFICATION_MARK.startBp(data, i)
      u32[o + F_U32.y] = rows[i]!
      u32[o + F_U32.packedColor] = data.modificationColors[i]!
      o += s32
    }
  }
  return buf
}
