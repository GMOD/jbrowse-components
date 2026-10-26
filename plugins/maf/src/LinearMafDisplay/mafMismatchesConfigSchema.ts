import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MafMismatches
 * #category display
 * The MAF display's `alignments.mismatches` layer: how each species differs
 * from the reference, as each differing base in its own color with its
 * letter, insertion markers and deletion counts, drawn over whatever
 * `encoding.color` fills the rows with. Alignments' `pileup.mismatches`.
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', alignments: { mismatches: { show: false } } }
 * ```
 */
export const mafMismatchesConfigSchema = ConfigurationSchema(
  'MafMismatches',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description:
        'draw the differing bases, insertion markers and deletion counts',
    },
  },
  { closed: true, plot: true },
)
