import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { ARC_COLOR_FIELDS } from '../shared/arcColorOptions.ts'
import { dropEmptyField } from '../shared/dropEmptyField.ts'

/**
 * #config AlignmentsArcColor
 * #category display
 * The alignments displays' `readConnections.encoding.color` colors the
 * read-connection arcs and the read cloud. Empty, the default, the arcs take
 * the reads' `encoding.color` field where it is one an arc paints
 * (`insertSizeAndOrientation` or `pairOrientation`), and paint
 * `insertSizeAndOrientation` under any other. A field set here colors the
 * arcs whatever the reads show. A string is the field.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: { show: true, encoding: { color: 'pairOrientation' } },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: { show: true, mark: 'rule' },
 *   encoding: { color: 'pairOrientation' },
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
      type: 'maybeStringEnum',
      model: types.enumeration('AlignmentsArcColorField', [
        ...ARC_COLOR_FIELDS,
      ]),
      description:
        "the pair field the arcs paint: insertSizeAndOrientation or pairOrientation; unset takes the reads' color field where an arc paints it",
    },
  },
  {
    shorthand: 'field',
    writes: 'whole',
    plot: true,
    closed: true,
    preProcessSnapshot: dropEmptyField,
  },
)
