import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/syntenyFill.generated.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

export function interleaveInstances(data: SyntenyInstanceData) {
  const {
    bp1Hi,
    bp1Lo,
    bp2Hi,
    bp2Lo,
    bp3Hi,
    bp3Lo,
    bp4Hi,
    bp4Lo,
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
    f[off + FIELD_OFFSET_F32.bp1Hi] = bp1Hi[i]!
    f[off + FIELD_OFFSET_F32.bp1Lo] = bp1Lo[i]!
    f[off + FIELD_OFFSET_F32.bp2Hi] = bp2Hi[i]!
    f[off + FIELD_OFFSET_F32.bp2Lo] = bp2Lo[i]!
    f[off + FIELD_OFFSET_F32.bp3Hi] = bp3Hi[i]!
    f[off + FIELD_OFFSET_F32.bp3Lo] = bp3Lo[i]!
    f[off + FIELD_OFFSET_F32.bp4Hi] = bp4Hi[i]!
    f[off + FIELD_OFFSET_F32.bp4Lo] = bp4Lo[i]!
    u32[off + FIELD_OFFSET_F32.color] = colors[i]!
    f[off + FIELD_OFFSET_F32.featureId] = instanceFeatureIdx[i]! + 1
    f[off + FIELD_OFFSET_F32.queryTotalLength] = queryTotalLengths[i]!
    f[off + FIELD_OFFSET_F32.padTop] = padTops[i]!
    f[off + FIELD_OFFSET_F32.padBottom] = padBottoms[i]!
  }
  return buf
}
