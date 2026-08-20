import { slangPass } from '@jbrowse/render-core/slangPass'

import * as connectingLineShader from '../../shaders/slang/connectingLine.generated.ts'

import type { ConnectingLinesUploadData } from './types.ts'

export const CONN_LINE_PASS = {
  ...slangPass({
    id: 'connLine',
    mod: connectingLineShader,
  }),
  pack: packConnectingLines,
}

function packConnectingLines(data: ConnectingLinesUploadData): ArrayBuffer {
  const n = data.connectingLinePositions.length / 2
  const F_F32 = connectingLineShader.INSTANCE_OFFSET_F32
  const F_U32 = connectingLineShader.INSTANCE_OFFSET_U32
  const s32 = connectingLineShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(n * connectingLineShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.connectingLinePositions
  const ys = data.connectingLineYs
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F_U32.startOff] = pos[i * 2]!
    u32[o + F_U32.endOff] = pos[i * 2 + 1]!
    f32[o + F_F32.y] = ys[i]!
  }
  return buf
}
