import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { BASE_COLOR_FIELDS } from '../shared/types.ts'

/**
 * #config AlignmentsBaseColor
 * #category display
 * The `pileup.bases.encoding.color` channel: the per-base variable painted
 * as a cell per base over the reads, whatever `encoding.color` fills them
 * with. `modifications` paints the MM/ML calls and `bisulfite` the conversion
 * state against the reference, both under the display's `modifications`
 * settings; `baseQuality` and `base` paint every aligned base. A string is
 * the field. While a modification field paints, mismatches draw grey, and a
 * read that no `encoding.color` paints takes a pale strand tint.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: { bases: { show: true, encoding: { color: 'modifications' } } },
 * }
 * ```
 */
export const alignmentsBaseColorConfigSchema = ConfigurationSchema(
  'AlignmentsBaseColor',
  {
    /**
     * #slot field
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('AlignmentsBaseColorField', [
        '',
        ...BASE_COLOR_FIELDS,
      ]),
      defaultValue: '',
      description:
        'the per-base variable painted over the reads: modifications, bisulfite, baseQuality or base; empty draws none',
    },
  },
  { shorthand: 'field', writes: 'whole', closed: true, plot: true },
)
