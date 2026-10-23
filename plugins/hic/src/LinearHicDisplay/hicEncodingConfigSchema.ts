import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { hicColorConfigSchema } from './hicColorConfigSchema.ts'

/**
 * #config HicEncoding
 * #category display
 * The Hi-C display's `encoding`, the channels its bins paint through.
 *
 * #example
 * ```js
 * { type: 'LinearHicDisplay', encoding: { color: 'observed/expected' } }
 * ```
 */
export const hicEncodingConfigSchema = ConfigurationSchema(
  'HicEncoding',
  {
    /**
     * #slot color
     * The scale from a bin's value to its color: a `linear`, `symlog` or
     * `log` scale onto a named scheme, over a domain whose unset ends follow
     * the loaded counts.
     */
    color: hicColorConfigSchema,
  },
  encodingOptions,
)
