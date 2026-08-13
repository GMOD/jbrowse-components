import { drawnFeatureContext, forEachDrawnFeature } from './featurePainting.ts'
import {
  INSTANCE_OFFSET_U32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
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
 * Sized for every feature, then right-sized to what was written — a hidden
 * legend category or a filtered row means fewer instances than features. The
 * returned buffer is therefore exactly `count` instances, which is what lets the
 * upload read the count off its bytes.
 *
 * A right-sized COPY rather than a subarray view, for maf's reason
 * (`InstanceWriter.finish`): a view would pin the whole over-allocation, and
 * this payload is retained per region for as long as the region is loaded. One
 * copy at encode is cheap next to holding the dead tail for the session — and
 * next to uploading it, which is what the full buffer did.
 */
export function buildMultiRowInstanceBuffer(
  data: MultiRowRegionData,
  state: Pick<
    MultiRowRenderState,
    'rowIndexByValue' | 'rowColorsByIndex' | 'hiddenColors'
  >,
): { buffer: ArrayBuffer; count: number } {
  const { featureStarts, featureEnds } = data
  const capacity = new ArrayBuffer(featureStarts.length * INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(capacity)
  let count = 0
  forEachDrawnFeature(
    data,
    drawnFeatureContext(data, state),
    (i, rowIndex, color) => {
      const base = count * INSTANCE_STRIDE_WORDS
      u32[base + INSTANCE_OFFSET_U32.startBp] = featureStarts[i]!
      u32[base + INSTANCE_OFFSET_U32.endBp] = featureEnds[i]!
      u32[base + INSTANCE_OFFSET_U32.rowIndex] = rowIndex
      u32[base + INSTANCE_OFFSET_U32.color] = color
      count++
    },
  )
  const used = count * INSTANCE_STRIDE_BYTES
  return {
    buffer: used === capacity.byteLength ? capacity : capacity.slice(0, used),
    count,
  }
}
