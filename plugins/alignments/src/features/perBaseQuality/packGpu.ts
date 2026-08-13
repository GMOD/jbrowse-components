import { instancePass } from '@jbrowse/render-core/instancePass'

import * as perBaseQualityShader from '../../shaders/slang/packedColorQuad.generated.ts'
import { qualityAbgr } from './colors.ts'

import type { PerBaseQualityUploadData } from './types.ts'

export const PASS_PER_BASE_QUAL = 'perBaseQuality'

export const PER_BASE_QUALITY_PASS = instancePass({
  id: PASS_PER_BASE_QUAL,
  mod: perBaseQualityShader,
  pack: packPerBaseQuality,
})

export function packPerBaseQuality(
  data: PerBaseQualityUploadData,
): ArrayBuffer {
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
