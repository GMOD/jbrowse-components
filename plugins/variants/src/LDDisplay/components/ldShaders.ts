import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/ldGenomic.generated.ts'

export function interleaveLDInstances(data: {
  positions: Float32Array
  cellSizes: Float32Array
  ldValues: Float32Array
  numCells: number
}) {
  const count = data.numCells
  const buf = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * INSTANCE_STRIDE_F32
    f32[off + FIELD_OFFSET_F32.position] = data.positions[i * 2]!
    f32[off + FIELD_OFFSET_F32.position + 1] = data.positions[i * 2 + 1]!
    f32[off + FIELD_OFFSET_F32.cellSize] = data.cellSizes[i * 2]!
    f32[off + FIELD_OFFSET_F32.cellSize + 1] = data.cellSizes[i * 2 + 1]!
    f32[off + FIELD_OFFSET_F32.ldValue] = data.ldValues[i]!
  }
  return buf
}
