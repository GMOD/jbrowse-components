import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config AlignmentsBaseColor
 * #category display
 * The alignments displays' `baseColor` setting: the per-base variable painted
 * as a cell per base over the reads, whatever `color` fills them with.
 * `modifications` paints the MM/ML calls and `bisulfite` the conversion state
 * against the reference, both under the display's `modifications` settings;
 * `baseQuality` and `base` paint every aligned base. A string is the field.
 * While a modification field paints, mismatches draw grey, and a read with no
 * `color` of its own takes a pale strand tint.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', baseColor: 'modifications' }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   color: { field: 'tags.HP' },
 *   baseColor: { field: 'modifications' },
 *   modifications: { twoColor: true },
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
      type: 'string',
      defaultValue: '',
      description:
        'the per-base variable painted over the reads: modifications, bisulfite, baseQuality or base; empty draws none',
    },
    /**
     * #slot scale
     */
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration('AlignmentsBaseColorScale', ['none']),
      description: 'none draws no layer and keeps the field for a switch back',
    },
  },
  { shorthand: 'field', closed: true },
)
