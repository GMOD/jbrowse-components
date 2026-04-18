import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/variant.generated.ts'

import type { VariantUploadData } from './variantBackendTypes.ts'

export function interleaveVariantInstances(data: VariantUploadData) {
  const count = data.numCells
  const buf = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * INSTANCE_STRIDE_F32
    u32[off + FIELD_OFFSET_F32.startEnd] = data.cellPositions[i * 2]!
    u32[off + FIELD_OFFSET_F32.startEnd + 1] = data.cellPositions[i * 2 + 1]!
    u32[off + FIELD_OFFSET_F32.rowIndex] = data.cellRowIndices[i]!
    u32[off + FIELD_OFFSET_F32.shapeType] = data.cellShapeTypes[i]!
    u32[off + FIELD_OFFSET_F32.color] = data.cellColors[i]!
  }
  return buf
}
