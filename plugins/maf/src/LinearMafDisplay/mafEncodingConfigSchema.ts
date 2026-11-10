import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { mafColorConfigSchema } from './mafColorConfigSchema.ts'
import { mafYConfigSchema } from './mafYConfigSchema.ts'

/**
 * #config MafEncoding
 * #category display
 * The MAF display's `encoding`, the channels its aligned cells paint through
 * and the field its rows' bars show.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', encoding: { color: 'identity', y: 'identity' } }
 * ```
 */
export const mafEncodingConfigSchema = ConfigurationSchema(
  'MafEncoding',
  {
    /**
     * #slot color
     * What fills each aligned cell: the field `identity` or `refNameRank`, or
     * a constant `value`, and the scale the field's values map through. Base
     * and codon colors belong to the per-base layer,
     * `alignments.bases.encoding.color`.
     */
    color: mafColorConfigSchema,
    /**
     * #slot y
     * The value a row's bar height shows: `identity`, or unset for none.
     */
    y: mafYConfigSchema,
  },
  encodingOptions,
)
