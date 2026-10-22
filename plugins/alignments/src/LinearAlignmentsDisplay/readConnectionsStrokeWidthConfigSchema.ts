import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { READ_CONNECTIONS_WIDTH_SCALES } from './constants.ts'

/**
 * #config ReadConnectionsStrokeWidth
 * #category display
 * The read connections' `encoding.strokeWidth`, the width each arc or line
 * strokes at. By default each connection's `reads`, the reads that agree on
 * it, run through a log scale from 1 px at one read to 4 px at 44 or more,
 * so each doubling adds the same width. A number is the constant every
 * connection takes, whatever its reads, and is written to `value`.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: { show: true, encoding: { strokeWidth: 2 } },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: {
 *     show: true,
 *     encoding: { strokeWidth: { field: 'reads', scale: { range: [1, 8] } } },
 *   },
 * }
 * ```
 */
export const readConnectionsStrokeWidthConfigSchema = ConfigurationSchema(
  'ReadConnectionsStrokeWidth',
  {
    /**
     * #slot value
     * The px every connection strokes at while no field is written; the
     * Line width menu writes it. Unset, `reads` maps through the scale.
     */
    value: {
      type: 'maybeNumber',
      description: 'px every connection strokes at; unset maps reads',
    },
    /**
     * #slot field
     * `reads`, the reads that agree on a connection, the one count a width
     * reads; a written field maps through `scale` over any `value`.
     */
    field: {
      type: 'maybeStringEnum',
      model: types.enumeration('ReadConnectionsStrokeWidthField', ['reads']),
      description: 'reads; unset maps reads while no value is written',
    },
    /**
     * #slot scale
     * How `reads` map to a width: from one read to 44, past which more
     * reads add no width.
     */
    scale: ConfigurationSchema(
      'ReadConnectionsStrokeWidthScale',
      {
        /**
         * #slot type
         */
        type: {
          type: 'stringEnum',
          model: types.enumeration('ReadConnectionsStrokeWidthScaleType', [
            ...READ_CONNECTIONS_WIDTH_SCALES,
          ]),
          defaultValue: 'log',
          description:
            'log adds the same width per doubling of reads; linear the same per read',
        },
        /**
         * #slot range
         * The px at one read and at 44, thinnest first. Empty is 1 to 4.
         */
        range: {
          type: 'stringArray',
          defaultValue: [],
          description: 'px at one read and at 44; empty is 1 to 4',
        },
      },
      {
        closed: true,
        // A range is written as numbers, the px it names; the slot holds them
        // as strings the way a threshold domain holds its cuts.
        preProcessSnapshot: (snap: Record<string, unknown> = {}) =>
          Array.isArray(snap.range)
            ? { ...snap, range: snap.range.map(String) }
            : snap,
      },
    ),
  },
  { shorthand: ['field', 'value'], writes: 'whole', plot: true, closed: true },
)
