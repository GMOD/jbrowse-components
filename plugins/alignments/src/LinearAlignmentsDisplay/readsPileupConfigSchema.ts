import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { pileupBasesConfigSchema } from './pileupBasesConfigSchema.ts'
import { pileupConfigSchema } from './pileupConfigSchema.ts'

/**
 * #config ReadsPileup
 * #category display
 * LinearAlignmentsDisplay's `pileup`: the [Pileup](../pileup) band with the
 * per-base layer over the reads, `bases`, which a synteny block, having no
 * qualities or basecaller tags, goes without.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   pileup: { bases: { show: true, encoding: { color: 'modifications' } } },
 * }
 * ```
 */
export const readsPileupConfigSchema = ConfigurationSchema(
  'ReadsPileup',
  {
    /**
     * #slot bases
     * The per-base layer: `show` and `encoding.color`.
     */
    bases: pileupBasesConfigSchema,
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: pileupConfigSchema,
    closed: true,
    plot: true,
  },
)
