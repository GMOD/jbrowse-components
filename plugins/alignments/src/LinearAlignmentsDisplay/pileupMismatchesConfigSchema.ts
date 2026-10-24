import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import { pileupMismatchesOpacityConfigSchema } from './pileupMismatchesOpacityConfigSchema.ts'

/**
 * #config PileupMismatches
 * #category display
 * The pileup's `mismatches` layer: how each read differs from the reference,
 * as per-base mismatches, insertion markers and deletion bars, and the
 * opacity each mismatched base takes from its quality. The line
 * joining a spliced read across its introns draws either way, since it shows
 * the exon blocks are one read.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', pileup: { mismatches: { show: false } } }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: { mismatches: { encoding: { opacity: 'baseQuality' } } },
 * }
 * ```
 */
export const pileupMismatchesConfigSchema = ConfigurationSchema(
  'PileupMismatches',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description:
        'draw the mismatched bases, insertion markers and deletion bars',
    },
    /**
     * #slot encoding
     * The layer's channels: `encoding.opacity`, which fades each mismatched
     * base by its base quality.
     */
    encoding: ConfigurationSchema(
      'PileupMismatchesEncoding',
      {
        /**
         * #slot encoding.opacity
         * The fade by base quality: `baseQuality`, through a linear scale.
         */
        opacity: pileupMismatchesOpacityConfigSchema,
      },
      encodingOptions,
    ),
  },
  { closed: true, plot: true },
)
