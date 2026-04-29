import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as linkedReadLineShader from '../../shaders/slang/linkedReadLine.generated.ts'

import type { LinkedReadLinesUploadData } from './types.ts'

export const PASS_LINKED_READ_LINE = 'linkedReadLine'

export const LINKED_READ_LINE_PASS = slangPass({
  id: PASS_LINKED_READ_LINE,
  mod: linkedReadLineShader,
  topology: 'line-list',
})

export function packLinkedReadLines(
  data: LinkedReadLinesUploadData,
): ArrayBuffer {
  const n = data.numLinkedReadLines
  const F = linkedReadLineShader.FIELD_OFFSET_F32
  const s32 = linkedReadLineShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * linkedReadLineShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.linkedReadLinePositions
  const ys = data.linkedReadLineYs
  const cts = data.linkedReadLineColorTypes
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.bp1] = pos[i * 2]!
    u32[o + F.bp2] = pos[i * 2 + 1]!
    f32[o + F.y1] = ys[i * 2]!
    f32[o + F.y2] = ys[i * 2 + 1]!
    f32[o + F.colorType] = cts[i]!
  }
  return buf
}
