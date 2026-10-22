import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { ARC_COLOR_FIELDS } from '../shared/arcColorOptions.ts'
import { READ_CONNECTIONS_WIDTH_SCALES } from './constants.ts'

/**
 * #config AlignmentsArcColor
 * #category display
 * The alignments displays' `readConnections.encoding.color` colors the
 * read-connection arcs and the read cloud. Empty, the default, the arcs take
 * the reads' `encoding.color` field where it is one an arc paints
 * (`insertSize`, `pairOrientation`, `insertSizeAndOrientation`), and paint
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
 *   encoding: { color: 'insertSize' },
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
  { shorthand: 'field', writes: 'whole', plot: true, closed: true },
)

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

/**
 * #config ReadConnectionsEncoding
 * #category display
 * The read connections' `encoding`: the color and width each connection
 * strokes at.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: {
 *     show: true,
 *     encoding: { color: 'insertSize', strokeWidth: 2 },
 *   },
 * }
 * ```
 */
export const readConnectionsEncodingConfigSchema = ConfigurationSchema(
  'ReadConnectionsEncoding',
  {
    /**
     * #slot color
     * The field that colors the connections; `""` uses the reads'
     * `encoding.color` field where a connection paints it.
     */
    color: alignmentsArcColorConfigSchema,
    /**
     * #slot strokeWidth
     * The width each connection strokes at.
     */
    strokeWidth: readConnectionsStrokeWidthConfigSchema,
  },
  encodingOptions,
)
