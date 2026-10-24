import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { sectionFacetConfigSchema } from '@jbrowse/display-kit/sectionFacetConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { markTransformStep } from './markTransformConfigSchema.ts'

/**
 * #config MarkFacet
 * #category display
 * The mark display's `facet`: the [Facet](../facet) the feature and alignments
 * displays take, one labelled section of the track per value of a field, plus
 * the steps the facet runs separately over each section's features, after the
 * display's `transform` and before every mark's `transform`. A `pileup` here
 * packs each section into separate rows, and every mark then draws in them. A
 * string is the field; with no field the steps run over the one section there
 * is.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearMarkDisplay',
 *   facet: { field: 'HP', transform: [{ type: 'pileup' }] },
 *   marks: [{ mark: 'rect' }],
 * }
 * ```
 */
export const markFacetSchema = ConfigurationSchema(
  'MarkFacet',
  {
    /**
     * #slot transform
     * Steps that run separately over each section's features, after the
     * display's `transform` and before any mark's `transform`: a `pileup` here
     * packs each section into separate rows, and every mark draws in them.
     */
    transform: types.array(markTransformStep),
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: sectionFacetConfigSchema,
  },
)
