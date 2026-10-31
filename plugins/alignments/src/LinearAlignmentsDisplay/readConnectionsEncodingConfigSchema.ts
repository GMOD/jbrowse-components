import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { readConnectionsStrokeWidthConfigSchema } from './readConnectionsStrokeWidthConfigSchema.ts'

/**
 * #config ReadConnectionsEncoding
 * #category display
 * The read connections' `encoding`: the width each connection strokes at.
 * A connection's color is its insert size and orientation class, as the
 * reads' `insertSizeAndOrientation` color names it, declared colors included.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   readConnections: { show: true, encoding: { strokeWidth: 2 } },
 * }
 * ```
 */
export const readConnectionsEncodingConfigSchema = ConfigurationSchema(
  'ReadConnectionsEncoding',
  {
    /**
     * #slot strokeWidth
     * The width each connection strokes at.
     */
    strokeWidth: readConnectionsStrokeWidthConfigSchema,
  },
  encodingOptions,
)
