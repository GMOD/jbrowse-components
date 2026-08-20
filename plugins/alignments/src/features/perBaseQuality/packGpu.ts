import { slangPass } from '@jbrowse/render-core/slangPass'

import * as perBaseQualityShader from '../../shaders/slang/packedColorQuad.generated.ts'
import { qualityAbgr } from './colors.ts'

import type { PerBaseQualityUploadData } from './types.ts'

export const PER_BASE_QUALITY_PASS = {
  ...slangPass({
    id: 'perBaseQuality',
    mod: perBaseQualityShader,
  }),
  pack: packPerBaseQuality,
}

function packPerBaseQuality(data: PerBaseQualityUploadData): ArrayBuffer {
  const n = data.perBaseQualPositions.length
  const F_U32 = perBaseQualityShader.INSTANCE_OFFSET_U32
  const s32 = perBaseQualityShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(n * perBaseQualityShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const pos = data.perBaseQualPositions
  const ys = data.perBaseQualYs
  const scores = data.perBaseQualScores
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F_U32.position] = pos[i]!
    u32[o + F_U32.y] = ys[i]!
    u32[o + F_U32.packedColor] = qualityAbgr[scores[i]!]!
  }
  return buf
}
