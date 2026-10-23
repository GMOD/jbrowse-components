import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'
import { syntenyMarkConfigSchema } from '@jbrowse/synteny-core'

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
 *
 * Curved sides, the linear synteny view's `mark` spelled the same:
 * ```js
 * { type: 'MultiWaySyntenyDisplay', ribbons: { mark: { interpolate: 'bump' } } }
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
    /**
     * #slot mark
     * How each ribbon draws: `interpolate` picks straight or S-curved sides.
     */
    mark: syntenyMarkConfigSchema,
  },
  { closed: true, plot: true },
)
