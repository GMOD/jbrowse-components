import { drawnFeatureContext, forEachDrawnFeature } from './featurePainting.ts'
import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/multiRow.iface.generated.ts'

import type {
  MultiRowRegionData,
  MultiRowRenderState,
} from './multiRowRenderingBackendTypes.ts'

/**
 * Encode one region's features into a GPU instance buffer — one quad per
 * feature ({startBp,endBp,rowIndex,color}).
 *
 * Runs on the main thread (the per-region encode autorun) rather than in the
 * worker, which is what lets a row reorder, a row recolor, or a legend category
 * being toggled off re-encode with no RPC roundtrip: all three are inputs to
 * `forEachDrawnFeature`, which decides both which features appear here and what
 * color they carry.
 *
 * The buffer is sized for every feature but only `count` of them are written,
 * so a caller uploads `count` instances and ignores the tail.
 */
export function buildMultiRowInstanceBuffer(
  data: MultiRowRegionData,
  state: Pick<
    MultiRowRenderState,
    'rowIndexByValue' | 'rowColorsByIndex' | 'hiddenColors'
  >,
): { buffer: ArrayBuffer; count: number } {
  const { featureStarts, featureEnds } = data
  const buffer = new ArrayBuffer(featureStarts.length * INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buffer)
  let count = 0
  forEachDrawnFeature(
    data,
    drawnFeatureContext(data, state),
    (i, rowIndex, color) => {
      const base = count * INSTANCE_STRIDE_F32
      u32[base + FIELD_OFFSET_F32.startBp] = featureStarts[i]!
      u32[base + FIELD_OFFSET_F32.endBp] = featureEnds[i]!
      u32[base + FIELD_OFFSET_F32.rowIndex] = rowIndex
      u32[base + FIELD_OFFSET_F32.color] = color
      count++
    },
  )
  return { buffer, count }
}
