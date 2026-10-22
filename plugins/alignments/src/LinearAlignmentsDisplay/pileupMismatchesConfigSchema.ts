import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config PileupMismatches
 * #category display
 * The pileup's `mismatches` layer: how each read differs from the reference,
 * as per-base mismatches, insertion markers and deletion bars. The line
 * joining a spliced read across its introns draws either way, since it shows
 * the exon blocks are one read (PILEUP_MARKS).
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', pileup: { mismatches: { show: false } } }
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
  },
  { closed: true },
)
