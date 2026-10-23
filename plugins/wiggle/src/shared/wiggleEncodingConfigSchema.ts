import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { wiggleColorSchema } from './wiggleColorConfigSchema.ts'

/**
 * #config WiggleEncoding
 * #category display
 * The quantitative display's `encoding`, the channels its marks paint
 * through.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', encoding: { color: { value: 'darkgreen' } } }
 * ```
 */
export const wiggleEncodingConfigSchema = ConfigurationSchema(
  'WiggleEncoding',
  {
    /**
     * #slot color
     * One CSS color in `value`, or the score through a `scale`, with a key.
     */
    color: wiggleColorSchema,
  },
  encodingOptions,
)
