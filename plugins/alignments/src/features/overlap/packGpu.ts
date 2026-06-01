import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as overlapShader from '../../LinearAlignmentsDisplay/shaders/slang/overlap.generated.ts'

import type { OverlapsUploadData } from './types.ts'

export const PASS_OVERLAP = 'overlap'

export const OVERLAP_PASS = slangPass({ id: PASS_OVERLAP, mod: overlapShader })

export function packOverlaps(data: OverlapsUploadData): ArrayBuffer {
  const n = data.overlapPositions.length / 2
  const F = overlapShader.FIELD_OFFSET_F32
  const s32 = overlapShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * overlapShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.overlapPositions
  const ys = data.overlapYs
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.startOff] = pos[i * 2]!
    u32[o + F.endOff] = pos[i * 2 + 1]!
    f32[o + F.y] = ys[i]!
  }
  return buf
}
