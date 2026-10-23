import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { lgvSyntenyColorConfigSchema } from './lgvSyntenyColorConfigSchema.ts'

/**
 * #config LGVSyntenyEncoding
 * #category display
 * The LGVSyntenyDisplay's `encoding`, the channels its blocks paint through.
 *
 * #example
 * ```js
 * { type: 'LGVSyntenyDisplay', encoding: { color: 'mapq' } }
 * ```
 */
export const lgvSyntenyEncodingConfigSchema = ConfigurationSchema(
  'LGVSyntenyEncoding',
  {
    /**
     * #slot color
     * The block fill, `strand` while it names neither a field nor a
     * constant.
     */
    color: lgvSyntenyColorConfigSchema,
  },
  encodingOptions,
)
