import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'

import type {
  GeneGlyphSettings,
  SubfeatureLabels,
  WorkerColor,
} from '../RenderFeatureDataRPC/renderConfig.ts'
import type { RenderFeatureDataArgs } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearFeatureBaseDisplayConfigModel } from './baseConfigSchema.ts'
import type { LinearBasicDisplayConfig } from './configSchema.ts'
import type { FeatureFacet } from './facet.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

/** What {@link geneGlyphRequestViews} reads. */
export interface GeneGlyphRequestHost {
  conf: Pick<LinearBasicDisplayConfig, 'transcripts' | 'containers' | 'utrs'>
  effectiveSubfeatureLabels: SubfeatureLabels
}

/**
 * The gene-glyph slots of a `LinearBasicDisplay` as the worker reads them.
 * The display installs it over the base's hook; the tables export's static
 * host installs the same layer.
 */
export function geneGlyphRequestViews(self: GeneGlyphRequestHost) {
  return {
    /**
     * #getter
     * The half of the worker's settings that shapes a multi-part glyph,
     * `utrs.encoding.color.value` raw: a `jexl:` expression there is the
     * worker's to evaluate per feature.
     */
    get geneGlyphSettings(): GeneGlyphSettings {
      const { transcripts, containers, utrs } = self.conf
      return {
        subfeatureLabels: self.effectiveSubfeatureLabels,
        transcriptTypes: [...transcripts.types],
        canonicalTranscriptField: transcripts.field,
        canonicalTranscriptTags: [...transcripts.sort],
        containerTypes: [...containers.types],
        utrColor: utrs.encoding.color.value,
      }
    },
  }
}

/** What {@link featureRequestViews} reads. */
export interface FeatureRequestHost {
  conf: Pick<
    Instance<LinearFeatureBaseDisplayConfigModel>,
    'filter' | 'tooltip' | 'mark' | 'labels'
  >
  geneGlyphSettings: GeneGlyphSettings
  workerColor: WorkerColor
  facet: FeatureFacet | undefined
}

/**
 * The display's settings as the worker reads them. The base model installs
 * it as a `.views()` layer; the tables export's static host installs the
 * same layer.
 */
export function featureRequestViews(self: FeatureRequestHost) {
  return {
    /**
     * #getter
     * Each slot the worker reads, named member by member, so an unrelated
     * slot write — `height` on every resize-drag frame — stays out of the
     * RPC cache key. The gate budgets are not cache keys; as one,
     * `maxFeatureDensity` made zooming across the 20 kb floor a full clear
     * and refetch, and a raised budget already reaches the verdict through
     * the tracked `regionTooLarge`. The `field` slots and the `filter` list
     * are read raw: a `jexl:` expression there is the worker's to evaluate
     * per feature. The label fields alone: the `show` switches are the main
     * thread's, so a label toggle never refetches.
     */
    get renderSettings(): RenderFeatureDataArgs['displayConfig'] {
      const { filter, tooltip, mark, labels } = self.conf
      const { facet } = self
      return {
        ...self.geneGlyphSettings,
        tooltip: tooltip.field,
        filter: predicatesOf(filter),
        featureHeight: mark.height,
        color: self.workerColor,
        labels: {
          name: labels.name.field,
          description: labels.description.field,
        },
        // A facet other than strand needs a stamp per feature, so only
        // it joins the cache key: a strand facet never refetches.
        ...(facet === undefined || facet.field === STRAND_FIELD
          ? {}
          : { facetField: facet.field }),
      }
    },
  }
}
