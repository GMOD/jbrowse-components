import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { dropEmptyField } from '../shared/dropEmptyField.ts'
import { BASE_COLOR_FIELDS } from '../shared/types.ts'

/**
 * #config AlignmentsBaseColor
 * #category display
 * The `pileup.bases.encoding.color` channel: the per-base variable painted
 * as a cell per base over the reads, whatever `encoding.color` fills them
 * with. `modifications` paints the MM/ML calls and `bisulfite` the conversion
 * state against the reference, both through `pileup.bases.filter` and
 * `unmodified`; `baseQuality` and `base` paint every aligned base. A string is
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
      type: 'maybeStringEnum',
      model: types.enumeration('AlignmentsBaseColorField', [
        ...BASE_COLOR_FIELDS,
      ]),
      description:
        'the per-base variable painted over the reads: modifications, bisulfite, baseQuality or base; unset paints none',
    },
  },
  {
    shorthand: 'field',
    writes: 'whole',
    closed: true,
    plot: true,
    preProcessSnapshot: dropEmptyField,
  },
)
