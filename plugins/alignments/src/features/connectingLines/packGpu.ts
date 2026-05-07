import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as connectingLineShader from '../../shaders/slang/connectingLine.generated.ts'

import type { ConnectingLinesUploadData } from './types.ts'

export const PASS_CONN_LINE = 'connLine'

export const CONN_LINE_PASS = slangPass({
  id: PASS_CONN_LINE,
  mod: connectingLineShader,
})

export function packConnectingLines(
  data: ConnectingLinesUploadData,
): ArrayBuffer {
  const n = data.connectingLinePositions.length / 2
  const F = connectingLineShader.FIELD_OFFSET_F32
  const s32 = connectingLineShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * connectingLineShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.connectingLinePositions
  const ys = data.connectingLineYs
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.startOff] = pos[i * 2]!
    u32[o + F.endOff] = pos[i * 2 + 1]!
    f32[o + F.y] = ys[i]!
  }
  return buf
}
