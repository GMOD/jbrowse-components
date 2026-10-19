import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { ARC_COLOR_FIELDS } from '../shared/arcColorOptions.ts'

/**
 * #config AlignmentsArcColor
 * #category display
 * The alignments displays' `readConnections.color` setting colors the
 * read-connection arcs and the read cloud. Empty, the default, the arcs take
 * the reads' `color` field where it is one an arc paints (`insertSize`,
 * `pairOrientation`, `insertSizeAndOrientation`), and paint
 * `insertSizeAndOrientation` under any other. A field set here colors the
 * arcs whatever the reads show. A bare string is refused rather than read as
 * the field, since the reads' `color` reads one as a constant.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: { show: true, color: { field: 'pairOrientation' } },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: { show: true, mark: 'cloud' },
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
  {
    closed: true,
    // no shorthand lifted a bare string, so it arrives here as written
    preProcessSnapshot: snap => {
      const written: unknown = snap
      if (typeof written === 'string') {
        throw new Error(
          `readConnections.color takes { "field": "${written}" }, not a bare string`,
        )
      }
      return snap
    },
  },
)
