import { slangPass } from '@jbrowse/render-core/slangPass'

import * as linkedReadLineShader from '../../LinearAlignmentsDisplay/shaders/slang/linkedReadLine.generated.ts'

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
  const F_F32 = linkedReadLineShader.INSTANCE_OFFSET_F32
  const F_U32 = linkedReadLineShader.INSTANCE_OFFSET_U32
  const s32 = linkedReadLineShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(n * linkedReadLineShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.linkedReadLinePositions
  const ys = data.linkedReadLineYs
  const cts = data.linkedReadLineColorTypes
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F_U32.bp1] = pos[i * 2]!
    u32[o + F_U32.bp2] = pos[i * 2 + 1]!
    f32[o + F_F32.y1] = ys[i * 2]!
    f32[o + F_F32.y2] = ys[i * 2 + 1]!
    f32[o + F_F32.colorType] = cts[i]!
  }
  return buf
}
