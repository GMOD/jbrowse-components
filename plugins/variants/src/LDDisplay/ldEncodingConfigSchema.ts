import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { ldColorConfigSchema } from './ldColorConfigSchema.ts'

/**
 * #config LDEncoding
 * #category display
 * The LD display's `encoding`: `color`, the statistic the cells paint.
 *
 * #example
 * ```js
 * { type: 'LDTrackDisplay', encoding: { color: 'dprime' } }
 * ```
 */
export const ldEncodingConfigSchema = ConfigurationSchema(
  'LDEncoding',
  {
    /**
     * #slot color
     * The statistic the cells show, `field` `r2` or `dprime`, and the
     * linear ramp it paints through over the statistic's 0 to 1.
     */
    color: ldColorConfigSchema,
  },
  encodingOptions,
)
