import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/multiRow.generated.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

/**
 * Encode one region's features into a GPU instance buffer — one quad per
 * feature ({startBp,endBp,rowIndex,color}). Runs on the main thread (the
 * per-region encode autorun) so the row index, resolved here from the global
 * `rowIndexByValue` map, re-encodes on a row reorder without an RPC roundtrip.
 * Features whose partition value has no assigned row are skipped.
 */
export function buildMultiRowInstanceBuffer(
  data: MultiRowRegionData,
  rowIndexByValue: ReadonlyMap<string, number>,
): { buffer: ArrayBuffer; count: number } {
  const { featureStarts, featureEnds, featureColors, partitionValues } = data
  const n = featureStarts.length
  const buffer = new ArrayBuffer(n * INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buffer)
  let count = 0
  for (let i = 0; i < n; i++) {
    const value = partitionValues[data.featurePartitionIndex[i]!]!
    const rowIndex = rowIndexByValue.get(value)
    if (rowIndex !== undefined) {
      const base = count * INSTANCE_STRIDE_F32
      u32[base + FIELD_OFFSET_F32.startBp] = featureStarts[i]!
      u32[base + FIELD_OFFSET_F32.endBp] = featureEnds[i]!
      u32[base + FIELD_OFFSET_F32.rowIndex] = rowIndex
      u32[base + FIELD_OFFSET_F32.color] = featureColors[i]!
      count++
    }
  }
  return { buffer, count }
}
