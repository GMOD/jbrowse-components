import { slangPass } from '@jbrowse/render-core/slangPass'

import * as overlapShader from '../../shaders/slang/overlap.generated.ts'

import type { OverlapsUploadData } from './types.ts'

export const OVERLAP_PASS = {
  ...slangPass({
    id: 'overlap',
    mod: overlapShader,
  }),
  pack: packOverlaps,
}

function packOverlaps(data: OverlapsUploadData): ArrayBuffer {
  const n = data.overlapPositions.length / 2
  const F_F32 = overlapShader.INSTANCE_OFFSET_F32
  const F_U32 = overlapShader.INSTANCE_OFFSET_U32
  const s32 = overlapShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(n * overlapShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.overlapPositions
  const ys = data.overlapYs
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F_U32.startOff] = pos[i * 2]!
    u32[o + F_U32.endOff] = pos[i * 2 + 1]!
    f32[o + F_F32.y] = ys[i]!
  }
  return buf
}
