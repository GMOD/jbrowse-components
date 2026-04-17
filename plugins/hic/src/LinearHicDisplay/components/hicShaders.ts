import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/hic.generated.ts'

export {
  INSTANCE_STRIDE_BYTES as INSTANCE_BYTES,
  INSTANCE_STRIDE_F32 as INSTANCE_STRIDE,
  WGSL_SOURCE as hicShader,
} from './shaders/hic.generated.ts'

export function interleaveHicInstances(data: {
  positions: Float32Array
  counts: Float32Array
  numContacts: number
}) {
  const count = data.numContacts
  const buf = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * INSTANCE_STRIDE_F32
    f32[off + FIELD_OFFSET_F32.position] = data.positions[i * 2]!
    f32[off + FIELD_OFFSET_F32.position + 1] = data.positions[i * 2 + 1]!
    f32[off + FIELD_OFFSET_F32.count] = data.counts[i]!
  }
  return buf
}
