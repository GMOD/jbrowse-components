import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { ARC_COLOR_FIELDS } from '../shared/arcColorOptions.ts'

/**
 * #config AlignmentsArcColor
 * #category display
 * The alignments displays' `arcColor` setting: what colours the
 * read-connection arcs and the read cloud. Empty, the default, the arcs take the reads'
 * `color` field where it is one an arc paints (`insertSize`,
 * `pairOrientation`, `insertSizeAndOrientation`), and paint
 * `insertSizeAndOrientation` under any other. A field of its own colours the
 * arcs whatever the reads show. A string is the field.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', readConnections: 'arc', arcColor: 'pairOrientation' }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: 'cloud',
 *   color: { field: 'insertSize' },
 * }
 * ```
 */
export const alignmentsArcColorConfigSchema = ConfigurationSchema(
  'AlignmentsArcColor',
  {
    /**
     * #slot field
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('AlignmentsArcColorField', [
        '',
        ...ARC_COLOR_FIELDS,
      ]),
      defaultValue: '',
      description:
        "the pair field the arcs paint: insertSizeAndOrientation, insertSize or pairOrientation; empty takes the reads' color field where an arc paints it",
    },
  },
  { shorthand: 'field', closed: true },
)
