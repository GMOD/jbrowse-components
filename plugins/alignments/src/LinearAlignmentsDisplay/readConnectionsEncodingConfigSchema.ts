import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { alignmentsArcColorConfigSchema } from './alignmentsArcColorConfigSchema.ts'
import { readConnectionsStrokeWidthConfigSchema } from './readConnectionsStrokeWidthConfigSchema.ts'

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
