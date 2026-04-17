import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/variantMatrix.generated.ts'

export function interleaveMatrixInstances(data: {
  cellFeatureIndices: Float32Array
  cellRowIndices: Uint32Array
  cellColors: Uint8Array
  numCells: number
}) {
  const count = data.numCells
  const buf = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const colors = data.cellColors
  for (let i = 0; i < count; i++) {
    const off = i * INSTANCE_STRIDE_F32
    const c = i * 4
    f32[off + FIELD_OFFSET_F32.featureIndex] = data.cellFeatureIndices[i]!
    u32[off + FIELD_OFFSET_F32.rowIndex] = data.cellRowIndices[i]!
    // RGBA bytes -> ABGR u32 (R at byte 0, A at byte 3), matching unpackRGBA
    u32[off + FIELD_OFFSET_F32.color] =
      ((colors[c + 3]! << 24) |
        (colors[c + 2]! << 16) |
        (colors[c + 1]! << 8) |
        colors[c]!) >>>
      0
  }
  return buf
}
