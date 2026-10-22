import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { mafColorConfigSchema } from './mafColorConfigSchema.ts'

/**
 * #config MafEncoding
 * #category display
 * The MAF display's `encoding`, the channels its aligned cells paint through.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', encoding: { color: 'identity' }, y: 'identity' }
 * ```
 */
export const mafEncodingConfigSchema = ConfigurationSchema(
  'MafEncoding',
  {
    /**
     * #slot color
     * What each aligned cell paints: `mismatch`, `base`, `identity`,
     * `chromosome` or `codon`, and the scale its values map through.
     */
    color: mafColorConfigSchema,
  },
  encodingOptions,
)
