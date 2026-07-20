import {
  isFeatureColorHidden,
  resolveLocalRowIndices,
} from './resolveLocalRowIndices.ts'
import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/multiRow.iface.generated.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

/**
 * Encode one region's features into a GPU instance buffer — one quad per
 * feature ({startBp,endBp,rowIndex,color}). Runs on the main thread (the
 * per-region encode autorun) so the row index, resolved here from the global
 * `rowIndexByValue` map, re-encodes on a row reorder without an RPC roundtrip.
 * Features whose partition value has no assigned row are skipped.
 *
 * `rowColorsByIndex` (indexed by global row) overrides the worker-baked
 * per-feature color for rows whose color was set in the arrangement dialog, so
 * a row recolor re-encodes here too — no RPC roundtrip.
 *
 * `hiddenColors` are the per-feature ABGR colors of legend categories toggled
 * off; matching features are omitted from the buffer, so hiding a category
 * re-encodes here without a refetch.
 */
export function buildMultiRowInstanceBuffer(
  data: MultiRowRegionData,
  rowIndexByValue: ReadonlyMap<string, number>,
  rowColorsByIndex?: readonly (number | undefined)[],
  hiddenColors?: ReadonlySet<number>,
): { buffer: ArrayBuffer; count: number } {
  const { featureStarts, featureEnds, featureColors, partitionValues } = data
  const n = featureStarts.length
  const buffer = new ArrayBuffer(n * INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buffer)
  const rowForLocal = resolveLocalRowIndices(partitionValues, rowIndexByValue)
  let count = 0
  for (let i = 0; i < n; i++) {
    const rowIndex = rowForLocal[data.featurePartitionIndex[i]!]
    if (
      rowIndex !== undefined &&
      !isFeatureColorHidden(
        rowIndex,
        featureColors[i]!,
        hiddenColors,
        rowColorsByIndex,
      )
    ) {
      const base = count * INSTANCE_STRIDE_F32
      u32[base + FIELD_OFFSET_F32.startBp] = featureStarts[i]!
      u32[base + FIELD_OFFSET_F32.endBp] = featureEnds[i]!
      u32[base + FIELD_OFFSET_F32.rowIndex] = rowIndex
      u32[base + FIELD_OFFSET_F32.color] =
        rowColorsByIndex?.[rowIndex] ?? featureColors[i]!
      count++
    }
  }
  return { buffer, count }
}
