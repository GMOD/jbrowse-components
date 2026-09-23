import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { normalizeChannel } from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { markTransformStep } from './markTransformConfigSchema.ts'

/**
 * #config MarkFacet
 * #category display
 * The mark display's `facet`: one labelled section of the track per value of
 * a field, as the feature and alignments displays' facet is, and the steps the
 * facet runs over each section's features alone, after the display's
 * `transform` and before every mark's own. A `pileup` here packs each section
 * on its own rows, which every mark then stands in. A string is the field.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearMarkDisplay',
 *   facet: { field: 'HP', transform: [{ type: 'pileup' }] },
 *   marks: [{ shape: 'span' }],
 * }
 * ```
 */
export const markFacetSchema = ConfigurationSchema(
  'MarkFacet',
  {
    /**
     * #slot field
     * The feature field each value of which packs its own labelled section: a
     * field name, a dotted path into a structured field (`INFO.SVTYPE`), a
     * `jexl:` expression, or `strand`. A feature with no value stacks last.
     * Writing `facet: "HP"` lands here.
     */
    field: {
      type: 'featureField',
      defaultValue: '',
      description:
        'feature field (or jexl expression) to group by, one labelled section per value',
    },
    /**
     * #slot domain
     * The values whose sections stack first, in order; the rest follow sorted.
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description: 'values whose sections stack first, in order',
    },
    /**
     * #slot transform
     * Steps over each section's features alone, after the display's
     * `transform` and before any mark's own: a `pileup` here packs each
     * section on its own rows, and every mark stands in them.
     */
    transform: types.array(markTransformStep),
  },
  {
    shorthand: 'field',
    closed: true,
    preProcessSnapshot: snap => normalizeChannel(snap, 'facet'),
  },
)
