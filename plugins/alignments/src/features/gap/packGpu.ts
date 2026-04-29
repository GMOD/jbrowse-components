import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as gapShader from '../../shaders/slang/gap.generated.ts'

import type { GapUploadData } from './types.ts'

export const PASS_GAP = 'gap'

export const GAP_PASS = slangPass({
  id: PASS_GAP,
  mod: gapShader,
})

export function packGaps(data: GapUploadData): ArrayBuffer {
  const n = data.gapPositions.length / 2
  const F = gapShader.FIELD_OFFSET_F32
  const s32 = gapShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * gapShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.gapPositions
  const ys = data.gapYs
  const types = data.gapTypes
  const freq = data.gapFrequencies
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.startOff] = pos[i * 2]!
    u32[o + F.endOff] = pos[i * 2 + 1]!
    u32[o + F.y] = ys[i]!
    u32[o + F.gapType] = types[i]!
    f32[o + F.frequency] = freq[i]! / 255
  }
  return buf
}
