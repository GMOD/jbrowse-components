import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'
import { fieldPredicateList } from '@jbrowse/display-kit/fieldPredicateConfigSchema'
import {
  syntenyMarkConfigSchema,
  syntenyOpacityConfigSchema,
} from '@jbrowse/synteny-core'

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
 *
 * Denser ribbons, and only the pairs at 98% identity or more, as the linear
 * synteny view's `encoding.opacity` and `filter` write them:
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   ribbons: {
 *     encoding: { opacity: 0.6 },
 *     filter: [{ field: 'identity', gte: 0.98 }],
 *   },
 * }
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
         * #slot encoding.color
         * `{ value }` paints every ribbon; `"strand"` the record's strand,
         * `"identity"` a preset ramp and `"group"` a declared column.
         */
        color: ribbonColorConfigSchema,
        /**
         * #slot encoding.opacity
         * A [](/docs/config/syntenyopacity) object: `0.6` draws every ribbon
         * at that opacity, a field fades each by its value; unset, 0.3.
         */
        opacity: syntenyOpacityConfigSchema,
      },
      encodingOptions,
    ),
    /**
     * #slot mark
     * How each ribbon draws: `interpolate` picks straight or S-curved sides.
     */
    mark: syntenyMarkConfigSchema,
    /**
     * #slot filter
     * The ribbons drawn, a list of [](/docs/config/fieldpredicate) entries a
     * ribbon must all pass. A field is any field `color` takes, or `length`,
     * the record's bp. "Hide unlabelled rows" writes `{ field, valid: true }`
     * for the field the ribbons paint by.
     */
    filter: fieldPredicateList(),
  },
  { closed: true, plot: true },
)
