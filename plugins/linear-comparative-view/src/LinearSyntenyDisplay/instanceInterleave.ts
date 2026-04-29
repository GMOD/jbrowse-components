import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/syntenyFill.generated.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

export function interleaveInstances(data: SyntenyInstanceData) {
  const {
    x1,
    x2,
    x3,
    x4,
    colors,
    instanceFeatureIdx,
    queryTotalLengths,
    padTops,
    padBottoms,
    instanceCount: n,
  } = data
  const buf = new ArrayBuffer(n * INSTANCE_STRIDE_BYTES)
  const f = new Float32Array(buf)
  const u32 = new Uint32Array(buf)

  for (let i = 0; i < n; i++) {
    const off = i * INSTANCE_STRIDE_F32
    f[off + FIELD_OFFSET_F32.x1] = x1[i]!
    f[off + FIELD_OFFSET_F32.x2] = x2[i]!
    f[off + FIELD_OFFSET_F32.x3] = x3[i]!
    f[off + FIELD_OFFSET_F32.x4] = x4[i]!
    u32[off + FIELD_OFFSET_F32.color] = colors[i]!
    f[off + FIELD_OFFSET_F32.featureId] = instanceFeatureIdx[i]! + 1
    f[off + FIELD_OFFSET_F32.queryTotalLength] = queryTotalLengths[i]!
    f[off + FIELD_OFFSET_F32.padTop] = padTops[i]!
    f[off + FIELD_OFFSET_F32.padBottom] = padBottoms[i]!
  }
  return buf
}
