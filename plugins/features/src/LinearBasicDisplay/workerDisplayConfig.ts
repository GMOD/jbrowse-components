import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'

import { pickDisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'

import type {
  DisplayConfig,
  SubfeatureLabels,
} from '../RenderFeatureDataRPC/renderConfig.ts'
import type { FeatureFacet } from './facet.ts'

export function workerDisplayConfig(
  snapshot: Record<string, unknown>,
  {
    facet,
    effectiveSubfeatureLabels,
  }: {
    facet: FeatureFacet | undefined
    effectiveSubfeatureLabels: SubfeatureLabels
  },
): Omit<DisplayConfig, 'geneGlyphMode'> {
  return {
    // Picked rather than filtered: the snapshot carries every slot the
    // schema and its bases declare, and the subtractive spelling made
    // every slot nobody excluded a silent refetch trigger. The gate
    // budgets are not cache keys; as one, `maxFeatureDensity` made
    // zooming across the 20 kb floor a full clear and refetch, and a
    // raised budget already reaches the verdict through the tracked
    // `regionTooLarge`.
    ...pickDisplayConfig(snapshot),
    subfeatureLabels: effectiveSubfeatureLabels,
    // A facet other than strand needs a stamp per feature, so only
    // it joins the cache key: a strand facet never refetches.
    ...(facet === undefined || facet.field === STRAND_FIELD
      ? {}
      : { facetField: facet.field }),
  }
}
