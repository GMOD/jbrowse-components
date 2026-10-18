import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { CATEGORY_FILTERS } from '@jbrowse/display-kit/categoryFilter'
import { featureFilterConfigSchema } from '@jbrowse/display-kit/featureFilterConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config BasicFeatureFilter
 * #category display
 * The tests `LinearBasicDisplay` applies to the features it fetched, its
 * `filter`: the jexl `expressions` every display's feature filter takes, and
 * the gene-like features as a category.
 *
 * #example
 * ```js
 * { type: 'LinearBasicDisplay', filter: { genes: 'only' } }
 * ```
 */
export const basicFeatureFilterConfigSchema = ConfigurationSchema(
  'BasicFeatureFilter',
  {
    /**
     * #slot
     * `only`, `exclude`, or unset for unfiltered: the gene-like top-level
     * features, which are every gene, transcript and RNA type, the
     * `transcriptTypes` and `containerTypes`, and a top-level CDS. "Filter
     * by... → Genes" sets it.
     */
    genes: {
      type: 'maybeStringEnum',
      model: types.enumeration('CategoryFilter', [...CATEGORY_FILTERS]),
      description:
        'only, exclude, or unset for unfiltered: gene-like top-level features',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: featureFilterConfigSchema,
  },
)
