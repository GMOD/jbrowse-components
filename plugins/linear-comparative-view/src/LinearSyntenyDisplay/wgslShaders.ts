import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/syntenyFill.generated.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

// SYNC: must match FILL_SEGS in syntenyFill.slang / syntenyPicking.slang.
const FILL_SEGMENTS = 16
// SYNC: must match EDGE_SEGS in syntenyEdge.slang.
const EDGE_SEGMENTS = 4

export const FILL_VERTS_PER_INSTANCE = FILL_SEGMENTS * 6
export const EDGE_VERTS_PER_INSTANCE = 2 * EDGE_SEGMENTS * 6

export function interleaveInstances(data: SyntenyInstanceData) {
  const {
    x1,
    x2,
    x3,
    x4,
    colors,
    featureIds,
    isCurves,
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
    f[off + FIELD_OFFSET_F32.featureId] = featureIds[i]!
    f[off + FIELD_OFFSET_F32.isCurve] = isCurves[i]!
    f[off + FIELD_OFFSET_F32.queryTotalLength] = queryTotalLengths[i]!
    f[off + FIELD_OFFSET_F32.padTop] = padTops[i]!
    f[off + FIELD_OFFSET_F32.padBottom] = padBottoms[i]!
  }
  return buf
}
