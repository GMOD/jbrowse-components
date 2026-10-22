import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { ribbonColorConfigSchema } from './ribbonColorConfigSchema.ts'

/**
 * #config MultiWayRibbons
 * #category display
 * The multi-way synteny display's `ribbons`: the bands joining each gene's
 * placements in adjacent lanes.
 *
 * #example
 * ```js
 * { type: 'MultiWaySyntenyDisplay', ribbons: { encoding: { color: 'identity' } } }
 * ```
 */
export const ribbonsConfigSchema = ConfigurationSchema(
  'MultiWayRibbons',
  {
    /**
     * #slot encoding
     * The channels each ribbon paints through.
     */
    encoding: ConfigurationSchema(
      'MultiWayRibbonsEncoding',
      {
        /**
         * #slot color
         * `{ value }` paints every ribbon; `"strand"` the record's strand,
         * `"identity"` a preset ramp and `"group"` a declared column.
         */
        color: ribbonColorConfigSchema,
      },
      encodingOptions,
    ),
  },
  { closed: true, plot: true },
)
