import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { facetConfigSchema } from '@jbrowse/display-kit/facetConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { markTransformStep } from './markTransformConfigSchema.ts'

/**
 * #config MarkFacet
 * #category display
 * The mark display's `facet`: the [Facet](../facet) the feature and alignments
 * displays take, one labelled section of the track per value of a field, plus
 * the steps the facet runs over each section's features alone, after the
 * display's `transform` and before every mark's own. A `pileup` here packs
 * each section on its own rows, which every mark then stands in. A string is
 * the field; with no field the steps run over the one section there is.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearMarkDisplay',
 *   facet: { field: 'HP', transform: [{ type: 'pileup' }] },
 *   marks: [{ mark: 'span' }],
 * }
 * ```
 */
export const markFacetSchema = ConfigurationSchema(
  'MarkFacet',
  {
    /**
     * #slot transform
     * Steps over each section's features alone, after the display's
     * `transform` and before any mark's own: a `pileup` here packs each
     * section on its own rows, and every mark stands in them.
     */
    transform: types.array(markTransformStep),
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: facetConfigSchema,
  },
)
