import { slangPass } from '@jbrowse/core/gpu/slangPass'

import { qualityAbgr } from './colors.ts'
import * as perBaseQualityShader from '../../LinearAlignmentsDisplay/shaders/slang/packedColorQuad.generated.ts'

import type { PerBaseQualityUploadData } from './types.ts'

export const PASS_PER_BASE_QUAL = 'perBaseQuality'

export const PER_BASE_QUALITY_PASS = slangPass({
  id: PASS_PER_BASE_QUAL,
  mod: perBaseQualityShader,
})

export function packPerBaseQuality(
  data: PerBaseQualityUploadData,
): ArrayBuffer {
  const n = data.perBaseQualPositions.length
  const F = perBaseQualityShader.FIELD_OFFSET_F32
  const s32 = perBaseQualityShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * perBaseQualityShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const pos = data.perBaseQualPositions
  const ys = data.perBaseQualYs
  const scores = data.perBaseQualScores
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.position] = pos[i]!
    u32[o + F.y] = ys[i]!
    u32[o + F.packedColor] = qualityAbgr[scores[i]!]!
  }
  return buf
}
