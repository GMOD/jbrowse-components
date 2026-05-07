import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as arcShader from '../../shaders/slang/arc.generated.ts'
import * as arcLineShader from '../../shaders/slang/arcLine.generated.ts'

import type { ArcsUploadData } from './types.ts'

export const PASS_ARC = 'arc'
export const PASS_ARC_LINE = 'arcLine'

export const ARC_PASS = slangPass({
  id: PASS_ARC,
  mod: arcShader,
  topology: 'triangle-strip',
})

export const ARC_LINE_PASS = slangPass({
  id: PASS_ARC_LINE,
  mod: arcLineShader,
  topology: 'line-list',
})

export function packArcs(data: ArcsUploadData): ArrayBuffer {
  const n = data.numArcs
  const F = arcShader.FIELD_OFFSET_F32
  const s32 = arcShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * arcShader.INSTANCE_STRIDE_BYTES)
  const f32 = new Float32Array(buf)
  const u32 = new Uint32Array(buf)
  const x1 = data.arcX1
  const x2 = data.arcX2
  const cts = data.arcColorTypes
  const shape = data.arcShapeTypes
  const yBp = data.arcYBp
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.x1] = x1[i]!
    u32[o + F.x2] = x2[i]!
    f32[o + F.colorType] = cts[i]!
    f32[o + F.shapeType] = shape[i]!
    u32[o + F.yBp] = yBp[i]!
  }
  return buf
}

export function packArcLines(data: ArcsUploadData): ArrayBuffer {
  const n = data.numArcLines
  const F = arcLineShader.FIELD_OFFSET_F32
  const s32 = arcLineShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * arcLineShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.arcLinePositions
  const ys = data.arcLineYs
  const cts = data.arcLineColorTypes
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.position] = pos[i]!
    f32[o + F.y] = ys[i]!
    f32[o + F.colorType] = cts[i]!
  }
  return buf
}
