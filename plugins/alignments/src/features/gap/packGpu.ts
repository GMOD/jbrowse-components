import { slangPass } from '@jbrowse/render-core/slangPass'

import * as gapShader from '../../LinearAlignmentsDisplay/shaders/slang/gap.generated.ts'

import type { GapUploadData } from './types.ts'

export const PASS_GAP = 'gap'

export const GAP_PASS = slangPass({
  id: PASS_GAP,
  mod: gapShader,
})

export function packGaps(data: GapUploadData): ArrayBuffer {
  const n = data.gapPositions.length / 2
  const F_F32 = gapShader.INSTANCE_OFFSET_F32
  const F_U32 = gapShader.INSTANCE_OFFSET_U32
  const s32 = gapShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(n * gapShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.gapPositions
  const ys = data.gapYs
  const types = data.gapTypes
  const freq = data.gapFrequencies
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F_U32.startOff] = pos[i * 2]!
    u32[o + F_U32.endOff] = pos[i * 2 + 1]!
    u32[o + F_U32.y] = ys[i]!
    u32[o + F_U32.gapType] = types[i]!
    f32[o + F_F32.frequency] = freq[i]! / 255
  }
  return buf
}
