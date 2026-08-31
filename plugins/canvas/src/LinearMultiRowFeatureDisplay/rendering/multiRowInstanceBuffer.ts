import { drawnFeatureContext, forEachDrawnFeature } from './featurePainting.ts'
import { InstanceWriter } from './shaders/multiRow.iface.generated.ts'

import type {
  MultiRowFeaturePaintInputs,
  MultiRowRegionData,
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
 * Seeded with one instance per feature and right-sized by `finish` to what was
 * actually written — a hidden legend category or a filtered row means fewer
 * instances than features. The returned buffer is therefore exactly the drawn
 * instances, which is what lets the upload read the count off its bytes.
 */
export function buildMultiRowInstanceBuffer(
  data: MultiRowRegionData,
  state: MultiRowFeaturePaintInputs,
) {
  const { featureStarts, featureEnds } = data
  const out = new InstanceWriter(featureStarts.length)
  forEachDrawnFeature(
    data,
    drawnFeatureContext(data, state),
    (i, rowIndex, color) => {
      out.push(featureStarts[i]!, featureEnds[i]!, rowIndex, color)
    },
  )
  return out.finish()
}
