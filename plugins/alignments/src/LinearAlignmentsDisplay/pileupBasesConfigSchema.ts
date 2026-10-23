import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { alignmentsBaseColorConfigSchema } from './alignmentsBaseColorConfigSchema.ts'

/**
 * #config PileupBases
 * #category display
 * The pileup's `bases` layer, a cell per base over the reads: `show` turns it
 * on and `encoding.color` names what it paints. It draws while `show` is on
 * and a field is named.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: { bases: { show: true, encoding: { color: 'baseQuality' } } },
 *   encoding: { color: 'tags.HP' },
 * }
 * ```
 */
export const pileupBasesConfigSchema = ConfigurationSchema(
  'PileupBases',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: false,
      description: 'draw the per-base layer over the reads',
    },
    /**
     * #slot encoding
     * The layer's channels: `encoding.color`, the per-base variable.
     */
    encoding: ConfigurationSchema(
      'PileupBasesEncoding',
      {
        /**
         * #slot encoding.color
         * The per-base variable the layer paints.
         */
        color: alignmentsBaseColorConfigSchema,
      },
      encodingOptions,
    ),
  },
  { closed: true, plot: true },
)
